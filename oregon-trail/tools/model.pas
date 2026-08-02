{ model.pas -- the recovered simulation, written out as runnable Pascal.

  This is NOT a reconstruction of MECC's source. It cannot be: the original is
  a compiled program, no tool here recovers Pascal from object code, and 22.6%
  of the binary is a third-party library nobody archived. Nothing in this file
  came from decompiling anything.

  What it is instead: every rule recovered from the binary, written down in a
  form that runs. Prose can hide a mistake -- "health accumulates from pace and
  rations" sounds right whether or not the coefficients are. Code cannot. If a
  formula here is wrong, the numbers it prints are wrong, and someone can say
  so.

  It compiles with the game's own compiler, Turbo Pascal 5.0:

      TPC MODEL.PAS
      MODEL

  Every constant is marked with where it came from. Read those marks: some are
  read straight out of the binary and some are honestly not known, and the
  difference matters more than the model does.
}

program Model;

const
  { ---- established: read from the binary, address given ---------------- }

  { The store's own dialogue, at image 0x0DE5C onward. The shopkeeper states
    every price out loud, which is why these needed no disassembly at all. }
  PriceYoke      = 40.00;    { "I charge $40 a yoke", 2 oxen to a yoke }
  PriceFoodLb    =  0.20;    { "My price is 20 cents a pound"          }
  PriceClothing  = 10.00;    { "Each set is $10.00"                    }
  PriceAmmoBox   =  2.00;    { "boxes of 20 bullets. Each box costs $2.00" }
  PricePart      = 10.00;    { wheel, axle, tongue -- "$10 each"       }
  MaxOxen        = 20;       { "You may only take 20 oxen"             }
  MaxFoodLb      = 2000;     { image 0x0E1FD: cmp [bp-2], 0x07D0       }
  BulletsPerBox  = 20;

  { Starting money by profession -- $1,600 for a banker was read off the store
    screen under emulation. The other two are the game's documented values and
    are NOT confirmed from this binary. }
  MoneyBanker    = 1600.00;  { confirmed: the running game printed it }
  MoneyCarpenter =  800.00;  { [inferred] }
  MoneyFarmer    =  400.00;  { [inferred] }

  { Scoring. The words and the numbers sit adjacent in the data segment:
    0x0C0A7 "good\fair\poor\very poor", 0x0C0C0 "500\400\300\200". }
  PtsGood        = 500;
  PtsFair        = 400;
  PtsPoor        = 300;
  PtsVeryPoor    = 200;
  BulletsPerPt   = 50;       { image 0x08128: divide by 50.0 }
  FoodLbPerPt    = 25;       { image 0x08160: divide by 25.0 }
  DollarsPerPt   = 5;        { image 0x08181: divide by 5.0  }

  { Profession multiplier, from the strings at 0x07DAF: "carpenter ... doubled",
    "farmer ... tripled". A banker gets no sentence and no multiplier. }
  MultBanker     = 1;
  MultCarpenter  = 2;
  MultFarmer     = 3;

  IllnessLow     = 3;        { the array is array[3..8] of string[10], which is }
  IllnessHigh    = 8;        { why its address never appears -- see document 3  }

  { ---- NOT recovered: named so they cannot be mistaken for facts ------- }

  { Writing this file is how the health formula's first version was caught.
    The documents used to say

        health := health + (pace+1)*2*k + rations*2 + weatherBits

    which is too simple. The integer term at image 0x1404E is real -- it is
    exactly (pace+1)*2*k + rations*2 + two weather bits -- but it is stored to
    a local and then becomes *one argument among six* to a longer computation
    at 0x140C2, alongside two byte variables at DS:0x199E and DS:0x199F, a
    second local, and Real constants near 0.9 and 0.5. That computation has not
    been traced.

    The update itself has since been read -- health halves on a good day and
    rises by 0.2 on a bad one, image 0x14055 -- and is implemented below. What
    is still missing is the threshold that decides "bad", and the divisor in the
    casualty probability. Both are marked where they are stood in for. }

  DeathOffset    = 2.5;      { image 0x04871: the literal 2.5 -- established }

  { The per-leg rate byte lives in a 37-byte record at DS:0x08B2. Its values
    have not been extracted, so a flat rate stands in. }
  LegRate        = 18;       { NOT RECOVERED -- a placeholder }

  TrailMiles     = 2040;     { "2000 miles of plains, rivers, and mountains" }
  PartySize      = 5;        { "I see that you have 5 people in all" }

type
  Person = record
    Name  : string[10];      { DS:0x17FE -- eleven bytes each, exactly }
    Alive : Boolean;
    Ill    : Integer;        { 0, or an illness code 3..8 }
  end;

var
  Party      : array[1..PartySize] of Person;
  Illness    : array[IllnessLow..IllnessHigh] of string[10];
  PaceWord   : array[0..2] of string[10];
  RationWord : array[0..2] of string[10];

  Pace, Rations : Integer;   { DS:0x185D and DS:0x185E -- 0, 1, 2 }
  Food          : LongInt;   { DS:0x183F -- pounds }
  Cash          : Real;
  Health        : Real;      { DS:0x1886 -- a badness score: it goes up }
  Oxen, Clothes, Bullets, Parts : Integer;
  Miles, Day    : LongInt;
  Profession    : Integer;
  Buried        : Integer;

{ ---- the four formulas ------------------------------------------------- }

{ image 0x0003C5:  legRate * (pace + 2) / 2 }
function MilesToday : Real;
begin
  MilesToday := LegRate * (Pace + 2) / 2.0;
end;

{ image 0x013D34:  people * (3 - rations) }
function FoodEatenToday : Integer;
var i, alive : Integer;
begin
  alive := 0;
  for i := 1 to PartySize do
    if Party[i].Alive then Inc(alive);
  FoodEatenToday := alive * (3 - Rations);
end;

{ image 0x013FF9 and 0x014045 -- the strain the day put on the party. }
function HealthTermToday : Integer;
begin
  HealthTermToday := (Pace + 1) * 2 + Rations * 2;
end;

{ image 0x014055. Health halves when the day goes well and rises by a fifth
  when it does not -- an exponential decay with a linear penalty, which is why
  a party recovers quickly but three bad weeks running are fatal. }
procedure UpdateHealth(strainedDay : Boolean);
begin
  if strainedDay or (Food <= 0) then
    Health := Health + 0.2
  else
    Health := Health * 0.5;
end;

{ ---- the store, which states its own prices ---------------------------- }

procedure Outfit;
begin
  case Profession of
    1 : Cash := MoneyBanker;
    2 : Cash := MoneyCarpenter;
  else  Cash := MoneyFarmer;
  end;
  { The shopkeeper's advice, not the game's rules: "at least 3 yoke",
    "200 pounds per person", "2 sets of clothes per person". The game lets you
    ignore all of it, which is where its difficulty lives. }
  Oxen    := 6;                          { 3 yoke }
  Food    := 200 * PartySize;
  Clothes := 2 * PartySize;
  Bullets := 5 * BulletsPerBox;
  Parts   := 3;
  Cash := Cash - (Oxen div 2) * PriceYoke
               - Food * PriceFoodLb
               - Clothes * PriceClothing
               - (Bullets div BulletsPerBox) * PriceAmmoBox
               - Parts * PricePart;
end;

{ ---- scoring ----------------------------------------------------------- }

{ The four bands and their values are adjacent in the data segment:
  0x0C0A7 "goodair\poorery poor" and 0x0C0C0 "500ĀÀ".
  Which band you are in depends on the health value, which is not reproduced,
  so the score is shown for all four rather than guessed at. }

function BandWord(band : Integer) : string;
begin
  case band of
    0 : BandWord := 'good';
    1 : BandWord := 'fair';
    2 : BandWord := 'poor';
  else  BandWord := 'very poor';
  end;
end;

function BandPoints(band : Integer) : Integer;
begin
  case band of
    0 : BandPoints := PtsGood;
    1 : BandPoints := PtsFair;
    2 : BandPoints := PtsPoor;
  else  BandPoints := PtsVeryPoor;
  end;
end;

function Score(band : Integer) : LongInt;
var total : LongInt; mult : Integer;
begin
  total := PartySize * BandPoints(band);
  total := total + 50;                          { the wagon }
  total := total + Oxen * 4;
  total := total + Parts * 2 + Clothes * 2;
  total := total + Bullets div BulletsPerPt;    { one point per 50 }
  total := total + Food div FoodLbPerPt;        { one point per 25 lb }
  total := total + Trunc(Cash) div DollarsPerPt;{ one point per $5 }
  case Profession of
    1 : mult := MultBanker;
    2 : mult := MultCarpenter;
  else  mult := MultFarmer;
  end;
  Score := total * mult;
end;

{ ---- one day, and a whole journey -------------------------------------- }

procedure OneDay;
begin
  Inc(Day);
  Miles := Miles + Trunc(MilesToday);
  Food := Food - FoodEatenToday;
  { The strain threshold is a Real the game computes earlier in the day and
    which is not traced; the pace-and-rations term stands in for it here, so
    the shape is right and the exact day a party turns is not. }
  UpdateHealth(HealthTermToday > 6);
  { Still no deaths: the casualty probability is (health - 2.5) / y, and y is
    computed from state that has not been traced. }
end;

procedure Journey;
begin
  Miles := 0; Day := 0; Health := 1.0;
  while (Miles < TrailMiles) and (Day < 400) and (Food > 0) do
    OneDay;
end;

procedure Setup;
var i : Integer;
begin
  Illness[3] := 'exhaustion'; Illness[4] := 'typhoid';
  Illness[5] := 'cholera';    Illness[6] := 'measles';
  Illness[7] := 'dysentery';  Illness[8] := 'a fever';
  PaceWord[0] := 'steady';    PaceWord[1] := 'strenuous';
  PaceWord[2] := 'grueling';
  RationWord[0] := 'filling'; RationWord[1] := 'meager';
  RationWord[2] := 'bare bones';
  for i := 1 to PartySize do
  begin
    Party[i].Alive := True;
    Party[i].Ill := 0;
  end;
end;

procedure RunOne(p, r : Integer);
begin
  Setup;
  Pace := p; Rations := r;
  Profession := 1;
  Outfit;
  Journey;
  WriteLn(PaceWord[Pace]:10, RationWord[Rations]:12,
          Trunc(MilesToday):8, FoodEatenToday:8,
          Day:8, Food:9, HealthTermToday:6, Health:9:2);
end;

var band, i : Integer;

begin
  WriteLn('The Oregon Trail -- the recovered rules, run.');
  WriteLn('This is not MECC''s source. It is what the binary was found to say.');
  WriteLn;
  WriteLn('     pace     rations   miles/d  food/d    days  food left  term   health');
  WriteLn('  ------------------------------------------------------------------');
  for i := 0 to 2 do
    RunOne(i, i);
  RunOne(0, 2);
  RunOne(2, 0);
  WriteLn;
  WriteLn('  miles/d = legRate x (pace + 2) / 2      image 0x0003C5');
  WriteLn('  food/d  = people x (3 - rations)        image 0x013D34');
  WriteLn('  health term = (pace+1) x 2 + rations x 2  image 0x014045');
  WriteLn('  legRate is NOT recovered; ', LegRate, ' stands in for it.');
  WriteLn;
  WriteLn('Health halves on a good day and rises 0.2 on a bad one (0x14055).');
  WriteLn('The threshold for "bad" is a Real the game computes earlier and');
  WriteLn('which is not traced, so the shape is right and the exact day a');
  WriteLn('party turns is not. No deaths: the casualty odds are');
  WriteLn('(health - 2.5) / y, and y is still unrecovered.');
  WriteLn;
  WriteLn('Outfitted as a banker at Matt''s stated prices, the score would be:');
  for band := 0 to 3 do
    WriteLn('    all five in ', BandWord(band):10, ' health: ', Score(band):6);
  WriteLn;
  WriteLn('Store: yoke $', PriceYoke:0:2, ' (2 oxen), food $', PriceFoodLb:0:2,
          '/lb, clothing $', PriceClothing:0:2);
  WriteLn('       ammo $', PriceAmmoBox:0:2, '/box of ', BulletsPerBox,
          ', parts $', PricePart:0:2, ', ferry $5.00');
  WriteLn('Caps : ', MaxOxen, ' oxen, ', MaxFoodLb, ' lb of food, 3 of each part');
end.
