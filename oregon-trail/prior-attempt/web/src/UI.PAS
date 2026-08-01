{ ----------------------------------------------------------------- }
{  UI.PAS                                                           }
{  Text-mode menus, status panels, and shared input helpers.        }
{ ----------------------------------------------------------------- }

unit UI;

interface

uses Crt, GameType, GameStat;

procedure ShowStatus;
procedure PauseForKey;
function  PromptChoice(const Prompt : String; Lo, Hi : Char) : Char;
function  PromptName(const Prompt : String) : TString15;
function  PromptInteger(const Prompt : String; Min, Max : Word) : Word;
function  PromptYesNo(const Prompt : String) : Boolean;

procedure ShowDate(const D : TDate);
procedure ShowDollarsLn(Cents : LongInt);

implementation

const
  MonthName : array [1..12] of String[10] =
    ('January', 'February', 'March', 'April', 'May', 'June',
     'July', 'August', 'September', 'October', 'November', 'December');

procedure ShowDate(const D : TDate);
begin
  Write(MonthName[D.Month], ' ', D.Day, ', ', D.Year);
end;

procedure ShowDollarsLn(Cents : LongInt);
begin
  Write('$', Cents div 100, '.');
  if (Cents mod 100) < 10 then Write('0');
  WriteLn(Cents mod 100);
end;

procedure ShowStatus;
var
  Alive, I : Byte;
begin
  Alive := 0;
  for I := 0 to MaxParty - 1 do
    if State.Party[I].Alive then Inc(Alive);
  WriteLn('---------------------------------------------------------------');
  Write  ('  Date: '); ShowDate(State.CalDate);
  Write  ('   Miles: ', State.MilesTraveled, '/', MaxMiles);
  WriteLn('   Party: ', Alive, '/', State.PartySize);
  Write  ('  Cash: '); ShowDollarsLn(State.Supplies.Cash);
  WriteLn('  Food: ', State.Supplies.Food, ' lbs   ',
          'Bullets: ', State.Supplies.Bullets);
  WriteLn('  Oxen: ', State.Supplies.Oxen, '   ',
          'Clothes: ', State.Supplies.Clothing, '   ',
          'Wheels/Axles/Tongues: ',
          State.Supplies.SpareWheel, '/',
          State.Supplies.SpareAxle, '/',
          State.Supplies.SpareTongue);
  WriteLn('---------------------------------------------------------------');
end;

procedure PauseForKey;
begin
  WriteLn;
  WriteLn('Press any key to continue...');
  ReadKey;
end;

function PromptChoice(const Prompt : String; Lo, Hi : Char) : Char;
var
  C : Char;
begin
  repeat
    Write(Prompt);
    C := UpCase(ReadKey);
    WriteLn(C);
  until (C >= Lo) and (C <= Hi);
  PromptChoice := C;
end;

function PromptName(const Prompt : String) : TString15;
var
  S : String;
begin
  Write(Prompt);
  ReadLn(S);
  if Length(S) > PartyNameLen then
    S[0] := Chr(PartyNameLen);
  PromptName := S;
end;

function PromptInteger(const Prompt : String; Min, Max : Word) : Word;
var
  V : LongInt;
  S : String;
  E : Integer;
begin
  repeat
    Write(Prompt);
    ReadLn(S);
    Val(S, V, E);
  until (E = 0) and (V >= Min) and (V <= Max);
  PromptInteger := V;
end;

function PromptYesNo(const Prompt : String) : Boolean;
var
  C : Char;
begin
  Write(Prompt, ' (Y/N) ');
  repeat
    C := UpCase(ReadKey);
  until (C = 'Y') or (C = 'N');
  WriteLn(C);
  PromptYesNo := C = 'Y';
end;

end.
