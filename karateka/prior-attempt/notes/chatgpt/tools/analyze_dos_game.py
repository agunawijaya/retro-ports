from __future__ import annotations

import argparse
import collections
import math
import pathlib
import re
import struct
from dataclasses import dataclass

from capstone import Cs, CS_ARCH_X86, CS_MODE_16


PRINTABLE = set(range(0x20, 0x7F))


@dataclass
class MzHeader:
    last_page_bytes: int
    pages: int
    relocations: int
    header_paragraphs: int
    min_alloc: int
    max_alloc: int
    ss: int
    sp: int
    checksum: int
    ip: int
    cs: int
    reloc_table_offset: int
    overlay: int

    @property
    def header_size(self) -> int:
        return self.header_paragraphs * 16

    @property
    def file_image_size(self) -> int:
        return (self.pages - 1) * 512 + (self.last_page_bytes or 512)

    @property
    def load_image_size(self) -> int:
        return self.file_image_size - self.header_size

    @property
    def entry_linear(self) -> int:
        return self.cs * 16 + self.ip

    @property
    def stack_linear(self) -> int:
        return self.ss * 16 + self.sp


def parse_mz(data: bytes) -> MzHeader:
    if data[:2] != b"MZ":
        raise ValueError("not an MZ executable")
    fields = struct.unpack_from("<13H", data, 2)
    return MzHeader(*fields)


def entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = collections.Counter(data)
    total = len(data)
    return -sum((n / total) * math.log2(n / total) for n in counts.values())


def strings(data: bytes, min_len: int = 4) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    start = None
    buf = bytearray()
    for i, b in enumerate(data + b"\0"):
        if b in PRINTABLE:
            if start is None:
                start = i
            buf.append(b)
        else:
            if start is not None and len(buf) >= min_len:
                out.append((start, buf.decode("ascii", errors="replace")))
            start = None
            buf = bytearray()
    return out


def write_strings(path: pathlib.Path, items: list[tuple[int, str]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for off, s in items:
            f.write(f"{off:08X}: {s}\n")


def disassemble(blob: bytes, start: int, count: int = 200) -> list[str]:
    md = Cs(CS_ARCH_X86, CS_MODE_16)
    md.detail = False
    lines = []
    for idx, insn in enumerate(md.disasm(blob[start:], start)):
        if idx >= count:
            break
        b = " ".join(f"{x:02X}" for x in insn.bytes)
        lines.append(f"{insn.address:04X}: {b:<18} {insn.mnemonic} {insn.op_str}".rstrip())
    return lines


def all_disasm(blob: bytes, start: int = 0) -> list[tuple[int, str, str, bytes]]:
    md = Cs(CS_ARCH_X86, CS_MODE_16)
    return [(i.address, i.mnemonic, i.op_str, bytes(i.bytes)) for i in md.disasm(blob[start:], start)]


def find_ints(insns: list[tuple[int, str, str, bytes]]) -> list[tuple[int, str]]:
    return [(a, op) for a, m, op, _ in insns if m == "int"]


def find_ports(insns: list[tuple[int, str, str, bytes]]) -> list[tuple[int, str, str]]:
    hits = []
    for a, m, op, _ in insns:
        if m in {"in", "out", "cli", "sti"}:
            hits.append((a, m, op))
    return hits


def find_dos_filenames(items: list[tuple[int, str]]) -> list[tuple[int, str]]:
    rx = re.compile(r"^[A-Z0-9_$~.-]{2,12}(\.[A-Z0-9]{1,3})?$")
    return [(off, s) for off, s in items if rx.match(s)]


def parse_ind(path: pathlib.Path) -> list[tuple[int, int]]:
    data = path.read_bytes()
    values = []
    for i in range(0, len(data) - 1, 2):
        values.append(struct.unpack_from("<H", data, i)[0])
    return [(i * 2, v) for i, v in enumerate(values)]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("exe", type=pathlib.Path)
    ap.add_argument("--out", type=pathlib.Path, default=pathlib.Path("docs/findings"))
    args = ap.parse_args()

    root = args.exe.parent
    out = args.out
    out.mkdir(parents=True, exist_ok=True)
    data = args.exe.read_bytes()
    mz = parse_mz(data)
    load = data[mz.header_size:mz.file_image_size]
    relocs = [
        struct.unpack_from("<HH", data, mz.reloc_table_offset + i * 4)
        for i in range(mz.relocations)
    ]
    exe_strings = strings(data)
    write_strings(out / "strings.txt", exe_strings)

    file_lines = [
        f"File: {args.exe.name}",
        f"Size: {len(data)} bytes",
        "Magic: MZ",
        f"Header size: {mz.header_size} bytes ({mz.header_paragraphs} paragraphs)",
        f"EXE image size from header: {mz.file_image_size} bytes",
        f"Load image size: {len(load)} bytes",
        f"Relocations: {mz.relocations}",
        f"Relocation table offset: 0x{mz.reloc_table_offset:04X}",
        f"Entry point: CS:IP {mz.cs:04X}:{mz.ip:04X} (load-image linear 0x{mz.entry_linear:04X}, file offset 0x{mz.header_size + mz.entry_linear:04X})",
        f"Initial SS:SP: {mz.ss:04X}:{mz.sp:04X} (load-image linear 0x{mz.stack_linear:04X})",
        f"Min alloc: 0x{mz.min_alloc:04X}",
        f"Max alloc: 0x{mz.max_alloc:04X}",
        f"Overlay number: {mz.overlay}",
        "Relocation entries:",
    ]
    file_lines += [f"  {i:02d}: {seg:04X}:{off:04X}" for i, (off, seg) in enumerate(relocs)]
    file_lines += [
        "",
        "Entropy:",
        f"  whole file: {entropy(data):.3f} bits/byte",
        f"  load image: {entropy(load):.3f} bits/byte",
    ]
    file_lines += ["", "Sibling files:"]
    for p in sorted(root.iterdir()):
        if p.is_file():
            file_lines.append(f"  {p.name:16} {p.stat().st_size:8} bytes")
    (out / "file_identification.txt").write_text("\n".join(file_lines) + "\n", encoding="utf-8")

    entry_lines = ["Entry point disassembly:", *disassemble(load, mz.entry_linear, 240)]
    (out / "entry_disassembly.txt").write_text("\n".join(entry_lines) + "\n", encoding="utf-8")

    insns = all_disasm(load)
    ints = find_ints(insns)
    ports = find_ports(insns)
    int_counts = collections.Counter(op for _, op in ints)
    func_lines = [
        "Linear sweep disassembly caveat: 16-bit DOS code and embedded data are mixed; these are evidence anchors, not a complete control-flow graph.",
        "",
        "Interrupt use counts:",
    ]
    for op, n in sorted(int_counts.items()):
        func_lines.append(f"  int {op}: {n}")
    func_lines += ["", "Interrupt anchors:"]
    for a, op in ints[:250]:
        func_lines.append(f"  {a:04X}: int {op}")
    func_lines += ["", "Port/interrupt-control anchors:"]
    for a, m, op in ports[:250]:
        func_lines.append(f"  {a:04X}: {m} {op}".rstrip())
    (out / "function_map.md").write_text("\n".join(func_lines) + "\n", encoding="utf-8")

    data_lines = [
        "Resource and table evidence",
        "===========================",
        "",
        "Executable strings that look like DOS filenames:",
    ]
    for off, s in find_dos_filenames(exe_strings):
        data_lines.append(f"- file offset 0x{off:04X}: `{s}`")
    data_lines += ["", "IND files interpreted as little-endian 16-bit values (first 32 values each):"]
    for p in sorted(root.glob("*.IND")):
        vals = parse_ind(p)[:32]
        rendered = " ".join(f"{v:04X}" for _, v in vals)
        data_lines.append(f"- `{p.name}` ({p.stat().st_size} bytes): {rendered}")
    data_lines += ["", "BCG/resource sizes:"]
    for pat in ("*.BCG", "*.DAT", "ALL*", "BAL*", "CAL*"):
        for p in sorted(root.glob(pat)):
            if p.suffix.upper() != ".EXE":
                data_lines.append(f"- `{p.name}`: {p.stat().st_size} bytes, entropy {entropy(p.read_bytes()):.3f}")
    (out / "data_tables.md").write_text("\n".join(dict.fromkeys(data_lines)) + "\n", encoding="utf-8")

    mem_lines = [
        "# Memory Map Notes",
        "",
        f"- PSP precedes loaded MZ image by 0x100 bytes at runtime; CS is relative to the load segment.",
        f"- Program entry is load segment + 0x{mz.entry_linear:04X}; file offset 0x{mz.header_size + mz.entry_linear:04X}.",
        f"- Initial stack is load segment + 0x{mz.stack_linear:04X}; SS:SP {mz.ss:04X}:{mz.sp:04X}.",
        f"- Load image occupies 0x{len(load):04X} bytes before runtime allocations.",
        "- `.DAT/.IND/.BCG` files are external resources loaded through DOS file APIs, not embedded assets.",
        "- Important hardware areas to confirm dynamically: video memory A000/B800, BIOS data area 0040:001A keyboard buffer, PIT timer tick at 0040:006C.",
    ]
    (out / "memory_map_notes.md").write_text("\n".join(mem_lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
