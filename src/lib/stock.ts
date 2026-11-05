export interface StockItem {
  id: string;
  description: string;
  /** Physically counted quantity (what we have in hand). */
  inHand: number;
  /** Cost rate per unit. */
  rate: number;
  /** Quantity showing in the computer system. null = not entered yet. */
  computer: number | null;
}

export interface Sale {
  id: string;
  itemId: string;
  qty: number;
  /** Sale price per unit (defaults to cost rate). */
  saleRate: number;
  date: string;
  billNo?: string;
  note?: string;
}

/** One line of computer stock entry (like a bill line). Same item can have many lines. */
export interface ComputerEntry {
  id: string;
  itemId: string;
  qty: number;
  /** ISO timestamp of entry */
  at: string;
}

/** Item code = first word of the description, e.g. "1045" in "1045 MEAT MINDER". */
export function itemCode(description: string): string {
  return description.trim().split(/\s+/)[0] ?? "";
}

/** Total computer qty per item from entry lines. Items with no lines are absent. */
export function computerTotals(entries: ComputerEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.itemId, (m.get(e.itemId) ?? 0) + e.qty);
  return m;
}

/**
 * Order lines like a bill: items in order of their first entry, with every
 * repeat entry of the same item placed directly under the earlier one.
 */
export function groupLinesByItem<T extends { itemId: string }>(lines: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const l of lines) {
    const g = groups.get(l.itemId);
    if (g) g.push(l);
    else groups.set(l.itemId, [l]);
  }
  return [...groups.values()];
}

export interface ReportMeta {
  storeName: string;
  countDate: string;
  preparedBy: string;
  checkedBy: string;
}

export type Status = "pending" | "matched" | "short" | "excess";

export interface ReconciledItem extends StockItem {
  sold: number;
  /** Computer qty after the unposted sales are posted (computer − sold). */
  computerAfterSales: number | null;
  /** inHand − computerAfterSales. Negative = shortage, positive = excess. */
  diff: number;
  /** diff × rate */
  diffValue: number;
  status: Status;
}

export function soldByItem(sales: Sale[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sales) map.set(s.itemId, (map.get(s.itemId) ?? 0) + s.qty);
  return map;
}

export function reconcileItem(item: StockItem, sold: number): ReconciledItem {
  if (item.computer === null) {
    return { ...item, sold, computerAfterSales: null, diff: 0, diffValue: 0, status: "pending" };
  }
  const computerAfterSales = item.computer - sold;
  const diff = item.inHand - computerAfterSales;
  const status: Status = diff === 0 ? "matched" : diff < 0 ? "short" : "excess";
  return { ...item, sold, computerAfterSales, diff, diffValue: diff * item.rate, status };
}

export function reconcileAll(items: StockItem[], sales: Sale[]): ReconciledItem[] {
  const sold = soldByItem(sales);
  return items.map((i) => reconcileItem(i, sold.get(i.id) ?? 0));
}

export interface Summary {
  totalItems: number;
  enteredItems: number;
  pendingItems: number;
  matchedItems: number;
  shortItems: number;
  excessItems: number;
  inHandQty: number;
  inHandValue: number;
  /** Totals of entered (non-pending) items only. */
  computerQty: number;
  computerValue: number;
  soldQty: number;
  soldCostValue: number;
  soldSaleValue: number;
  computerAfterSalesQty: number;
  computerAfterSalesValue: number;
  shortQty: number;
  shortValue: number;
  excessQty: number;
  excessValue: number;
  /** excessValue − shortValue. Negative = net loss. */
  netValue: number;
  netQty: number;
}

export function summarize(rows: ReconciledItem[], sales: Sale[]): Summary {
  const s: Summary = {
    totalItems: rows.length,
    enteredItems: 0,
    pendingItems: 0,
    matchedItems: 0,
    shortItems: 0,
    excessItems: 0,
    inHandQty: 0,
    inHandValue: 0,
    computerQty: 0,
    computerValue: 0,
    soldQty: 0,
    soldCostValue: 0,
    soldSaleValue: 0,
    computerAfterSalesQty: 0,
    computerAfterSalesValue: 0,
    shortQty: 0,
    shortValue: 0,
    excessQty: 0,
    excessValue: 0,
    netValue: 0,
    netQty: 0,
  };
  const rateById = new Map(rows.map((r) => [r.id, r.rate]));
  for (const r of rows) {
    s.inHandQty += r.inHand;
    s.inHandValue += r.inHand * r.rate;
    if (r.status === "pending") {
      s.pendingItems++;
      continue;
    }
    s.enteredItems++;
    const c = r.computer ?? 0;
    s.computerQty += c;
    s.computerValue += c * r.rate;
    const after = r.computerAfterSales ?? 0;
    s.computerAfterSalesQty += after;
    s.computerAfterSalesValue += after * r.rate;
    if (r.status === "matched") s.matchedItems++;
    if (r.status === "short") {
      s.shortItems++;
      s.shortQty += -r.diff;
      s.shortValue += -r.diffValue;
    }
    if (r.status === "excess") {
      s.excessItems++;
      s.excessQty += r.diff;
      s.excessValue += r.diffValue;
    }
  }
  for (const sale of sales) {
    s.soldQty += sale.qty;
    s.soldCostValue += sale.qty * (rateById.get(sale.itemId) ?? 0);
    s.soldSaleValue += sale.qty * sale.saleRate;
  }
  s.netValue = s.excessValue - s.shortValue;
  s.netQty = s.excessQty - s.shortQty;
  return s;
}

const numFmt = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 });
export const fmtNum = (n: number) => numFmt.format(n);
export const fmtRs = (n: number) => `Rs ${numFmt.format(n)}`;
export const fmtSigned = (n: number) => (n > 0 ? `+${numFmt.format(n)}` : numFmt.format(n));
