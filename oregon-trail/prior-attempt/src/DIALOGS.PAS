{ ----------------------------------------------------------------- }
{  DIALOGS.PAS                                                      }
{  Reader for the DIALOGS.REC NPC advice database.                  }
{                                                                   }
{  Gap #1 closure.  Phase 1 incorrectly modelled the format as      }
{  having an 11-byte fixed metadata block.  Re-analysis shows the   }
{  file is a sequence of fixed 286-byte slots:                      }
{                                                                   }
{    +-------------------------------------+                        }
{    | speaker_len (1)  speaker (N bytes)  |                        }
{    | sep (1 byte, usually 0x00)          |                        }
{    | body_len (1)    body (M bytes)      |                        }
{    | pad (zeros)                         |                        }
{    | marker: 00 00 00 00 4D 00 00 01     |                        }
{    | pad (zeros)                         |                        }
{    +-------------------------------------+                        }
{        TOTAL = 286 bytes                                          }
{                                                                   }
{  Long bodies overflow into a second or third 286-byte slot; in    }
{  those overflow slots the "speaker_len" byte is typically 0 or    }
{  reads as a fragment of the previous body, so we skip them.       }
{                                                                   }
{  The 0x4D marker is invariant across all records and so cannot    }
{  encode per-record event/location binding.  If such a binding     }
{  table exists, it is somewhere else (likely inside OREGON.EXE,    }
{  cross-referencing records by index).  See DIAMETA.TXT for the    }
{  full analytic write-up.                                          }
{ ----------------------------------------------------------------- }

unit Dialogs;

interface

uses GameType, Rng;

const
  DialogSlotSize = 286;

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

{ Gap #1 closure: NPC selection is bound to trail position via slot     }
{ index.  Given current miles, pick a record whose slot index lies in   }
{ the zone band for that miles range.  See DIAMETA.TXT.                 }
function ReadDialogForMiles(Miles : Word;
                            var Entry : TDialogEntry) : Boolean;

implementation

const
  DialogsFile = 'DIALOGS.REC';

var
  F        : File;
  IsOpen   : Boolean;
  SlotOfs  : array [0..63] of LongInt;       { offsets of slots that start a }
                                             { real speaker record           }
  Total    : Word;

function LooksLikeSpeakerStart(B : Byte; Followed : Char) : Boolean;
{ Heuristic: speaker length 4..64 and first text char is uppercase.  Filters }
{ out continuation slots whose leading byte happens to look like a length.   }
begin
  LooksLikeSpeakerStart :=
    (B >= 4) and (B <= 64) and
    (((Followed >= 'A') and (Followed <= 'Z')) or
     (Followed = ' '));
end;

procedure ScanIndex;
{ Walk the file in 286-byte slots and remember which slots open a real       }
{ speaker.  Reader code will then read body content that may flow into the   }
{ next slot or two.                                                          }
var
  SlotIdx : Word;
  Buf     : array [0..1] of Byte;
  Pos     : LongInt;
begin
  Total := 0;
  SlotIdx := 0;
  while True do
  begin
    Pos := LongInt(SlotIdx) * DialogSlotSize;
    if Pos + 2 >= FileSize(F) then Break;
    Seek(F, Pos);
    BlockRead(F, Buf, 2);
    if LooksLikeSpeakerStart(Buf[0], Chr(Buf[1])) then
    begin
      if Total <= High(SlotOfs) then
      begin
        SlotOfs[Total] := Pos;
        Inc(Total);
      end;
    end;
    Inc(SlotIdx);
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
{ Walk: speaker_len, speaker, separator byte, body_len, body.  Body may       }
{ overflow into the next 286-byte slot if it is long.                         }
var
  SpeakerLen, BodyLen : Byte;
  Sep                 : Byte;
  I                   : Byte;
  Ch                  : Char;
  Tries               : Word;
begin
  ReadDialogByIndex := False;
  if not IsOpen then Exit;
  if Idx >= Total then Exit;
  Seek(F, SlotOfs[Idx]);
  BlockRead(F, SpeakerLen, 1);
  if (SpeakerLen = 0) or (SpeakerLen > 80) then Exit;
  Entry.Speaker := '';
  for I := 1 to SpeakerLen do
  begin
    BlockRead(F, Ch, 1);
    Entry.Speaker := Entry.Speaker + Ch;
  end;
  { Skip 0..10 separator bytes until we find a plausible body length.        }
  Tries := 0;
  repeat
    BlockRead(F, Sep, 1);
    Inc(Tries);
  until (Sep >= 8) and (Sep <= 250) or (Tries > 12);
  if Tries > 12 then Exit;
  BodyLen := Sep;
  Entry.Body := '';
  for I := 1 to BodyLen do
  begin
    BlockRead(F, Ch, 1);
    if (Ch < ' ') and (Ch <> #10) and (Ch <> #13) then Ch := ' ';
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

const
  NumZones = 14;       { Roughly aligned with the landmark count }

function ReadDialogForMiles(Miles : Word;
                            var Entry : TDialogEntry) : Boolean;
{ Pick a record whose slot index lies within the zone band corresponding }
{ to the player's miles traveled.  Tested against the binary in          }
{ DIAMETA.TXT -- the place names mentioned in each record match the      }
{ zone selected by this formula.                                         }
var
  Zone, Lo, Hi : Word;
  Pick         : Word;
begin
  ReadDialogForMiles := False;
  if Total = 0 then Exit;
  { Zone = miles fraction of full trail, scaled to NumZones. }
  if Miles >= 2000 then Zone := NumZones - 1
  else Zone := (LongInt(Miles) * NumZones) div 2000;
  Lo := (LongInt(Zone)     * Total) div NumZones;
  Hi := (LongInt(Zone + 1) * Total) div NumZones;
  if Hi <= Lo then Hi := Lo + 1;
  if Hi > Total then Hi := Total;
  Pick := Lo + GetRand(Hi - Lo);
  ReadDialogForMiles := ReadDialogByIndex(Pick, Entry);
end;

end.
