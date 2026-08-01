"""Side-by-side compare: in-game hero crop  vs  decoded sprite 0x014A.

Pull the karateka silhouette out of boot_seq22.png at native CGA resolution
(undo DOSBox-X upscale), then place it next to the decoder output at the
same scale.  If the decoder is correct, the two should be pixel-identical
(modulo the redraw ghost in the live capture).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from extract_karateka import load_pack, decode_shape, CGA_PALETTE, _checker_bg
from PIL import Image

here = Path(__file__).parent
extracted = here / "extracted"

# 1. Load the in-game screenshot.  The DOSBox-X title bar+menu is roughly
#    the top 60 pixels; the game canvas occupies the rest.
shot = Image.open(extracted / "boot_seq22.png")
print(f"Screenshot size: {shot.size}")
# Crop to the game canvas (skip title bar + menu)
top_chrome = 60
game = shot.crop((0, top_chrome, shot.width, shot.height))
# Downsample to native CGA 320×200
native = game.resize((320, 200), Image.NEAREST)
native.save(extracted / "boot_seq22_native.png")
print(f"Native-CGA crop saved: 320x200")

# 2. Find the hero.  Looking at the screenshot, the karateka silhouette
#    is roughly at native x≈140..170, y≈110..160 — let's grab a 32×48 window
#    around that.
hero_crop = native.crop((88, 110, 120, 158))   # ~32×48 around the karateka silhouette
hero_crop_8x = hero_crop.resize((hero_crop.width*8, hero_crop.height*8), Image.NEAREST)
hero_crop_8x.save(extracted / "hero_ingame_8x.png")
print(f"In-game hero crop (8x): {hero_crop_8x.size}")

# 3. Decode sprite 0x014A from KM0 + KS0 with full composite logic
pack_m = load_pack(here / "KM0")
pack_p = load_pack(here / "KS0")
em = next(e for e in pack_m.index if e.sprite_id == 0x014A)
ep = next(e for e in pack_p.index if e.sprite_id == 0x014A)
wm, hm, mask  = decode_shape(pack_m.dat, em.offset)
_,  _,  pixel = decode_shape(pack_p.dat, ep.offset)
print(f"Decoded sprite 0x014A: {wm*4}x{hm} px")

# 4. Render the decoded sprite onto a checker background at 8x scale
img = _checker_bg(wm * 4, hm, cell=2)
px = img.load()
for y in range(hm):
    for xb in range(wm):
        idx = y * wm + xb
        m = mask[idx]
        p = pixel[idx]
        for sub in range(4):
            shift = (3 - sub) * 2
            mb = (m >> shift) & 0b11
            pb = (p >> shift) & 0b11
            if (mb | pb) == 0:
                continue          # transparent
            px[xb * 4 + sub, y] = CGA_PALETTE[mb]
decoded_8x = img.resize((img.width*8, img.height*8), Image.NEAREST)
decoded_8x.save(extracted / "hero_decoded_8x.png")
print(f"Decoded sprite (8x): {decoded_8x.size}")

# 5. Place side-by-side
gap = 24
W = hero_crop_8x.width + gap + decoded_8x.width
H = max(hero_crop_8x.height, decoded_8x.height)
side = Image.new("RGB", (W, H), (24, 24, 24))
side.paste(hero_crop_8x, (0, 0))
side.paste(decoded_8x, (hero_crop_8x.width + gap, 0))
side.save(extracted / "hero_side_by_side.png")
print(f"Side-by-side: {side.size}")
print(f"  -> {extracted / 'hero_side_by_side.png'}")
