"""Estimate the row stride of each TAPPER.DAT record.

Bitmap data is vertically coherent: byte i and byte i+stride belong to pixels
directly above/below each other and therefore agree far more often than chance.
Sweeping candidate strides and scoring that agreement recovers the row width
without having to guess it from the rendered image.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Tapper", "TAPPER.DAT")
RECORD = 2560
MIN_STRIDE, MAX_STRIDE = 2, 160


def score(buf, stride):
    """Fraction of byte pairs one stride apart that match exactly."""
    n = len(buf) - stride
    if n <= 0:
        return 0.0
    return sum(1 for i in range(n) if buf[i] == buf[i + stride]) / n


def best_strides(buf, top=4, skip=0):
    body = buf[skip:]
    baseline = score(body, 1)
    ranked = sorted(
        ((score(body, s), s) for s in range(MIN_STRIDE, MAX_STRIDE + 1)),
        reverse=True,
    )
    return baseline, ranked[:top]


def main():
    data = open(SRC, "rb").read()
    n = len(data) // RECORD
    # Records often open with a small header (dimensions or an offset table);
    # skipping a few bytes keeps it from polluting the correlation.
    for skip in (0,):
        print(f"stride estimate (skipping {skip} header bytes)")
        print(f"{'rec':>3} {'lag1':>6}   top strides (score)")
        print("-" * 62)
        for i in range(n):
            r = data[i * RECORD:(i + 1) * RECORD]
            baseline, top = best_strides(r, skip=skip)
            cells = "  ".join(f"{s:>3}:{sc:.3f}" for sc, s in top)
            print(f"{i:>3} {baseline:>6.3f}   {cells}")


if __name__ == "__main__":
    main()
