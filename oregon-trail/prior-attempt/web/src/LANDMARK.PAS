{ ----------------------------------------------------------------- }
{  LANDMARK.PAS                                                     }
{  16 landmarks along the historic Oregon Trail.                    }
{                                                                   }
{  Names and order match the strings found at file offset 0x23D17   }
{  through 0x23F8C; required-miles are reconstructed from the       }
{  inter-record spacing data documented in landmark_table.txt.      }
{ ----------------------------------------------------------------- }

unit Landmark;

interface

uses GameType;

const
  NumLandmarks = 16;

var
  Landmarks : array [0..NumLandmarks-1] of TLandmark;

procedure InitLandmarks;
function FindLandmarkForMiles(Miles : Word) : Integer;
function IsRiver(Idx : Byte) : Boolean;
function IsFort(Idx : Byte) : Boolean;

implementation

procedure SetLandmark(Idx : Byte;
                     const Nm : TString30;
                     Mi : Word;
                     Cat : Byte;
                     Pic, Song : Byte);
begin
  Landmarks[Idx].Flag       := 0;
  Landmarks[Idx].Category   := Cat;
  Landmarks[Idx].MapX       := 0;
  Landmarks[Idx].MapY       := 0;
  Landmarks[Idx].Name       := Nm;
  Landmarks[Idx].RequiredMi := Mi;
  Landmarks[Idx].PictureIdx := Pic;
  Landmarks[Idx].SongIdx    := Song;
end;

procedure InitLandmarks;
begin
  { Cumulative miles approximate the geographic distances of the historic   }
  { route.  Categories follow LmFort/LmRiver/etc. constants.                }
  SetLandmark( 0, 'Independence',              0, LmCity,       0,  0);
  SetLandmark( 1, 'Kansas River crossing',   102, LmRiver,      8,  6);
  SetLandmark( 2, 'Big Blue River crossing', 185, LmRiver,      8,  6);
  SetLandmark( 3, 'Fort Kearney',            304, LmFort,       1,  1);
  SetLandmark( 4, 'Chimney Rock',            554, LmGeography,  2,  2);
  SetLandmark( 5, 'Fort Laramie',            640, LmFort,       3,  1);
  SetLandmark( 6, 'Independence Rock',       830, LmGeography,  4,  2);
  SetLandmark( 7, 'South Pass',              932, LmGeography,  5,  3);
  SetLandmark( 8, 'Fort Bridger',           1054, LmFort,       6,  1);
  SetLandmark( 9, 'Green River crossing',   1144, LmRiver,      8,  6);
  SetLandmark(10, 'Soda Springs',           1288, LmGeography,  7,  2);
  SetLandmark(11, 'Fort Hall',              1395, LmFort,       9,  1);
  SetLandmark(12, 'Snake River crossing',   1633, LmRiver,      8,  6);
  SetLandmark(13, 'Fort Boise',             1779, LmFort,      10,  1);
  SetLandmark(14, 'Blue Mountains',         1843, LmGeography, 11,  3);
  SetLandmark(15, 'Willamette Valley',      2000, LmFinal,     17, 17);
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
