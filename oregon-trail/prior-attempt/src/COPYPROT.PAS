{ ----------------------------------------------------------------- }
{  COPYPROT.PAS                                                     }
{  Copy-protection investigation -- closed (Gap #2).                }
{                                                                   }
{  The original OREGON.EXE has a time-bomb anti-piracy gate at the  }
{  top of the game-init function (main_func_47BA, file offset       }
{  0x14BDA in the unpacked image).  Relevant assembly:              }
{                                                                   }
{    0x14BF3  9A B5 03 9F 21   lcall 0x219F:0x3B5                   }
{                              ^^ Borland TP TDateTime GetDate      }
{                              returning days-since-1899-12-30 as   }
{                              a 32-bit value in DX:AX.             }
{    0x14BF8  89 46 FC         mov  [bp - 4], ax                    }
{    0x14BFB  89 56 FE         mov  [bp - 2], dx                    }
{    0x14BFE  83 7E FE 00      cmp  word [bp - 2], 0                }
{    0x14C02  7C 09            jl   0x14C0D   ; negative -> lock    }
{    0x14C04  7F 2A            jg   0x14C30   ; positive HIGH word  }
{                                              -> safe-passthrough  }
{    0x14C06  81 7E FC B8 88   cmp  word [bp - 4], 0x88B8           }
{    0x14C0B  73 23            jae  0x14C30   ; >= 35000 -> safe    }
{    0x14C0D  ...              ; the LOCK branch (loads the         }
{                              ;  "PROGRAM IS NOT AVAILABLE"        }
{                              ;  string at 0x3ED8 and exits)       }
{                                                                   }
{  The constant 0x88B8 = 35000 is the number of days since the      }
{  Borland TDateTime epoch (1899-12-30) that resolves to            }
{  **1995-10-28**.  The check therefore reads "if the current DOS   }
{  clock is BEFORE 1995-10-28, run the game; otherwise show the     }
{  lock message and exit."                                          }
{                                                                   }
{  Interpretation: this is not a license check, dongle, or          }
{  manual-lookup scheme -- it is a hard-coded expiry date intended  }
{  to time-out evaluation copies.  Five years of headroom past the  }
{  v2.1 release in April 1990 lines up with a typical MECC sales    }
{  cycle.                                                           }
{                                                                   }
{  Status in this rebuild: NOT IMPLEMENTED.  The reconstruction     }
{  does not gate launch on the system date.  This unit exists       }
{  solely to document the finding inline with the source tree so    }
{  anyone working through the binary later does not have to         }
{  re-derive it.                                                    }
{                                                                   }
{  Reference: work/copyprotect_analysis.txt                         }
{  Reference: work/main_function_traces.txt (main_func_47BA)        }
{ ----------------------------------------------------------------- }

unit CopyProt;

interface

const
  { Documented constants from the disassembly. }
  TpEpochDays    : LongInt = 35000;       { 0x88B8 -- expiry threshold      }
  TpEpochYear    = 1899;                  { Borland TDateTime epoch year    }
  ExpiryYear     = 1995;                  { resolved calendar date          }
  ExpiryMonth    = 10;
  ExpiryDay      = 28;
  LockMsgOffset  = $3ED8;                 { string in unpacked binary       }

function CheckExpired : Boolean;

implementation

uses Dos;

function CheckExpired : Boolean;
{ Reference implementation of the original gate, kept for documentation.   }
{ It is NOT called from the game -- the rebuild ships without the lock.    }
const
  DaysIn : array [1..12] of Integer =
    (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31);
var
  Y, M, D, Dow : Word;
  Days, I       : LongInt;
begin
  GetDate(Y, M, D, Dow);
  if (Y > ExpiryYear) then
  begin
    CheckExpired := True;
    Exit;
  end;
  if (Y < ExpiryYear) then
  begin
    CheckExpired := False;
    Exit;
  end;
  if (M > ExpiryMonth) or ((M = ExpiryMonth) and (D >= ExpiryDay)) then
    CheckExpired := True
  else
    CheckExpired := False;
end;

end.
