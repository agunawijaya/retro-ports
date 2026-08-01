{ ----------------------------------------------------------------- }
{  RIVER.PAS                                                        }
{  River crossing: ford / caulk-and-float / ferry / hire guide.     }
{                                                                   }
{  Risk model (from pseudo-code 5.4 in LEARN doc):                  }
{    ford depth <= 2.5 ft  : safe                                   }
{    ford depth >  2.5 ft  : ~70% failure                           }
{    caulk-and-float       : ~30% wagon-tips failure                }
{    ferry                 : costs $5..$10, near-100% safe          }
{    indian guide          : costs $10..$30, near-100% safe         }
{                                                                   }
{  Original screen-text positions in OREGON_UNPACKED.BIN:           }
{    RIVER_MENU (4 options)   @ 0x05A99                             }
{ ----------------------------------------------------------------- }

unit River;

interface

uses Crt, GameType, Rng, GameStat, Store;

type
  TRiverChoice  = (rcFord, rcCaulk, rcFerry, rcGuide, rcWait);
  TRiverOutcome = (roSuccess, roLostSupplies, roTipped, roDrowning, roTooLong);

procedure CrossRiver(LandmarkName : TString30);

implementation

function RandDepth : Word;
{ Returns depth in tenths-of-foot (e.g. 25 = 2.5 ft).                       }
begin
  RandDepth := GetRand(80) + 5;   { 0.5 .. 8.4 ft }
end;

procedure ShowDepth(Depth : Word);
begin
  Write(Depth div 10, '.', Depth mod 10, ' feet');
end;

procedure ApplyOutcome(Outcome : TRiverOutcome);
var
  I : Byte;
begin
  case Outcome of
    roSuccess : WriteLn('You make it across with no trouble.');
    roLostSupplies :
      begin
        WriteLn('Some of your supplies were swept downstream.');
        if State.Supplies.Food > 50    then Dec(State.Supplies.Food, 50);
        if State.Supplies.Bullets > 10 then Dec(State.Supplies.Bullets, 10);
        if State.Supplies.Clothing > 0 then Dec(State.Supplies.Clothing);
      end;
    roTipped :
      begin
        WriteLn('The wagon tipped over in the river!');
        if State.Supplies.Food > 100   then Dec(State.Supplies.Food, 100);
        if State.Supplies.Clothing > 1 then Dec(State.Supplies.Clothing, 1);
        if State.Supplies.SpareWheel > 0 then Dec(State.Supplies.SpareWheel);
      end;
    roDrowning :
      begin
        WriteLn('A member of your party has drowned.');
        for I := 0 to MaxParty - 1 do
          if State.Party[I].Alive then
          begin
            State.Party[I].Health := 0;
            State.Party[I].Alive  := False;
            Break;
          end;
      end;
    roTooLong :
      WriteLn('You wait three days for the water to drop.');
  end;
  Delay(2000);
end;

function DoFord(Depth : Word) : TRiverOutcome;
begin
  if Depth <= 25 then
    DoFord := roSuccess
  else if RollPercent(70) then
  begin
    if RollPercent(20) then
      DoFord := roDrowning
    else
      DoFord := roLostSupplies;
  end
  else
    DoFord := roSuccess;
end;

function DoCaulk(Depth : Word) : TRiverOutcome;
begin
  if Depth < 10 then
    DoCaulk := roSuccess
  else if RollPercent(30) then
    DoCaulk := roTipped
  else
    DoCaulk := roSuccess;
end;

function DoFerry : TRiverOutcome;
var
  Cost : Word;
begin
  Cost := 500 + GetRand(500);   { $5..$10 }
  if State.Supplies.Cash < Cost then
  begin
    WriteLn('You cannot afford the ferry fare.');
    DoFerry := roTooLong;
    Exit;
  end;
  State.Supplies.Cash := State.Supplies.Cash - Cost;
  DoFerry := roSuccess;
end;

function DoGuide : TRiverOutcome;
var
  Cost : Word;
begin
  Cost := 1000 + GetRand(2000);  { $10..$30 }
  if State.Supplies.Cash < Cost then
  begin
    WriteLn('You cannot afford an Indian guide.');
    DoGuide := roTooLong;
    Exit;
  end;
  State.Supplies.Cash := State.Supplies.Cash - Cost;
  DoGuide := roSuccess;
end;

procedure CrossRiver(LandmarkName : TString30);
var
  Depth   : Word;
  Choice  : Char;
  Done    : Boolean;
  Outcome : TRiverOutcome;
begin
  Depth := RandDepth;
  Done  := False;
  while not Done do
  begin
    ClrScr;
    WriteLn('You have arrived at ', LandmarkName, '.');
    Write('  Depth of river: ');
    ShowDepth(Depth);
    WriteLn;
    WriteLn;
    WriteLn('  1. Attempt to ford');
    WriteLn('  2. Caulk the wagon and float across');
    WriteLn('  3. Take the ferry');
    WriteLn('  4. Hire an Indian guide');
    WriteLn('  5. Wait for conditions to improve');
    WriteLn;
    Write('Choice: ');
    Choice := ReadKey;
    WriteLn(Choice);

    case Choice of
      '1' : begin Outcome := DoFord(Depth);  Done := True; end;
      '2' : begin Outcome := DoCaulk(Depth); Done := True; end;
      '3' : begin Outcome := DoFerry;        Done := True; end;
      '4' : begin Outcome := DoGuide;        Done := True; end;
      '5' : begin
              Depth := RandDepth;
              Inc(State.CalDate.Day, 3);
              Outcome := roTooLong;
              Done := True;
            end;
    end;
  end;
  ApplyOutcome(Outcome);
end;

end.
