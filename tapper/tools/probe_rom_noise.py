"""Measure which addresses play_rom_noise actually reads.

CS:3B5D opens with `or bx, 0xe000`, which aims BX at the IBM PC's real BIOS
ROM at F000:E000-FFFF. But the loop body does `inc bx` / `and bx, 0x1fff`
before the first read, which strips those bits again. Reading the code says
the OR is dead and the routine walks F000:0000-1FFF instead.

That is a claim about arithmetic, so it can be measured rather than argued.
This forces the routine to run and records ES:BX at CS:3B6E -- the
`test byte [es:bx], 1` -- which is the address about to be fetched.

The test can fail: if the OR did matter, the observed offsets would land in
0xE000-0xFFFF. If it is dead they stay under 0x2000.

    python tools/probe_rom_noise.py [boot_instructions]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from trace import Machine, LOAD_SEG  # noqa: E402
from emu8086 import BX, ES  # noqa: E402

PLAY_ROM_NOISE = 0x3B1E
TEST_INSN = 0x3B6E          # test byte [es:bx], 1
SOUND_FLAGS = 0x448E
SAMPLE_CAP = 4000


def main():
    boot = int(sys.argv[1]) if len(sys.argv) > 1 else 8_000_000
    m = Machine()
    m.load("TAPPER.COM")
    m.keys = [0x13] + [0x39] * 4000

    print(f"booting {boot:,} instructions to get an initialised machine ...")
    m.run(boot)

    # The routine is only ever called from the two death paths, which a short
    # attract-mode run never reaches, so enter it directly.
    m.cpu.wr8(LOAD_SEG, SOUND_FLAGS, m.cpu.rd8(LOAD_SEG, SOUND_FLAGS) | 1)
    m.cpu.ip = PLAY_ROM_NOISE
    print(f"forced entry at CS:{PLAY_ROM_NOISE:04X}, "
          f"sound_flags={m.cpu.rd8(LOAD_SEG, SOUND_FLAGS):#04x}")

    seen = []
    orig = m.cpu.on_exec

    def hook(cpu, seg, off):
        if orig:
            orig(cpu, seg, off)
        if seg == LOAD_SEG and off == TEST_INSN and len(seen) < SAMPLE_CAP:
            seen.append((cpu.segs[ES], cpu.regs[BX]))

    m.cpu.on_exec = hook
    m.run(30_000_000)

    if not seen:
        raise SystemExit("no reads observed -- the routine never ran")

    segs = {s for s, _ in seen}
    offs = [b for _, b in seen]
    lo, hi = min(offs), max(offs)
    print(f"\n{len(seen)} reads observed")
    print(f"  segment(s) : {', '.join(f'{s:04X}' for s in sorted(segs))}")
    print(f"  offset lo  : {lo:#06x}")
    print(f"  offset hi  : {hi:#06x}")
    print(f"  first ten  : {', '.join(f'{b:#06x}' for b in offs[:10])}")

    print()
    if hi >= 0xE000:
        print("VERDICT: the OR survives -- BX reaches the BIOS ROM window.")
    else:
        print("VERDICT: the OR is dead -- every read lands below 0x2000,")
        print("         so the noise source is F000:0000-1FFF, not the")
        print("         BIOS ROM at F000:E000-FFFF.")


if __name__ == "__main__":
    main()
