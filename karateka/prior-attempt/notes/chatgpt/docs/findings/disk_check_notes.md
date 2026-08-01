# Disk Check Notes

## Runtime Status

The DOSBox-X config mounts the workspace as floppy drive `A:` and runs the program from `A:`.

Evidence from `docs/findings/dosboxx_runtime.log`:

- `DOSMISC:DIRCACHE: Set volume label to A_FLOPPY`
- `EXEC:Execute karateka.exe 0`
- `INT10:Set Video Mode 4`
- The program then loads resources from the mounted drive.

## Static Disk Check Evidence

The executable contains direct BIOS disk access using `int 13h`, which is different from normal DOS file access through mounted folders.

Evidence from `docs/findings/disk_check_analysis.txt`:

- `0x16C7: mov ch, 0x0a`
- `0x16C9: mov cl, 0x07`
- `0x16CD: mov dl, byte ptr [bp + 4]`
- `0x16D3: int 0x13`
- `0x16DD: mov ax, 0x0201`
- `0x16E3: mov ch, 0x0a`
- `0x16E5: mov cl, 0xf1`
- `0x16EC: int 0x13`
- `0x16F9..0x170B`: compares 16 words from one buffer against another.

This looks like a raw floppy-sector check. A DOSBox folder mount can satisfy normal DOS file opens, but it generally cannot reproduce unusual raw floppy sectors or copy-protection layout.

## Interpretation

The visible prompt:

`make sure your karateka disk is in drive a{ press any key to continue`

is likely triggered by this disk-check path, not by the folder being mounted as `C:`. The current config already uses `A:`.

## Non-Bypass Next Step

For authentic debugging, use a legal floppy disk image of the original disk and mount it as drive `A:` with DOSBox-X `imgmount`, rather than mounting an extracted folder.

Example template:

```dos
imgmount a "E:\path\to\legal-karateka-disk.img" -t floppy
a:
karateka.exe
```

Do not patch out or bypass the disk check for redistribution. For educational analysis, the useful finding is that the program mixes normal DOS file I/O with direct BIOS floppy-sector validation.
