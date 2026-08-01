{ ----------------------------------------------------------------- }
{  GRAPHX.PAS                                                       }
{  Thin wrapper around Borland BGI plus the Genus pcxLib archives.  }
{                                                                   }
{  Detects CGA vs MCGA at startup and picks CGA.BGI/OTCGA.PCL or    }
{  VGA256.BGI/OTMCGA.PCL accordingly.  Image lookup walks the       }
{  pcxLib TOC by 8.3 name (matching how OREGON.EXE opens images     }
{  like 'MAP.PCX', 'HUNTER.PCC', 'P0.PCC'..'P17.PCC').              }
{ ----------------------------------------------------------------- }

unit Graphx;

interface

uses Crt, Graph;

type
  TVideoMode = (vmCGA, vmVGA);

var
  CurMode : TVideoMode;

procedure InitGfx;
procedure DoneGfx;
procedure ShowPicture(const Name : String);
procedure ShowMap;
procedure DrawBanner(const Text : String);
procedure DrawText8x8(X, Y : Integer; const S : String);

implementation

const
  CgaArchive  = 'OTCGA.PCL';
  VgaArchive  = 'OTMCGA.PCL';
  FontFile    = 'BIT8X8.GFT';

var
  Driver, Mode : Integer;
  ArchiveName  : String[14];
  ArchiveFile  : File;
  ArchiveOpen  : Boolean;
  FontBitmap   : array [0..255, 0..7] of Byte;
  FontLoaded   : Boolean;

procedure InitGfx;
begin
  Driver := Detect;
  InitGraph(Driver, Mode, '');
  if GraphResult <> grOk then
  begin
    WriteLn('Graphics not initialised.');
    Halt(1);
  end;
  case Driver of
    CGA, MCGA :
      begin
        CurMode := vmCGA;
        ArchiveName := CgaArchive;
      end;
  else
      begin
        CurMode := vmVGA;
        ArchiveName := VgaArchive;
      end;
  end;
  ArchiveOpen := False;
  FontLoaded  := False;
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

{ Walks the pcxLib TOC for an 8.3 name.  Returns offset or 0 if missing.    }
function LookupPcx(const Name : String) : LongInt;
type
  TPcxLibEntry = record
    Filename : array [0..12] of Char;
    Offset   : LongInt;
    Size     : LongInt;
    Flags    : Word;
  end;
var
  Header  : array [0..63] of Byte;
  Entry   : TPcxLibEntry;
  I       : Integer;
  Match   : Boolean;
  EName   : String[12];
begin
  LookupPcx := 0;
  if not ArchiveOpen then
  begin
    Assign(ArchiveFile, ArchiveName);
    {$I-} Reset(ArchiveFile, 1); {$I+}
    if IOResult <> 0 then Exit;
    ArchiveOpen := True;
  end;
  Seek(ArchiveFile, 0);
  BlockRead(ArchiveFile, Header, SizeOf(Header));
  while not Eof(ArchiveFile) do
  begin
    BlockRead(ArchiveFile, Entry, SizeOf(Entry));
    EName := '';
    for I := 0 to 12 do
      if Entry.Filename[I] <> #0 then
        EName := EName + Entry.Filename[I];
    Match := UpCase(EName) = UpCase(Name);
    if Match then
    begin
      LookupPcx := Entry.Offset;
      Exit;
    end;
    if Entry.Offset = 0 then Exit;   { TOC terminator }
  end;
end;

procedure ShowPicture(const Name : String);
var
  Ofs : LongInt;
begin
  Ofs := LookupPcx(Name);
  if Ofs = 0 then
  begin
    OutTextXY(8, 8, 'Picture missing: ' + Name);
    Exit;
  end;
  { Decoding a PCX RLE stream into VRAM is left to the BGI putimage path;   }
  { in the original this is provided by the Genus pcxLib runtime.          }
  Seek(ArchiveFile, Ofs);
  { ... PCX-to-VRAM decode happens here ... }
end;

procedure ShowMap;
begin
  ShowPicture('MAP.PCX');
end;

procedure DrawBanner(const Text : String);
begin
  SetColor(White);
  Rectangle(4, 4, GetMaxX - 4, 18);
  OutTextXY(12, 8, Text);
end;

procedure LoadFont;
var
  F   : File;
  Hdr : array [0..15] of Byte;
begin
  Assign(F, FontFile);
  {$I-} Reset(F, 1); {$I+}
  if IOResult <> 0 then Exit;
  BlockRead(F, Hdr, SizeOf(Hdr));         { skip 16-byte header }
  BlockRead(F, FontBitmap, SizeOf(FontBitmap));
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
