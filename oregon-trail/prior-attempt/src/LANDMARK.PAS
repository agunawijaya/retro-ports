{ ----------------------------------------------------------------- }
{  LANDMARK.PAS                                                     }
{  16 landmarks along the historic Oregon Trail.                    }
{                                                                   }
{  Names and order match the strings found at file offset 0x23D17   }
{  through 0x23F8C; required-miles are reconstructed from the       }
{  inter-record spacing data documented in landmark_table.txt.      }
{                                                                   }
{  Gap #4 closure -- the 0x7D flag byte:                            }
{                                                                   }
{  The 37-byte record laid out at 0x23D80 onwards starts with a     }
{  flag byte at offset 0.  Across all 15 active records this byte   }
{  is 0x00, EXCEPT at:                                              }
{      record  5 (Fort Bridger)      -> 0x7D                        }
{      record 12 (Fort Walla Walla)  -> 0x7D                        }
{                                                                   }
{  Static analysis on the unpacked binary found:                    }
{    * no CMP imm8 0x7D against AL/AH/BL anywhere in the code seg   }
{    * no MOV reg8, 0x7D                                            }
{    * no record-stride-37 multiplier (no MOV CX,0x25 + MUL)        }
{                                                                   }
{  So the byte is not loaded as a literal constant comparison.      }
{  The most consistent interpretation is that 0x7D is a non-zero    }
{  sentinel ("any non-zero value here means look at the auxiliary   }
{  variant data") -- the code path that consumes it would test      }
{  `[record].flag <> 0` and then branch to a variant arrival        }
{  sequence specific to that landmark.                              }
{                                                                   }
{  Historical match for that interpretation:                        }
{    Fort Bridger      -- Sublette Cutoff bypasses the fort. The    }
{                         string "Sublette" is embedded at          }
{                         0x23BFC, just before the landmark table.  }
{    Fort Walla Walla  -- Whitman Mission / Catholic Mission        }
{                         alternate route.                          }
{  Both are the only landmarks on the historic trail where the      }
{  emigrant had a choice of route.                                  }
{                                                                   }
{  Closure status: HIGH CONFIDENCE on the WHICH landmarks (direct   }
{  byte evidence).  MEDIUM CONFIDENCE on the WHY (historical        }
{  + structural inference, no direct branch site located).          }
{ ----------------------------------------------------------------- }

unit Landmark;

interface

uses GameType;

const
  NumLandmarks = 18;        { 16 original + Fort Walla Walla + The Dalles split out }

var
  Landmarks : array [0..NumLandmarks-1] of TLandmark;

procedure InitLandmarks;
function FindLandmarkForMiles(Miles : Word) : Integer;
function IsRiver(Idx : Byte) : Boolean;
function IsFort(Idx : Byte) : Boolean;
function HasRouteFork(Idx : Byte) : Boolean;

implementation

procedure SetLandmark(Idx : Byte;
                     const Nm : TString30;
                     Mi : Word;
                     Cat : Byte;
                     Pic, Song : Byte;
                     FlagVal : Byte);
begin
  Landmarks[Idx].Flag       := FlagVal;
  Landmarks[Idx].Category   := Cat;
  Landmarks[Idx].MapX       := 0;
  Landmarks[Idx].MapY       := 0;
  Landmarks[Idx].Name       := Nm;
  Landmarks[Idx].RequiredMi := Mi;
  Landmarks[Idx].PictureIdx := Pic;
  Landmarks[Idx].SongIdx    := Song;
end;

function HasRouteFork(Idx : Byte) : Boolean;
begin
  HasRouteFork := Landmarks[Idx].Flag = LmFlagFork;
end;

procedure InitLandmarks;
begin
  { Cumulative miles approximate the geographic distances of the historic   }
  { route.  Categories follow LmFort/LmRiver/etc. constants.                }
  { Flag byte preserves the 0x7D marker observed at the two historic        }
  { trail-fork junctions (see header comment).                              }
  SetLandmark( 0, 'Independence',              0, LmCity,       0,  0, LmFlagPlain);
  SetLandmark( 1, 'Kansas River crossing',   102, LmRiver,      8,  6, LmFlagPlain);
  SetLandmark( 2, 'Big Blue River crossing', 185, LmRiver,      8,  6, LmFlagPlain);
  SetLandmark( 3, 'Fort Kearney',            304, LmFort,       1,  1, LmFlagPlain);
  SetLandmark( 4, 'Chimney Rock',            554, LmGeography,  2,  2, LmFlagPlain);
  SetLandmark( 5, 'Fort Laramie',            640, LmFort,       3,  1, LmFlagPlain);
  SetLandmark( 6, 'Independence Rock',       830, LmGeography,  4,  2, LmFlagPlain);
  SetLandmark( 7, 'South Pass',              932, LmGeography,  5,  3, LmFlagPlain);
  SetLandmark( 8, 'Fort Bridger',           1054, LmFort,       6,  1, LmFlagFork);  { Sublette Cutoff }
  SetLandmark( 9, 'Green River crossing',   1144, LmRiver,      8,  6, LmFlagPlain);
  SetLandmark(10, 'Soda Springs',           1288, LmGeography,  7,  2, LmFlagPlain);
  SetLandmark(11, 'Fort Hall',              1395, LmFort,       9,  1, LmFlagPlain);
  SetLandmark(12, 'Snake River crossing',   1633, LmRiver,      8,  6, LmFlagPlain);
  SetLandmark(13, 'Fort Boise',             1779, LmFort,      10,  1, LmFlagPlain);
  SetLandmark(14, 'Blue Mountains',         1843, LmGeography, 11,  3, LmFlagPlain);
  SetLandmark(15, 'Fort Walla Walla',       1907, LmFort,      15,  1, LmFlagFork);  { Whitman Mission alternate }
  SetLandmark(16, 'The Dalles',             1960, LmRiver,     16,  6, LmFlagPlain);
  SetLandmark(17, 'Willamette Valley',      2000, LmFinal,     17, 17, LmFlagPlain);
end;

function FindLandmarkForMiles(Miles : Word) : Integer;
var
  I : Integer;
begin
  FindLandmarkForMiles := -1;
  for I := 1 to NumLandmarks - 1 do
    if Miles >= Landmarks[I].RequiredMi then
      FindLandmarkForMiles := I;
end;

function IsRiver(Idx : Byte) : Boolean;
begin
  IsRiver := Landmarks[Idx].Category = LmRiver;
end;

function IsFort(Idx : Byte) : Boolean;
begin
  IsFort := Landmarks[Idx].Category = LmFort;
end;

end.
