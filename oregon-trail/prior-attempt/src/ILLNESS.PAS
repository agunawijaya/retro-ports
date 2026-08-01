{ ----------------------------------------------------------------- }
{  ILLNESS.PAS                                                      }
{  Six diseases.  Parameter table mirrors the on-disk W0..W3 quad   }
{  at file offset 0x24156 (names) and 0x24198 (params).             }
{ ----------------------------------------------------------------- }

unit Illness;

interface

uses GameType, Rng, GameStat;

const
  NumIllnesses = 6;

var
  IllnessTbl : array [1..NumIllnesses] of TIllnessParam;

procedure InitIllness;
function RollIllness : Byte;
procedure ApplyIllness(MemberIdx, IllId : Byte);
procedure UpdateSickness;     { call once per simulated day }
function IllnessName(Id : Byte) : TString15;

implementation

procedure SetIllness(Idx : Byte;
                    const Nm : TString15;
                    W0, W1, W2, W3 : Word);
begin
  IllnessTbl[Idx].Name       := Nm;
  IllnessTbl[Idx].Weight     := W0;
  IllnessTbl[Idx].AltWeight  := W1;
  IllnessTbl[Idx].Duration   := W2;
  IllnessTbl[Idx].DailyDrain := W3;
end;

procedure InitIllness;
begin
  { Numbers from illness_analysis.txt — confirmed values from the binary. }
  SetIllness(IllExhaustion, 'exhaustion', 200,   0, 48, 109);
  SetIllness(IllTyphoid,    'typhoid',    109,   0, 71,  49);
  SetIllness(IllCholera,    'cholera',      0,  49, 60,  36);
  SetIllness(IllMeasles,    'measles',     67,  51, 79,  41);
  SetIllness(IllDysentery,  'dysentery',   59,   0, 45,  44);
  SetIllness(IllFever,      'fever',        0,   0, 53,  32);
end;

{ Weighted pick across illness Weight + AltWeight.  Returns illness ID. }
function RollIllness : Byte;
var
  Total : LongInt;
  R     : LongInt;
  I     : Byte;
  Acc   : LongInt;
begin
  Total := 0;
  for I := 1 to NumIllnesses do
    Total := Total + IllnessTbl[I].Weight + IllnessTbl[I].AltWeight;
  if Total <= 0 then
  begin
    RollIllness := IllFever;
    Exit;
  end;
  R := GetRand(Word(Total));
  Acc := 0;
  for I := 1 to NumIllnesses do
  begin
    Acc := Acc + IllnessTbl[I].Weight + IllnessTbl[I].AltWeight;
    if R < Acc then
    begin
      RollIllness := I;
      Exit;
    end;
  end;
  RollIllness := IllFever;
end;

procedure ApplyIllness(MemberIdx, IllId : Byte);
begin
  if not State.Party[MemberIdx].Alive then Exit;
  if State.Party[MemberIdx].Illness <> IllNone then Exit;
  State.Party[MemberIdx].Illness  := IllId;
  State.Party[MemberIdx].DaysSick := IllnessTbl[IllId].Duration;
end;

procedure UpdateSickness;
var
  I, IllId, Drain : Byte;
begin
  for I := 0 to MaxParty - 1 do
    with State.Party[I] do
      if Alive and (Illness <> IllNone) then
      begin
        IllId := Illness;
        Drain := IllnessTbl[IllId].DailyDrain;
        { Filling rations heal slightly; bare-bones speeds the drain.       }
        case State.Ration of
          RationFilling   : if Drain > 5 then Dec(Drain, 5);
          RationBareBones : Inc(Drain, 5);
        end;
        if Health <= Drain then
        begin
          Health := 0;
          Alive  := False;
        end
        else
        begin
          Dec(Health, Drain);
          Dec(DaysSick);
          if DaysSick = 0 then
            Illness := IllNone;
        end;
      end;
end;

function IllnessName(Id : Byte) : TString15;
begin
  if (Id >= 1) and (Id <= NumIllnesses) then
    IllnessName := IllnessTbl[Id].Name
  else
    IllnessName := '';
end;

end.
