import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { actions, downloadCsv, useAppState } from "@/lib/store";
import { fmtNum, fmtRs, fmtSigned, reconcileAll, repeatedCounts, summarize, type ReconciledItem } from "@/lib/stock";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "A4 Stock Report — Westpoint Stock Audit" },
      {
        name: "description",
        content: "Printable A4 stock reconciliation report: shortage, excess, loss value and computer adjustments.",
      },
      { property: "og:title", content: "A4 Stock Report — Westpoint Stock Audit" },
      {
        property: "og:description",
        content: "Detailed printable report of stock differences between computer and in hand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportPage,
});

function Section({ title, sub, children, className = "" }: { title: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`report-section mt-6 ${className}`}>
      <h2 className="mb-1 border-b-2 border-foreground pb-1 text-base font-semibold">{title}</h2>
      {sub && <p className="mb-2 text-[8pt] text-muted-foreground">{sub}</p>}
      {children}
    </section>
  );
}

const R = "text-right num";

function ReportPage() {
  const { items, sales, meta, entries } = useAppState();
  const repeats = useMemo(() => repeatedCounts(entries), [entries]);
  const twice = useMemo(() => repeats.filter((g) => g.count === 2), [repeats]);
  const thrice = useMemo(() => repeats.filter((g) => g.count >= 3), [repeats]);
  const rows = useMemo(() => reconcileAll(items, sales), [items, sales]);
  const s = useMemo(() => summarize(rows, sales), [rows, sales]);
  const [showFull, setShowFull] = useState(false);
  const [showPending, setShowPending] = useState(true);

  const short = useMemo(() => rows.filter((r) => r.status === "short").sort((a, b) => a.diffValue - b.diffValue), [rows]);
  const excess = useMemo(() => rows.filter((r) => r.status === "excess").sort((a, b) => b.diffValue - a.diffValue), [rows]);
  const pending = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);
  const patch = useMemo(() => rows.filter((r) => r.status !== "pending" && (r.diff !== 0 || r.sold > 0)), [rows]);
  const enteredInHandQty = s.inHandQty;
  const enteredInHandValue = s.inHandValue;
  const comparedSoldQty = s.enteredComputerQty - s.computerAfterSalesQty;
  const comparedSoldValue = s.enteredComputerValue - s.computerAfterSalesValue;
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const printedOn = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const zeroInHandInComputer = short.filter((r) => r.inHand === 0).length;
  const zeroInComputerInHand = excess.filter((r) => (r.computerAfterSales ?? 0) <= 0).length;

  const exportCsv = () => {
    downloadCsv(`stock-reconciliation-${meta.countDate}.csv`, [
      ["#", "Description", "Rate", "In Hand", "Computer", "Unposted Sold", "Computer After Sales", "Diff Qty", "Diff Value", "Status"],
      ...rows.map((r, i) => [
        i + 1,
        r.description,
        r.rate,
        r.inHand ?? "",
        r.computer ?? "",
        r.sold,
        r.computerAfterSales ?? "",
        r.status === "pending" ? "" : r.diff,
        r.status === "pending" ? "" : r.diffValue,
        r.status,
      ]),
      [],
      ["Repeated in-hand counts"],
      ["Description", "Times entered", "Original entry line", "Occurrence", "Line qty", "Total in hand"],
      ...repeats.flatMap((group) => group.lines.map((line, index) => [
        byId.get(group.itemId)?.description ?? "Deleted item", group.count, line.position,
        index + 1, line.qty, group.total,
      ])),
    ]);
  };

  const diffTable = (list: ReconciledItem[], kind: "short" | "excess") => {
    const totQty = list.reduce((a, r) => a + Math.abs(r.diff), 0);
    const totVal = list.reduce((a, r) => a + Math.abs(r.diffValue), 0);
    return (
      <table className="report-table">
        <thead>
          <tr>
            <th className="w-[22pt]">#</th>
            <th>Description</th>
            <th className="text-right">Rate</th>
            <th className="text-right">Computer</th>
            <th className="text-right">Sold</th>
            <th className="text-right">Comp. net</th>
            <th className="text-right">In hand</th>
            <th className="text-right">{kind === "short" ? "Short qty" : "Excess qty"}</th>
            <th className="text-right">{kind === "short" ? "Loss (Rs)" : "Value (Rs)"}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={r.id}>
              <td className="num">{i + 1}</td>
              <td>{r.description}</td>
              <td className={R}>{fmtNum(r.rate)}</td>
              <td className={R}>{fmtNum(r.computer ?? 0)}</td>
              <td className={R}>{r.sold ? fmtNum(r.sold) : "–"}</td>
              <td className={R}>{fmtNum(r.computerAfterSales ?? 0)}</td>
              <td className={R}>{r.inHand === null ? "—" : fmtNum(r.inHand)}</td>
              <td className={`${R} font-semibold ${kind === "short" ? "text-short" : "text-excess"}`}>{fmtNum(Math.abs(r.diff))}</td>
              <td className={`${R} font-semibold`}>{fmtNum(Math.abs(r.diffValue))}</td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center text-muted-foreground">
                None
              </td>
            </tr>
          )}
        </tbody>
        {list.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={7}>Total ({list.length} items)</td>
              <td className={R}>{fmtNum(totQty)}</td>
              <td className={R}>{fmtNum(totVal)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    );
  };

  return (
    <AppShell>
      <div className="no-print mb-6 rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <Label htmlFor="store" className="text-xs">Store / company</Label>
            <Input id="store" value={meta.storeName} onChange={(e) => actions.setMeta({ storeName: e.target.value })} className="w-44" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="cdate" className="text-xs">Stock count date</Label>
            <Input id="cdate" type="date" value={meta.countDate} onChange={(e) => actions.setMeta({ countDate: e.target.value })} className="w-40" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="prep" className="text-xs">Prepared by</Label>
            <Input id="prep" value={meta.preparedBy} onChange={(e) => actions.setMeta({ preparedBy: e.target.value })} className="w-40" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="chk" className="text-xs">Checked by</Label>
            <Input id="chk" value={meta.checkedBy} onChange={(e) => actions.setMeta({ checkedBy: e.target.value })} className="w-40" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showPending} onCheckedChange={setShowPending} /> Pending list
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showFull} onCheckedChange={setShowFull} /> Full stock list
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <FileSpreadsheet /> Excel (CSV)
            </Button>
            <Button onClick={() => window.print()}>
              <Printer /> Print / Save PDF
            </Button>
          </div>
        </div>
        {s.pendingItems > 0 && (
          <p className="mt-3 rounded-md bg-pending-soft px-3 py-2 text-sm">
            {s.pendingItems} items still have no in-hand count. They are listed as pending and not counted in
            the difference.
          </p>
        )}
      </div>

      <div className="overflow-x-auto pb-10">
        <article className="a4-sheet">
          {/* Header */}
          <header className="flex items-start justify-between border-b-4 border-double border-foreground pb-3">
            <div>
              <div className="text-[8pt] uppercase tracking-[0.25em] text-muted-foreground">Stock Reconciliation Report</div>
              <h1 className="text-2xl font-semibold leading-tight">{meta.storeName || "Stock"}</h1>
              <div className="text-[9pt]">Physical stock (in hand) vs computer stock</div>
            </div>
            <div className="num text-right text-[8.5pt] leading-relaxed">
              <div>
                Count date: <strong>{meta.countDate}</strong>
              </div>
              <div>Printed: {printedOn}</div>
              <div>
                Items: {s.totalItems} · Entered: {s.enteredItems}
              </div>
            </div>
          </header>

          {/* Headline */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {[
              { l: "Stock in hand", v: fmtRs(enteredInHandValue), sub: `${fmtNum(enteredInHandQty)} pcs`, c: "" },
              { l: "Stock in computer", v: fmtRs(s.computerAfterSalesValue), sub: `${fmtNum(s.computerAfterSalesQty)} pcs (after sales)`, c: "" },
              { l: "Shortage / loss", v: fmtRs(s.shortValue), sub: `${fmtNum(s.shortQty)} pcs · ${s.shortItems} items`, c: "bg-short-soft text-short" },
              {
                l: s.netValue < 0 ? "Net loss" : "Net gain",
                v: fmtRs(Math.abs(s.netValue)),
                sub: `${fmtSigned(s.netQty)} pcs net`,
                c: "bg-ink text-ink-foreground",
              },
            ].map((b) => (
              <div key={b.l} className={`rounded border border-input p-2 ${b.c}`}>
                <div className="text-[7pt] uppercase tracking-wider opacity-80">{b.l}</div>
                <div className="num text-[12pt] font-bold">{b.v}</div>
                <div className="num text-[7.5pt] opacity-80">{b.sub}</div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <Section title="1. Summary" sub="JSON list = computer stock. Manual entries = in-hand stock. Only physically counted items are compared; repeated lines are added together. Values are at cost rate.">
            <div className="grid grid-cols-[1.5fr_1fr] gap-4">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Particulars</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Value (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Computer stock (counted items only)</td>
                    <td className={R}>{fmtNum(s.enteredComputerQty)}</td>
                    <td className={R}>{fmtNum(s.enteredComputerValue)}</td>
                  </tr>
                  <tr>
                    <td>Less: unposted sales (same counted items)</td>
                    <td className={R}>({fmtNum(comparedSoldQty)})</td>
                    <td className={R}>({fmtNum(comparedSoldValue)})</td>
                  </tr>
                  <tr className="font-semibold">
                    <td>Computer stock after sales</td>
                    <td className={R}>{fmtNum(s.computerAfterSalesQty)}</td>
                    <td className={R}>{fmtNum(s.computerAfterSalesValue)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td>Physical stock in hand (same items)</td>
                    <td className={R}>{fmtNum(enteredInHandQty)}</td>
                    <td className={R}>{fmtNum(enteredInHandValue)}</td>
                  </tr>
                  <tr className="text-short">
                    <td>Shortage — computer more than in hand</td>
                    <td className={R}>{fmtNum(s.shortQty)}</td>
                    <td className={R}>{fmtNum(s.shortValue)}</td>
                  </tr>
                  <tr className="text-excess">
                    <td>Excess — in hand more than computer</td>
                    <td className={R}>{fmtNum(s.excessQty)}</td>
                    <td className={R}>{fmtNum(s.excessValue)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td>{s.netValue < 0 ? "NET LOSS (shortage − excess)" : "NET GAIN (excess − shortage)"}</td>
                    <td className={R}>{fmtSigned(s.netQty)}</td>
                    <td className={R}>{fmtNum(Math.abs(s.netValue))}</td>
                  </tr>
                </tfoot>
              </table>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Item count</th>
                    <th className="text-right">Items</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Total items in list</td><td className={R}>{s.totalItems}</td></tr>
                  <tr><td>In-hand count entered</td><td className={R}>{s.enteredItems}</td></tr>
                  <tr><td>Pending (not entered)</td><td className={R}>{s.pendingItems}</td></tr>
                  <tr><td>Matched exactly</td><td className={R}>{s.matchedItems}</td></tr>
                  <tr className="text-short"><td>Short items</td><td className={R}>{s.shortItems}</td></tr>
                  <tr className="text-excess"><td>Excess items</td><td className={R}>{s.excessItems}</td></tr>
                  <tr><td>In computer, none in hand</td><td className={R}>{zeroInHandInComputer}</td></tr>
                  <tr><td>In hand, none in computer</td><td className={R}>{zeroInComputerInHand}</td></tr>
                  <tr><td>Accuracy (matched ÷ entered)</td><td className={R}>{s.enteredItems ? Math.round((s.matchedItems / s.enteredItems) * 100) : 0}%</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[8pt]">
              Counted stock in hand ({s.enteredItems} items): <strong className="num">{fmtNum(s.inHandQty)} pcs</strong>{" "}
              worth <strong className="num">{fmtRs(s.inHandValue)}</strong>.
              {" "}Computer stock from JSON (all {s.totalItems} items): <strong className="num">{fmtNum(s.computerQty)} pcs</strong>{" "}
              worth <strong className="num">{fmtRs(s.computerValue)}</strong>.
            </p>
          </Section>

          <Section title="2. Shortage — computer shows more than in hand" sub="These items are missing. Loss = short qty × cost rate. Sorted by highest loss.">
            {diffTable(short, "short")}
          </Section>

          <Section title="3. Excess — in hand more than computer" sub="Extra stock found that the computer does not show. Sorted by highest value.">
            {diffTable(excess, "excess")}
          </Section>

          <Section
            title="4. Computer adjustment sheet"
            sub="Entries needed to patch the computer so it equals stock in hand. First post the sales, then post the adjustment (+ = stock in, − = stock out)."
          >
            <table className="report-table">
              <thead>
                <tr>
                  <th className="w-[22pt]">#</th>
                  <th>Description</th>
                  <th className="text-right">Computer now</th>
                  <th className="text-right">Post sale</th>
                  <th className="text-right">Adjustment</th>
                  <th className="text-right">Final qty</th>
                  <th className="w-[30pt] text-center">Done</th>
                </tr>
              </thead>
              <tbody>
                {patch.map((r, i) => (
                  <tr key={r.id}>
                    <td className="num">{i + 1}</td>
                    <td>{r.description}</td>
                    <td className={R}>{fmtNum(r.computer ?? 0)}</td>
                    <td className={R}>{r.sold ? `−${fmtNum(r.sold)}` : "–"}</td>
                    <td className={`${R} font-semibold ${r.diff < 0 ? "text-short" : r.diff > 0 ? "text-excess" : ""}`}>
                      {r.diff === 0 ? "–" : fmtSigned(r.diff)}
                    </td>
                    <td className={`${R} font-semibold`}>{r.inHand === null ? "—" : fmtNum(r.inHand)}</td>
                    <td className="text-center">☐</td>
                  </tr>
                ))}
                {patch.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground">No adjustments needed</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>

          <Section title="5. Sold items — to post as sale in computer">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bill</th>
                  <th>Description</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Cost value</th>
                  <th className="text-right">Sale rate</th>
                  <th className="text-right">Amount</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((x) => {
                  const it = byId.get(x.itemId);
                  return (
                    <tr key={x.id}>
                      <td className="num">{x.date}</td>
                      <td>{x.billNo ?? ""}</td>
                      <td>{it?.description ?? "Deleted item"}</td>
                      <td className={R}>{fmtNum(x.qty)}</td>
                      <td className={R}>{fmtNum(x.qty * (it?.rate ?? 0))}</td>
                      <td className={R}>{fmtNum(x.saleRate)}</td>
                      <td className={R}>{fmtNum(x.qty * x.saleRate)}</td>
                      <td>{x.note ?? ""}</td>
                    </tr>
                  );
                })}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-foreground">No unposted sales</td>
                  </tr>
                )}
              </tbody>
              {sales.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total ({sales.length} entries)</td>
                    <td className={R}>{fmtNum(s.soldQty)}</td>
                    <td className={R}>{fmtNum(s.soldCostValue)}</td>
                    <td />
                    <td className={R}>{fmtNum(s.soldSaleValue)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </Section>

          {showPending && pending.length > 0 && (
            <Section title={`6. Pending — in-hand count not entered (${pending.length})`} sub="These items were not compared. Quantities shown are computer stock from JSON.">
              <div className="columns-3 gap-4 text-[7.5pt] leading-snug">
                {pending.map((r) => (
                  <div key={r.id} className="flex justify-between gap-2 border-b border-dotted border-input">
                    <span className="truncate">{r.description}</span>
                    <span className="num">{fmtNum(r.computer)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title={`7. Repeated in-hand entries (${repeats.length} items)`} sub="Items counted 2 or 3+ times are highlighted — check them first. Each original count line is listed below; quantities are added, not discarded.">
            {repeats.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div className="rounded border border-input bg-pending-soft p-2">
                  <div className="text-[7pt] uppercase tracking-wider opacity-80">Counted 2 times</div>
                  <div className="num text-[12pt] font-bold">{twice.length} items</div>
                  <div className="text-[7.5pt] opacity-80">{twice.map((g) => byId.get(g.itemId)?.description ?? "Deleted item").join(" · ") || "—"}</div>
                </div>
                <div className="rounded border border-input bg-short-soft p-2 text-short">
                  <div className="text-[7pt] uppercase tracking-wider opacity-80">Counted 3+ times</div>
                  <div className="num text-[12pt] font-bold">{thrice.length} items</div>
                  <div className="text-[7.5pt] opacity-80">{thrice.map((g) => byId.get(g.itemId)?.description ?? "Deleted item").join(" · ") || "—"}</div>
                </div>
              </div>
            )}
            <table className="report-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="text-right">Times added</th>
                  <th className="text-right">Entry line</th>
                  <th className="text-right">Occurrence</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Total in hand</th>
                </tr>
              </thead>
              <tbody>
                {repeats.flatMap((group) => group.lines.map((line, index) => (
                  <tr key={line.id} className={group.count >= 3 ? "bg-short-soft" : "bg-pending-soft"}>
                    <td className="font-medium">
                      {byId.get(group.itemId)?.description ?? "Deleted item"}
                      {index === 0 && (
                        <span className={`ml-1 rounded px-1 text-[7pt] font-bold ${group.count >= 3 ? "bg-short text-white" : "bg-pending/20 text-pending"}`}>
                          ×{group.count}
                        </span>
                      )}
                    </td>
                    <td className={R}>{group.count}</td>
                    <td className={R}>#{line.position}</td>
                    <td className={R}>{index + 1} / {group.count}</td>
                    <td className={R}>{fmtNum(line.qty)}</td>
                    <td className={`${R} font-semibold`}>{index === 0 ? fmtNum(group.total) : ""}</td>
                  </tr>
                )))}
                {repeats.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground">No repeated in-hand entries</td></tr>}
              </tbody>
            </table>
          </Section>

          {showFull && (
            <Section title="Annexure — full stock list" className="print-break">
              <table className="report-table">
                <thead>
                  <tr>
                    <th className="w-[22pt]">#</th>
                    <th>Description</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">In hand</th>
                    <th className="text-right">Computer</th>
                    <th className="text-right">Sold</th>
                    <th className="text-right">Diff</th>
                    <th className="text-right">Diff value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="num">{i + 1}</td>
                      <td>{r.description}</td>
                      <td className={R}>{fmtNum(r.rate)}</td>
                      <td className={R}>{r.inHand === null ? "—" : fmtNum(r.inHand)}</td>
                      <td className={R}>{r.computer === null ? "—" : fmtNum(r.computer)}</td>
                      <td className={R}>{r.sold ? fmtNum(r.sold) : ""}</td>
                      <td className={`${R} ${r.diff < 0 ? "text-short" : r.diff > 0 ? "text-excess" : ""}`}>
                        {r.status === "pending" ? "" : r.diff === 0 ? "0" : fmtSigned(r.diff)}
                      </td>
                      <td className={R}>{r.status === "pending" || r.diff === 0 ? "" : fmtSigned(r.diffValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Signatures */}
          <div className="mt-14 grid grid-cols-3 gap-8 text-center text-[8.5pt]" style={{ breakInside: "avoid" }}>
            {[
              { l: "Prepared by", n: meta.preparedBy },
              { l: "Checked by", n: meta.checkedBy },
              { l: "Approved by", n: "" },
            ].map((x) => (
              <div key={x.l}>
                <div className="h-6 font-medium">{x.n}</div>
                <div className="border-t border-foreground pt-1">{x.l}</div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </AppShell>
  );
}
