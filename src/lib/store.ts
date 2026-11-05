import { useSyncExternalStore } from "react";
import seed from "@/data/westpoint-items.json";
import { computerTotals, type ComputerEntry, type ReportMeta, type Sale, type StockItem } from "./stock";

export interface AppState {
  /** Data format version. v2: JSON list = computer stock, entries = physical in-hand count. */
  v: number;
  items: StockItem[];
  /** Bill-style physical count lines; items[].inHand is kept in sync as their total. */
  entries: ComputerEntry[];
  sales: Sale[];
  meta: ReportMeta;
}

const STORAGE_KEY = "westpoint-stock-audit-v1";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function seedState(): AppState {
  return {
    v: 2,
    items: (seed as { description: string; inHand: number; rate: number }[]).map((s, i) => ({
      id: `i${i + 1}`,
      description: s.description,
      // The JSON list is the computer stock; in-hand is counted by the user.
      computer: s.inHand,
      rate: s.rate,
      inHand: null,
    })),
    entries: [],
    sales: [],
    meta: { storeName: "Westpoint", countDate: today(), preparedBy: "", checkedBy: "" },
  };
}

/** Keep items[].inHand equal to the sum of count entry lines (null when an item has none). */
function syncInHand(s: AppState): AppState {
  const totals = computerTotals(s.entries);
  return {
    ...s,
    items: s.items.map((i) => {
      const h = totals.has(i.id) ? totals.get(i.id)! : null;
      return i.inHand === h ? i : { ...i, inHand: h };
    }),
  };
}

/** Accept saved/backup data, including v1 where the JSON list was inHand and entries were computer qty. */
function normalize(parsed: Partial<AppState>): AppState {
  const base = seedState();
  // Non-Westpoint heater items removed from the list; drop them from saved data too.
  const REMOVED = /^(8822|8833|8844|8877) .*HEATER/i;
  let items = (parsed.items ?? base.items).filter((i) => !REMOVED.test(i.description));
  let entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  if (parsed.v !== 2) {
    // v1: item.inHand held the JSON (computer) qty; entries (or item.computer) held the count.
    if (!Array.isArray(parsed.entries)) {
      const at = new Date().toISOString();
      entries = items
        .filter((i) => i.computer !== null && i.computer !== undefined)
        .map((i) => ({ id: uid(), itemId: i.id, qty: i.computer as number, at }));
    }
    items = items.map((i) => ({ ...i, computer: i.inHand ?? 0, inHand: null }));
  }
  return syncInHand({
    v: 2,
    items,
    entries,
    sales: parsed.sales ?? [],
    meta: { ...base.meta, ...parsed.meta },
  });
}

const SERVER_STATE = seedState();
let state: AppState | null = null;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const listeners = new Set<() => void>();

function load(): AppState {
  if (state) return state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (Array.isArray(parsed.items) && Array.isArray(parsed.sales)) {
        state = normalize(parsed);
        return state;
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  state = seedState();
  return state;
}

function setState(next: AppState) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage full */
  }
  listeners.forEach((l) => l());
}

function update(fn: (s: AppState) => AppState) {
  setState(syncInHand(fn(load())));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, load, () => SERVER_STATE);
}


export const actions = {
  addEntry(itemId: string, qty: number): string {
    const id = uid();
    update((s) => ({
      ...s,
      entries: [...s.entries, { id, itemId, qty, at: new Date().toISOString() }],
    }));
    return id;
  },
  updateEntry(id: string, qty: number) {
    update((s) => ({ ...s, entries: s.entries.map((e) => (e.id === id ? { ...e, qty } : e)) }));
  },
  deleteEntry(id: string) {
    update((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) }));
  },
  updateItem(id: string, patch: Partial<Omit<StockItem, "id">>) {
    update((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  },
  addItem(item: Omit<StockItem, "id">) {
    const id = uid();
    update((s) => ({
      ...s,
      items: [...s.items, { ...item, id, inHand: null }],
      entries:
        item.inHand === null
          ? s.entries
          : [...s.entries, { id: uid(), itemId: id, qty: item.inHand, at: new Date().toISOString() }],
    }));
  },
  deleteItem(id: string) {
    update((s) => ({
      ...s,
      items: s.items.filter((i) => i.id !== id),
      entries: s.entries.filter((e) => e.itemId !== id),
      sales: s.sales.filter((x) => x.itemId !== id),
    }));
  },
  fillPendingWithComputer() {
    const at = new Date().toISOString();
    update((s) => ({
      ...s,
      entries: [
        ...s.entries,
        ...s.items.filter((i) => i.inHand === null).map((i) => ({ id: uid(), itemId: i.id, qty: i.computer, at })),
      ],
    }));
  },
  clearComputer() {
    update((s) => ({ ...s, entries: [] }));
  },
  addSale(sale: Omit<Sale, "id">) {
    update((s) => ({ ...s, sales: [...s.sales, { ...sale, id: uid() }] }));
  },
  updateSale(id: string, patch: { qty?: number; saleRate?: number }) {
    update((s) => ({ ...s, sales: s.sales.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  },
  deleteSale(id: string) {
    update((s) => ({ ...s, sales: s.sales.filter((x) => x.id !== id) }));
  },
  setMeta(patch: Partial<ReportMeta>) {
    update((s) => ({ ...s, meta: { ...s.meta, ...patch } }));
  },
  replaceAll(next: AppState) {
    setState(normalize(next));
  },
  resetAll() {
    setState(seedState());
  },
};

export function exportBackup() {
  const data = JSON.stringify(load(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `stock-audit-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function parseBackup(text: string): AppState {
  const parsed = JSON.parse(text);
  if (parsed && Array.isArray(parsed.items) && Array.isArray(parsed.sales)) {
    return normalize(parsed);
  }
  throw new Error("This file is not a valid stock audit backup.");
}
