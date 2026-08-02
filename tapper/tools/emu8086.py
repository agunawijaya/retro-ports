"""Minimal 8086 real-mode interpreter, sized for running TAPPER.COM.

Why this exists: static recursive descent tops out around 73% of the image and
cannot resolve the four `call word ptr [bx + si]` sites, whose targets are
computed at run time. Executing the program resolves them exactly, and records
only instructions that really run -- no zero-padding decoded as `add [bx+si],al`.

Scope is deliberately the 8086 subset this game uses (see the mnemonic histogram
in the project notes), not a complete or cycle-accurate CPU. Interrupts are
dispatched through the real interrupt vector table so that handlers the program
installs itself -- notably the INT 80h disk shim at CS:0135 -- execute as real
code; only vectors with no installed handler fall back to a Python stub.
"""

# Register file indices, matching the ModR/M encoding order.
AX, CX, DX, BX, SP, BP, SI, DI = range(8)
ES, CS, SS, DS = range(4)
_REG16 = ("ax", "cx", "dx", "bx", "sp", "bp", "si", "di")
_SEG = ("es", "cs", "ss", "ds")

PARITY = [bin(i).count("1") % 2 == 0 for i in range(256)]


class Halt(Exception):
    """Raised by a stub to stop execution (program exit)."""


class CPU:
    def __init__(self, mem, stubs=None):
        self.mem = mem
        self.regs = [0] * 8
        self.segs = [0] * 4
        self.ip = 0
        self.cf = self.pf = self.af = self.zf = False
        self.sf = self.tf = self.if_ = self.df = self.of = False
        self.stubs = stubs or {}
        self.halted = False
        self.icount = 0
        self.cur_ip = 0
        # Set by the fetch loop each instruction; consumed by address decoding.
        self._seg_override = None
        self._rep = None
        # Hooks: called as fn(cpu, ...) -- see trace.py.
        self.on_exec = None
        self.on_write = None
        self.on_indirect = None
        self.port_in = None
        self.port_out = None

    # ---- memory -----------------------------------------------------------

    def _phys(self, seg, off):
        return ((seg << 4) + (off & 0xFFFF)) & 0xFFFFF

    def rd8(self, seg, off):
        return self.mem[self._phys(seg, off)]

    def rd16(self, seg, off):
        p = self._phys(seg, off)
        return self.mem[p] | (self.mem[(p + 1) & 0xFFFFF] << 8)

    def wr8(self, seg, off, v):
        p = self._phys(seg, off)
        self.mem[p] = v & 0xFF
        if self.on_write:
            self.on_write(self, seg, off, v & 0xFF, 1)

    def wr16(self, seg, off, v):
        p = self._phys(seg, off)
        self.mem[p] = v & 0xFF
        self.mem[(p + 1) & 0xFFFFF] = (v >> 8) & 0xFF
        if self.on_write:
            self.on_write(self, seg, off, v & 0xFFFF, 2)

    # ---- register access --------------------------------------------------

    def r16(self, i):
        return self.regs[i]

    def w16(self, i, v):
        self.regs[i] = v & 0xFFFF

    def r8(self, i):
        return (self.regs[i & 3] >> (8 if i & 4 else 0)) & 0xFF

    def w8(self, i, v):
        r = i & 3
        if i & 4:
            self.regs[r] = (self.regs[r] & 0x00FF) | ((v & 0xFF) << 8)
        else:
            self.regs[r] = (self.regs[r] & 0xFF00) | (v & 0xFF)

    # ---- instruction fetch ------------------------------------------------

    def fetch8(self):
        v = self.rd8(self.segs[CS], self.ip)
        self.ip = (self.ip + 1) & 0xFFFF
        return v

    def fetch16(self):
        v = self.rd16(self.segs[CS], self.ip)
        self.ip = (self.ip + 2) & 0xFFFF
        return v

    def fetch_s8(self):
        v = self.fetch8()
        return v - 256 if v & 0x80 else v

    # ---- ModR/M -----------------------------------------------------------

    def modrm(self):
        """Decode a ModR/M byte. Returns (mod, reg, rm, seg, off).

        For mod==3 the operand is a register and (seg, off) is (None, rm).
        """
        b = self.fetch8()
        mod, reg, rm = b >> 6, (b >> 3) & 7, b & 7
        if mod == 3:
            return mod, reg, rm, None, rm

        r = self.regs
        # BP-relative modes default to the stack segment.
        if rm == 0:
            base, dseg = r[BX] + r[SI], DS
        elif rm == 1:
            base, dseg = r[BX] + r[DI], DS
        elif rm == 2:
            base, dseg = r[BP] + r[SI], SS
        elif rm == 3:
            base, dseg = r[BP] + r[DI], SS
        elif rm == 4:
            base, dseg = r[SI], DS
        elif rm == 5:
            base, dseg = r[DI], DS
        elif rm == 6:
            if mod == 0:
                base, dseg = self.fetch16(), DS
            else:
                base, dseg = r[BP], SS
        else:
            base, dseg = r[BX], DS

        if mod == 1:
            base += self.fetch_s8()
        elif mod == 2:
            base += self.fetch16()

        seg = self._seg_override if self._seg_override is not None else dseg
        return mod, reg, rm, self.segs[seg], base & 0xFFFF

    def read_rm(self, mod, rm, seg, off, size):
        if mod == 3:
            return self.r16(rm) if size == 2 else self.r8(rm)
        return self.rd16(seg, off) if size == 2 else self.rd8(seg, off)

    def write_rm(self, mod, rm, seg, off, size, v):
        if mod == 3:
            (self.w16 if size == 2 else self.w8)(rm, v)
        else:
            (self.wr16 if size == 2 else self.wr8)(seg, off, v)

    # ---- flags ------------------------------------------------------------

    def _szp(self, v, size):
        mask = 0xFFFF if size == 2 else 0xFF
        self.zf = (v & mask) == 0
        self.sf = bool(v & (0x8000 if size == 2 else 0x80))
        self.pf = PARITY[v & 0xFF]

    def op_add(self, a, b, size, carry=0):
        mask = 0xFFFF if size == 2 else 0xFF
        sign = 0x8000 if size == 2 else 0x80
        r = a + b + carry
        self.cf = r > mask
        self.af = ((a ^ b ^ r) & 0x10) != 0
        self.of = bool(~(a ^ b) & (a ^ r) & sign)
        r &= mask
        self._szp(r, size)
        return r

    def op_sub(self, a, b, size, borrow=0):
        mask = 0xFFFF if size == 2 else 0xFF
        sign = 0x8000 if size == 2 else 0x80
        r = a - b - borrow
        self.cf = r < 0
        self.af = ((a ^ b ^ r) & 0x10) != 0
        self.of = bool((a ^ b) & (a ^ r) & sign)
        r &= mask
        self._szp(r, size)
        return r

    def op_logic(self, r, size):
        self.cf = self.of = self.af = False
        self._szp(r, size)
        return r

    @property
    def flags(self):
        f = 0xF002
        for bit, val in ((0, self.cf), (2, self.pf), (4, self.af), (6, self.zf),
                         (7, self.sf), (8, self.tf), (9, self.if_),
                         (10, self.df), (11, self.of)):
            if val:
                f |= 1 << bit
        return f

    @flags.setter
    def flags(self, f):
        self.cf, self.pf, self.af = bool(f & 1), bool(f & 4), bool(f & 0x10)
        self.zf, self.sf, self.tf = bool(f & 0x40), bool(f & 0x80), bool(f & 0x100)
        self.if_, self.df, self.of = bool(f & 0x200), bool(f & 0x400), bool(f & 0x800)

    # ---- stack ------------------------------------------------------------

    def push(self, v):
        self.w16(SP, self.regs[SP] - 2)
        self.wr16(self.segs[SS], self.regs[SP], v)

    def pop(self):
        v = self.rd16(self.segs[SS], self.regs[SP])
        self.w16(SP, self.regs[SP] + 2)
        return v

    # ---- interrupts -------------------------------------------------------

    def interrupt(self, n):
        """Dispatch through the IVT; fall back to a Python stub if unhooked."""
        vec_off = self.rd16(0, n * 4)
        vec_seg = self.rd16(0, n * 4 + 2)
        if vec_seg or vec_off:
            self.push(self.flags)
            self.push(self.segs[CS])
            self.push(self.ip)
            self.if_ = self.tf = False
            self.segs[CS], self.ip = vec_seg, vec_off
            return
        stub = self.stubs.get(n)
        if stub is None:
            raise Halt(f"unhandled INT {n:02X}h at {self.segs[CS]:04X}:{self.ip:04X}")
        stub(self)

    def cond(self, code):
        """Evaluate a Jcc condition code (low nibble of the opcode)."""
        c = code >> 1
        r = (self.of, self.cf, self.zf, self.cf or self.zf, self.sf, self.pf,
             self.sf != self.of, self.zf or (self.sf != self.of))[c]
        return (not r) if (code & 1) else r

    # ---- ALU dispatch -----------------------------------------------------

    def alu(self, kind, a, b, size):
        """kind: 0 add, 1 or, 2 adc, 3 sbb, 4 and, 5 sub, 6 xor, 7 cmp.

        Returns the result, or None for cmp (flags only).
        """
        if kind == 0:
            return self.op_add(a, b, size)
        if kind == 1:
            return self.op_logic(a | b, size)
        if kind == 2:
            return self.op_add(a, b, size, 1 if self.cf else 0)
        if kind == 3:
            return self.op_sub(a, b, size, 1 if self.cf else 0)
        if kind == 4:
            return self.op_logic(a & b, size)
        if kind == 5:
            return self.op_sub(a, b, size)
        if kind == 6:
            return self.op_logic(a ^ b, size)
        self.op_sub(a, b, size)
        return None

    def shift(self, kind, v, n, size):
        """kind: 0 rol, 1 ror, 2 rcl, 3 rcr, 4 shl, 5 shr, 7 sar."""
        mask = 0xFFFF if size == 2 else 0xFF
        bits = 16 if size == 2 else 8
        sign = 1 << (bits - 1)
        n &= 0x1F
        if n == 0:
            return v
        for _ in range(n):
            if kind == 0:
                self.cf = bool(v & sign)
                v = ((v << 1) | (1 if self.cf else 0)) & mask
            elif kind == 1:
                self.cf = bool(v & 1)
                v = ((v >> 1) | (sign if self.cf else 0)) & mask
            elif kind == 2:
                c = 1 if self.cf else 0
                self.cf = bool(v & sign)
                v = ((v << 1) | c) & mask
            elif kind == 3:
                c = sign if self.cf else 0
                self.cf = bool(v & 1)
                v = ((v >> 1) | c) & mask
            elif kind == 4:
                self.cf = bool(v & sign)
                v = (v << 1) & mask
            elif kind == 5:
                self.cf = bool(v & 1)
                v = (v >> 1) & mask
            else:
                self.cf = bool(v & 1)
                v = ((v >> 1) | (v & sign)) & mask
        if kind in (4, 5, 6, 7):
            self._szp(v, size)
        self.of = False
        return v

    # ---- string primitives ------------------------------------------------

    def _str_step(self, size):
        d = -size if self.df else size
        self.w16(SI, self.regs[SI] + d)
        self.w16(DI, self.regs[DI] + d)

    def string_op(self, op, size):
        """Execute one iteration of a string instruction."""
        sseg = self._seg_override
        src = self.segs[sseg] if sseg is not None else self.segs[DS]
        es = self.segs[ES]
        d = -size if self.df else size
        if op == 0xA4 or op == 0xA5:                      # movs
            v = self.read_mem(src, self.regs[SI], size)
            self.write_mem(es, self.regs[DI], size, v)
            self._str_step(size)
        elif op == 0xA6 or op == 0xA7:                    # cmps
            a = self.read_mem(src, self.regs[SI], size)
            b = self.read_mem(es, self.regs[DI], size)
            self.op_sub(a, b, size)
            self._str_step(size)
        elif op == 0xAA or op == 0xAB:                    # stos
            v = self.regs[AX] if size == 2 else self.r8(0)
            self.write_mem(es, self.regs[DI], size, v)
            self.w16(DI, self.regs[DI] + d)
        elif op == 0xAC or op == 0xAD:                    # lods
            v = self.read_mem(src, self.regs[SI], size)
            if size == 2:
                self.w16(AX, v)
            else:
                self.w8(0, v)
            self.w16(SI, self.regs[SI] + d)
        else:                                             # scas
            a = self.regs[AX] if size == 2 else self.r8(0)
            b = self.read_mem(es, self.regs[DI], size)
            self.op_sub(a, b, size)
            self.w16(DI, self.regs[DI] + d)

    def read_mem(self, seg, off, size):
        return self.rd16(seg, off) if size == 2 else self.rd8(seg, off)

    def write_mem(self, seg, off, size, v):
        (self.wr16 if size == 2 else self.wr8)(seg, off, v)

    # ---- main loop --------------------------------------------------------

    def step(self):
        self._seg_override = None
        self._rep = None
        # Address of the instruction being executed. self.ip advances during
        # decode, so hooks must use this rather than reading self.ip, or they
        # attribute every memory write to the *following* instruction.
        self.cur_ip = self.ip
        if self.on_exec:
            self.on_exec(self, self.segs[CS], self.ip)
        while True:
            op = self.fetch8()
            if op in (0x26, 0x2E, 0x36, 0x3E):
                self._seg_override = (op >> 3) & 3
            elif op == 0xF0:
                pass                                      # lock: no effect here
            elif op in (0xF2, 0xF3):
                self._rep = op
            else:
                break
        self.execute(op)
        self.icount += 1

    def execute(self, op):
        r = self.regs

        # --- ALU r/m and immediate forms (0x00-0x3F) ---
        if op < 0x40 and (op & 7) < 6:
            kind = (op >> 3) & 7
            form = op & 7
            size = 2 if form & 1 else 1
            if form < 4:
                mod, reg, rm, seg, off = self.modrm()
                a_rm = self.read_rm(mod, rm, seg, off, size)
                a_r = self.r16(reg) if size == 2 else self.r8(reg)
                if form < 2:                              # rm, reg
                    res = self.alu(kind, a_rm, a_r, size)
                    if res is not None:
                        self.write_rm(mod, rm, seg, off, size, res)
                else:                                     # reg, rm
                    res = self.alu(kind, a_r, a_rm, size)
                    if res is not None:
                        (self.w16 if size == 2 else self.w8)(reg, res)
            else:                                         # acc, imm
                imm = self.fetch16() if size == 2 else self.fetch8()
                acc = r[AX] if size == 2 else self.r8(0)
                res = self.alu(kind, acc, imm, size)
                if res is not None:
                    (self.w16 if size == 2 else self.w8)(0 if size == 1 else AX, res)
            return

        if 0x40 <= op <= 0x47:                            # inc r16
            i = op & 7
            cf = self.cf
            self.w16(i, self.op_add(r[i], 1, 2))
            self.cf = cf
            return
        if 0x48 <= op <= 0x4F:                            # dec r16
            i = op & 7
            cf = self.cf
            self.w16(i, self.op_sub(r[i], 1, 2))
            self.cf = cf
            return
        if 0x50 <= op <= 0x57:
            self.push(r[op & 7])
            return
        if 0x58 <= op <= 0x5F:
            self.w16(op & 7, self.pop())
            return
        if op in (0x06, 0x0E, 0x16, 0x1E):                # push sreg
            self.push(self.segs[(op >> 3) & 3])
            return
        if op in (0x07, 0x17, 0x1F):                      # pop sreg
            self.segs[(op >> 3) & 3] = self.pop()
            return
        if 0x70 <= op <= 0x7F:                            # Jcc rel8
            d = self.fetch_s8()
            if self.cond(op & 0x0F):
                self.ip = (self.ip + d) & 0xFFFF
            return

        if op in (0x80, 0x81, 0x83):                      # grp1 rm, imm
            size = 1 if op == 0x80 else 2
            mod, reg, rm, seg, off = self.modrm()
            a = self.read_rm(mod, rm, seg, off, size)
            if op == 0x81:
                imm = self.fetch16()
            elif op == 0x83:
                imm = self.fetch_s8() & 0xFFFF
            else:
                imm = self.fetch8()
            res = self.alu(reg, a, imm, size)
            if res is not None:
                self.write_rm(mod, rm, seg, off, size, res)
            return
        if op in (0x84, 0x85):                            # test rm, reg
            size = 2 if op & 1 else 1
            mod, reg, rm, seg, off = self.modrm()
            a = self.read_rm(mod, rm, seg, off, size)
            b = self.r16(reg) if size == 2 else self.r8(reg)
            self.op_logic(a & b, size)
            return
        if op in (0x86, 0x87):                            # xchg rm, reg
            size = 2 if op & 1 else 1
            mod, reg, rm, seg, off = self.modrm()
            a = self.read_rm(mod, rm, seg, off, size)
            b = self.r16(reg) if size == 2 else self.r8(reg)
            self.write_rm(mod, rm, seg, off, size, b)
            (self.w16 if size == 2 else self.w8)(reg, a)
            return
        if 0x88 <= op <= 0x8B:                            # mov
            size = 2 if op & 1 else 1
            mod, reg, rm, seg, off = self.modrm()
            if op < 0x8A:
                v = self.r16(reg) if size == 2 else self.r8(reg)
                self.write_rm(mod, rm, seg, off, size, v)
            else:
                v = self.read_rm(mod, rm, seg, off, size)
                (self.w16 if size == 2 else self.w8)(reg, v)
            return
        if op == 0x8C:                                    # mov rm, sreg
            mod, reg, rm, seg, off = self.modrm()
            self.write_rm(mod, rm, seg, off, 2, self.segs[reg & 3])
            return
        if op == 0x8E:                                    # mov sreg, rm
            mod, reg, rm, seg, off = self.modrm()
            self.segs[reg & 3] = self.read_rm(mod, rm, seg, off, 2)
            return
        if op == 0x8D:                                    # lea
            mod, reg, rm, seg, off = self.modrm()
            self.w16(reg, off)
            return
        if op == 0x8F:                                    # pop rm
            mod, reg, rm, seg, off = self.modrm()
            self.write_rm(mod, rm, seg, off, 2, self.pop())
            return
        if op == 0x90:
            return
        if 0x91 <= op <= 0x97:                            # xchg ax, r16
            i = op & 7
            r[AX], r[i] = r[i], r[AX]
            return
        if op == 0x98:                                    # cbw
            self.w16(AX, self.r8(0) | (0xFF00 if self.r8(0) & 0x80 else 0))
            return
        if op == 0x99:                                    # cwd
            self.w16(DX, 0xFFFF if r[AX] & 0x8000 else 0)
            return
        if op == 0x9A:                                    # call far
            off = self.fetch16()
            seg = self.fetch16()
            self.push(self.segs[CS])
            self.push(self.ip)
            self.segs[CS], self.ip = seg, off
            return
        if op == 0x9C:
            self.push(self.flags)
            return
        if op == 0x9D:
            self.flags = self.pop()
            return
        if op == 0x9E:                                    # sahf
            self.flags = (self.flags & 0xFF00) | self.r8(4)
            return
        if op == 0x9F:                                    # lahf
            self.w8(4, self.flags & 0xFF)
            return
        if 0xA0 <= op <= 0xA3:                            # mov acc, moffs
            size = 2 if op & 1 else 1
            off = self.fetch16()
            sseg = self._seg_override
            seg = self.segs[sseg] if sseg is not None else self.segs[DS]
            if op < 0xA2:
                v = self.read_mem(seg, off, size)
                (self.w16 if size == 2 else self.w8)(0 if size == 1 else AX, v)
            else:
                v = r[AX] if size == 2 else self.r8(0)
                self.write_mem(seg, off, size, v)
            return
        if op in (0xA8, 0xA9):                            # test acc, imm
            size = 2 if op & 1 else 1
            imm = self.fetch16() if size == 2 else self.fetch8()
            acc = r[AX] if size == 2 else self.r8(0)
            self.op_logic(acc & imm, size)
            return
        if op in (0xA4, 0xA5, 0xA6, 0xA7, 0xAA, 0xAB, 0xAC, 0xAD, 0xAE, 0xAF):
            size = 2 if op & 1 else 1
            if self._rep is None:
                self.string_op(op, size)
                return
            cmp_like = op in (0xA6, 0xA7, 0xAE, 0xAF)
            while r[CX]:
                self.string_op(op, size)
                self.w16(CX, r[CX] - 1)
                if cmp_like:
                    # F3 = repe, F2 = repne
                    if (self._rep == 0xF3) != self.zf:
                        break
            return
        if 0xB0 <= op <= 0xB7:
            self.w8(op & 7, self.fetch8())
            return
        if 0xB8 <= op <= 0xBF:
            self.w16(op & 7, self.fetch16())
            return
        if op in (0xC2, 0xC3):                            # ret [imm16]
            n = self.fetch16() if op == 0xC2 else 0
            self.ip = self.pop()
            self.w16(SP, r[SP] + n)
            return
        if op in (0xCA, 0xCB):                            # retf [imm16]
            n = self.fetch16() if op == 0xCA else 0
            self.ip = self.pop()
            self.segs[CS] = self.pop()
            self.w16(SP, r[SP] + n)
            return
        if op in (0xC4, 0xC5):                            # les / lds
            mod, reg, rm, seg, off = self.modrm()
            self.w16(reg, self.rd16(seg, off))
            self.segs[ES if op == 0xC4 else DS] = self.rd16(seg, off + 2)
            return
        if op in (0xC6, 0xC7):                            # mov rm, imm
            size = 2 if op & 1 else 1
            mod, reg, rm, seg, off = self.modrm()
            imm = self.fetch16() if size == 2 else self.fetch8()
            self.write_rm(mod, rm, seg, off, size, imm)
            return
        if op == 0xCC:
            self.interrupt(3)
            return
        if op == 0xCD:
            self.interrupt(self.fetch8())
            return
        if op == 0xCF:                                    # iret
            self.ip = self.pop()
            self.segs[CS] = self.pop()
            self.flags = self.pop()
            return
        if 0xD0 <= op <= 0xD3:                            # shift group
            size = 2 if op & 1 else 1
            mod, reg, rm, seg, off = self.modrm()
            v = self.read_rm(mod, rm, seg, off, size)
            n = 1 if op < 0xD2 else self.r8(1)
            self.write_rm(mod, rm, seg, off, size, self.shift(reg, v, n, size))
            return
        if op == 0xD7:                                    # xlat
            sseg = self._seg_override
            seg = self.segs[sseg] if sseg is not None else self.segs[DS]
            self.w8(0, self.rd8(seg, r[BX] + self.r8(0)))
            return
        if 0xE0 <= op <= 0xE2:                            # loopne/loope/loop
            d = self.fetch_s8()
            self.w16(CX, r[CX] - 1)
            take = r[CX] != 0
            if op == 0xE0:
                take = take and not self.zf
            elif op == 0xE1:
                take = take and self.zf
            if take:
                self.ip = (self.ip + d) & 0xFFFF
            return
        if op == 0xE3:                                    # jcxz
            d = self.fetch_s8()
            if r[CX] == 0:
                self.ip = (self.ip + d) & 0xFFFF
            return
        if op == 0xE8:                                    # call rel16
            d = self.fetch16()
            self.push(self.ip)
            self.ip = (self.ip + (d - 65536 if d & 0x8000 else d)) & 0xFFFF
            return
        if op == 0xE9:                                    # jmp rel16
            d = self.fetch16()
            self.ip = (self.ip + (d - 65536 if d & 0x8000 else d)) & 0xFFFF
            return
        if op == 0xEA:                                    # jmp far
            off = self.fetch16()
            self.segs[CS] = self.fetch16()
            self.ip = off
            return
        if op == 0xEB:                                    # jmp rel8
            d = self.fetch_s8()
            self.ip = (self.ip + d) & 0xFFFF
            return
        if op in (0xE4, 0xE5, 0xE6, 0xE7, 0xEC, 0xED, 0xEE, 0xEF):
            # Port I/O. Writes (CGA registers, PIC end-of-interrupt) are inert,
            # but reads matter: the keyboard handler reads a scancode from
            # port 0x60, so a hook has to supply it.
            port = self.fetch8() if op in (0xE4, 0xE5, 0xE6, 0xE7) else r[DX]
            size = 2 if op & 1 else 1
            if op in (0xE4, 0xE5, 0xEC, 0xED):
                v = self.port_in(self, port, size) if self.port_in else 0
                (self.w16 if size == 2 else self.w8)(AX if size == 2 else 0, v)
            elif self.port_out:
                self.port_out(self, port, r[AX] if size == 2 else self.r8(0), size)
            return
        if op == 0xF4:
            raise Halt("hlt")
        if op == 0xF5:
            self.cf = not self.cf
            return
        if op in (0xF6, 0xF7):                            # grp3
            size = 2 if op & 1 else 1
            mod, reg, rm, seg, off = self.modrm()
            v = self.read_rm(mod, rm, seg, off, size)
            if reg == 0 or reg == 1:                      # test rm, imm
                imm = self.fetch16() if size == 2 else self.fetch8()
                self.op_logic(v & imm, size)
            elif reg == 2:                                # not
                self.write_rm(mod, rm, seg, off, size,
                              ~v & (0xFFFF if size == 2 else 0xFF))
            elif reg == 3:                                # neg
                self.write_rm(mod, rm, seg, off, size, self.op_sub(0, v, size))
            elif reg == 4:                                # mul
                if size == 1:
                    res = self.r8(0) * v
                    self.w16(AX, res)
                    self.cf = self.of = res > 0xFF
                else:
                    res = r[AX] * v
                    self.w16(AX, res & 0xFFFF)
                    self.w16(DX, (res >> 16) & 0xFFFF)
                    self.cf = self.of = res > 0xFFFF
            elif reg == 5:                                # imul
                def sx(x, s):
                    b = 8 * s
                    return x - (1 << b) if x & (1 << (b - 1)) else x
                if size == 1:
                    res = sx(self.r8(0), 1) * sx(v, 1)
                    self.w16(AX, res & 0xFFFF)
                else:
                    res = sx(r[AX], 2) * sx(v, 2)
                    self.w16(AX, res & 0xFFFF)
                    self.w16(DX, (res >> 16) & 0xFFFF)
                self.cf = self.of = not (-128 <= res < 128 if size == 1
                                         else -32768 <= res < 32768)
            elif reg == 6:                                # div
                if v == 0:
                    raise Halt("divide by zero")
                if size == 1:
                    n = r[AX]
                    self.w8(0, (n // v) & 0xFF)
                    self.w8(4, n % v)
                else:
                    n = (r[DX] << 16) | r[AX]
                    self.w16(AX, (n // v) & 0xFFFF)
                    self.w16(DX, n % v)
            else:                                         # idiv
                if v == 0:
                    raise Halt("divide by zero")
                if size == 1:
                    n = r[AX] - 0x10000 if r[AX] & 0x8000 else r[AX]
                    d = v - 256 if v & 0x80 else v
                    self.w8(0, int(n / d) & 0xFF)
                    self.w8(4, (n - int(n / d) * d) & 0xFF)
                else:
                    n = (r[DX] << 16) | r[AX]
                    if n & 0x80000000:
                        n -= 1 << 32
                    d = v - 65536 if v & 0x8000 else v
                    self.w16(AX, int(n / d) & 0xFFFF)
                    self.w16(DX, (n - int(n / d) * d) & 0xFFFF)
            return
        if op == 0xF8:
            self.cf = False
            return
        if op == 0xF9:
            self.cf = True
            return
        if op == 0xFA:
            self.if_ = False
            return
        if op == 0xFB:
            self.if_ = True
            return
        if op == 0xFC:
            self.df = False
            return
        if op == 0xFD:
            self.df = True
            return
        if op in (0xFE, 0xFF):                            # grp4 / grp5
            size = 2 if op & 1 else 1
            mod, reg, rm, seg, off = self.modrm()
            v = self.read_rm(mod, rm, seg, off, size)
            if reg == 0:
                cf = self.cf
                self.write_rm(mod, rm, seg, off, size, self.op_add(v, 1, size))
                self.cf = cf
            elif reg == 1:
                cf = self.cf
                self.write_rm(mod, rm, seg, off, size, self.op_sub(v, 1, size))
                self.cf = cf
            elif reg == 2:                                # call rm
                if self.on_indirect:
                    self.on_indirect(self, "call", v)
                self.push(self.ip)
                self.ip = v
            elif reg == 3:                                # call far [rm]
                nip, ncs = self.rd16(seg, off), self.rd16(seg, off + 2)
                if self.on_indirect:
                    self.on_indirect(self, "callf", nip)
                self.push(self.segs[CS])
                self.push(self.ip)
                self.segs[CS], self.ip = ncs, nip
            elif reg == 4:                                # jmp rm
                if self.on_indirect:
                    self.on_indirect(self, "jmp", v)
                self.ip = v
            elif reg == 5:                                # jmp far [rm]
                nip, ncs = self.rd16(seg, off), self.rd16(seg, off + 2)
                if self.on_indirect:
                    self.on_indirect(self, "jmpf", nip)
                self.segs[CS], self.ip = ncs, nip
            else:                                         # push rm
                self.push(v)
            return

        # The BCD adjust group. These were left out on the assumption that
        # "hitting one means we followed a bad branch" -- which turned out to be
        # wrong. add_score keeps the score as packed BCD and adjusts with DAA at
        # CS:3156, so the whole scoring path was simply unreachable under
        # emulation until state injection took the bar-cleared bonus branch and
        # halted here.
        if op in (0x27, 0x2F):                            # DAA / DAS
            sub = op == 0x2F
            old_al, old_cf = self.r8(0), self.cf
            al = old_al
            low = (al & 0x0F) > 9 or self.af
            if low:
                al = al - 6 if sub else al + 6
                self.af = True
            else:
                self.af = False
            top = old_al > 0x99 or old_cf
            if top:
                al = al - 0x60 if sub else al + 0x60
            # Intel's pseudocode reassigns CF in the second step, so the
            # low-nibble carry only survives on DAS, where the borrow out of
            # AL - 6 is kept.
            self.cf = top or (sub and low and old_al < 6)
            self.w8(0, al & 0xFF)
            self._szp(al & 0xFF, 1)
            return
        if op in (0x37, 0x3F):                            # AAA / AAS
            if (self.r8(0) & 0x0F) > 9 or self.af:
                delta = -6 if op == 0x3F else 6
                self.w8(0, (self.r8(0) + delta) & 0xFF)
                self.w8(4, (self.r8(4) + (-1 if op == 0x3F else 1)) & 0xFF)
                self.af = self.cf = True
            else:
                self.af = self.cf = False
            self.w8(0, self.r8(0) & 0x0F)
            return

        raise Halt(f"unimplemented opcode {op:02X}h at "
                   f"{self.segs[CS]:04X}:{(self.ip - 1) & 0xFFFF:04X}")
