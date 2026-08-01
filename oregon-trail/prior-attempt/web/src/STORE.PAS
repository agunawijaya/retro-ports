{ ----------------------------------------------------------------- }
{  STORE.PAS                                                        }
{  Matt's General Store (Independence) and the fort resupply shops. }
{                                                                   }
{  Base prices match the immediate operands embedded in the binary  }
{  ($40 per ox, $10 per spare wheel, etc., per store_prices.txt).   }
{  Fort multiplier is documented as approximately 2x.               }
{ ----------------------------------------------------------------- }

unit Store;

interface

uses Crt, GameType, GameStat;

type
  TStoreItem = (siOxen, siFood, siClothing, siBullets,
                siWheel, siAxle, siTongue);

  TStoreCtx  = (scStart, scFort);

function BasePrice(Item : TStoreItem) : Word;       { in cents }
function CurrentPrice(Item : TStoreItem; Ctx : TStoreCtx) : Word;
procedure ShopAtStart;
procedure ShopAtFort;

implementation

const
  ItemName : array [TStoreItem] of String[20] =
    ('Oxen (yoke)',
     'Food (per pound)',
     'Set of clothing',
     'Box of 20 bullets',
     'Spare wagon wheel',
     'Spare wagon axle',
     'Spare wagon tongue');

function BasePrice(Item : TStoreItem) : Word;
begin
  case Item of
    siOxen     : BasePrice := 4000;   { $40 }
    siFood     : BasePrice :=   20;   { $0.20 / lb }
    siClothing : BasePrice := 1000;   { $10 }
    siBullets  : BasePrice :=  200;   { $2 / box of 20 }
    siWheel    : BasePrice := 1000;   { $10 }
    siAxle     : BasePrice := 1000;   { $10 }
    siTongue   : BasePrice := 1000;   { $10 }
  end;
end;

function CurrentPrice(Item : TStoreItem; Ctx : TStoreCtx) : Word;
begin
  if Ctx = scFort then
    CurrentPrice := BasePrice(Item) * 2
  else
    CurrentPrice := BasePrice(Item);
end;

procedure ShowDollars(Cents : LongInt);
begin
  Write('$', Cents div 100, '.');
  if (Cents mod 100) < 10 then Write('0');
  Write(Cents mod 100);
end;

procedure ApplyItem(Item : TStoreItem; Qty : Word);
begin
  case Item of
    siOxen     : Inc(State.Supplies.Oxen, Qty * 2);   { yoke = 2 oxen }
    siFood     : Inc(State.Supplies.Food, Qty);
    siClothing : Inc(State.Supplies.Clothing, Qty);
    siBullets  : Inc(State.Supplies.Bullets, Qty * 20);
    siWheel    : Inc(State.Supplies.SpareWheel, Qty);
    siAxle     : Inc(State.Supplies.SpareAxle, Qty);
    siTongue   : Inc(State.Supplies.SpareTongue, Qty);
  end;
end;

procedure RunStore(Ctx : TStoreCtx);
var
  Done    : Boolean;
  Choice  : Char;
  Qty     : Word;
  Total   : LongInt;
  Item    : TStoreItem;
  K       : Byte;
begin
  Done := False;
  while not Done do
  begin
    ClrScr;
    if Ctx = scStart then
      WriteLn('=== General Store -- Independence, Missouri ===')
    else
      WriteLn('=== Fort Trading Post ===');
    WriteLn;
    Write('  Cash on hand: ');  ShowDollars(State.Supplies.Cash); WriteLn;
    WriteLn;
    WriteLn('  1. ', ItemName[siOxen],     '   - ');
    K := 1;
    for Item := siOxen to siTongue do
    begin
      Write('  ', K, '. ');
      Write(ItemName[Item]:22);
      Write('  ');
      ShowDollars(CurrentPrice(Item, Ctx));
      WriteLn;
      Inc(K);
    end;
    WriteLn('  Q. Leave the store');
    WriteLn;
    Write('Choice: ');
    Choice := ReadKey;
    WriteLn(Choice);

    if (Choice = 'Q') or (Choice = 'q') then
    begin
      Done := True;
      Continue;
    end;

    if (Choice < '1') or (Choice > '7') then Continue;

    Item := TStoreItem(Ord(Choice) - Ord('1'));
    Write('How many to buy? ');
    {$I-} ReadLn(Qty); {$I+}
    if IOResult <> 0 then Continue;
    if Qty = 0 then Continue;

    Total := LongInt(CurrentPrice(Item, Ctx)) * Qty;
    if Total > State.Supplies.Cash then
    begin
      WriteLn('You do not have enough cash.');
      Delay(1200);
      Continue;
    end;

    State.Supplies.Cash := State.Supplies.Cash - Total;
    ApplyItem(Item, Qty);
  end;
end;

procedure ShopAtStart;
begin
  RunStore(scStart);
end;

procedure ShopAtFort;
begin
  RunStore(scFort);
end;

end.
