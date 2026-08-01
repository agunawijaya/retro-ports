# DOSBox-X Runtime Notes

Tool: `E:\Program Files (x86)\DOSBox-X\dosbox-x.exe`

Config used: `tools/dosboxx_trace_karateka.conf`

Runtime log: `docs/findings/dosboxx_runtime.log`

## Confirmed Runtime Behavior

- DOSBox-X version: `2026.05.02`, Visual Studio SDL1 64-bit.
- The game was launched from DOSBox-X autoexec with `karateka.exe`.
- DOSBox-X logged `EXEC:Execute karateka.exe 0`.
- The executable was opened and closed by DOSBox-X loader:
  - `FILES:file open command 0 file karateka.exe`
  - `FILES:Closing file KARATEKA.EXE`
- The game set BIOS video mode 4:
  - `INT10:Set Video Mode 4`
- Runtime resource load order observed:
  - `allpal`
  - `ksc.ind`
  - `ksc.dat`
  - `kmc.ind`
  - `kmc.dat`
  - `allgal`
  - `fuji.bcg`
  - `ks0.ind`
  - `ks0.dat`
  - `km0.ind`
  - `km0.dat`
  - `bal00`
  - `ksi.ind`
  - `ksi.dat`
  - `kmi.ind`
  - `kmi.dat`
  - `title.bcg`

## Drive-A Observation

The visible DOSBox-X prompt reported by the user:

`make sure your karateka disk is in drive a{ press any key to continue`

This is stronger evidence that the emulator must present the game directory as drive `A:` and run the program from `A:`, not merely make the files visible on `C:`.

The DOSBox configs were updated to mount the workspace as floppy drive `A:`, switch to `A:`, and run `karateka.exe` from there.

Prior note: the log showed an attempted open of `title.bcg`, but that alone does not prove `title.bcg` is required in the original distribution. Static analysis now found direct `int 13h` floppy-sector reads around load offsets `0x16C2..0x1717`; the prompt is more likely related to raw disk validation than to a simple missing extracted file.

## Debugger Status

DOSBox-X supports `debuggerrun=debugger` in config, but automated breakpoint control from the shell is not confirmed yet. A separate probe config exists at `tools/dosboxx_debug_probe.conf`.
