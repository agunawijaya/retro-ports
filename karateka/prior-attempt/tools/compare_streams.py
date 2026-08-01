"""Compare KM0 and KS0 byte streams for sprite 0x014A."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from extract_karateka import load_pack, decode_shape

pa = load_pack(Path(__file__).with_name("KM0"))
pb = load_pack(Path(__file__).with_name("KS0"))
ea = next(e for e in pa.index if e.sprite_id == 0x014A)
eb = next(e for e in pb.index if e.sprite_id == 0x014A)
wa, ha, ma = decode_shape(pa.dat, ea.offset)
wb, hb, pix = decode_shape(pb.dat, eb.offset)
print(f"KM0 sprite 0x014A: {wa}x{ha}, {len(ma)} bytes")
print(f"KS0 sprite 0x014A: {wb}x{hb}, {len(pix)} bytes")
print()
print("row  KM0 (mask?)      KS0 (pixel?)     m|p              m&p")
for y in range(min(ha, 18)):
    rm = ma[y*wa:(y+1)*wa]
    rp = pix[y*wb:(y+1)*wb]
    or_  = bytes(a|b for a, b in zip(rm, rp))
    and_ = bytes(a&b for a, b in zip(rm, rp))
    print(f" {y:2}  {rm.hex():<16} {rp.hex():<16} {or_.hex():<16} {and_.hex()}")
print()
print("Row 4 in binary (each byte = 4 CGA pixels MSB-first):")
y = 4
rm = ma[y*wa:(y+1)*wa]
rp = pix[y*wb:(y+1)*wb]
fmt = lambda row: " ".join(f"{b:08b}" for b in row)
print(f"  KM0 (mask): {fmt(rm)}")
print(f"  KS0 (pxl ): {fmt(rp)}")
print(f"  m  | p    : {fmt(bytes(a|b for a,b in zip(rm,rp)))}")
print(f"  ~m & p    : {fmt(bytes((~a&b)&0xFF for a,b in zip(rm,rp)))}")
