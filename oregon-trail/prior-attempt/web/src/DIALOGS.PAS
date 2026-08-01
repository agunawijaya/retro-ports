{ ----------------------------------------------------------------- }
{  DIALOGS.PAS                                                      }
{  Reader for the DIALOGS.REC NPC advice database.                  }
{                                                                   }
{  Record layout (per oregon_trail_reverse.md section 4.1):         }
{    speaker_len : byte                                             }
{    speaker     : 1..speaker_len bytes                             }
{    metadata    : 11 bytes  (location/event binding — partially    }
{                  understood; see open question #2 in reverse doc) }
{    body_len    : byte                                             }
{    body        : 1..body_len bytes                                }
{                                                                   }
{  We do not embed any dialog content here — it is read from the    }
{  shipped DIALOGS.REC file at runtime.                             }
{ ----------------------------------------------------------------- }

unit Dialogs;

interface

uses GameType, Rng;

type
  TDialogEntry = record
    Speaker : String[80];
    Body    : String;
  end;

procedure OpenDialogs;
procedure CloseDialogs;
function CountDialogs : Word;
function ReadRandomDialog(var Entry : TDialogEntry) : Boolean;
function ReadDialogByIndex(Idx : Word; var Entry : TDialogEntry) : Boolean;

implementation

const
  DialogsFile = 'DIALOGS.REC';

var
  F        : File;
  IsOpen   : Boolean;
  EntryOfs : array [0..255] of LongInt;
  Total    : Word;

procedure ScanIndex;
var
  SpeakerLen, BodyLen : Byte;
  Skip                : array [0..10] of Byte;
  Ofs                 : LongInt;
  Buf                 : array [0..255] of Byte;
begin
  Total := 0;
  Seek(F, 0);
  while not Eof(F) do
  begin
    Ofs := FilePos(F);
    {$I-} BlockRead(F, SpeakerLen, 1); {$I+}
    if (IOResult <> 0) or (SpeakerLen = 0) then Break;
    BlockRead(F, Buf, SpeakerLen);
    BlockRead(F, Skip, SizeOf(Skip));
    BlockRead(F, BodyLen, 1);
    if BodyLen = 0 then Break;
    BlockRead(F, Buf, BodyLen);
    if Total <= High(EntryOfs) then
    begin
      EntryOfs[Total] := Ofs;
      Inc(Total);
    end;
  end;
end;

procedure OpenDialogs;
begin
  if IsOpen then Exit;
  Assign(F, DialogsFile);
  {$I-} Reset(F, 1); {$I+}
  if IOResult <> 0 then
  begin
    IsOpen := False;
    Total  := 0;
    Exit;
  end;
  IsOpen := True;
  ScanIndex;
end;

procedure CloseDialogs;
begin
  if IsOpen then
  begin
    Close(F);
    IsOpen := False;
  end;
end;

function CountDialogs : Word;
begin
  CountDialogs := Total;
end;

function ReadDialogByIndex(Idx : Word; var Entry : TDialogEntry) : Boolean;
var
  SpeakerLen, BodyLen : Byte;
  Skip                : array [0..10] of Byte;
  I                   : Byte;
  Ch                  : Char;
begin
  ReadDialogByIndex := False;
  if not IsOpen then Exit;
  if Idx >= Total then Exit;
  Seek(F, EntryOfs[Idx]);
  BlockRead(F, SpeakerLen, 1);
  Entry.Speaker := '';
  for I := 1 to SpeakerLen do
  begin
    BlockRead(F, Ch, 1);
    Entry.Speaker := Entry.Speaker + Ch;
  end;
  BlockRead(F, Skip, SizeOf(Skip));
  BlockRead(F, BodyLen, 1);
  Entry.Body := '';
  for I := 1 to BodyLen do
  begin
    BlockRead(F, Ch, 1);
    Entry.Body := Entry.Body + Ch;
  end;
  ReadDialogByIndex := True;
end;

function ReadRandomDialog(var Entry : TDialogEntry) : Boolean;
begin
  if Total = 0 then
    ReadRandomDialog := False
  else
    ReadRandomDialog := ReadDialogByIndex(GetRand(Total), Entry);
end;

end.
