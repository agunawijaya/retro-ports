{ ----------------------------------------------------------------- }
{  RNG.PAS                                                          }
{  Custom timer-driven RNG.                                         }
{                                                                   }
{  The original v2.1 does NOT use Turbo Pascal's stock LCG          }
{  (constant 0x08088405 is absent from the binary).  Instead the    }
{  RNG state lives at 0x16B2..0x16B4 (a 32-bit counter) and is      }
{  ticked from the INT 1Ch handler installed at startup.  Reads     }
{  are mixed with a small LCG step to spread the bits.              }
{ ----------------------------------------------------------------- }

unit Rng;

interface

uses Dos;

{ Initialize from current DOS time. }
procedure SeedRng;

{ Tick the internal counter once.  Called by the timer hook each interrupt. }
procedure TickRng;

{ Uniform 0 <= Result < N.  N must be in 1..65535. }
function GetRand(N : Word) : Word;

{ Coin flip with the given probability percentage (0..100). }
function RollPercent(Pct : Byte) : Boolean;

implementation

var
  Counter : LongInt;
  Mix     : Word;

procedure SeedRng;
var
  H, M, S, Hund : Word;
begin
  GetTime(H, M, S, Hund);
  Counter := (LongInt(M) shl 16) or (LongInt(S) shl 8) or Hund;
  Mix     := (H * 1009) xor 31337;
end;

procedure TickRng;
begin
  Inc(Counter);
end;

function GetRand(N : Word) : Word;
begin
  { Light LCG step on the public-facing word.  The actual count comes      }
  { from the timer ISR, so two reads at different keypress moments give    }
  { genuinely different values.                                            }
  Mix := Word((LongInt(Mix) * 25173 + 13849) and $FFFF);
  GetRand := Word((LongInt(Counter) xor Mix) and $7FFF) mod N;
end;

function RollPercent(Pct : Byte) : Boolean;
begin
  RollPercent := GetRand(100) < Pct;
end;

end.
