{ ----------------------------------------------------------------- }
{  GAMETYPE.PAS                                                     }
{  Shared type definitions and constants.                           }
{  Reconstruction of Oregon Trail v2.1 (MECC, 1990) data model.     }
{ ----------------------------------------------------------------- }

unit GameType;

interface

const
  { Party }
  MaxParty       = 5;
  PartyNameLen   = 15;

  { Calendar }
  StartYear      = 1848;
  MaxMiles       = 2000;

  { Pace }
  PaceSteady     = 0;
  PaceStrenuous  = 1;
  PaceGrueling   = 2;
  PaceResting    = 3;

  { Ration }
  RationFilling  = 0;
  RationMeager   = 1;
  RationBareBones= 2;

  { Occupations }
  OccBanker      = 0;
  OccCarpenter   = 1;
  OccFarmer      = 2;

  { Difficulty }
  DiffGreenhorn  = 0;
  DiffAdventurer = 1;
  DiffTrailGuide = 2;

  { Illness IDs }
  IllNone        = 0;
  IllExhaustion  = 1;
  IllTyphoid     = 2;
  IllCholera     = 3;
  IllMeasles     = 4;
  IllDysentery   = 5;
  IllFever       = 6;

  { Event IDs returned by RollEvent }
  EvNone         = 0;
  EvIllness      = 1;
  EvWeather      = 2;
  EvWagonDamage  = 3;
  EvPositive     = 4;
  EvAccident     = 5;
  EvTheft        = 6;

  { Landmark category flags }
  LmFort         = 1;
  LmRiver        = 2;
  LmCity         = 3;
  LmGeography    = 4;
  LmFinal        = 5;

  { Per-landmark flag byte values found at offset 0 of a 37-byte record.   }
  { Only two records in the binary carry LmFlagFork: Fort Bridger and      }
  { Fort Walla Walla, both historic trail-fork junctions.  See Gap #4      }
  { closure notes in LANDMARK.PAS.                                         }
  LmFlagPlain    = $00;
  LmFlagFork     = $7D;

  { Sentinel marking a dead party slot }
  PartyDead      = $FF;

  { Months }
  MonthMarch     = 3;
  MonthNovember  = 11;

type
  TString15  = string[15];
  TString30  = string[30];
  TString80  = string[80];

  TDate = record
    Day   : Byte;
    Month : Byte;
    Year  : Word;
  end;

  TPartyMember = record
    Name       : TString15;
    Health     : Byte;          { 0..100; 0 = dead }
    Illness    : Byte;          { IllNone..IllFever }
    DaysSick   : Byte;
    Alive      : Boolean;       { mirrors Health > 0; sentinel $FF when dead }
  end;

  TSupplies = record
    Cash       : LongInt;       { cents }
    Food       : Word;          { pounds }
    Bullets    : Word;          { box of 20 each }
    Clothing   : Byte;          { sets }
    Oxen       : Byte;          { animals }
    SpareWheel : Byte;
    SpareAxle  : Byte;
    SpareTongue: Byte;
  end;

  TGameState = record
    Party          : array [0..MaxParty-1] of TPartyMember;
    PartySize      : Byte;
    Supplies       : TSupplies;
    Occupation     : Byte;
    Difficulty     : Byte;
    DepartureMonth : Byte;
    Pace           : Byte;
    Ration         : Byte;
    MilesTraveled  : Word;
    NextLandmark   : Byte;
    CalDate        : TDate;
    Score          : LongInt;
  end;

  { Landmark record laid out to match the 37-byte block in the binary. }
  TLandmark = record
    Flag       : Byte;          { 0 = inland, $7D in two records = special }
    Category   : Byte;
    MapX       : Word;
    MapY       : Word;
    Name       : TString30;
    RequiredMi : Word;          { miles required to reach }
    PictureIdx : Byte;          { index into P0..P17 PCC archive }
    SongIdx    : Byte;
  end;

  { 8-byte event-table row, exactly the on-disk shape at file 0x241C8.       }
  { Thresholds are cumulative probabilities (0..255 scale) for illness /     }
  { weather / wagon damage / positive events.                                }
  TEventRow = record
    IllnessP   : Word;
    WeatherP   : Word;
    DamageP    : Word;
    PositiveP  : Word;
  end;

  TIllnessParam = record
    Name       : TString15;
    Weight     : Word;     { spawn weight  (W0) }
    AltWeight  : Word;     { secondary weight  (W1) — used for cholera/measles }
    Duration   : Word;     { base recovery days (W2) }
    DailyDrain : Word;     { daily health loss (W3) }
  end;

implementation

end.
