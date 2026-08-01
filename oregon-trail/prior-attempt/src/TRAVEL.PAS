{ ----------------------------------------------------------------- }
{  TRAVEL.PAS                                                       }
{  Daily simulation loop.                                           }
{                                                                   }
{  Mirrors pseudo-code 5.1 in LEARN_OregonTrail.md.                 }
{                                                                   }
{  Original screen-text positions in OREGON_UNPACKED.BIN:           }
{    DAILY_MENU header        @ 0x03DD6                             }
{    DAILY_TALK               @ 0x03E5A                             }
{    DAILY_PACE_RATION        @ 0x09DE9, 0x0A2B1                    }
{    PACE_MENU body           @ 0x09E05                             }
{    EXPLAIN_HINT pace        @ 0x09E86                             }
{    DAILY_REST text          @ 0x09F1A, 0x09FD8                    }
{    EVENT_THEFT              @ 0x02610, 0x0C7F0                    }
{    EVENT_BAD_WATER          @ 0x02996                             }
{    EVENT_NO_GRASS           @ 0x029B2                             }
{    TRAIL_DIVIDES_FORK_A     @ 0x02F7D                             }
{    TRAIL_DIVIDES_FORK_B     @ 0x0312D                             }
{    ENDGAME_VICTORY          @ 0x07CA5, 0x07E0B                    }
{    ILLNESS_DEATH            @ 0x0173E, 0x0AABE                    }
{    TOMBSTONE                @ 0x12975                             }
{ ----------------------------------------------------------------- }

unit Travel;

interface

uses Crt, GameType, GameStat, UI, Rng, Events, Illness,
     Landmark, River, Store, Hunting, SaveLoad, Dialogs, Music;

type
  TEndReason = (erContinue, erVictory, erAllDead, erWinter);

function RunDailyLoop : TEndReason;
procedure ShowVictoryScreen;
procedure ShowDeathScreen(Reason : TEndReason);

implementation

const
  DaysInMonth : array [1..12] of Byte =
    (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31);

procedure AdvanceDate(Days : Byte);
var
  Limit : Byte;
begin
  Inc(State.CalDate.Day, Days);
  while True do
  begin
    Limit := DaysInMonth[State.CalDate.Month];
    if (State.CalDate.Month = 2) and ((State.CalDate.Year mod 4) = 0) then
      Limit := 29;
    if State.CalDate.Day <= Limit then Exit;
    Dec(State.CalDate.Day, Limit);
    Inc(State.CalDate.Month);
    if State.CalDate.Month > 12 then
    begin
      State.CalDate.Month := 1;
      Inc(State.CalDate.Year);
    end;
  end;
end;

function SpeedFactor : Word;
{ Miles per "travel hour", scaled to oxen count.  Empirically calibrated   }
{ so a healthy team makes ~15-20 miles per day at Steady pace.             }
var
  Base : Word;
begin
  if State.Supplies.Oxen >= 6 then       Base := 3
  else if State.Supplies.Oxen >= 4 then  Base := 2
  else if State.Supplies.Oxen >= 2 then  Base := 1
  else                                   Base := 0;
  SpeedFactor := Base;
end;

function HoursForPace : Byte;
begin
  case State.Pace of
    PaceSteady    : HoursForPace := 8;
    PaceStrenuous : HoursForPace := 12;
    PaceGrueling  : HoursForPace := 16;
  else
    HoursForPace := 0;
  end;
end;

procedure ShowDailyMenu;
begin
  ClrScr;
  ShowStatus;
  WriteLn;
  WriteLn('  1. Continue on the trail');
  WriteLn('  2. Check supplies');
  WriteLn('  3. Change pace');
  WriteLn('  4. Change food rations');
  WriteLn('  5. Stop to rest');
  WriteLn('  6. Hunt for food');
  WriteLn('  7. Talk to people');
  WriteLn('  8. Save game');
  WriteLn('  Q. Quit to DOS');
  WriteLn;
end;

procedure ChangePace;
var
  C : Char;
begin
  WriteLn('  1. Steady');
  WriteLn('  2. Strenuous');
  WriteLn('  3. Grueling');
  WriteLn('  4. Resting');
  C := PromptChoice('Pace: ', '1', '4');
  State.Pace := Ord(C) - Ord('1');
end;

procedure ChangeRation;
var
  C : Char;
begin
  WriteLn('  1. Filling (3 lbs/person)');
  WriteLn('  2. Meager  (2 lbs/person)');
  WriteLn('  3. Bare bones (1 lb/person)');
  C := PromptChoice('Rations: ', '1', '3');
  State.Ration := Ord(C) - Ord('1');
end;

procedure TalkToPeople;
var
  E : TDialogEntry;
begin
  { Use zone-aware dialog pick (Gap #1 closure).  NPC advice tracks the    }
  { player's position on the trail rather than being uniform-random.      }
  if ReadDialogForMiles(State.MilesTraveled, E) then
  begin
    WriteLn;
    WriteLn(E.Speaker, ' says:');
    WriteLn;
    WriteLn(E.Body);
  end
  else
    WriteLn('There is no one to talk to here.');
  PauseForKey;
end;

procedure ProcessEvent(Ev : Byte);
var
  E : TDialogEntry;
begin
  case Ev of
    EvIllness     : ProcessIllnessEvent;
    EvWeather     : ProcessWeatherEvent;
    EvWagonDamage : ProcessDamageEvent;
    EvPositive    : ProcessPositiveEvent;
    EvAccident    :
      begin
        WriteLn('Someone in your party has had an accident.');
        ProcessIllnessEvent;
      end;
    EvTheft :
      begin
        WriteLn('Thieves visited your camp during the night.');
        if State.Supplies.Bullets > 5 then Dec(State.Supplies.Bullets, 5);
        if State.Supplies.Clothing > 0 then Dec(State.Supplies.Clothing);
      end;
  end;
end;

procedure OfferRouteFork(Idx : Byte);
{ The 0x7D flag (Gap #4) marks landmarks where the historic trail offered }
{ an alternate routing.  At Fort Bridger this is the Sublette Cutoff;     }
{ at Fort Walla Walla it is the Whitman Mission alternate.                }
var
  Skip : Word;
begin
  if Idx = 8 then       { Fort Bridger -- Sublette Cutoff }
  begin
    WriteLn('The Sublette Cutoff skips Fort Bridger and saves roughly 85 miles,');
    WriteLn('but the trail is harder and water is scarcer.');
    if PromptYesNo('Take the Sublette Cutoff?') then
    begin
      Skip := 85;
      Inc(State.MilesTraveled, Skip);
      WriteLn('You take the cutoff and bypass the fort.');
      Delay(1500);
      State.NextLandmark := 9;
      Exit;
    end;
  end
  else if Idx = 15 then  { Fort Walla Walla -- Whitman Mission alternate }
  begin
    WriteLn('You can rest at the Whitman Mission instead of the fort.');
    if PromptYesNo('Visit the mission?') then
    begin
      Inc(State.Supplies.Food, 20);
      WriteLn('The mission gives your party some food.');
      Delay(1500);
    end;
  end;
end;

procedure ArriveAtLandmark(Idx : Byte);
begin
  ClrScr;
  WriteLn('You have reached ', Landmarks[Idx].Name, '.');
  WriteLn;
  PlaySong(Landmarks[Idx].SongIdx);
  if HasRouteFork(Idx) then OfferRouteFork(Idx);
  case Landmarks[Idx].Category of
    LmFort  :
      if PromptYesNo('Do you want to look around the fort?') then
        ShopAtFort;
    LmRiver :
      CrossRiver(Landmarks[Idx].Name);
  end;
  State.NextLandmark := Idx + 1;
end;

function RunDailyLoop : TEndReason;
var
  Choice  : Char;
  Hours   : Byte;
  Miles   : Word;
  Ev      : Byte;
  LmIdx   : Integer;
  Quit    : Boolean;
begin
  Quit := False;
  while not Quit do
  begin
    ShowDailyMenu;
    Choice := PromptChoice('Choice: ', '1', 'Q');
    case Choice of
      '1' : ;   { fall through to advance day }
      '2' : begin ShowStatus; PauseForKey; Continue; end;
      '3' : begin ChangePace;    Continue; end;
      '4' : begin ChangeRation;  Continue; end;
      '5' : State.Pace := PaceResting;
      '6' : begin DoHunt;        Continue; end;
      '7' : begin TalkToPeople;  Continue; end;
      '8' : begin SaveGame('CURRENT.GAM'); WriteLn('Game saved.'); PauseForKey; Continue; end;
      'Q' :
        if PromptYesNo('Quit to DOS?') then
        begin
          RunDailyLoop := erContinue;
          Halt;
        end
        else Continue;
    end;

    { Advance one day. }
    Hours := HoursForPace;
    Miles := Hours * SpeedFactor;
    Inc(State.MilesTraveled, Miles);
    if State.MilesTraveled > MaxMiles then
      State.MilesTraveled := MaxMiles;

    if not ConsumeFood then
      ProcessIllnessEvent;     { hunger triggers a sickness roll }

    Ev := RollEvent;
    if Ev <> EvNone then ProcessEvent(Ev);

    UpdateSickness;

    LmIdx := FindLandmarkForMiles(State.MilesTraveled);
    if (LmIdx >= 0) and (LmIdx >= State.NextLandmark) then
      ArriveAtLandmark(LmIdx);

    AdvanceDate(1);

    if State.MilesTraveled >= MaxMiles then
    begin
      RunDailyLoop := erVictory;
      Exit;
    end;
    if CountAlivePty = 0 then
    begin
      RunDailyLoop := erAllDead;
      Exit;
    end;
    if (State.CalDate.Year > StartYear + 1) or
       ((State.CalDate.Year = StartYear + 1) and
        (State.CalDate.Month > MonthNovember)) then
    begin
      RunDailyLoop := erWinter;
      Exit;
    end;
  end;
  RunDailyLoop := erContinue;
end;

function BaseResources : LongInt;
begin
  BaseResources :=
       LongInt(State.Supplies.Cash) div 100
     + LongInt(State.Supplies.Food)
     + LongInt(State.Supplies.Bullets)
     + LongInt(State.Supplies.Oxen)        * 50
     + LongInt(State.Supplies.Clothing)    * 25
     + LongInt(State.Supplies.SpareWheel)  * 20
     + LongInt(State.Supplies.SpareAxle)   * 20
     + LongInt(State.Supplies.SpareTongue) * 20;
end;

procedure ShowVictoryScreen;
var
  Mult : Byte;
begin
  ClrScr;
  WriteLn('You have reached the Willamette Valley!');
  WriteLn;
  WriteLn('You survived the journey on the Oregon Trail.');
  WriteLn;
  case State.Occupation of
    OccBanker    : Mult := 1;
    OccCarpenter : Mult := 2;
    OccFarmer    : Mult := 3;
  else
    Mult := 1;
  end;
  State.Score := BaseResources * Mult * CountAlivePty;
  WriteLn('Final score: ', State.Score);
  if Length(State.Party[0].Name) > 0 then
    InsertHiScore(State.Party[0].Name, Word(State.Score and $FFFF));
  PauseForKey;
end;

procedure ShowDeathScreen(Reason : TEndReason);
var
  I : Byte;
begin
  ClrScr;
  case Reason of
    erAllDead : WriteLn('Your entire party has perished on the trail.');
    erWinter  : WriteLn('Winter has set in.  Your party cannot continue.');
  end;
  WriteLn;
  for I := 0 to MaxParty - 1 do
    if (not State.Party[I].Alive) and (Length(State.Party[I].Name) > 0) then
      AppendTombstone(State.Party[I].Name,
                      IllnessName(State.Party[I].Illness));
  PauseForKey;
end;

end.
