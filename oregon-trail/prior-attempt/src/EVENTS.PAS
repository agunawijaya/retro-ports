{ ----------------------------------------------------------------- }
{  EVENTS.PAS                                                       }
{  Daily event roll.                                                }
{                                                                   }
{  Event probability table @ 0x241C8 — 20 rows of 8 bytes,          }
{  4 cumulative WORD thresholds each (illness/weather/damage/pos).  }
{  Selecting a row from current trail segment + season; rolling a   }
{  0..255 against the thresholds picks one of: nothing / illness /  }
{  weather / wagon damage / positive event.                         }
{ ----------------------------------------------------------------- }

unit Events;

interface

uses GameType, Rng, GameStat, Illness;

const
  NumEventRows = 20;

var
  EventTbl : array [0..NumEventRows-1] of TEventRow;

procedure InitEventTable;
function PickRow(MilesFraction : Byte; Month : Byte) : Byte;
function RollEvent : Byte;       { returns EvNone..EvTheft }
procedure ProcessIllnessEvent;
procedure ProcessWeatherEvent;
procedure ProcessDamageEvent;
procedure ProcessPositiveEvent;

implementation

{ Raw bytes copied from event_table_analysis.txt.  Each row is              }
{ (illness, weather, damage, positive) cumulative threshold pairs.          }
procedure SetRow(I : Byte; A, B, C, D : Word);
begin
  EventTbl[I].IllnessP  := A;
  EventTbl[I].WeatherP  := B;
  EventTbl[I].DamageP   := C;
  EventTbl[I].PositiveP := D;
end;

procedure InitEventTable;
begin
  SetRow( 0,   0,   0, 319,  19);
  SetRow( 1,   0,  24, 319,  21);
  SetRow( 2,   0,  51,  56,  22);
  SetRow( 3,  60,  53,  48,  17);
  SetRow( 4, 112,  53,  48,  20);
  SetRow( 5, 160,  53,  52,  19);
  SetRow( 6, 216,  51,  80,  21);
  SetRow( 7,   0,  82,  48,  19);
  SetRow( 8,  51,  84,  28,  20);
  SetRow( 9,  84,  83,  64,  21);
  SetRow(10, 162,  85,  60,  17);
  SetRow(11,   0, 114,  40,  13);
  SetRow(12,  52, 116,  44,  13);
  SetRow(13, 110, 110,  44,  15);
  SetRow(14, 164, 112,  54,  13);
  SetRow(15, 220, 108,  84,  20);
  SetRow(16,  88,   0,  80,  31);
  SetRow(17,   0,   0,  80,  31);
  SetRow(18, 176,   0,  80,  31);
  SetRow(19,   0,  35,  80,  34);
end;

{ Trail segment plus season modifier indexes into the 20-row table. }
function PickRow(MilesFraction : Byte; Month : Byte) : Byte;
var
  Seg, Bias : Byte;
begin
  if State.MilesTraveled < 500 then       Seg := 0
  else if State.MilesTraveled < 1000 then Seg := 1
  else if State.MilesTraveled < 1600 then Seg := 2
  else                                    Seg := 3;
  case Month of
    1, 2, 12 : Bias := 4;     { winter-ish, harsher table }
    6, 7, 8  : Bias := 0;     { high summer }
    else       Bias := 2;
  end;
  PickRow := (Seg * 5 + Bias) mod NumEventRows;
end;

function RollEvent : Byte;
var
  Row     : Byte;
  R       : Word;
  Cumul   : Word;
  Ev      : Byte;
begin
  Row := PickRow(0, State.CalDate.Month);
  R   := GetRand(400);   { wider than 255 to dilute high-illness rows }
  Ev  := EvNone;

  Cumul := EventTbl[Row].IllnessP;
  if R < Cumul then
  begin
    RollEvent := EvIllness;
    Exit;
  end;

  Inc(Cumul, EventTbl[Row].WeatherP);
  if R < Cumul then
  begin
    RollEvent := EvWeather;
    Exit;
  end;

  Inc(Cumul, EventTbl[Row].DamageP);
  if R < Cumul then
  begin
    RollEvent := EvWagonDamage;
    Exit;
  end;

  Inc(Cumul, EventTbl[Row].PositiveP);
  if R < Cumul then
  begin
    RollEvent := EvPositive;
    Exit;
  end;

  { Small residual chance for theft or accident. }
  if GetRand(100) < 3 then       Ev := EvAccident
  else if GetRand(100) < 2 then  Ev := EvTheft;
  RollEvent := Ev;
end;

procedure ProcessIllnessEvent;
var
  Victim : Byte;
  Tries  : Byte;
  IllId  : Byte;
begin
  Tries := 0;
  repeat
    Victim := GetRand(MaxParty);
    Inc(Tries);
  until (State.Party[Victim].Alive and (State.Party[Victim].Illness = IllNone))
        or (Tries >= MaxParty);
  if not State.Party[Victim].Alive then Exit;
  if State.Party[Victim].Illness <> IllNone then Exit;
  IllId := RollIllness;
  ApplyIllness(Victim, IllId);
end;

procedure ProcessWeatherEvent;
var
  M : Byte;
begin
  M := State.CalDate.Month;
  { Cold months risk losing clothing benefit and one ox to exposure. }
  if (M >= 10) or (M <= 2) then
  begin
    if (State.Supplies.Clothing < 3) and (CountAlivePty > 0) then
    begin
      { Pick a victim and chip away health. }
      ProcessIllnessEvent;
    end;
    if State.Supplies.Oxen > 0 then
      if RollPercent(20) then Dec(State.Supplies.Oxen);
  end
  else
  begin
    { Summer: heat saps food via spoilage. }
    if State.Supplies.Food > 10 then
      Dec(State.Supplies.Food, GetRand(10) + 5);
  end;
end;

procedure ProcessDamageEvent;
var
  K : Byte;
begin
  K := GetRand(3);     { 0=wheel 1=axle 2=tongue }
  case K of
    0 : if State.Supplies.SpareWheel > 0 then  Dec(State.Supplies.SpareWheel)
        else Dec(State.MilesTraveled, GetRand(20) + 5);
    1 : if State.Supplies.SpareAxle  > 0 then  Dec(State.Supplies.SpareAxle)
        else Dec(State.MilesTraveled, GetRand(20) + 5);
    2 : if State.Supplies.SpareTongue> 0 then  Dec(State.Supplies.SpareTongue)
        else Dec(State.MilesTraveled, GetRand(20) + 5);
  end;
end;

procedure ProcessPositiveEvent;
var
  K : Byte;
begin
  K := GetRand(4);
  case K of
    0 : Inc(State.Supplies.Food, GetRand(20) + 10);   { found berries }
    1 : Inc(State.Supplies.Bullets, GetRand(10) + 5); { trade with travelers }
    2 : Inc(State.Supplies.Clothing);                 { abandoned wagon }
    3 : Inc(State.Supplies.Cash, 500);                { found a sum }
  end;
end;

end.
