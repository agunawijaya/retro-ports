#!/usr/bin/env python3
"""Export composed Karateka animation frames as transparent PNGs.

This is different from export_dos_sprites.py:

* export_dos_sprites.py dumps the low-level DOS shape table.
* this script reads ALLPAL/ALLGAL/ALLVAL and composes the shapes into usable
  character frames, then crops each frame to its non-transparent bounds.

The result is much closer to "sprites" as a remake or sprite-sheet workflow
expects them.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

from extract_karateka import CGA_PALETTE, SpritePack, decode_shape, load_pack


BASE_PAIRS = [
    ("KM0", "KS0"), ("KMI0", "KSI0"),
    ("KM1", "KS1"), ("KMI1", "KSI1"),
    ("KM2", "KS2"), ("KMI2", "KSI2"), ("KMJ2", "KSJ2"),
    ("KM3", "KS3"), ("KMI3", "KSI3"),
    ("KM4", "KS4"), ("KMI4", "KSI4"), ("KMJ4", "KSJ4"),
    ("KMC", "KSC"), ("KMI", "KSI"),
]

SCRIPT_PAIR_ORDER = {
    # Player animation lists mostly use common body pieces plus player pack
    # pieces. Put KMC first to avoid low-byte collisions such as shape 0x66.
    "ALLPAL": [("KMC", "KSC"), ("KM0", "KS0"), ("KMI0", "KSI0")],
    # Guard lists use common body pieces plus guard-tier pieces.
    "ALLGAL": [("KMC", "KSC"), ("KM1", "KS1"), ("KM2", "KS2"), ("KM3", "KS3"), ("KM0", "KS0")],
    # Villain/Akuma lists use common body pieces plus character-4 packs.
    "ALLVAL": [("KMC", "KSC"), ("KM4", "KS4"), ("KMI4", "KSI4"), ("KMJ4", "KSJ4")],
}


@dataclass
class ShapeRef:
    shape: int
    x: int
    y: int


@dataclass
class Anim:
    name: str
    frames: list[list[ShapeRef]] = field(default_factory=list)


class SpriteIndex:
    def __init__(self, game_dir: Path):
        self.packs: dict[str, SpritePack] = {}
        for pack_name in {name for pair in BASE_PAIRS for name in pair}:
            if (game_dir / f"{pack_name}.IND").exists() and (game_dir / f"{pack_name}.DAT").exists():
                self.packs[pack_name] = load_pack(game_dir / pack_name)

        self.by_low: dict[str, dict[int, object]] = {}
        for name, pack in self.packs.items():
            m = {}
            for entry in pack.index:
                if entry.sprite_id != 0xFFFF:
                    m.setdefault(entry.sprite_id & 0xFF, entry)
            self.by_low[name] = m

    def resolve(self, shape: int, pair_order: list[tuple[str, str]] | None = None):
        low = shape & 0xFF
        ordered = list(pair_order or []) + [pair for pair in BASE_PAIRS if pair not in (pair_order or [])]
        for mask_name, pixel_name in ordered:
            mask_pack = self.packs.get(mask_name)
            pixel_pack = self.packs.get(pixel_name)
            if not mask_pack or not pixel_pack:
                continue
            mask_entry = self.by_low.get(mask_name, {}).get(low)
            pixel_entry = self.by_low.get(pixel_name, {}).get(low)
            if mask_entry and pixel_entry:
                return mask_pack.dat, mask_entry.offset, pixel_pack.dat, pixel_entry.offset
        return None


def parse_set_pos_label(line: str) -> str | None:
    if not line.startswith("set_pos,"):
        return None
    parts = line.split()
    if len(parts) >= 3:
        return parts[2].strip()
    return None


def parse_set_fig(line: str) -> ShapeRef | None:
    if not line.startswith("set_fig,"):
        return None
    rest = line.split(",", 1)[1].strip()
    nums = []
    for token in rest.split():
        try:
            nums.append(int(token))
        except ValueError:
            break
    if len(nums) < 3:
        return None
    return ShapeRef(nums[0], nums[1], nums[2])


def parse_all_style(path: Path) -> list[Anim]:
    """Parse ALLPAL/ALLGAL/ALLVAL style animation lists.

    A labeled set_pos starts one named animation. Later unlabeled set_pos lines
    start additional frames within the same animation. end_animation closes it.
    """
    animations: list[Anim] = []
    current: Anim | None = None
    current_frame: list[ShapeRef] = []
    anon_counter = 0

    def flush_frame() -> None:
        nonlocal current_frame
        if current is not None and current_frame:
            current.frames.append(current_frame)
        current_frame = []

    def flush_anim() -> None:
        nonlocal current, current_frame
        flush_frame()
        if current is not None and current.frames:
            animations.append(current)
        current = None
        current_frame = []

    for raw in path.read_text(errors="replace").splitlines():
        line = raw.strip().rstrip(",")
        if not line:
            continue
        if line.startswith("set_pos,"):
            label = parse_set_pos_label(line)
            if current is None:
                if not label:
                    label = f"{path.stem.lower()}_{anon_counter:03d}"
                    anon_counter += 1
                current = Anim(label)
            elif label:
                flush_anim()
                current = Anim(label)
            else:
                flush_frame()
            continue
        if line.startswith("end_animation"):
            flush_anim()
            continue
        ref = parse_set_fig(line)
        if ref is not None:
            if current is None:
                current = Anim(f"{path.stem.lower()}_{anon_counter:03d}")
                anon_counter += 1
            current_frame.append(ref)

    flush_anim()
    return animations


def draw_shape(
    canvas: Image.Image,
    sprites: SpriteIndex,
    ref: ShapeRef,
    origin: int,
    pair_order: list[tuple[str, str]] | None,
) -> bool:
    resolved = sprites.resolve(ref.shape, pair_order)
    if resolved is None:
        return False
    mask_dat, mask_off, pixel_dat, pixel_off = resolved
    wm, hm, mask = decode_shape(mask_dat, mask_off)
    wp, hp, pixel = decode_shape(pixel_dat, pixel_off)
    if wm <= 0 or hm <= 0 or (wm, hm) != (wp, hp):
        return False

    px = canvas.load()
    top_left_x = ref.x + origin
    top_left_y = ref.y - hm + 1 + origin

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
                x_out = top_left_x + xb * 4 + sub
                y_out = top_left_y + y
                if 0 <= x_out < canvas.width and 0 <= y_out < canvas.height:
                    r, g, b = CGA_PALETTE[mask_bits]
                    px[x_out, y_out] = (r, g, b, 255)
    return True


def render_frame(
    sprites: SpriteIndex,
    refs: list[ShapeRef],
    pair_order: list[tuple[str, str]] | None = None,
) -> Image.Image:
    origin = 128
    canvas = Image.new("RGBA", (576, 456), (0, 0, 0, 0))
    for ref in refs:
        draw_shape(canvas, sprites, ref, origin, pair_order)
    bbox = canvas.getbbox()
    if not bbox:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    return canvas.crop(bbox)


def write_contact_sheet(folder: Path, anim: Anim, image_names: list[str]) -> None:
    cells = []
    for i, image_name in enumerate(image_names):
        cells.append(
            "<figure>"
            f"<a href='{image_name}'><img src='{image_name}'></a>"
            f"<figcaption>{i:02d}</figcaption>"
            "</figure>"
        )
    html = (
        "<!doctype html><meta charset='utf-8'>"
        f"<title>{anim.name}</title>"
        "<style>"
        "body{font:13px system-ui,sans-serif;background:#202020;color:#eee;margin:24px}"
        ".grid{display:flex;flex-wrap:wrap;gap:28px;align-items:flex-start}"
        "figure{margin:0;text-align:center;color:#bbb}"
        "img{image-rendering:pixelated;transform:scale(4);transform-origin:top left;"
        "margin:0 96px 112px 0;background-size:8px 8px;"
        "background-image:linear-gradient(45deg,#777 25%,transparent 25%),"
        "linear-gradient(-45deg,#777 25%,transparent 25%),"
        "linear-gradient(45deg,transparent 75%,#777 75%),"
        "linear-gradient(-45deg,transparent 75%,#777 75%);"
        "background-position:0 0,0 4px,4px -4px,-4px 0}"
        "a{color:#8fd}"
        "</style>"
        f"<h1>{anim.name}</h1>"
        f"<p>{len(image_names)} composed transparent frame(s), cropped to alpha bounds.</p>"
        "<div class='grid'>"
        + "".join(cells)
        + "</div>"
    )
    (folder / "index.html").write_text(html, encoding="utf-8")


def write_preview_sheet(folder: Path, image_names: list[str], scale: int = 4) -> None:
    if not image_names:
        return
    thumbs: list[Image.Image] = []
    for image_name in image_names:
        img = Image.open(folder / image_name).convert("RGBA")
        if scale != 1:
            img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
        tile = Image.new("RGBA", (max(48, img.width + 8), max(72, img.height + 8)), (48, 48, 48, 255))
        tile.alpha_composite(img, ((tile.width - img.width) // 2, (tile.height - img.height) // 2))
        thumbs.append(tile)

    cols = min(8, len(thumbs))
    rows = (len(thumbs) + cols - 1) // cols
    cell_w = max(t.width for t in thumbs)
    cell_h = max(t.height for t in thumbs)
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), (32, 32, 32, 255))
    for i, thumb in enumerate(thumbs):
        x = (i % cols) * cell_w
        y = (i // cols) * cell_h
        sheet.alpha_composite(thumb, (x, y))
    sheet.save(folder / "_sheet.png")


def export_file(game_dir: Path, out_dir: Path, script_name: str, sprites: SpriteIndex) -> list[Anim]:
    script_path = game_dir / script_name
    animations = parse_all_style(script_path)
    script_out = out_dir / script_path.stem
    script_out.mkdir(parents=True, exist_ok=True)
    pair_order = SCRIPT_PAIR_ORDER.get(script_path.stem)

    for anim in animations:
        safe_name = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in anim.name)
        anim_out = script_out / safe_name
        anim_out.mkdir(parents=True, exist_ok=True)
        image_names = []
        for i, refs in enumerate(anim.frames):
            img = render_frame(sprites, refs, pair_order)
            name = f"frame_{i:02d}.png"
            img.save(anim_out / name)
            image_names.append(name)
        write_preview_sheet(anim_out, image_names)
        write_contact_sheet(anim_out, anim, image_names)
    return animations


def write_top_index(out_dir: Path, exported: dict[str, list[Anim]]) -> None:
    rows = []
    for script_name, animations in exported.items():
        rows.append(f"<h2>{script_name}</h2><ul>")
        for anim in animations:
            safe_name = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in anim.name)
            rows.append(
                f"<li><a href='{Path(script_name).stem}/{safe_name}/index.html'>{anim.name}</a> "
                f"({len(anim.frames)} frames)</li>"
            )
        rows.append("</ul>")
    html = (
        "<!doctype html><meta charset='utf-8'>"
        "<title>Karateka composed animations</title>"
        "<style>body{font:14px system-ui,sans-serif;background:#202020;color:#eee;margin:24px}"
        "a{color:#8fd} h2{margin-top:28px}</style>"
        "<h1>Karateka composed animation frames</h1>"
        "<p>These are assembled from script set_fig groups, not raw shape dumps.</p>"
        + "".join(rows)
    )
    (out_dir / "index.html").write_text(html, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--game-dir", default=".")
    parser.add_argument("--out", default="extracted/composed_animations")
    parser.add_argument("--scripts", nargs="*", default=["ALLPAL", "ALLGAL", "ALLVAL"])
    args = parser.parse_args()

    game_dir = Path(args.game_dir).resolve()
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    sprites = SpriteIndex(game_dir)
    exported: dict[str, list[Anim]] = {}
    total_frames = 0
    for script_name in args.scripts:
        animations = export_file(game_dir, out_dir, script_name, sprites)
        exported[script_name] = animations
        frame_count = sum(len(anim.frames) for anim in animations)
        total_frames += frame_count
        print(f"{script_name}: {len(animations)} animations, {frame_count} frames")

    write_top_index(out_dir, exported)
    print(f"Total: {total_frames} composed frames")
    print(f"Open {out_dir / 'index.html'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
