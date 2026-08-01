{ ----------------------------------------------------------------- }
{  HUNTING.PAS                                                      }
{  Real-time hunting mini-game.                                     }
{                                                                   }
{  In the original, a crosshair moves under joystick (port 0x201)   }
{  or keyboard control, SPACE fires, and animals carry per-species  }
{  meat weights.  Joystick code lives near 0x11580 in the binary.   }
{ ----------------------------------------------------------------- }

unit Hunting;

interface

uses Crt, GameType, Rng, GameStat;

procedure DoHunt;

implementation

type
  TAnimal = (anNone, anRabbit, anSquirrel, anDeer, anBuffalo, anBear);

const
  AnimalMeat : array [TAnimal] of Word =
    (0, 2, 1, 50, 800, 350);

  AnimalChance : array [TAnimal] of Byte =
    (0, 30, 25, 25, 15, 5);

procedure ShowHud(Bullets, Bagged : Word; TimeLeft : Word);
begin
  GotoXY(1, 1);
  Write('Bullets: ', Bullets:4,
        '   Meat bagged: ', Bagged:4,
        '   Time: ', TimeLeft:3, ' ');
end;

function RollAnimal : TAnimal;
var
  R, Acc : Word;
  A      : TAnimal;
begin
  R := GetRand(100);
  Acc := 0;
  for A := anRabbit to anBear do
  begin
    Inc(Acc, AnimalChance[A]);
    if R < Acc then
    begin
      RollAnimal := A;
      Exit;
    end;
  end;
  RollAnimal := anNone;
end;

procedure FireShot(var Bagged, BulletsLeft : Word; var Streak : Byte);
var
  Game : TAnimal;
  HitPct : Byte;
begin
  if BulletsLeft = 0 then
  begin
    Write(#7);  { bell }
    Exit;
  end;
  Dec(BulletsLeft);
  Game := RollAnimal;
  if Game = anNone then
  begin
    Streak := 0;
    Exit;
  end;
  { Hit chance: bigger animals are easier to hit but rarer to spawn. }
  case Game of
    anRabbit, anSquirrel : HitPct := 35;
    anDeer               : HitPct := 55;
    anBuffalo            : HitPct := 75;
    anBear               : HitPct := 45;
  else
    HitPct := 30;
  end;
  if RollPercent(HitPct) then
  begin
    Inc(Bagged, AnimalMeat[Game]);
    Inc(Streak);
    GotoXY(1, 24);
    Write('Hit! ');
  end
  else
  begin
    Streak := 0;
    GotoXY(1, 24);
    Write('Missed.');
  end;
end;

procedure DoHunt;
var
  TimeLeft : Word;
  Bagged   : Word;
  Streak   : Byte;
  Key      : Char;
  Carry    : Word;
begin
  if State.Supplies.Bullets = 0 then
  begin
    WriteLn('You have no bullets to hunt with.');
    Delay(2000);
    Exit;
  end;
  ClrScr;
  TimeLeft := 60;
  Bagged   := 0;
  Streak   := 0;
  ShowHud(State.Supplies.Bullets, Bagged, TimeLeft);

  while (TimeLeft > 0) and (State.Supplies.Bullets > 0) do
  begin
    if KeyPressed then
    begin
      Key := ReadKey;
      case Key of
        ' ' : FireShot(Bagged, State.Supplies.Bullets, Streak);
        #27 : TimeLeft := 0;
      end;
      ShowHud(State.Supplies.Bullets, Bagged, TimeLeft);
    end;
    Delay(80);
    Dec(TimeLeft);
    if (TimeLeft mod 5) = 0 then
      ShowHud(State.Supplies.Bullets, Bagged, TimeLeft);
  end;

  { Game limits the haul a wagon can carry back to 100 lbs at a time. }
  if Bagged > 100 then
    Carry := 100
  else
    Carry := Bagged;
  Inc(State.Supplies.Food, Carry);
  GotoXY(1, 24);
  Write('You brought back ', Carry, ' pounds of meat.');
  Delay(2500);
end;

end.
