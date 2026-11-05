import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { CornerDownLeft } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { fmtNum, itemCode, type StockItem } from "@/lib/stock";

export interface QuickEntryBarHandle {
  focus: () => void;
}

interface Props {
  items: StockItem[];
  /** Quantities of lines already added for this item (in order). */
  existingQtys: (itemId: string) => number[];
  onAdd: (item: StockItem, qty: number, rate: number) => void;
  /** Show an editable rate field (used for sales). */
  withRate?: boolean;
  qtyLabel?: string;
  saveLabel?: string;
}

function search(items: StockItem[], q: string): StockItem[] {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  const starts: StockItem[] = [];
  const contains: StockItem[] = [];
  for (const i of items) {
    const code = itemCode(i.description).toLowerCase();
    const d = i.description.toLowerCase();
    if (code === term || code.startsWith(term)) starts.push(i);
    else if (d.includes(term)) contains.push(i);
  }
  starts.sort((a, b) => {
    const ca = itemCode(a.description).toLowerCase() === term ? 0 : 1;
    const cb = itemCode(b.description).toLowerCase() === term ? 0 : 1;
    return ca - cb;
  });
  return [...starts, ...contains].slice(0, 8);
}

export const QuickEntryBar = forwardRef<QuickEntryBarHandle, Props>(function QuickEntryBar(
  { items, existingQtys, onAdd, withRate = false, qtyLabel = "Qty", saveLabel = "Save" },
  ref,
) {
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const [selected, setSelected] = useState<StockItem | null>(null);
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [dupFor, setDupFor] = useState<StockItem | null>(null);
  const [error, setError] = useState("");
  const [dupQty, setDupQty] = useState("");
  const [dupError, setDupError] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const afterDialog = useRef<"qty" | "code">("code");

  useImperativeHandle(ref, () => ({ focus: () => codeRef.current?.focus() }));

  const results = useMemo(() => (selected ? [] : search(items, query)), [items, query, selected]);

  const focusQty = () => setTimeout(() => qtyRef.current?.select(), 30);
  const focusCode = () => setTimeout(() => codeRef.current?.focus(), 30);

  const choose = (item: StockItem) => {
    setError("");
    if (existingQtys(item.id).length > 0) {
      afterDialog.current = "code";
      setDupQty("");
      setDupError("");
      setDupFor(item);
      return;
    }
    accept(item);
  };

  const accept = (item: StockItem) => {
    setSelected(item);
    setQuery(item.description);
    setRate(String(item.rate));
    setQty("");
    focusQty();
  };

  const reset = () => {
    setSelected(null);
    setQuery("");
    setQty("");
    setRate("");
    setHi(0);
    setError("");
    focusCode();
  };

  const save = () => {
    if (!selected) {
      setError("Type an item code and press Enter first.");
      focusCode();
      return;
    }
    const q = Number(qty);
    if (qty.trim() === "" || !Number.isInteger(q) || q < 0) {
      setError("Enter a whole number quantity.");
      focusQty();
      return;
    }
    const r = withRate ? Number(rate) : selected.rate;
    if (!Number.isFinite(r) || r < 0) {
      setError("Rate must be 0 or more.");
      return;
    }
    onAdd(selected, q, r);
    reset();
  };

  const dupQtys = dupFor ? existingQtys(dupFor.id) : [];

  const saveDup = () => {
    if (!dupFor) return;
    const q = Number(dupQty);
    if (dupQty.trim() === "" || !Number.isInteger(q) || q < 0) {
      setDupError("Enter a whole number quantity.");
      return;
    }
    onAdd(dupFor, q, dupFor.rate);
    afterDialog.current = "code";
    setDupFor(null);
    reset();
  };

  return (
    <>
      <div className="grid gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[260px] flex-1">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Item code / name
            </label>
            <input
              ref={codeRef}
              autoFocus
              value={query}
              placeholder="e.g. 1045 then Enter"
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
                setHi(0);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHi((h) => Math.min(h + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHi((h) => Math.max(h - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (selected) {
                    focusQty();
                    return;
                  }
                  const pick = results[hi];
                  if (pick) choose(pick);
                  else setError(query.trim() ? "No item found with this code." : "Type an item code.");
                } else if (e.key === "Escape") {
                  reset();
                }
              }}
              className={`num h-11 w-full rounded-md border bg-paper px-3 text-base font-semibold outline-none transition focus:ring-2 focus:ring-ring/30 ${
                selected ? "border-primary text-primary" : "border-input focus:border-primary"
              }`}
            />
            {results.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-card">
                {results.map((r, i) => {
                  const n = existingQtys(r.id).length;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          choose(r);
                        }}
                        onMouseEnter={() => setHi(i)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${
                          i === hi ? "bg-accent text-accent-foreground" : ""
                        }`}
                      >
                        <span className="num w-14 font-semibold">{itemCode(r.description)}</span>
                        <span className="flex-1 truncate">{r.description}</span>
                        {n > 0 && (
                          <span className="rounded bg-pending-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-pending">
                            Added ×{n}
                          </span>
                        )}
                        <span className="num text-xs opacity-60">{r.inHand} in hand</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="w-28">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {qtyLabel}
            </label>
            <input
              ref={qtyRef}
              type="number"
              inputMode="numeric"
              min={0}
              value={qty}
              disabled={!selected}
              onChange={(e) => {
                setQty(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (qty.trim() === "") {
                    setError("Enter a quantity.");
                    return;
                  }
                  saveRef.current?.focus();
                } else if (e.key === "Escape") reset();
              }}
              className="num h-11 w-full rounded-md border border-input bg-paper px-3 text-right text-base font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
            />
          </div>
          {withRate && (
            <div className="w-32">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Rate (Rs)
              </label>
              <input
                type="number"
                min={0}
                value={rate}
                disabled={!selected}
                onChange={(e) => setRate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveRef.current?.focus();
                  }
                }}
                className="num h-11 w-full rounded-md border border-input bg-paper px-3 text-right text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
              />
            </div>
          )}
          <Button
            ref={saveRef}
            type="button"
            onClick={save}
            onKeyDown={(e) => {
              if (e.key === "Escape") reset();
            }}
            className="h-11 px-6 focus-visible:ring-4 focus-visible:ring-accent"
          >
            <CornerDownLeft /> {saveLabel}
          </Button>
        </div>
        <div className="flex min-h-5 flex-wrap items-center justify-between gap-2 text-xs">
          {error ? (
            <span className="font-medium text-short">{error}</span>
          ) : selected ? (
            <span className="num text-muted-foreground">
              {selected.description} · In hand {fmtNum(selected.inHand)} · Rate {fmtNum(selected.rate)}
            </span>
          ) : (
            <span className="text-muted-foreground">
              Code → <kbd className="num rounded border bg-paper px-1">Enter</kbd> → Qty →{" "}
              <kbd className="num rounded border bg-paper px-1">Enter</kbd> → Save →{" "}
              <kbd className="num rounded border bg-paper px-1">Enter</kbd> · <kbd className="num rounded border bg-paper px-1">Esc</kbd> to clear
            </span>
          )}
        </div>
      </div>

      <AlertDialog
        open={dupFor !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDupFor(null);
          }
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (afterDialog.current === "qty") qtyRef.current?.select();
            else codeRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Item already added</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="grid gap-2 text-sm">
                <p>
                  <strong className="text-foreground">{dupFor?.description}</strong> has already been added{" "}
                  {dupQtys.length === 1 ? "once" : `${dupQtys.length} times`}:
                </p>
                <ul className="num rounded-md border border-border bg-muted p-2 text-foreground">
                  {dupQtys.map((q, i) => (
                    <li key={i} className="flex justify-between">
                      <span>Entry {i + 1}</span>
                      <span className="font-semibold">{fmtNum(q)} pcs</span>
                    </li>
                  ))}
                  <li className="mt-1 flex justify-between border-t border-border pt-1 font-bold">
                    <span>Total so far</span>
                    <span>{fmtNum(dupQtys.reduce((a, b) => a + b, 0))} pcs</span>
                  </li>
                </ul>
                <p>Type the new quantity and press Enter to add it directly under the earlier line.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              New {qtyLabel}
            </label>
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              min={0}
              value={dupQty}
              onChange={(e) => {
                setDupQty(e.target.value);
                setDupError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveDup();
                }
              }}
              className="num h-11 w-full rounded-md border border-input bg-paper px-3 text-right text-base font-semibold outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            {dupError && <span className="text-xs font-medium text-short">{dupError}</span>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                afterDialog.current = "code";
                setDupFor(null);
                reset();
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                saveDup();
              }}
            >
              Add
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
