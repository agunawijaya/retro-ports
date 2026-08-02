"""Search harder for the pixel layout of the dense TAPPER.DAT records.

Stride 80 renders records 2-4 legibly but leaves 23-29 as noise, so those use a
different layout. Candidates tested here:

  plain      - rows of N bytes, straight through
  even/odd   - de-interleave byte pairs first (classic mask+data sprite storage)
  bank       - CGA-style even/odd scanline banks split at the record midpoint

Each candidate is scored by vertical coherence (how often a byte equals the byte
one row above); the winner per record is reported and rendered.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cga

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Tapper", "TAPPER.DAT")
OUT = os.path.join(ROOT, "out", "sweep")
RECORD = 2560


def coherence(buf, stride):
    n = len(buf) - stride
    if n <= 0:
        return 0.0
    return sum(1 for i in range(n) if buf[i] == buf[i + stride]) / n


def transforms(buf):
    yield "plain", buf
    yield "even", buf[0::2]
    yield "odd", buf[1::2]
    half = len(buf) // 2
    a, b = buf[:half], buf[half:]
    yield "bank", bytes(x for pair in zip(a, b) for x in pair)


def main():
    os.makedirs(OUT, exist_ok=True)
    data = open(SRC, "rb").read()
    targets = [23, 24, 25, 26, 27, 28, 29, 5, 6, 17, 18, 19]

    print(f"{'rec':>3}  {'best layout':<12} {'stride':>6} {'score':>6}   runners-up")
    print("-" * 72)
    for i in targets:
        r = data[i * RECORD:(i + 1) * RECORD]
        results = []
        for name, buf in transforms(r):
            for stride in range(4, 161):
                results.append((coherence(buf, stride), name, stride, buf))
        results.sort(key=lambda t: -t[0])
        top = results[0]
        others = "  ".join(f"{n}/{s}:{sc:.3f}" for sc, n, s, _ in results[1:4])
        print(f"{i:>3}  {top[1]:<12} {top[2]:>6} {top[0]:>6.3f}   {others}")

        rows = []
        buf, stride = top[3], top[2]
        for base in range(0, len(buf) - stride + 1, stride):
            row = []
            for x in range(stride):
                b = buf[base + x]
                for shift in (6, 4, 2, 0):
                    row.append(cga.PAL1_HI[(b >> shift) & 3])
            rows.append(row)
        cga.save_png(rows, os.path.join(OUT, f"rec{i:02d}_{top[1]}_s{stride}.png"), scale=2)


if __name__ == "__main__":
    main()
