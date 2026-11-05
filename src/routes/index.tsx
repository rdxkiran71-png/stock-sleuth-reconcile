import { createFileRoute } from "@tanstack/react-router";
import { memo, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CopyCheck, Download, Pencil, Plus, RotateCcw, Save, Search, Upload } from "lucide-react";
import { AppShell, StatCard } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { ItemDialog } from "@/components/ItemDialog";
import { QuickEntryBar } from "@/components/QuickEntryBar";
import { EntryLines } from "@/components/EntryLines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actions, exportBackup, parseBackup, useAppState } from "@/lib/store";
import {
  fmtNum,
  fmtRs,
  fmtSigned,
  itemCode,
  reconcileAll,
  summarize,
  type ReconciledItem,
  type Status,
  type StockItem,
} from "@/lib/stock";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stock Entry — Westpoint Stock Audit" },
      {
        name: "description",
        content: "Enter computer stock against physically counted stock and see shortages and excess instantly.",
      },
      { property: "og:title", content: "Stock Entry — Westpoint Stock Audit" },
      {
        property: "og:description",
        content: "Compare in-hand stock with computer stock, item by item.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StockEntryPage,
});

type Filter = "all" | Status;
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "short", label: "Short" },
  { key: "excess", label: "Excess" },
  { key: "matched", label: "Matched" },
];

const Row = memo(function Row({
  r,
  lines,
  serial,
  onEdit,
}: {
  r: ReconciledItem;
  lines: number;
  serial: number;
  onEdit: (item: StockItem) => void;
}) {
  const rowTone =
    r.status === "short" ? "bg-short-soft/60" : r.status === "excess" ? "bg-excess-soft/60" : "";
  return (
    <tr className={`border-b border-border/70 hover:bg-secondary/50 ${rowTone}`}>
      <td className="num px-2 py-1.5 text-xs text-muted-foreground">{serial}</td>
      <td className="px-2 py-1.5 font-medium">{r.description}</td>
      <td className="num px-2 py-1.5 text-right text-muted-foreground">{fmtNum(r.rate)}</td>
      <td className="num px-2 py-1.5 text-right font-semibold">{fmtNum(r.inHand)}</td>
      <td className="num px-2 py-1.5 text-right font-semibold">
        {r.computer === null ? <span className="text-muted-foreground">—</span> : fmtNum(r.computer)}
        {lines > 1 && (
          <span className="ml-1 rounded bg-pending-soft px-1 text-[10px] font-semibold text-pending">×{lines}</span>
        )}
      </td>
      <td className="num px-2 py-1.5 text-right text-muted-foreground">{r.sold ? fmtNum(r.sold) : ""}</td>
      <td
        className={`num px-2 py-1.5 text-right font-semibold ${
          r.diff < 0 ? "text-short" : r.diff > 0 ? "text-excess" : "text-muted-foreground"
        }`}
      >
        {r.status === "pending" ? "" : fmtSigned(r.diff)}
      </td>
      <td
        className={`num px-2 py-1.5 text-right ${
          r.diff < 0 ? "text-short" : r.diff > 0 ? "text-excess" : "text-muted-foreground"
        }`}
      >
        {r.status === "pending" || r.diff === 0 ? "" : fmtSigned(r.diffValue)}
      </td>
      <td className="px-2 py-1.5">
        <StatusBadge status={r.status} />
      </td>
      <td className="px-1 py-1.5">
        <button
          type="button"
          title="Edit item"
          onClick={() => onEdit(r)}
          className="rounded p-1 text-muted-foreground transition hover:bg-secondary hover:text-primary"
        >
          <Pencil className="size-3.5" />
        </button>
      </td>
    </tr>
  );
});

function StockEntryPage() {
  const { items, sales, entries } = useAppState();
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const lineCount = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach((e) => m.set(e.itemId, (m.get(e.itemId) ?? 0) + 1));
    return m;
  }, [entries]);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const rows = useMemo(() => reconcileAll(items, sales), [items, sales]);
  const s = useMemo(() => summarize(rows, sales), [rows, sales]);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, pending: 0, short: 0, excess: 0, matched: 0 };
    rows.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows
      .map((r, i) => ({ r, serial: i + 1 }))
      .filter(({ r }) => (filter === "all" || r.status === filter) && (!term || r.description.toLowerCase().includes(term)));
  }, [rows, filter, q]);

  const onEdit = useMemo(
    () => (item: StockItem) => {
      setEditing(item);
      setDialogOpen(true);
    },
    [],
  );

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Stock entry</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Enter the stock showing in the <strong>computer</strong> like a bill: type the item code, press Enter,
            type the qty, press Enter, then Enter again to save. If an item is entered twice, its lines are added
            together.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus /> Add item
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={counts.pending === 0}
            onClick={() => {
              if (
                confirm(
                  `Set computer qty = in-hand qty for all ${counts.pending} pending items? Only do this if those items match in the computer.`,
                )
              ) {
                actions.fillPendingWithInHand();
                toast.success("Pending items filled");
              }
            }}
          >
            <CopyCheck /> Fill pending = in hand
          </Button>
          <Button
            size="sm"
            onClick={() => {
              exportBackup();
              toast.success(
                `Entries saved! ${entries.length} lines browser mein save hain aur backup file bhi download ho gayi. Agli dafa app kholne par yahin se start hogi.`,
              );
            }}
          >
            <Save /> Save entries
          </Button>
          <Button variant="outline" size="sm" onClick={exportBackup}>
            <Download /> Backup
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload /> Restore
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => {
              if (!confirm("Reset everything back to the original list? All computer entries and sales will be cleared.")) return;
              if (!confirm("Pakka sure hain? Reset ke baad sab entries aur sales hamesha ke liye delete ho jayengi.")) return;
              actions.resetAll();
              toast.success("Reset to original list");
            }}
          >
            <RotateCcw /> Reset
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const next = parseBackup(await f.text());
                if (!confirm("Is backup file se restore karein? Abhi ki tamam entries aur sales is file wali entries se badal jayengi.")) return;
                if (!confirm("Pakka sure hain? Abhi ka data khatam ho jayega aur backup wala data aa jayega.")) return;
                actions.replaceAll(next);
                toast.success("Backup restored");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not read file");
              }
            }}
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="In hand value" value={fmtRs(s.inHandValue)} sub={`${fmtNum(s.inHandQty)} pcs`} />
        <StatCard
          label="Computer value"
          value={fmtRs(s.computerValue)}
          sub={`${fmtNum(s.computerQty)} pcs · ${s.enteredItems} items entered`}
        />
        <StatCard label="Shortage (loss)" tone="short" value={fmtRs(s.shortValue)} sub={`${fmtNum(s.shortQty)} pcs · ${s.shortItems} items`} />
        <StatCard label="Excess in hand" tone="excess" value={fmtRs(s.excessValue)} sub={`${fmtNum(s.excessQty)} pcs · ${s.excessItems} items`} />
        <StatCard
          label={s.netValue < 0 ? "Net loss" : "Net gain"}
          tone="ink"
          value={fmtRs(Math.abs(s.netValue))}
          sub={`after ${fmtNum(s.soldQty)} pcs unposted sales`}
        />
      </div>

      <div className="mb-6 rounded-lg border-2 border-primary/30 bg-card shadow-card">
        <div className="border-b border-border p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Computer stock entry</h2>
            <span className="num text-xs text-muted-foreground">
              {entries.length} lines · {lineCount.size} items · {fmtNum(entries.reduce((a, e) => a + e.qty, 0))} pcs
            </span>
          </div>
          <QuickEntryBar
            items={items}
            existingQtys={(id) => entries.filter((e) => e.itemId === id).map((e) => e.qty)}
            positions={(id) => ({
              at: entries.flatMap((e, i) => (e.itemId === id ? [i + 1] : [])),
              total: entries.length,
            })}
            qtyLabel="Computer qty"
            onAdd={(item, qty) => {
              setLastAdded(actions.addEntry(item.id, qty));
              toast.success(`${itemCode(item.description)} · ${qty} pcs saved`, { duration: 1200 });
            }}
          />
        </div>
        <EntryLines entries={entries} byId={byId} lastAddedId={lastAdded} />
      </div>

      <div className="rounded-lg border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
          <h2 className="mr-2 text-lg font-semibold">All items</h2>
          <div className="flex flex-wrap gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  filter === f.key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                }`}
              >
                {f.label} <span className="num ml-1 text-xs opacity-70">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <div className="relative ml-auto w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item…" className="pl-8" />
          </div>
        </div>
        <div className="max-h-[calc(100vh-140px)] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-secondary text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2 text-right">Rate</th>
                <th className="px-2 py-2 text-right">In hand</th>
                <th className="px-2 py-2 text-right">Computer total</th>
                <th className="px-2 py-2 text-right">Unposted sold</th>
                <th className="px-2 py-2 text-right">Diff qty</th>
                <th className="px-2 py-2 text-right">Diff value</th>
                <th className="px-2 py-2">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ r, serial }) => (
                <Row key={r.id} r={r} lines={lineCount.get(r.id) ?? 0} serial={serial} onEdit={onEdit} />
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    No items here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border p-3 text-xs text-muted-foreground">
          Diff qty = In hand − (Computer qty − Unposted sold). Minus means stock is short (loss), plus means
          extra stock in hand.
        </p>
      </div>

      <ItemDialog open={dialogOpen} onOpenChange={setDialogOpen} item={editing} />
    </AppShell>
  );
}
