Linear sweep disassembly caveat: 16-bit DOS code and embedded data are mixed; these are evidence anchors, not a complete control-flow graph.

Named static anchors:
- `0x0002` - MZ/Lattice startup entry. Sets DS/SS/SP, reads DOS version, builds runtime state, then calls `0x5953`.
- `0x0255` - probable game entry called by Lattice runtime at `0x5B1C`; not fully mapped yet.
- `0x0B4E` - clears internal draw/back buffer at `[0x0337]`.
- `0x0B5E` - animation stream A byte reader with `0x7B` repeat marker.
- `0x0BA6` - animation stream B byte reader with `0x7B` repeat marker.
- `0x0BC9` - draw-list renderer loop; records appear to be 4 bytes and terminate with `0xFF`.
- `0x1027` - indexed resource/table loader/parser for frame or animation tables.
- `0x18BF` - BIOS tick wait helper using `int 1Ah`.
- `0x18EF` - records BIOS tick into `[0xBCD1]`.
- `0x18F8` - waits until at least 3 BIOS ticks elapsed.
- `0x19AE` - scene/game-state reset candidate.
- `0x3BAE` - PC speaker/sound event dispatcher.
- `0x4149` - input poll routine; handles Escape, control keys, and extended left/right arrows.
- `0x4273` - CGA/video mode 4 initialization path.
- `0x42D1` - alternate CGA/register initialization path.
- `0x4352` - video adapter probe using `int 11h` and `int 10h`.
- `0x4396` - clears video memory through segment stored at `[0xDF48]`.
- `0x5953` - Lattice C runtime `main` candidate; parses command line/stdio and calls probable game entry.
- `0x5CB5` - DOS open wrapper (`int 21h AH=3Dh`).
- `0x5CE6` - DOS read wrapper (`int 21h AH=3Fh`).
- `0x5D24` - DOS seek wrapper (`int 21h AH=42h`).

Interrupt use counts:
  int 0x10: 6
  int 0x11: 1
  int 0x13: 2
  int 0x1a: 4
  int 0x21: 29

Interrupt anchors:
  0013: int 0x21
  0202: int 0x21
  0209: int 0x21
  0219: int 0x21
  022D: int 0x21
  0239: int 0x21
  024A: int 0x21
  0610: int 0x10
  0625: int 0x10
  16A7: int 0x21
  16B3: int 0x10
  16C0: int 0x21
  16D3: int 0x13
  16EC: int 0x13
  18C4: int 0x1a
  18CC: int 0x1a
  18F1: int 0x1a
  18FA: int 0x1a
  41D4: int 0x21
  41F6: int 0x21
  4208: int 0x21
  4219: int 0x21
  428F: int 0x10
  4352: int 0x11
  4359: int 0x10
  438B: int 0x10
  4393: int 0x21
  4838: int 0x21
  5C40: int 0x21
  5C84: int 0x21
  5CAC: int 0x21
  5CC6: int 0x21
  5CDD: int 0x21
  5CFA: int 0x21
  5D19: int 0x21
  5D3B: int 0x21
  5D56: int 0x21
  5D73: int 0x21
  5D87: int 0x21
  5D9E: int 0x21
  672D: int 0x21
  6B90: int 0x21

Port/interrupt-control anchors:
  0002: cli
  0010: sti
  013F: cli
  014E: sti
  3BDA: in al, 0x61
  3BDE: out 0x61, al
  3DD6: in al, 0x61
  3DDA: out 0x61, al
  425E: in al, dx
  4266: in al, dx
  4278: out dx, al
  42D6: out dx, al
  4339: out dx, al
  4348: out dx, al
  434B: out dx, al
  4623: out dx, al
  4624: in al, dx
  4630: in al, dx
  4666: in al, dx
  466A: in al, dx
  4727: in al, dx
  4809: out dx, al
  480A: in al, dx
  52C6: in al, 0x51
