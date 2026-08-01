# Memory Map Notes

- PSP precedes loaded MZ image by 0x100 bytes at runtime; CS is relative to the load segment.
- Program entry is load segment + 0x0002; file offset 0x0202.
- Initial stack is load segment + 0x15640; SS:SP 155C:0080.
- Load image occupies 0x155B6 bytes before runtime allocations.
- `.DAT/.IND/.BCG` files are external resources loaded through DOS file APIs, not embedded assets.
- Important hardware areas to confirm dynamically: video memory A000/B800, BIOS data area 0040:001A keyboard buffer, PIT timer tick at 0040:006C.
