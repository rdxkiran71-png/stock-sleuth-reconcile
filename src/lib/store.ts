import { useSyncExternalStore } from "react";
import seed from "@/data/westpoint-items.json";
import { computerTotals, type ComputerEntry, type ReportMeta, type Sale, type StockItem } from "./stock";
import { auditChannelName, loadAudit, saveAuditSnapshot } from "./audits";

export interface AppState {
  /** Data format version. v2: JSON list = computer stock, entries = physical in-hand count. */
  v: number;
  items: StockItem[];
  /** Bill-style physical count lines; items[].inHand is kept in sync as their total. */
  entries: ComputerEntry[];
  sales: Sale[];
  meta: ReportMeta;
  /** Online audit folder this state belongs to (null = not saved on the website yet). */
  auditId: string | null;
  auditName: string | null;
  /** Last cloud sync error message, if any. */
  syncError: string | null;
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
    auditId: null,
    auditName: null,
    syncError: null,
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
    auditId: parsed.auditId ?? null,
    auditName: parsed.auditName ?? null,
    syncError: null,
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
        // Resume the online audit this device was working on.
        if (state.auditId && typeof window !== "undefined") {
          const id = state.auditId;
          void watchAudit(id);
          void pullFromCloud(id);
        }
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
  scheduleCloudSync(next);
}

// ---- Online audit sync (Lovable Cloud) ----
// Entries/sales/meta are mirrored to the open audit folder so anyone with the
// link sees the same data. Sync is debounced and failures only set syncError.

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let syncAgain = false;
let applyingRemote = false;

function scheduleCloudSync(s: AppState) {
  if (!s.auditId || applyingRemote || typeof window === "undefined") return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void pushToCloud(), 800);
}

async function pushToCloud() {
  const s = load();
  if (!s.auditId || syncing) {
    if (s.auditId && syncing) syncAgain = true;
    return;
  }
  syncing = true;
  try {
    await saveAuditSnapshot(s.auditId, s.meta, s.entries, s.sales);
    if (state && state.syncError) {
      state = { ...state, syncError: null };
      listeners.forEach((l) => l());
    }
    broadcastChange(s.auditId);
  } catch (err) {
    if (state) {
      state = { ...state, syncError: err instanceof Error ? err.message : "sync failed" };
      listeners.forEach((l) => l());
    }
  } finally {
    syncing = false;
    if (syncAgain) {
      syncAgain = false;
      void pushToCloud();
    }
  }
}

function broadcastChange(auditId: string) {
  try {
    if (channel && channelAuditId === auditId) {
      void channel.send({ type: "broadcast", event: "changed", payload: {} });
    }
  } catch {
    /* realtime optional */
  }
}

// Lazy realtime channel so other tabs/devices reload when this audit changes.
type Channel = { send: (m: unknown) => Promise<unknown>; unsubscribe: () => Promise<unknown> };
let channel: Channel | null = null;
let channelAuditId: string | null = null;

async function watchAudit(auditId: string) {
  if (channelAuditId === auditId) return;
  if (channel) await channel.unsubscribe();
  channelAuditId = auditId;
  const { supabase } = await import("@/integrations/supabase/client");
  const ch = supabase.channel(auditChannelName(auditId));
  ch.on("broadcast", { event: "changed" }, () => void pullFromCloud(auditId));
  await ch.subscribe();
  channel = ch as unknown as Channel;
}

async function pullFromCloud(auditId: string) {
  try {
    const snap = await loadAudit(auditId);
    const s = load();
    if (s.auditId !== auditId) return;
    applyingRemote = true;
    try {
      setState(
        syncInHand({
          ...s,
          entries: snap.entries,
          sales: snap.sales,
          meta: {
            storeName: snap.folder.storeName,
            countDate: snap.folder.countDate,
            preparedBy: snap.folder.preparedBy,
            checkedBy: snap.folder.checkedBy,
          },
          auditName: snap.folder.name,
          syncError: null,
        }),
      );
    } finally {
      applyingRemote = false;
    }
  } catch {
    /* keep local data */
  }
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
  /** Point the app at an online audit folder (or clear it with null). */
  setAudit(id: string | null, name: string | null) {
    update((s) => ({ ...s, auditId: id, auditName: name }));
    if (id) void watchAudit(id);
  },
  /** Replace local entries/sales/meta with the audit folder saved on the website. */
  async openAudit(id: string) {
    const snap = await loadAudit(id);
    setState(
      syncInHand({
        ...load(),
        entries: snap.entries,
        sales: snap.sales,
        meta: {
          storeName: snap.folder.storeName,
          countDate: snap.folder.countDate,
          preparedBy: snap.folder.preparedBy,
          checkedBy: snap.folder.checkedBy,
        },
        auditId: id,
        auditName: snap.folder.name,
        syncError: null,
      }),
    );
    void watchAudit(id);
  },
  /** Force an immediate save of the current state to the open audit folder. */
  async saveToCloud() {
    const s = load();
    if (!s.auditId) return;
    await saveAuditSnapshot(s.auditId, s.meta, s.entries, s.sales);
    broadcastChange(s.auditId);
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
