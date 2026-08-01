#!/usr/bin/env python3
"""Export Karateka DOS sprite packs as transparent PNGs.

This uses the decoded DOS shape format from extract_karateka.py:

    .IND row       = <sprite_id:u16le> <offset:u16le>
    shape header   = <width_bytes> <height> <anchor>
    RLE opcode     = 0x7B <data> <count>
    pair combine   = (shadow & ~pixel_stream) | mask_stream

The exported PNGs are individual DOS "shape" sprites, not reconstructed
animation timelines. Animation/cutscene scripts such as CAL05 compose these
shapes on screen.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from extract_karateka import CGA_PALETTE, decode_shape, load_pack


PAIR_NAMES = [
    ("KM0", "KS0"),
    ("KM1", "KS1"),
    ("KM2", "KS2"),
    ("KM3", "KS3"),
    ("KM4", "KS4"),
    ("KMC", "KSC"),
    ("KMI", "KSI"),
    ("KMI0", "KSI0"),
    ("KMI1", "KSI1"),
    ("KMI2", "KSI2"),
    ("KMI3", "KSI3"),
    ("KMI4", "KSI4"),
    ("KMJ2", "KSJ2"),
    ("KMJ4", "KSJ4"),
]


@dataclass(frozen=True)
class ExportedSprite:
    sprite_id: int
    filename: str
    width: int
    height: int
    source: str


def compose_rgba(mask_dat: bytes, mask_off: int, pixel_dat: bytes, pixel_off: int) -> Image.Image | None:
    """Return one transparent RGBA sprite from a mask/pixel stream pair."""
    wm, hm, mask = decode_shape(mask_dat, mask_off)
    wp, hp, pixel = decode_shape(pixel_dat, pixel_off)
    if wm <= 0 or hm <= 0 or (wm, hm) != (wp, hp):
        return None

    img = Image.new("RGBA", (wm * 4, hm), (0, 0, 0, 0))
    px = img.load()
    for y in range(hm):
        for xb in range(wm):
            idx = y * wm + xb
            m = mask[idx]
            p = pixel[idx]
            for sub in range(4):
                shift = (3 - sub) * 2
                mask_bits = (m >> shift) & 0b11
                pixel_bits = (p >> shift) & 0b11
                if (mask_bits | pixel_bits) == 0:
                    continue
                r, g, b = CGA_PALETTE[mask_bits]
                px[xb * 4 + sub, y] = (r, g, b, 255)
    return img


def export_pair(game_dir: Path, out_dir: Path, mask_name: str, pixel_name: str) -> list[ExportedSprite]:
    mask_pack = load_pack(game_dir / mask_name)
    pixel_pack = load_pack(game_dir / pixel_name)
    pixel_by_id = {entry.sprite_id: entry for entry in pixel_pack.index if entry.sprite_id != 0xFFFF}

    pair_dir = out_dir / f"{mask_name}_paired_{pixel_name}"
    pair_dir.mkdir(parents=True, exist_ok=True)

    exported: list[ExportedSprite] = []
    for mask_entry in mask_pack.index:
        if mask_entry.sprite_id == 0xFFFF:
            continue
        pixel_entry = pixel_by_id.get(mask_entry.sprite_id)
        if pixel_entry is None:
            continue

        img = compose_rgba(mask_pack.dat, mask_entry.offset, pixel_pack.dat, pixel_entry.offset)
        if img is None:
            continue

        filename = f"id{mask_entry.sprite_id:04X}.png"
        img.save(pair_dir / filename)
        exported.append(
            ExportedSprite(
                sprite_id=mask_entry.sprite_id,
                filename=filename,
                width=img.width,
                height=img.height,
                source=f"{mask_name}:{mask_entry.offset} + {pixel_name}:{pixel_entry.offset}",
            )
        )

    write_pair_index(pair_dir, f"{mask_name} + {pixel_name}", exported)
    return exported


def write_pair_index(pair_dir: Path, title: str, sprites: list[ExportedSprite]) -> None:
    rows = []
    for sprite in sprites:
        rows.append(
            "<tr>"
            f"<td>0x{sprite.sprite_id:04X}</td>"
            f"<td>{sprite.width}x{sprite.height}</td>"
            f"<td>{sprite.source}</td>"
            f"<td><a href='{sprite.filename}'><img src='{sprite.filename}'></a></td>"
            "</tr>"
        )

    html = (
        "<!doctype html><meta charset='utf-8'>"
        f"<title>{title}</title>"
        "<style>"
        "body{font:13px system-ui,sans-serif;background:#1f1f1f;color:#eee;margin:24px}"
        "table{border-collapse:collapse}"
        "td,th{padding:6px 10px;border-bottom:1px solid #444;vertical-align:top}"
        "img{image-rendering:pixelated;transform:scale(4);transform-origin:top left;"
        "margin:0 96px 96px 0;background-size:8px 8px;"
        "background-image:linear-gradient(45deg,#777 25%,transparent 25%),"
        "linear-gradient(-45deg,#777 25%,transparent 25%),"
        "linear-gradient(45deg,transparent 75%,#777 75%),"
        "linear-gradient(-45deg,transparent 75%,#777 75%);"
        "background-position:0 0,0 4px,4px -4px,-4px 0}"
        "code{color:#9ee}"
        "</style>"
        f"<h1>{title}</h1>"
        "<p>Transparent PNG export. Each sprite is one DOS shape decoded from "
        "<code>0x7B &lt;data&gt; &lt;count&gt;</code> RLE and composed from mask/pixel streams.</p>"
        "<table><tr><th>ID</th><th>size</th><th>source offsets</th><th>preview x4</th></tr>"
        + "".join(rows)
        + "</table>"
    )
    (pair_dir / "index.html").write_text(html, encoding="utf-8")


def write_top_index(out_dir: Path, totals: dict[str, int]) -> None:
    items = []
    for pair, count in totals.items():
        items.append(f"<li><a href='{pair}/index.html'>{pair}</a> - {count} PNGs</li>")
    html = (
        "<!doctype html><meta charset='utf-8'>"
        "<title>Karateka DOS transparent sprites</title>"
        "<style>body{font:14px system-ui,sans-serif;background:#1f1f1f;color:#eee;margin:24px}"
        "a{color:#8fd}</style>"
        "<h1>Karateka DOS transparent sprites</h1>"
        "<p>These are extracted shape sprites. Full animation frames are composed by the CAL/BAL/ALL scripts.</p>"
        "<ul>"
        + "".join(items)
        + "</ul>"
    )
    (out_dir / "index.html").write_text(html, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--game-dir", default=".", help="Directory containing KARATEKA.EXE and K*.DAT/K*.IND")
    parser.add_argument("--out", default="extracted/transparent_sprites", help="Output directory")
    args = parser.parse_args()

    game_dir = Path(args.game_dir).resolve()
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    totals: dict[str, int] = {}
    for mask_name, pixel_name in PAIR_NAMES:
        if not (game_dir / f"{mask_name}.DAT").exists():
            continue
        if not (game_dir / f"{pixel_name}.DAT").exists():
            continue
        exported = export_pair(game_dir, out_dir, mask_name, pixel_name)
        pair = f"{mask_name}_paired_{pixel_name}"
        totals[pair] = len(exported)
        print(f"{pair}: {len(exported)} PNGs")

    write_top_index(out_dir, totals)
    print(f"Open {out_dir / 'index.html'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
