{ ================================================================= }
{                                                                   }
{   T H E   O R E G O N   T R A I L                                 }
{                                                                   }
{   Reconstruction of the v2.1 (1990, MECC) DOS title in            }
{   Turbo Pascal 5.5/6.0.  Built from the reverse-engineering       }
{   notes in oregon_trail_reverse.md and LEARN_OregonTrail.md.      }
{                                                                   }
{   This is a clean-room re-implementation: data tables (illness,   }
{   event, landmark) come from the confirmed binary analysis; all   }
{   prose, menus, and code are newly written for this rebuild.      }
{                                                                   }
{   To compile under Turbo Pascal 6.0:                              }
{     tpc /m OREGON.PAS                                             }
{                                                                   }
{ ================================================================= }

program Oregon;

uses Crt,
     GameType,
     Rng,
     GameStat,
     Landmark,
     Illness,
     Events,
     Dialogs,
     SaveLoad,
     UI,
     Store,
     Travel;

procedure ShowTitle;
begin
  ClrScr;
  WriteLn('===============================================================');
  WriteLn('              T H E   O R E G O N   T R A I L                 ');
  WriteLn('              MECC reconstruction --  Turbo Pascal             ');
  WriteLn('===============================================================');
  WriteLn;
end;

procedure PickOccupation;
var
  C : Char;
begin
  WriteLn('Choose your occupation:');
  WriteLn('  1. Banker     ($1600, score x1)');
  WriteLn('  2. Carpenter  ($800,  score x2)');
  WriteLn('  3. Farmer     ($400,  score x3)');
  C := PromptChoice('Occupation: ', '1', '3');
  State.Occupation := Ord(C) - Ord('1');
end;

procedure PickDifficulty;
var
  C : Char;
begin
  WriteLn('Choose your difficulty:');
  WriteLn('  1. Greenhorn');
  WriteLn('  2. Adventurer');
  WriteLn('  3. Trail guide');
  C := PromptChoice('Difficulty: ', '1', '3');
  State.Difficulty := Ord(C) - Ord('1');
end;

procedure PickMonth;
var
  M : Word;
begin
  WriteLn('Pick the month to leave Independence (3=March .. 7=July).');
  M := PromptInteger('Month: ', 3, 7);
  State.DepartureMonth := M;
  State.CalDate.Day    := 1;
  State.CalDate.Month  := M;
  State.CalDate.Year   := StartYear;
end;

procedure PickNames;
var
  I : Byte;
  Name : TString15;
begin
  WriteLn('Enter the names of the five members of your party.');
  WriteLn('Name 1 is the party leader.');
  for I := 0 to MaxParty - 1 do
  begin
    Write('  Name ', I + 1, ': ');
    Name := PromptName('');
    State.Party[I].Name := Name;
  end;
end;

procedure NewGame;
begin
  InitNewGame(0, 0, MonthMarch);
  ShowTitle;
  PickOccupation;
  WriteLn;
  PickDifficulty;
  WriteLn;
  PickMonth;
  WriteLn;
  { Reset all of state for the chosen occupation, then re-enter names. }
  InitNewGame(State.Occupation, State.Difficulty, State.DepartureMonth);
  PickNames;
  WriteLn;
  WriteLn('Visit Matt''s General Store before leaving Independence.');
  PauseForKey;
  ShopAtStart;
end;

procedure ShowHighScores;
var
  Tbl  : array [0..9] of THiScoreRec;
  N, I : Byte;
  S    : String;
begin
  ClrScr;
  ReadHiScores(Tbl, N);
  WriteLn('=== TOP TRAILBLAZERS ===');
  WriteLn;
  if N = 0 then
  begin
    WriteLn('  (no scores recorded yet)');
  end
  else
  begin
    for I := 0 to N - 1 do
    begin
      S[0] := Chr(Tbl[I].NameLen);
      Move(Tbl[I].Name[0], S[1], Tbl[I].NameLen);
      WriteLn('  ', I + 1:2, '. ', S:16, '  ', Tbl[I].Score:6);
    end;
  end;
  PauseForKey;
end;

procedure MainMenu;
var
  C : Char;
  R : Travel.TEndReason;
begin
  while True do
  begin
    ClrScr;
    ShowTitle;
    WriteLn;
    WriteLn('  1. Travel the trail');
    WriteLn('  2. Load a saved game');
    WriteLn('  3. View top scores');
    WriteLn('  Q. Quit to DOS');
    WriteLn;
    C := PromptChoice('Choose: ', '1', 'Q');
    case C of
      '1' :
        begin
          NewGame;
          R := RunDailyLoop;
          case R of
            erVictory : ShowVictoryScreen;
            erAllDead, erWinter : ShowDeathScreen(R);
          end;
        end;
      '2' :
        begin
          if LoadGame('CURRENT.GAM') then
          begin
            R := RunDailyLoop;
            case R of
              erVictory : ShowVictoryScreen;
              erAllDead, erWinter : ShowDeathScreen(R);
            end;
          end
          else
          begin
            WriteLn('No saved game found.');
            PauseForKey;
          end;
        end;
      '3' : ShowHighScores;
      'Q' : Exit;
    end;
  end;
end;

begin
  SeedRng;
  InitLandmarks;
  InitIllness;
  InitEventTable;
  OpenDialogs;
  MainMenu;
  CloseDialogs;
  ClrScr;
  WriteLn('Have a good trail.');
end.
