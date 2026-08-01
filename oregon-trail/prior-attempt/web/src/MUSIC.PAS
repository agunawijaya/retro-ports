{ ----------------------------------------------------------------- }
{  MUSIC.PAS                                                        }
{  Plays the GW-BASIC PLAY-string songs from SONGS.TXT through      }
{  the PC speaker via Crt's Sound/Delay/NoSound.                    }
{                                                                   }
{  SONGS.TXT is plain ASCII; one song per line; 18 musical lines    }
{  plus an EOF marker.  Token grammar: o<n>, l<n>, t<n>, a..g,      }
{  '#'/'+' sharp, '-' flat, '.' dotted, '>' octave up, '<' down,    }
{  'p' rest.  See Phase-1 doc section 4.8.                          }
{ ----------------------------------------------------------------- }

unit Music;

interface

procedure PlaySong(Index : Byte);
procedure StopMusic;

implementation

uses Crt;

const
  SongsFile = 'SONGS.TXT';

var
  Songs     : array [0..18] of String;
  SongCount : Byte;
  Loaded    : Boolean;

procedure LoadSongs;
var
  F : Text;
  S : String;
begin
  if Loaded then Exit;
  SongCount := 0;
  Assign(F, SongsFile);
  {$I-} Reset(F); {$I+}
  if IOResult <> 0 then Exit;
  while (not Eof(F)) and (SongCount <= High(Songs)) do
  begin
    ReadLn(F, S);
    if Length(S) > 0 then
    begin
      Songs[SongCount] := S;
      Inc(SongCount);
    end;
  end;
  Close(F);
  Loaded := True;
end;

{ Pitch tables for one octave; frequencies in Hz multiplied by 10 to keep   }
{ them in WORD range and for fractional accuracy.                          }
const
  NoteHzX10 : array ['a'..'g'] of Word =
    (4400, 4938, 2616, 2937, 3296, 3492, 3920);
  { Will be scaled by octave multiplier (2^(oct-4)). }

function LowerCase(C : Char) : Char;
begin
  if (C >= 'A') and (C <= 'Z') then
    LowerCase := Chr(Ord(C) + 32)
  else
    LowerCase := C;
end;

function ScaleHz(BaseHzX10 : Word; Octave : Byte) : Word;
var
  Hz : LongInt;
  Diff : ShortInt;
begin
  Hz := BaseHzX10;
  Diff := ShortInt(Octave) - 4;
  while Diff > 0 do begin Hz := Hz * 2; Dec(Diff); end;
  while Diff < 0 do begin Hz := Hz div 2; Inc(Diff); end;
  ScaleHz := Word(Hz div 10);
end;

procedure PlayString(const S : String);
var
  I, Len    : Integer;
  C         : Char;
  Octave    : Byte;
  Length_   : Word;     { 1 = whole, 8 = eighth, etc. }
  Tempo     : Word;
  N         : Word;
  Dotted    : Boolean;
  Sharp     : Boolean;
  Flat      : Boolean;
  Hz        : Word;
  Duration  : Word;
  MsPerWhole: Word;

  function NextDigit : Word;
  var
    V : Word;
  begin
    V := 0;
    while (I <= Len) and (S[I] >= '0') and (S[I] <= '9') do
    begin
      V := V * 10 + (Ord(S[I]) - Ord('0'));
      Inc(I);
    end;
    NextDigit := V;
  end;

begin
  Octave  := 4;
  Length_ := 4;
  Tempo   := 120;
  Len     := Length(S);
  I       := 1;
  MsPerWhole := 240000 div Tempo;  { whole-note duration in ms }

  while I <= Len do
  begin
    C := S[I];
    Inc(I);
    case C of
      'o', 'O' : Octave  := NextDigit;
      'l', 'L' : Length_ := NextDigit;
      't', 'T' :
        begin
          Tempo := NextDigit;
          if Tempo = 0 then Tempo := 120;
          MsPerWhole := 240000 div Tempo;
        end;
      '>' : if Octave < 6 then Inc(Octave);
      '<' : if Octave > 0 then Dec(Octave);
      'a'..'g', 'A'..'G' :
        begin
          Sharp := False; Flat := False; Dotted := False;
          if (I <= Len) and ((S[I] = '#') or (S[I] = '+')) then
            begin Sharp := True; Inc(I); end;
          if (I <= Len) and (S[I] = '-') then
            begin Flat := True;  Inc(I); end;
          N := NextDigit;
          if N = 0 then N := Length_;
          if (I <= Len) and (S[I] = '.') then
            begin Dotted := True; Inc(I); end;
          Duration := MsPerWhole div N;
          if Dotted then Duration := (Duration * 3) div 2;
          Hz := ScaleHz(NoteHzX10[LowerCase(C)], Octave);
          if Sharp then Hz := (Hz * 1059) div 1000;
          if Flat  then Hz := (Hz * 944)  div 1000;
          Sound(Hz);
          Delay(Duration);
          NoSound;
        end;
      'p', 'P' :
        begin
          N := NextDigit;
          if N = 0 then N := Length_;
          Delay(MsPerWhole div N);
        end;
    end;
    if KeyPressed then Exit;
  end;
end;

procedure PlaySong(Index : Byte);
begin
  LoadSongs;
  if Index < SongCount then
    PlayString(Songs[Index]);
end;

procedure StopMusic;
begin
  NoSound;
end;

end.
