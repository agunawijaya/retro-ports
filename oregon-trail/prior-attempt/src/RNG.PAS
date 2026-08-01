{ ----------------------------------------------------------------- }
{  RNG.PAS                                                          }
{  Custom timer-seeded counter RNG.  Gap #3 closure.                }
{                                                                   }
{  Recovered via static disasm + DOSBox-X live-trace:               }
{                                                                   }
{    1. Startup phase (main_func_4108):                             }
{         - zero counter at DS:[0x16B2]                             }
{         - install INT 1Ch handler that does counter += 1          }
{         - wait until counter advances by 100 ticks or until any   }
{           key press (~5.5 seconds of input timing entropy)        }
{         - RESTORE the previous INT 1Ch handler -- the counter is  }
{           no longer incremented by the timer after this           }
{                                                                   }
{    2. Gameplay phase: counter is the RNG state.  Each GetRand     }
{       call advances it by +1 and returns counter mod N.           }
{                                                                   }
{  Evidence (DOSBox-X memory-write breakpoint on 0x2348:0x16B2      }
{  during a known 3-draw river-crossing path):                      }
{                                                                   }
{    DEBUG: Memory breakpoint : 2348:16B2  -  00 -> 03              }
{                                                                   }
{  +3 delta = exactly 3 draws.  Confirms +1-per-draw.               }
{                                                                   }
{  No LCG multiplier or XOR mask was found in the binary.           }
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

procedure SeedRng;
{ Seed = startup timer tick count.  The original does this via an INT 1Ch  }
{ handler counting timer interrupts for ~5.5 seconds.  We use DOS GetTime  }
{ to obtain the same kind of entropy (sub-second granularity from the      }
{ time at startup).                                                        }
var
  H, M, S, Hund : Word;
begin
  GetTime(H, M, S, Hund);
  Counter := (LongInt(M) * 6000) + (LongInt(S) * 100) + Hund;
end;

procedure TickRng;
{ Kept for API compatibility; not used by the bare counter model. }
begin
  Inc(Counter);
end;

function GetRand(N : Word) : Word;
{ Per-draw step matches the original:  inc counter;  return counter mod N. }
begin
  Inc(Counter);
  if N = 0 then GetRand := 0
  else GetRand := Word(Counter mod LongInt(N));
end;

function RollPercent(Pct : Byte) : Boolean;
begin
  RollPercent := GetRand(100) < Pct;
end;

end.
