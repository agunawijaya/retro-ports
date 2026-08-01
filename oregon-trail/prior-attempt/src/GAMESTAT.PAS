{ ----------------------------------------------------------------- }
{  GAMESTAT.PAS                                                     }
{  Holds the live game state in a single global record.             }
{  The original binary kept everything as data-segment globals; we  }
{  mirror that here so the layout matches the .GAM save dump.       }
{ ----------------------------------------------------------------- }

unit GameStat;

interface

uses GameType;

var
  State : TGameState;

{ Counts how many members still have Alive=True.  In the binary this is }
{ func @0x13045 — it scans byte ptr [0x1853+i] and counts entries that  }
{ are not the $FF sentinel. }
function CountAlivePty : Byte;

{ Decrement food by the daily consumption for the current ration level }
{ times alive party count.  Clamps at zero and reports underflow. }
function ConsumeFood : Boolean;

{ Reset State to a freshly-set-up game.  Does not pick names. }
procedure InitNewGame(Occ, Diff, Month : Byte);

implementation

function CountAlivePty : Byte;
var
  I, N : Byte;
begin
  N := 0;
  for I := 0 to MaxParty - 1 do
    if State.Party[I].Alive then
      Inc(N);
  CountAlivePty := N;
end;

function ConsumeFood : Boolean;
{ Confirmed by static disasm of func @0x13D26 + caller at 0x14172:        }
{   daily = (3 - ration_idx) * alive_count                                }
{ If daily > food, food := 0 (starvation event).                          }
{ See STATICTRACE.TXT section C for full evidence.                        }
var
  Per, Total, Alive : Word;
begin
  case State.Ration of
    RationFilling   : Per := 3;     { confirmed: ration idx 0 -> 3 }
    RationMeager    : Per := 2;     { confirmed: ration idx 1 -> 2 }
    RationBareBones : Per := 1;     { confirmed: ration idx 2 -> 1 }
  else
    Per := 2;
  end;
  Alive := CountAlivePty;
  Total := Per * Alive;
  if State.Supplies.Food >= Total then
  begin
    State.Supplies.Food := State.Supplies.Food - Total;
    ConsumeFood := True;
  end
  else
  begin
    State.Supplies.Food := 0;
    ConsumeFood := False;
  end;
end;

procedure InitNewGame(Occ, Diff, Month : Byte);
var
  I : Byte;
begin
  FillChar(State, SizeOf(State), 0);
  State.Occupation     := Occ;
  State.Difficulty     := Diff;
  State.DepartureMonth := Month;
  State.Pace           := PaceSteady;
  State.Ration         := RationFilling;
  State.MilesTraveled  := 0;
  State.NextLandmark   := 0;
  State.PartySize      := MaxParty;
  State.CalDate.Day    := 1;
  State.CalDate.Month  := Month;
  State.CalDate.Year   := StartYear;

  for I := 0 to MaxParty - 1 do
  begin
    State.Party[I].Health   := 100;
    State.Party[I].Illness  := IllNone;
    State.Party[I].DaysSick := 0;
    State.Party[I].Alive    := True;
  end;

  { Occupation-driven starting cash.  Confirmed in disasm — see              }
  { store_prices.txt 'Starting cash candidates'.                             }
  case Occ of
    OccBanker    : State.Supplies.Cash := 160000;   { $1600 }
    OccCarpenter : State.Supplies.Cash :=  80000;   { $800  }
    OccFarmer    : State.Supplies.Cash :=  40000;   { $400  }
  end;
end;

end.
