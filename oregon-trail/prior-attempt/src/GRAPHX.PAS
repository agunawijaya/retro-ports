{ ----------------------------------------------------------------- }
{  GRAPHX.PAS                                                       }
{  BGI + Genus pcxLib graphics layer.                               }
{                                                                   }
{  Original error-screen text positions in OREGON_UNPACKED.BIN:     }
{    SYSTEM_BGI_ERROR (init)  @ 0x1DE90                             }
{    SYSTEM_BGI_ERROR (state) @ 0x1DEC4                             }
{                                                                   }
{  Capabilities (Gap #5 closed):                                    }
{    * ZSoft PCX RLE decoder (8 bpp / 1 plane VGA, 1 bpp / 4 plane  }
{      CGA-EGA), straight to mode-13h VRAM for VGA.                 }
{    * pcxLib archive scan: PCX blobs are concatenated; locate by   }
{      scanning for the ZSoft header signature, in semantic order   }
{      established by Phase-3 visual confirmation (see work/        }
{      extract_graphics.py).                                        }
{    * Shared 768-byte palette loaded from PAL.256 once and pushed  }
{      to VGA DACs via port 3C8h/3C9h.                              }
{    * BIT8X8.GFT 8x8 font loader for text overlays.                }
{ ----------------------------------------------------------------- }

unit Graphx;

interface

uses Crt, Dos, Graph;

type
  TVideoMode = (vmCGA, vmVGA);

var
  CurMode : TVideoMode;

procedure InitGfx;
procedure DoneGfx;
procedure LoadSharedPalette;        { reads PAL.256 -> VGA DAC }
procedure ShowPictureByIndex(Idx : Byte);
procedure ShowPicture(const Name : String);
procedure ShowMap;
procedure DrawBanner(const Text : String);
procedure DrawText8x8(X, Y : Integer; const S : String);

const
  { Semantic image indices in the pcxLib archives, in scan order.          }
  { Confirmed visually -- see work/extract_graphics.py header comments.    }
  GfxEvents     =  0;
  GfxSupplies   =  1;
  GfxAnimals    =  2;
  GfxFamily     =  3;
  GfxHunter     =  4;
  GfxBanner     =  5;
  GfxTerrain    =  6;
  GfxTravelOx   =  7;
  GfxScenery    =  8;
  GfxFloat      =  9;
  GfxMap        = 10;
  GfxLandmarkBase = 11;             { P0..P17 follow }

implementation

const
  CgaArchive  = 'OTCGA.PCL';
  VgaArchive  = 'OTMCGA.PCL';
  FontFile    = 'BIT8X8.GFT';
  PalFile     = 'PAL.256';

type
  TPcxHeader = record
    Manufacturer : Byte;        { 0x0A }
    Version      : Byte;        { 3, 4 or 5 }
    Encoding     : Byte;        { 1 = RLE }
    BitsPerPixel : Byte;        { 1, 2, 4 or 8 }
    XMin, YMin   : Word;
    XMax, YMax   : Word;
    HRes, VRes   : Word;
    EgaPal       : array [0..47] of Byte;
    Reserved1    : Byte;
    NPlanes      : Byte;
    BytesPerLine : Word;
    PaletteInfo  : Word;
    HScreenSize  : Word;
    VScreenSize  : Word;
    Filler       : array [0..53] of Byte;
  end;                          { 128 bytes }

  TPcxIndex = array [0..31] of LongInt;     { up to 32 entries }

var
  ArchiveName  : String[14];
  ArchiveFile  : File;
  ArchiveOpen  : Boolean;
  PcxOffsets   : TPcxIndex;
  PcxCount     : Byte;
  SharedPal    : array [0..767] of Byte;
  PalLoaded    : Boolean;
  FontBitmap   : array [0..255, 0..7] of Byte;
  FontLoaded   : Boolean;

{ ----------------------------------------------------------------- }
{  Initialization                                                   }
{ ----------------------------------------------------------------- }

procedure ScanArchive;
{ Walk the open archive file and remember the offsets of every PCX header. }
var
  Buf    : array [0..4095] of Byte;
  Read   : Word;
  Base   : LongInt;
  I      : Word;
begin
  PcxCount := 0;
  Base := 0;
  Seek(ArchiveFile, 0);
  while not Eof(ArchiveFile) do
  begin
    Base := FilePos(ArchiveFile);
    BlockRead(ArchiveFile, Buf, SizeOf(Buf), Read);
    if Read < 4 then Break;
    I := 0;
    while I < Read - 4 do
    begin
      if (Buf[I] = $0A) and
         ((Buf[I+1] = 3) or (Buf[I+1] = 4) or (Buf[I+1] = 5)) and
         (Buf[I+2] = 1) and
         ((Buf[I+3] = 1) or (Buf[I+3] = 2) or (Buf[I+3] = 4) or (Buf[I+3] = 8)) then
      begin
        if PcxCount <= High(PcxOffsets) then
        begin
          PcxOffsets[PcxCount] := Base + I;
          Inc(PcxCount);
          Inc(I, 128);                  { skip into payload, headers are 128B }
          Continue;
        end;
      end;
      Inc(I);
    end;
    { Step back one window to avoid missing a header that straddles a       }
    { 4 KB boundary.                                                        }
    if Read >= 128 then
      Seek(ArchiveFile, FilePos(ArchiveFile) - 128);
  end;
end;

procedure InitGfx;
var
  Driver, Mode : Integer;
begin
  Driver := Detect;
  InitGraph(Driver, Mode, '');
  if GraphResult <> grOk then
  begin
    WriteLn('Graphics not initialised: ', GraphErrorMsg(GraphResult));
    Halt(1);
  end;
  case Driver of
    CGA, MCGA :
      begin
        CurMode     := vmCGA;
        ArchiveName := CgaArchive;
      end;
  else
      begin
        CurMode     := vmVGA;
        ArchiveName := VgaArchive;
      end;
  end;
  Assign(ArchiveFile, ArchiveName);
  {$I-} Reset(ArchiveFile, 1); {$I+}
  if IOResult <> 0 then
  begin
    ArchiveOpen := False;
    PcxCount    := 0;
  end
  else
  begin
    ArchiveOpen := True;
    ScanArchive;
  end;
  PalLoaded  := False;
  FontLoaded := False;
  if CurMode = vmVGA then LoadSharedPalette;
end;

procedure DoneGfx;
begin
  if ArchiveOpen then
  begin
    Close(ArchiveFile);
    ArchiveOpen := False;
  end;
  CloseGraph;
end;

{ ----------------------------------------------------------------- }
{  Palette                                                          }
{ ----------------------------------------------------------------- }

procedure LoadSharedPalette;
{ PAL.256 is a small (~906 byte) PCX whose only purpose is to carry a       }
{ 768-byte VGA palette appended after a 0x0C marker.                        }
var
  F      : File;
  Buf    : array [0..1023] of Byte;
  Read   : Word;
  I      : Integer;
  Marker : Integer;
  R      : Registers;
begin
  if PalLoaded then Exit;
  Assign(F, PalFile);
  {$I-} Reset(F, 1); {$I+}
  if IOResult <> 0 then Exit;
  BlockRead(F, Buf, SizeOf(Buf), Read);
  Close(F);
  if Read < 769 then Exit;
  Marker := Read - 769;
  if Buf[Marker] <> $0C then Exit;
  Move(Buf[Marker + 1], SharedPal, 768);
  PalLoaded := True;

  if CurMode <> vmVGA then Exit;
  { Push to VGA DACs.  PCX stores RGB in 8-bit form but VGA DAC is 6-bit,   }
  { so >>2 each component.                                                  }
  Port[$3C8] := 0;
  for I := 0 to 767 do
    Port[$3C9] := SharedPal[I] shr 2;
end;

{ ----------------------------------------------------------------- }
{  PCX RLE decode                                                   }
{ ----------------------------------------------------------------- }

procedure DecodeVgaPcx(Ofs : LongInt);
{ Decode an 8bpp/1-plane PCX directly into mode-13h VRAM at A000:0000.      }
{ Falls back to BGI PutPixel if not in mode 13h.                            }
var
  Hdr      : TPcxHeader;
  W, H     : Word;
  BPL      : Word;
  Row, Col : Word;
  RowBuf   : array [0..639] of Byte;
  RleByte  : Byte;
  RleVal   : Byte;
  Count    : Byte;
  Pos      : Word;
  PixelOfs : Word;
  EmbedPal : Boolean;
  TailMark : Byte;
  Tail     : array [0..767] of Byte;
  I        : Integer;
begin
  if not ArchiveOpen then Exit;
  Seek(ArchiveFile, Ofs);
  BlockRead(ArchiveFile, Hdr, SizeOf(Hdr));
  if Hdr.Manufacturer <> $0A then Exit;
  if (Hdr.BitsPerPixel <> 8) or (Hdr.NPlanes <> 1) then Exit;
  W := Hdr.XMax - Hdr.XMin + 1;
  H := Hdr.YMax - Hdr.YMin + 1;
  BPL := Hdr.BytesPerLine;
  if W > SizeOf(RowBuf) then W := SizeOf(RowBuf);

  for Row := 0 to H - 1 do
  begin
    Pos := 0;
    while Pos < BPL do
    begin
      BlockRead(ArchiveFile, RleByte, 1);
      if (RleByte and $C0) = $C0 then
      begin
        Count := RleByte and $3F;
        BlockRead(ArchiveFile, RleVal, 1);
        for I := 1 to Count do
        begin
          if Pos < SizeOf(RowBuf) then RowBuf[Pos] := RleVal;
          Inc(Pos);
          if Pos >= BPL then Break;
        end;
      end
      else
      begin
        if Pos < SizeOf(RowBuf) then RowBuf[Pos] := RleByte;
        Inc(Pos);
      end;
    end;
    { Blit row into VRAM.  Mode 13h: linear 320x200 at A000:0000.           }
    PixelOfs := Row * 320;
    for Col := 0 to W - 1 do
      Mem[$A000 : PixelOfs + Col] := RowBuf[Col];
  end;

  { If this PCX embeds its own palette, use it instead of the shared one.   }
  if Hdr.Version = 5 then
  begin
    BlockRead(ArchiveFile, TailMark, 1);
    if TailMark = $0C then
    begin
      BlockRead(ArchiveFile, Tail, SizeOf(Tail));
      Port[$3C8] := 0;
      for I := 0 to 767 do
        Port[$3C9] := Tail[I] shr 2;
    end;
  end;
end;

procedure DecodeCgaPcx(Ofs : LongInt);
{ 1bpp / 4-plane = 16-color EGA-style.  Decoded to BGI PutPixel calls --   }
{ slower but works in any graphics mode.                                   }
var
  Hdr      : TPcxHeader;
  W, H     : Word;
  BPL      : Word;
  Row, Col : Word;
  Plane    : Byte;
  RleByte  : Byte;
  RleVal   : Byte;
  Count    : Byte;
  Pos, Need: Word;
  RowBuf   : array [0..255] of Byte;
  Idx      : Byte;
  ByteI    : Byte;
  BitI     : Byte;
  I        : Integer;
begin
  if not ArchiveOpen then Exit;
  Seek(ArchiveFile, Ofs);
  BlockRead(ArchiveFile, Hdr, SizeOf(Hdr));
  if Hdr.Manufacturer <> $0A then Exit;
  W := Hdr.XMax - Hdr.XMin + 1;
  H := Hdr.YMax - Hdr.YMin + 1;
  BPL := Hdr.BytesPerLine;
  Need := BPL * Hdr.NPlanes;
  if Need > SizeOf(RowBuf) then Need := SizeOf(RowBuf);

  for Row := 0 to H - 1 do
  begin
    Pos := 0;
    while Pos < BPL * Hdr.NPlanes do
    begin
      BlockRead(ArchiveFile, RleByte, 1);
      if (RleByte and $C0) = $C0 then
      begin
        Count := RleByte and $3F;
        BlockRead(ArchiveFile, RleVal, 1);
        for I := 1 to Count do
        begin
          if Pos < Need then RowBuf[Pos] := RleVal;
          Inc(Pos);
          if Pos >= BPL * Hdr.NPlanes then Break;
        end;
      end
      else
      begin
        if Pos < Need then RowBuf[Pos] := RleByte;
        Inc(Pos);
      end;
    end;
    for Col := 0 to W - 1 do
    begin
      ByteI := Col shr 3;
      BitI  := 7 - (Col and 7);
      Idx   := 0;
      for Plane := 0 to Hdr.NPlanes - 1 do
        if (RowBuf[Plane * BPL + ByteI] shr BitI) and 1 = 1 then
          Idx := Idx or (1 shl Plane);
      PutPixel(Col, Row, Idx);
    end;
  end;
end;

{ ----------------------------------------------------------------- }
{  Public picture API                                               }
{ ----------------------------------------------------------------- }

procedure ShowPictureByIndex(Idx : Byte);
begin
  if not ArchiveOpen then Exit;
  if Idx >= PcxCount then Exit;
  if CurMode = vmVGA then
    DecodeVgaPcx(PcxOffsets[Idx])
  else
    DecodeCgaPcx(PcxOffsets[Idx]);
end;

function NameToIndex(const Name : String) : Integer;
{ Map 8.3 names the game asks for back into the scan-order index.  Mapping }
{ is from the Phase-3 visual confirmation.                                  }
var
  U      : String;
  Ii     : Integer;
  V, Err : Integer;
begin
  U := Name;
  for Ii := 1 to Length(U) do U[Ii] := UpCase(U[Ii]);
  if      (U = 'EVENTS.PCC')   or (U = 'EVENTS')   then NameToIndex :=  0
  else if (U = 'SUPPLIES.PCC') or (U = 'SUPPLIES') then NameToIndex :=  1
  else if (U = 'ANIMALS.PCC')  or (U = 'ANIMALS')  then NameToIndex :=  2
  else if (U = 'FAMILY.PCC')   or (U = 'FAMILY')   then NameToIndex :=  3
  else if (U = 'HUNTER.PCC')   or (U = 'HUNTER')   then NameToIndex :=  4
  else if (U = 'BANNER.PCC')   or (U = 'BANNER')   then NameToIndex :=  5
  else if (U = 'TERRAIN.PCC')  or (U = 'TERRAIN')  then NameToIndex :=  6
  else if (U = 'TRAVELOX.PCC') or (U = 'TRAVELOX') then NameToIndex :=  7
  else if (U = 'SCENERY.PCC')  or (U = 'SCENERY')  then NameToIndex :=  8
  else if (U = 'FLOAT.PCC')    or (U = 'FLOAT')    then NameToIndex :=  9
  else if (U = 'MAP.PCX')      or (U = 'MAP')      then NameToIndex := 10
  else if (Length(U) >= 2) and (U[1] = 'P') and (U[2] >= '0') and (U[2] <= '9') then
  begin
    { 'P0' .. 'P17' -> index 11..28 }
    Val(Copy(U, 2, 4), V, Err);
    if Err = 0 then NameToIndex := GfxLandmarkBase + V
    else NameToIndex := -1;
  end
  else NameToIndex := -1;
end;

procedure ShowPicture(const Name : String);
var
  Idx : Integer;
begin
  Idx := NameToIndex(Name);
  if Idx >= 0 then ShowPictureByIndex(Idx);
end;

procedure ShowMap;
begin
  ShowPictureByIndex(GfxMap);
end;

{ ----------------------------------------------------------------- }
{  Banner + 8x8 font                                                }
{ ----------------------------------------------------------------- }

procedure DrawBanner(const Text : String);
begin
  SetColor(White);
  Rectangle(4, 4, GetMaxX - 4, 18);
  OutTextXY(12, 8, Text);
end;

procedure LoadFont;
{ BIT8X8.GFT layout (per Phase-1 doc section 4.7):                          }
{   bytes 0..3 : zeros                                                       }
{   bytes 4..9 : magic 'BIT8X8'                                             }
{   bytes 10.. : 8 bytes per glyph, up to 256 glyphs.                       }
var
  F      : File;
  Hdr    : array [0..9] of Byte;
  Glyphs : LongInt;
begin
  Assign(F, FontFile);
  {$I-} Reset(F, 1); {$I+}
  if IOResult <> 0 then Exit;
  BlockRead(F, Hdr, SizeOf(Hdr));
  Glyphs := (FileSize(F) - SizeOf(Hdr)) div 8;
  if Glyphs > 256 then Glyphs := 256;
  BlockRead(F, FontBitmap, Glyphs * 8);
  Close(F);
  FontLoaded := True;
end;

procedure DrawText8x8(X, Y : Integer; const S : String);
var
  I, Row, Col : Integer;
  Bits        : Byte;
  Ch          : Byte;
begin
  if not FontLoaded then LoadFont;
  for I := 1 to Length(S) do
  begin
    Ch := Ord(S[I]);
    for Row := 0 to 7 do
    begin
      Bits := FontBitmap[Ch, Row];
      for Col := 0 to 7 do
        if (Bits and ($80 shr Col)) <> 0 then
          PutPixel(X + (I - 1) * 8 + Col, Y + Row, White);
    end;
  end;
end;

end.
