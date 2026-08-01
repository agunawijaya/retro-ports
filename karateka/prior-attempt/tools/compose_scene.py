"""Parse a Karateka animation script and render the scene as a PNG sequence.

Script syntax (decoded from disasm + file inspection):
    set_fig,SHAPE X Y [label]    place a static figure
    chg_fig,N SHAPE X Y          replace actor #N's shape
    do_scr,                       render current state (one frame)
    wait,N                        wait N ticks (no render)
    set_tune,N                    music — ignore for rendering
    init_sal,                     scene init — ignore
    end_animation,                end of script

Each rendered frame is composited onto a 320×200 CGA canvas using sprite
data from all K* packs.  Shape numbers in the script are 8-bit lowbytes;
the actual 16-bit sprite ID is found by searching every pack for an entry
whose ID low-byte matches (and then preferring KS<x>/KSC/KSI variants for
pixel data, KM<x>/KMC/KMI variants for mask).

Output: per script, a row of PNGs (one per do_scr frame) plus an HTML
contact sheet.
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))
from extract_karateka import (
    load_pack, decode_shape, CGA_PALETTE, _checker_bg, SpritePack
)
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
OUT  = HERE / "extracted" / "scenes"
OUT.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Sprite lookup across all packs
# ---------------------------------------------------------------------------

class SpriteIndex:
    """Resolve a script's 8-bit shape number to actual sprite bytes.

    For each unique low-byte we try a few mask/pixel pack pairs, falling
    back to whatever pack has the ID if the preferred ones don't.
    """

    # Preferred pack pairs in resolution order.
    PAIRS = [
        ("KM0", "KS0"), ("KMI0", "KSI0"), ("KMJ2", "KSJ2"),
        ("KM1", "KS1"), ("KM2", "KS2"), ("KM3", "KS3"), ("KM4", "KS4"),
        ("KMI1", "KSI1"), ("KMI2", "KSI2"), ("KMI3", "KSI3"), ("KMI4", "KSI4"),
        ("KMJ4", "KSJ4"), ("KMC", "KSC"), ("KMI", "KSI"),
    ]

    def __init__(self, game_dir: Path):
        self.packs: dict[str, SpritePack] = {}
        for name in {p for pair in self.PAIRS for p in pair}:
            ind = game_dir / f"{name}.IND"
            dat = game_dir / f"{name}.DAT"
            if ind.exists() and dat.exists():
                self.packs[name] = load_pack(game_dir / name)
        # Build per-pack {low_byte: (full_id, entry)} maps
        self.by_lowbyte = {}
        for name, pack in self.packs.items():
            m = {}
            for e in pack.index:
                if e.sprite_id == 0xFFFF: continue
                m.setdefault(e.sprite_id & 0xFF, e)
            self.by_lowbyte[name] = m
        print(f"  Loaded {len(self.packs)} sprite packs")

    def resolve(self, low_byte: int):
        """Return (mask_dat, mask_off, pixel_dat, pixel_off, has_mask) or None.

        `has_mask` is True only when BOTH a mask (KM*) and pixel (KS*) source
        were found — that's a real character/animation sprite that needs
        transparency.  When False (only a KS* found), the shape is treated
        as opaque scenery and rendered directly without a transparency mask.
        """
        for mask_name, pixel_name in self.PAIRS:
            mp = self.packs.get(mask_name)
            pp = self.packs.get(pixel_name)
            if not mp or not pp: continue
            mb = self.by_lowbyte.get(mask_name, {})
            pb = self.by_lowbyte.get(pixel_name, {})
            if low_byte in mb and low_byte in pb:
                me = mb[low_byte]
                pe = pb[low_byte]
                return mp.dat, me.offset, pp.dat, pe.offset, True
        # Scenery / KS-only path: any KS* pack that has the sprite
        for ks_name in ("KS0","KS1","KS2","KS3","KS4","KSC","KSI",
                        "KSI0","KSI1","KSI2","KSI3","KSI4","KSJ2","KSJ4"):
            pp = self.packs.get(ks_name)
            if not pp: continue
            e = self.by_lowbyte.get(ks_name, {}).get(low_byte)
            if e is not None:
                return pp.dat, e.offset, pp.dat, e.offset, False
        # Fallback: any pack at all (treat as opaque)
        for name, pack in self.packs.items():
            e = self.by_lowbyte[name].get(low_byte)
            if e is not None:
                return pack.dat, e.offset, pack.dat, e.offset, False
        return None


# ---------------------------------------------------------------------------
# Script parser
# ---------------------------------------------------------------------------

@dataclass
class Cmd:
    op: str
    args: list[int]
    label: str = ""


def parse_script(path: Path) -> list[Cmd]:
    cmds = []
    for line_raw in path.read_text(errors="replace").splitlines():
        line = line_raw.strip()
        if not line:
            continue
        if "," not in line:
            continue
        op, rest = line.split(",", 1)
        op = op.strip()
        rest = rest.strip()
        # Some entries trail with a label like "bal00" — split off non-numeric
        nums, label = [], ""
        for tok in rest.split():
            try:
                nums.append(int(tok))
            except ValueError:
                label = tok
                break
        cmds.append(Cmd(op=op, args=nums, label=label))
    return cmds


# ---------------------------------------------------------------------------
# Renderer
# ---------------------------------------------------------------------------

@dataclass
class Actor:
    shape: int   # script shape number
    x: int
    y: int

@dataclass
class Scene:
    bg_pieces: list[Actor] = field(default_factory=list)
    actors:    dict[int, Actor] = field(default_factory=dict)


def draw_sprite_at(canvas_px, canvas_w, canvas_h, sprites: SpriteIndex,
                   shape: int, ax: int, ay: int, fallback_log: list[str]):
    res = sprites.resolve(shape & 0xFF)
    if res is None:
        fallback_log.append(f"shape {shape} not found in any pack")
        return False
    mask_dat, mask_off, pixel_dat, pixel_off, has_mask = res
    wm, hm, mask = decode_shape(mask_dat, mask_off)
    if wm == 0 or hm == 0: return False
    if has_mask:
        wp, hp, pixel = decode_shape(pixel_dat, pixel_off)
        if (wp, hp) != (wm, hm):
            pixel = pixel + bytes(max(0, wm * hm - len(pixel)))
    else:
        # Opaque scenery — no separate pixel stream; "mask" IS the colour data
        pixel = bytes(wm * hm)         # placeholder zeros
    top_left_x = ax
    top_left_y = ay - hm + 1
    for ry in range(hm):
        for xb in range(wm):
            idx = ry * wm + xb
            m = mask[idx]
            p = pixel[idx] if idx < len(pixel) else 0
            for sub in range(4):
                shift = (3 - sub) * 2
                mb = (m >> shift) & 0b11
                if has_mask:
                    pb = (p >> shift) & 0b11
                    if (mb | pb) == 0: continue
                    colour = mb
                else:
                    # Opaque scenery: every non-zero pixel is drawn AS-IS
                    if mb == 0: continue
                    colour = mb
                px = top_left_x + xb * 4 + sub
                py = top_left_y + ry
                if 0 <= px < canvas_w and 0 <= py < canvas_h:
                    canvas_px[px, py] = CGA_PALETTE[colour]
    return True


def render_scene(scene: Scene, sprites: SpriteIndex, w=320, h=200,
                 fallback_log=None, sky_color=None) -> Image.Image:
    """Render scene with optional cyan-sky fill for outdoor scenes."""
    bg = sky_color if sky_color else (0, 0, 0)
    img = Image.new("RGB", (w, h), bg)
    px = img.load()
    if fallback_log is None: fallback_log = []
    for piece in scene.bg_pieces:
        draw_sprite_at(px, w, h, sprites, piece.shape, piece.x, piece.y, fallback_log)
    for actor in scene.actors.values():
        draw_sprite_at(px, w, h, sprites, actor.shape, actor.x, actor.y, fallback_log)
    return img


def play_script(script_path: Path, sprites: SpriteIndex, scale=3,
                sky_color=None) -> tuple[list[Image.Image], list[str]]:
    cmds = parse_script(script_path)
    scene = Scene()
    frames: list[Image.Image] = []
    log: list[str] = []
    for cmd in cmds:
        if cmd.op == "set_fig" and len(cmd.args) >= 3:
            shape, x, y = cmd.args[0], cmd.args[1], cmd.args[2]
            scene.bg_pieces.append(Actor(shape, x, y))
        elif cmd.op == "chg_fig" and len(cmd.args) >= 4:
            n, shape, x, y = cmd.args[0], cmd.args[1], cmd.args[2], cmd.args[3]
            scene.actors[n] = Actor(shape, x, y)
        elif cmd.op == "do_scr":
            frame = render_scene(scene, sprites, fallback_log=log, sky_color=sky_color)
            if scale != 1:
                frame = frame.resize((frame.width*scale, frame.height*scale), Image.NEAREST)
            frames.append(frame)
    if not frames:
        frame = render_scene(scene, sprites, fallback_log=log, sky_color=sky_color)
        if scale != 1:
            frame = frame.resize((frame.width*scale, frame.height*scale), Image.NEAREST)
        frames.append(frame)
    return frames, log


def main():
    print("Loading sprite packs...")
    sprites = SpriteIndex(HERE)

    # Outdoor scripts get cyan sky; indoor (throne) get black.
    CYAN = (0x55, 0xFF, 0xFF)
    BLACK = (0, 0, 0)
    scripts_to_try = [
        ("CAL01", BLACK),  # throne room
        ("CAL02", BLACK),  # throne / princess
        ("CAL03", CYAN),   # outdoor cliff
        ("CAL04", CYAN),
        ("CAL05", CYAN),   # gate + karateka outdoor
        ("CAL06", CYAN),
        ("CAL07", BLACK),  # throne
        ("BAL00", BLACK),
        ("BAL01", BLACK),
        ("BAL03", CYAN),
        ("BAL03A", CYAN), ("BAL03B", CYAN), ("BAL03C", CYAN),
        ("BAL03D", CYAN), ("BAL03E", CYAN), ("BAL03F", CYAN),
    ]

    rows = []
    for name, sky in scripts_to_try:
        path = HERE / name
        if not path.exists(): continue
        print(f"\n== {name}  sky={sky} ==")
        frames, log = play_script(path, sprites, sky_color=sky)
        print(f"   {len(frames)} frame(s)")
        if log:
            for entry in sorted(set(log))[:6]:
                print(f"   [warn] {entry}")
        scene_dir = OUT / name
        scene_dir.mkdir(parents=True, exist_ok=True)
        frame_paths = []
        for i, frame in enumerate(frames):
            p = scene_dir / f"frame_{i:02d}.png"
            frame.save(p)
            frame_paths.append(p.name)
        # Save an animated GIF too, if there are 2+ frames
        gif_path = None
        if len(frames) > 1:
            gif_path = scene_dir / "animation.gif"
            frames[0].save(gif_path, save_all=True, append_images=frames[1:],
                           duration=120, loop=0, disposal=2)
        rows.append((name, frame_paths, scene_dir, gif_path))

    # Build HTML index
    html = ["<!doctype html><meta charset=utf-8><title>Karateka scenes</title>",
            "<style>body{font:13px sans-serif;background:#111;color:#eee;margin:24px}"
            "h2{color:#f8d56c;margin-top:32px}"
            ".row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}"
            ".row img{image-rendering:pixelated;border:1px solid #333;max-width:220px}</style>",
            "<h1>Karateka — composed scenes from animation scripts</h1>",
            "<p>Each row is one script played back; one image per <code>do_scr</code> frame.</p>"]
    for name, paths, scene_dir, gif_path in rows:
        html.append(f"<h2>{name}  <small>({len(paths)} frames)</small></h2>")
        if gif_path:
            html.append(f'<div><img src="scenes/{name}/{gif_path.name}" '
                        'style="image-rendering:pixelated;border:2px solid #555;max-width:640px"></div>')
        html.append('<div class="row">')
        for fp in paths:
            html.append(f'<a href="scenes/{name}/{fp}"><img src="scenes/{name}/{fp}"></a>')
        html.append("</div>")
    (HERE / "extracted" / "SCENES.html").write_text("\n".join(html), encoding="utf-8")
    print(f"\nDone. Open: {HERE / 'extracted' / 'SCENES.html'}")


if __name__ == "__main__":
    main()
