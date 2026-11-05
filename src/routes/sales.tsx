import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { AppShell, StatCard } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { actions, useAppState } from "@/lib/store";
import {
  fmtNum,
  fmtRs,
  groupLinesByItem,
  itemCode,
  summarize,
  reconcileAll,
  type Sale,
  type StockItem,
} from "@/lib/stock";
import { QuickEntryBar } from "@/components/QuickEntryBar";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Unposted Sales — Westpoint Stock Audit" },
      {
        name: "description",
        content: "Record items that were sold but not yet posted in the computer, so they are not counted as shortage.",
      },
      { property: "og:title", content: "Unposted Sales — Westpoint Stock Audit" },
      {
        property: "og:description",
        content: "Keep a separate list of sold items to post as sales in the computer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function SalesPage() {
  const { items, sales } = useAppState();
  const s = useMemo(() => summarize(reconcileAll(items, sales), sales), [items, sales]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const [date, setDate] = useState(today());
  const [billNo, setBillNo] = useState("");
  const [note, setNote] = useState("");
  const groups = useMemo(() => groupLinesByItem(sales), [sales]);

  const addSale = (item: StockItem, qty: number, saleRate: number) => {
    if (qty <= 0) {
      toast.error("Sale quantity must be above 0.");
      return;
    }
    const sale: Omit<Sale, "id"> = { itemId: item.id, qty, saleRate, date };
    if (billNo.trim()) sale.billNo = billNo.trim();
    if (note.trim()) sale.note = note.trim();
    actions.addSale(sale);
    toast.success(`${itemCode(item.description)} · ${qty} pcs added to sales`, { duration: 1200 });
  };

  // Group per item for the posting summary
  const perItem = useMemo(() => {
    const m = new Map<string, { qty: number; amount: number }>();
    for (const x of sales) {
      const cur = m.get(x.itemId) ?? { qty: 0, amount: 0 };
      cur.qty += x.qty;
      cur.amount += x.qty * x.saleRate;
      m.set(x.itemId, cur);
    }
    return [...m.entries()]
      .map(([id, v]) => ({ item: byId.get(id), ...v }))
      .filter((x) => x.item)
      .sort((a, b) => (a.item!.description < b.item!.description ? -1 : 1));
  }, [sales, byId]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Unposted sales</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Add items that were sold but are <strong>not yet entered as sale in the computer</strong>. These are
          subtracted from computer stock so they don't show as shortage. Post them as sales in the computer later.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sale entries" value={fmtNum(sales.length)} />
        <StatCard label="Pieces sold" value={fmtNum(s.soldQty)} />
        <StatCard label="Cost value" value={fmtRs(s.soldCostValue)} />
        <StatCard label="Sale amount" tone="ink" value={fmtRs(s.soldSaleValue)} />
      </div>

      <div className="mb-6 rounded-lg border-2 border-primary/30 bg-card p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <h2 className="mr-auto text-lg font-semibold">Add sale</h2>
          <div className="grid gap-1">
            <Label htmlFor="date" className="text-xs">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="bill" className="text-xs">Bill no.</Label>
            <Input id="bill" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Optional" className="w-32" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="note" className="text-xs">Customer / note</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className="w-48" />
          </div>
        </div>
        <QuickEntryBar
          items={items}
          withRate
          qtyLabel="Sold qty"
          saveLabel="Add sale"
          existingQtys={(id) => sales.filter((x) => x.itemId === id).map((x) => x.qty)}
          onAdd={addSale}
        />
      </div>

      <div className="grid gap-6">
          <div className="rounded-lg border border-border bg-card shadow-card">
            <div className="border-b border-border p-4">
              <h2 className="text-lg font-semibold">Sale entries</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Bill</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Note</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const multi = g.length > 1;
                    return [
                      ...g.map((x, i) => (
                        <tr key={x.id} className={`border-b border-border/70 ${multi ? "bg-pending-soft/70" : ""}`}>
                          <td className="num px-3 py-2 text-xs">{x.date}</td>
                          <td className="px-3 py-2 text-xs">{x.billNo ?? ""}</td>
                          <td className="px-3 py-2 font-medium">
                            {multi && i > 0 && <span className="mr-1 text-pending">↳</span>}
                            {byId.get(x.itemId)?.description ?? "Deleted item"}
                            {multi && (
                              <span className="ml-2 rounded bg-pending/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-pending">
                                {i + 1} of {g.length}
                              </span>
                            )}
                          </td>
                          <td className="num px-3 py-2 text-right">{fmtNum(x.qty)}</td>
                          <td className="num px-3 py-2 text-right">{fmtNum(x.saleRate)}</td>
                          <td className="num px-3 py-2 text-right font-semibold">{fmtNum(x.qty * x.saleRate)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{x.note ?? ""}</td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              title="Delete"
                              className="rounded p-1 text-muted-foreground hover:bg-short-soft hover:text-short"
                              onClick={() => {
                                const name = byId.get(x.itemId)?.description ?? "Deleted item";
                                if (!confirm(`Kya aap "${name}" (qty ${x.qty}) ki sale delete kar rahe hain?`)) return;
                                actions.deleteSale(x.id);
                                toast.success("Sale removed");
                              }}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      )),
                      multi ? (
                        <tr key={`${g[0]!.itemId}-t`} className="border-b-2 border-pending/40 bg-pending-soft">
                          <td colSpan={3} className="px-3 py-1 text-right text-xs font-semibold uppercase text-pending">
                            Total ({g.length} entries)
                          </td>
                          <td className="num px-3 py-1 text-right font-bold">{fmtNum(g.reduce((a, x) => a + x.qty, 0))}</td>
                          <td />
                          <td className="num px-3 py-1 text-right font-bold">
                            {fmtNum(g.reduce((a, x) => a + x.qty * x.saleRate, 0))}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      ) : null,
                    ];
                  })}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No sales added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {perItem.length > 0 && (
            <div className="rounded-lg border border-border bg-card shadow-card">
              <div className="border-b border-border p-4">
                <h2 className="text-lg font-semibold">To post in computer (item-wise)</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {perItem.map((p) => (
                    <tr key={p.item!.id} className="border-b border-border/70">
                      <td className="px-3 py-2 font-medium">{p.item!.description}</td>
                      <td className="num px-3 py-2 text-right">{fmtNum(p.qty)}</td>
                      <td className="num px-3 py-2 text-right">{fmtNum(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </AppShell>
  );
}
