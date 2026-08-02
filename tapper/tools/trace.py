"""Run TAPPER.COM under the emulator and record what static analysis cannot see.

Collected:
  * every address actually executed (honest coverage -- no decoded padding)
  * resolved targets of the indirect dispatch sites, notably the four
    `call word ptr [bx + si]` at 3BAC / 3E26 / 3E78 / 3EC9
  * every write into the CGA framebuffer at B800, tagged with the instruction
    that made it, which is how we locate the blitter

Usage:
    python trace.py [max_instructions]
"""
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu8086 import CPU, Halt, AX, BX, CX, DX, SI, DI, SP, BP, CS, DS, ES, SS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, "Tapper")
OUT = os.path.join(ROOT, "out")

LOAD_SEG = 0x1000
VIDEO_SEG = 0xB800

# Raw make-code scancodes, not ASCII: the game reads port 0x60 directly and
# compares against scancodes (0x13 = R and 0x39 = space both appear as literals
# in the key routine at CS:2F68).
#
# R used to be described here as "answers the RGB/composite prompt". It does
# not: the crack removed that prompt, and the display mode is decided by the low
# byte of the load segment instead. R is kept only because it is a key the input
# path accepts. See select_display_mode in the reconstructed source.
SC_R, SC_C, SC_SPACE, SC_ENTER = 0x13, 0x2E, 0x39, 0x1C
SC_1, SC_2, SC_3 = 0x02, 0x03, 0x04
# Arrow/motion keys on the numeric keypad, which is what a 1984 PC game used.
SC_UP, SC_DOWN, SC_LEFT, SC_RIGHT = 0x48, 0x50, 0x4B, 0x4D

# Variety matters more than realism here: distinct keys drive distinct menu
# branches and gameplay actions, and every new branch is code the reconstruction
# can turn from `db` into real instructions.
KEY_SCRIPT = ([SC_R] + [SC_SPACE] * 6 + [SC_1, SC_2, SC_3, SC_ENTER] +
              [SC_SPACE] * 4 +
              [SC_UP, SC_SPACE, SC_DOWN, SC_SPACE, SC_LEFT, SC_SPACE,
               SC_RIGHT, SC_SPACE] * 12 +
              [SC_ENTER, SC_SPACE] * 20)


class DosFile:
    def __init__(self, data):
        self.data = data
        self.pos = 0


class Machine:
    def __init__(self, trace_video=True):
        self.mem = bytearray(1 << 20)
        self.files = {}
        self.next_handle = 5
        self.keys = list(KEY_SCRIPT)
        self.ticks = 0
        self.video_mode = None
        self.exec_count = Counter()
        self.indirect = defaultdict(Counter)
        self.video_writes = Counter()
        self.video_bytes = 0
        self.ivt_writes = []
        self.scancode = 0
        self.retrace = 0
        self.keys_sent = []
        self.seen_ever = set()
        self.diag = Counter()
        self.want_key = False
        self.sprite_ptrs = Counter()
        self.trace_video = trace_video
        self.exit_code = None

        self.cpu = CPU(self.mem, stubs={
            0x10: self.int10, 0x13: self.int13, 0x16: self.int16,
            0x1A: self.int1a, 0x20: self.int20, 0x21: self.int21,
        })
        self.cpu.on_exec = self._on_exec
        self.cpu.on_write = self._on_write
        self.cpu.on_indirect = self._on_indirect

    # ---- hooks ------------------------------------------------------------

    # CS:2CE5 loads BP with the sprite's base address; by CS:2CE9 it is set and
    # has not yet been advanced by the row loop, so that is where we sample it.
    SPRITE_PROBE = 0x2CE9

    def _on_exec(self, cpu, seg, off):
        if seg == LOAD_SEG:
            self.exec_count[off] += 1
            if off == self.SPRITE_PROBE:
                self.sprite_ptrs[cpu.regs[BP]] += 1

    def _on_write(self, cpu, seg, off, val, size):
        if seg == VIDEO_SEG and self.trace_video:
            self.video_bytes += size
            if cpu.segs[CS] == LOAD_SEG:
                self.video_writes[cpu.cur_ip] += 1
        elif seg == 0 and off < 0x400:
            # Writes into the interrupt vector table. The game is a converted
            # booter and installs its own hardware handlers (keyboard IRQ in
            # particular), so this tells us which interrupts we must drive.
            self.ivt_writes.append((cpu.ip, off // 4, off % 4, val, size))

    def _on_indirect(self, cpu, kind, target):
        if cpu.segs[CS] == LOAD_SEG:
            self.indirect[(kind, cpu.cur_ip)][target] += 1

    # ---- loading ----------------------------------------------------------

    def load(self, name):
        path = os.path.join(GAME, name)
        image = open(path, "rb").read()
        base = LOAD_SEG << 4
        # Minimal PSP: INT 20h at offset 0, empty command tail.
        self.mem[base] = 0xCD
        self.mem[base + 1] = 0x20
        self.mem[base + 0x80] = 0
        self.mem[base + 0x100:base + 0x100 + len(image)] = image
        c = self.cpu
        c.segs[CS] = c.segs[DS] = c.segs[ES] = c.segs[SS] = LOAD_SEG
        c.ip = 0x100
        c.regs[SP] = 0xFFFE
        return len(image)

    def _open(self, name):
        for fn in os.listdir(GAME):
            if fn.lower() == name.lower():
                h = self.next_handle
                self.next_handle += 1
                self.files[h] = DosFile(open(os.path.join(GAME, fn), "rb").read())
                return h
        return None

    # ---- interrupt stubs --------------------------------------------------

    def int10(self, cpu):
        ah = cpu.r8(4)
        if ah == 0x00:
            self.video_mode = cpu.r8(0)
        # Other BIOS video services (cursor, scroll, teletype) are no-ops here;
        # the game draws by writing the framebuffer directly.

    def int13(self, cpu):
        cpu.cf = False                       # reset/status: always succeed

    def int16(self, cpu):
        # Only the crack's intro uses BIOS keyboard services ("press a key"),
        # and it must not consume the scancode script -- those belong to the
        # game's own INT 09h handler. Always answer with a space.
        ah = cpu.r8(4)
        if ah in (0x00, 0x10):
            cpu.w16(AX, (0x39 << 8) | 0x20)
        elif ah in (0x01, 0x11):
            cpu.w16(AX, (0x39 << 8) | 0x20)
            cpu.zf = False

    def int1a(self, cpu):
        self.ticks += 1
        cpu.w16(CX, (self.ticks >> 16) & 0xFFFF)
        cpu.w16(DX, self.ticks & 0xFFFF)
        cpu.w8(0, 0)

    def int20(self, cpu):
        self.exit_code = 0
        raise Halt("INT 20h -- program terminated")

    def int21(self, cpu):
        ah = cpu.r8(4)
        if ah == 0x3D:                                   # open
            off = cpu.regs[DX]
            name = bytearray()
            while True:
                b = cpu.rd8(cpu.segs[DS], off)
                if b == 0:
                    break
                name.append(b)
                off += 1
            h = self._open(name.decode("latin-1"))
            if h is None:
                cpu.cf, _ = True, cpu.w16(AX, 2)
            else:
                cpu.cf = False
                cpu.w16(AX, h)
        elif ah == 0x3F:                                 # read
            f = self.files.get(cpu.regs[BX])
            n = cpu.regs[CX]
            if f is None:
                cpu.cf, _ = True, cpu.w16(AX, 6)
                return
            chunk = f.data[f.pos:f.pos + n]
            f.pos += len(chunk)
            dst_seg, dst_off = cpu.segs[DS], cpu.regs[DX]
            for i, b in enumerate(chunk):
                cpu.wr8(dst_seg, (dst_off + i) & 0xFFFF, b)
            cpu.cf = False
            cpu.w16(AX, len(chunk))
        elif ah == 0x42:                                 # lseek
            f = self.files.get(cpu.regs[BX])
            if f is None:
                cpu.cf, _ = True, cpu.w16(AX, 6)
                return
            pos = (cpu.regs[CX] << 16) | cpu.regs[DX]
            al = cpu.r8(0)
            f.pos = pos if al == 0 else (f.pos + pos if al == 1 else len(f.data) + pos)
            cpu.cf = False
            cpu.w16(AX, f.pos & 0xFFFF)
            cpu.w16(DX, (f.pos >> 16) & 0xFFFF)
        elif ah == 0x3E:                                 # close
            self.files.pop(cpu.regs[BX], None)
            cpu.cf = False
        elif ah == 0x25:                                 # set interrupt vector
            cpu.wr16(0, cpu.r8(0) * 4, cpu.regs[DX])
            cpu.wr16(0, cpu.r8(0) * 4 + 2, cpu.segs[DS])
        elif ah == 0x35:                                 # get interrupt vector
            n = cpu.r8(0)
            cpu.w16(BX, cpu.rd16(0, n * 4))
            cpu.segs[ES] = cpu.rd16(0, n * 4 + 2)
        elif ah == 0x2C:                                 # get time
            cpu.w16(CX, 0x0C00)
            cpu.w16(DX, 0)
        elif ah == 0x4C:
            self.exit_code = cpu.r8(0)
            raise Halt("INT 21h AH=4Ch -- program terminated")
        else:
            cpu.cf = False

    # ---- run --------------------------------------------------------------

    def port_read(self, cpu, port, size):
        if port == 0x60:
            return self.scancode
        if port == 0x61:
            return 0
        if port == 0x3DA:
            # CGA status: toggle the vertical-retrace bit so any wait-for-
            # retrace loop makes progress instead of spinning forever.
            self.retrace ^= 0x09
            return self.retrace
        return 0

    def screenshot(self, path, scale=2):
        """Decode the live CGA framebuffer to PNG.

        Being able to see what the program is actually displaying is the
        difference between navigating its menus and guessing at them.
        """
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import cga
        base = VIDEO_SEG << 4
        page = bytes(self.mem[base:base + 16384])
        cga.save_png(cga.decode_2bpp(page, palette=cga.PAL1_HI), path, scale=scale)
        return page

    def run(self, limit, timer_period=20000, shots=None, shot_dir=None):
        """Drive the machine, supplying the hardware interrupts a booter needs.

        The game installs its own INT 09h and INT 1Ch handlers and blocks on a
        keyboard ring buffer those handlers fill, so without injection it spins
        forever. Rather than feeding keys on a fixed timer, we detect that the
        program has stopped making progress -- a tight loop touching only a
        handful of addresses -- and deliver a keystroke then. That way each key
        lands where the program is actually waiting for one.

        Interrupts are only delivered while the program has them enabled, so we
        never re-enter a handler.
        """
        c = self.cpu
        c.port_in = self.port_read
        next_timer = timer_period
        window, window_start = set(), 0
        WINDOW = 40000
        shots = sorted(shots or [])
        shot_i = 0
        try:
            while c.icount < limit:
                c.step()
                window.add(c.cur_ip)

                if c.icount >= next_timer and c.if_:
                    next_timer = c.icount + timer_period
                    if c.rd16(0, 0x1C * 4) or c.rd16(0, 0x1C * 4 + 2):
                        c.interrupt(0x1C)

                if c.icount - window_start >= WINDOW:
                    # "Spin loop" is the wrong signal: the timer handler fires
                    # every 20k instructions and touches enough addresses to
                    # make any window look busy. Progress means reaching code
                    # never executed before -- if none appeared, we are waiting.
                    stalled = not (window - self.seen_ever)
                    self.seen_ever |= window
                    window, window_start = set(), c.icount
                    self.diag["windows"] += 1
                    self.diag["stalled"] += 1 if stalled else 0
                    if stalled:
                        self.want_key = True

                # The program runs with interrupts masked most of the time and
                # only briefly opens a window, so an IRQ cannot be delivered at
                # some fixed instant -- we have to arm the request and fire on
                # the first instruction where interrupts are actually enabled.
                if self.want_key and c.if_ and self.keys and (
                        c.rd16(0, 9 * 4) or c.rd16(0, 9 * 4 + 2)):
                    self.want_key = False
                    self.scancode = self.keys.pop(0)
                    self.keys_sent.append((c.icount, self.scancode))
                    c.interrupt(9)

                if shot_i < len(shots) and c.icount >= shots[shot_i]:
                    if shot_dir:
                        self.screenshot(os.path.join(
                            shot_dir, f"frame_{shots[shot_i]//1000:06d}k.png"))
                    shot_i += 1
        except Halt as e:
            return str(e)
        except Exception as e:
            return f"{type(e).__name__} at {c.segs[CS]:04X}:{c.ip:04X}: {e}"
        return f"instruction limit ({limit}) reached"


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 3_000_000
    m = Machine()
    size = m.load("TAPPER.COM")
    print(f"loaded TAPPER.COM ({size} bytes) at {LOAD_SEG:04X}:0100")

    shot_dir = os.path.join(OUT, "frames")
    os.makedirs(shot_dir, exist_ok=True)
    marks = [int(limit * f) for f in (0.05, 0.15, 0.3, 0.5, 0.7, 0.85, 1.0)]
    reason = m.run(limit, shots=marks, shot_dir=shot_dir)
    print(f"stopped: {reason}")
    print(f"instructions executed: {m.cpu.icount:,}")
    print(f"video mode set: {m.video_mode}")
    print(f"bytes written to B800: {m.video_bytes:,}")

    print(f"\ndistinct code addresses executed: {len(m.exec_count)}")
    if m.keys_sent:
        print("keys delivered: " + ", ".join(
            f"{sc:02X}h@{ic//1000}k" for ic, sc in m.keys_sent))
    else:
        print("keys delivered: none")
    print(f"injection diagnostics: {dict(m.diag)}")
    if m.indirect:
        print("\nresolved indirect dispatch:")
        for (kind, site), targets in sorted(m.indirect.items(), key=lambda k: k[0][1]):
            tl = ", ".join(f"{t:04X}({n}x)" for t, n in targets.most_common(8))
            print(f"  {kind:5} at CS:{site:04X} -> {tl}")
    else:
        print("\nno indirect dispatch reached yet")

    if m.ivt_writes:
        vecs = {}
        for ip, vec, part, val, size in m.ivt_writes:
            slot = vecs.setdefault(vec, {})
            if size == 2:
                slot["off" if part == 0 else "seg"] = val
            else:
                slot.setdefault("bytes", []).append((part, val))
            slot["by"] = ip
        print("\ninterrupt vectors installed by the program:")
        for vec in sorted(vecs):
            v = vecs[vec]
            desc = {0x08: "timer IRQ0", 0x09: "keyboard IRQ1",
                    0x1C: "timer tick", 0x80: "disk shim (crack)"}.get(vec, "")
            print(f"  INT {vec:02X}h -> {v.get('seg', 0):04X}:{v.get('off', 0):04X}"
                  f"   (written by CS:{v['by']:04X}) {desc}")

    if m.video_writes:
        print("\ntop instructions writing to the framebuffer:")
        for ip, n in m.video_writes.most_common(12):
            print(f"  CS:{ip:04X}  {n:,} writes")

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "executed.txt")
    with open(path, "w") as f:
        for addr in sorted(m.exec_count):
            f.write(f"{addr:04X} {m.exec_count[addr]}\n")
    print(f"\nwrote {path}")


if __name__ == "__main__":
    main()
