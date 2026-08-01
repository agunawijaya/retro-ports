{ ----------------------------------------------------------------- }
{  SAVELOAD.PAS                                                     }
{  *.GAM save slot (144 bytes), HISCORES.REC, TOMB.REC.             }
{                                                                   }
{  GAM layout reconstructed from work/save_decode.txt on the        }
{  shipped ZOP12.GAM dev save.                                      }
{                                                                   }
{  Original screen-text positions in OREGON_UNPACKED.BIN:           }
{    SAVE_GAME prompt          @ 0x0F082                            }
{    SAVE_GAME erase menu      @ 0x0F6D1, 0x0F703                   }
{    SAVE_GAME "no saved..."   @ 0x0F6E9                            }
{    SAVE_GAME confirm         @ 0x0F775                            }
{    SAVE_GAME "Removing..."   @ 0x0F7A8                            }
{    SAVE_GAME load options    @ 0x1015F                            }
{    SAVE_GAME label "Saved Games" @ 0x12281                        }
{ ----------------------------------------------------------------- }

unit SaveLoad;

interface

uses GameType, GameStat;

type
  THiScoreRec = record
    NameLen : Byte;
    Name    : array [0..14] of Char;
    Score   : Word;
  end;                              { 18 bytes }

procedure SaveGame(const FileName : String);
function  LoadGame(const FileName : String) : Boolean;

procedure ReadHiScores(var Tbl : array of THiScoreRec; var N : Byte);
procedure InsertHiScore(const Name : TString15; Score : Word);

procedure AppendTombstone(const Name : TString15; const Cause : String);

implementation

const
  HiScoresFile = 'HISCORES.REC';
  TombFile     = 'TOMB.REC';
  MaxHiScores  = 10;

procedure SaveGame(const FileName : String);
var
  F   : File;
  Pad : array [0..143] of Byte;
  P   : Byte;
  I   : Byte;
  Idx : Byte;
begin
  FillChar(Pad, SizeOf(Pad), 0);
  { Header: 3 bytes — count and a magic byte mirroring 0xC0 0x01 0x03 seen  }
  { in ZOP12.GAM at offset 0..2.                                            }
  Pad[0] := $C0;
  Pad[1] := $01;
  Pad[2] := State.PartySize;

  P := 3;
  for I := 0 to MaxParty - 1 do
  begin
    Pad[P] := Length(State.Party[I].Name);
    Inc(P);
    for Idx := 1 to Length(State.Party[I].Name) do
    begin
      Pad[P] := Ord(State.Party[I].Name[Idx]);
      Inc(P);
    end;
    Pad[P] := State.Party[I].Health;  Inc(P);
    Pad[P] := State.Party[I].Illness; Inc(P);
    if State.Party[I].Alive then Pad[P] := 1 else Pad[P] := PartyDead;
    Inc(P);
  end;

  { Supplies and cursor — pack into the remaining bytes. }
  Move(State.Supplies,      Pad[100], SizeOf(State.Supplies));
  Move(State.MilesTraveled, Pad[120], 2);
  Move(State.CalDate,       Pad[122], SizeOf(State.CalDate));
  Pad[126] := State.Occupation;
  Pad[127] := State.Difficulty;
  Pad[128] := State.Pace;
  Pad[129] := State.Ration;
  Pad[130] := State.NextLandmark;

  Assign(F, FileName);
  Rewrite(F, 1);
  BlockWrite(F, Pad, SizeOf(Pad));
  Close(F);
end;

function LoadGame(const FileName : String) : Boolean;
var
  F   : File;
  Pad : array [0..143] of Byte;
  P, L, I, Idx : Byte;
  N   : array [0..15] of Char;
begin
  LoadGame := False;
  Assign(F, FileName);
  {$I-} Reset(F, 1); {$I+}
  if IOResult <> 0 then Exit;
  if FileSize(F) <> SizeOf(Pad) then begin Close(F); Exit; end;
  BlockRead(F, Pad, SizeOf(Pad));
  Close(F);
  if Pad[0] <> $C0 then Exit;
  State.PartySize := Pad[2];

  P := 3;
  for I := 0 to MaxParty - 1 do
  begin
    L := Pad[P]; Inc(P);
    State.Party[I].Name := '';
    for Idx := 1 to L do
    begin
      State.Party[I].Name := State.Party[I].Name + Chr(Pad[P]);
      Inc(P);
    end;
    State.Party[I].Health   := Pad[P]; Inc(P);
    State.Party[I].Illness  := Pad[P]; Inc(P);
    State.Party[I].Alive    := Pad[P] = 1; Inc(P);
  end;

  Move(Pad[100], State.Supplies, SizeOf(State.Supplies));
  Move(Pad[120], State.MilesTraveled, 2);
  Move(Pad[122], State.CalDate, SizeOf(State.CalDate));
  State.Occupation   := Pad[126];
  State.Difficulty   := Pad[127];
  State.Pace         := Pad[128];
  State.Ration       := Pad[129];
  State.NextLandmark := Pad[130];
  LoadGame := True;
end;

procedure ReadHiScores(var Tbl : array of THiScoreRec; var N : Byte);
var
  F : File of THiScoreRec;
begin
  N := 0;
  Assign(F, HiScoresFile);
  {$I-} Reset(F); {$I+}
  if IOResult <> 0 then Exit;
  while (not Eof(F)) and (N < MaxHiScores) and (N <= High(Tbl)) do
  begin
    Read(F, Tbl[N]);
    Inc(N);
  end;
  Close(F);
end;

procedure WriteHiScores(const Tbl : array of THiScoreRec; N : Byte);
var
  F : File of THiScoreRec;
  I : Byte;
begin
  Assign(F, HiScoresFile);
  Rewrite(F);
  for I := 0 to N - 1 do
    Write(F, Tbl[I]);
  Close(F);
end;

procedure InsertHiScore(const Name : TString15; Score : Word);
var
  Tbl : array [0..MaxHiScores] of THiScoreRec;
  N, I, Pos : Byte;
  Rec : THiScoreRec;
  K   : Byte;
begin
  ReadHiScores(Tbl, N);
  Pos := N;
  for I := 0 to N - 1 do
    if Score > Tbl[I].Score then
    begin
      Pos := I;
      Break;
    end;
  if (Pos >= MaxHiScores) then Exit;

  for I := MaxHiScores - 1 downto Pos + 1 do
    Tbl[I] := Tbl[I - 1];
  FillChar(Rec, SizeOf(Rec), 0);
  Rec.NameLen := Length(Name);
  for K := 1 to Length(Name) do
    Rec.Name[K - 1] := Name[K];
  Rec.Score := Score;
  Tbl[Pos] := Rec;
  if N < MaxHiScores then Inc(N);
  WriteHiScores(Tbl, N);
end;

procedure AppendTombstone(const Name : TString15; const Cause : String);
var
  F   : File;
  Buf : array [0..63] of Byte;
  I, P : Byte;
begin
  FillChar(Buf, SizeOf(Buf), 0);
  Buf[0] := Length(Name);
  P := 1;
  for I := 1 to Length(Name) do
  begin
    Buf[P] := Ord(Name[I]); Inc(P);
  end;
  Buf[P] := Length(Cause); Inc(P);
  for I := 1 to Length(Cause) do
  begin
    Buf[P] := Ord(Cause[I]); Inc(P);
  end;
  Assign(F, TombFile);
  {$I-} Reset(F, 1); {$I+}
  if IOResult <> 0 then
    Rewrite(F, 1)
  else
    Seek(F, FileSize(F));
  BlockWrite(F, Buf, SizeOf(Buf));
  Close(F);
end;

end.
