#!/usr/bin/env python3
"""decode-sound.py -- Hard Hat Mack's two sound engines, read out of the file.

The machine this ran on has one bit of audio: port 0x61, bit 1. The game drives
it two different ways.

**music_tick** is a software oscillator, and the interesting one. Each note is a
16-bit phase increment; a 16-bit accumulator is advanced by it 0x78 times per
call, and the speaker follows whether the accumulator's high byte has passed a
duty threshold. That is pulse-width modulation. The threshold is not fixed --
duty_step adds 4 to it every sample, so the pulse width sweeps the full range
every 64 samples and the timbre moves under the note. On a one-bit speaker, in
1983.

**play_tune** is the ordinary way: a divisor and a length, and a counted toggle
loop, used for the jingles between screens where nothing else needs the CPU.

The note table turns out to be a twelve-tone equal-tempered chromatic scale,
36 semitones of it, measuring +1.00 semitones a step from end to end. Solving
for the sample rate that puts note 19 on A440 gives 6,992 samples a second;
divide by the 0x78 samples a call and the game was written expecting 58.27
frames a second. Note 0 then lands on 146.81 Hz against D3's 146.83 -- two
hundredths of a hertz out, across three octaves.

    python tools/decode-sound.py
    python tools/decode-sound.py --wav out/

Needs only a copy of the game you own in original/.
"""
import argparse
import math
import struct
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
NOTE_TABLE = 0x4895
DUTY_STEP = 0x46F7
JINGLE_DIVISORS = 0x64F3

# Every stream music_push is handed, and every one play_tune is.
TUNES = {
    "idle": 0x21E6, "walking": 0x4903, "jump": 0x21F6,
    "girder_lands": 0x222E, "pickup": 0x2206, "hammer_lands": 0x221A,
    "hoist_opens": 0x2236, "ladder_top": 0x2256, "bonus_low": 0x48E9,
    "plug": 0x492F, "hoist_stops": 0x4915, "unplug": 0x4927,
    "button": 0x491D,
}
JINGLES = {
    "screen_1_done": 0x6553, "death": 0x650C, "payout": 0x6550,
    "screen_2_done": 0x651D, "screen_3_done": 0x6531, "level_up": 0x6568,
    "hoist_call": 0x6583,
}


class Rom:
    def __init__(self, path):
        self.b = Path(path).read_bytes()

    def at(self, addr):
        return addr - 0x100

    def byte(self, addr):
        return self.b[self.at(addr)]

    def word(self, addr):
        return struct.unpack_from("<H", self.b, self.at(addr))[0]

    def increment(self, note):
        """What music_tick loads for a note: ((note + 4) * 2) into note_table,
        then doubled, because the routine shifts it left before use."""
        i = ((note + 4) * 2) & 0xFF
        return (self.word(NOTE_TABLE + i) << 1) & 0xFFFF

    def stream(self, addr, limit=256):
        out = []
        for _ in range(limit):
            note, ticks = self.byte(addr), self.byte(addr + 1)
            if ticks == 0:
                break
            out.append((note, ticks))
            addr += 2
        return out

    def jingle(self, addr, limit=128):
        out = []
        for _ in range(limit):
            d, n = self.byte(addr), self.byte(addr + 1)
            if d == 0:
                break
            out.append((self.byte(JINGLE_DIVISORS + d), n))
            addr += 2
        return out


def render(rom, notes, rate):
    """The synthesiser, exactly as music_tick runs it."""
    buf = bytearray()
    acc, duty = 0, 0x70
    step = rom.byte(DUTY_STEP)
    for note, ticks in notes:
        inc = rom.increment(note)
        for _ in range(ticks):
            for _ in range(0x78):
                acc = (acc + inc) & 0xFFFF
                duty = (duty + step) & 0xFF
                buf.append(0xC0 if (acc >> 8) > duty else 0x40)
    return bytes(buf)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rom", default=str(HERE / "original" / "HHM.COM"))
    ap.add_argument("--wav", help="directory to render the streams into")
    a = ap.parse_args()

    if not Path(a.rom).exists():
        raise SystemExit(f"{a.rom} is not here. This repository ships no game "
                         f"files; put your own copy in original/.")
    rom = Rom(a.rom)

    # solve for the rate that makes note 19 concert A
    rate = 440.0 * 65536 / rom.increment(19)
    print(f"note table at 0x{NOTE_TABLE:04X}")
    print(f"  the sample rate that puts note 19 on A440: {rate:,.0f} a second")
    print(f"  0x78 samples a call, so {rate/0x78:.2f} calls a second\n")

    prev, steps = None, []
    for n in range(36):
        inc = rom.increment(n)
        f = inc * rate / 65536
        if prev:
            steps.append(12 * math.log2(inc / prev))
        print(f"  note {n:>2}  0x{inc:04X}  {f:8.2f} Hz"
              + (f"  {steps[-1]:+.2f} semitones" if steps else ""))
        prev = inc
    print(f"\n  mean {sum(steps)/len(steps):+.3f}, "
          f"worst {min(steps, key=lambda s: abs(s-1)):+.3f} to "
          f"{max(steps, key=lambda s: abs(s-1)):+.3f} -- "
          f"equal temperament wants +1.000 exactly")
    print("  notes 252 and 255 have increment 0: they are rests\n")

    print("music_tick streams -- (note, ticks)")
    for name, addr in TUNES.items():
        s = rom.stream(addr)
        print(f"  {name:<14} 0x{addr:04X}  {len(s):>2} notes  "
              + " ".join(f"{n}/{t}" for n, t in s[:12])
              + ("..." if len(s) > 12 else ""))

    print("\nplay_tune jingles -- (divisor, length)")
    for name, addr in JINGLES.items():
        s = rom.jingle(addr)
        print(f"  {name:<15} 0x{addr:04X}  {len(s):>2} notes  "
              + " ".join(f"{d}/{n}" for d, n in s[:10])
              + ("..." if len(s) > 10 else ""))

    if not a.wav:
        print("\n  (pass --wav DIR to render the streams)")
        return
    out = Path(a.wav)
    out.mkdir(parents=True, exist_ok=True)
    for name, addr in TUNES.items():
        pcm = render(rom, rom.stream(addr), rate)
        if not pcm:
            continue
        with wave.open(str(out / f"{name}.wav"), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(1)
            w.setframerate(int(rate))
            w.writeframes(pcm)
        print(f"  {name}.wav  {len(pcm)/rate:.2f}s")


main()
