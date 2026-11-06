import { describe, expect, it } from "vitest";
import {
  reconcileItem,
  reconcileAll,
  summarize,
  computerTotals,
  groupLinesByItem,
  repeatedCounts,
  itemCode,
  type StockItem,
  type Sale,
} from "./stock";

describe("bill-style computer entries", () => {
  it("reports items counted twice, three times and more with every quantity and original position", () => {
    const entries = ["a", "b", "a", "c", "b", "b", "d", "d", "d", "d"].map((itemId, index) => ({
      id: String(index), itemId, qty: index + 1, at: "",
    }));
    const repeats = repeatedCounts(entries);
    expect(repeats.map(({ itemId, count, total }) => ({ itemId, count, total }))).toEqual([
      { itemId: "a", count: 2, total: 4 },
      { itemId: "b", count: 3, total: 13 },
      { itemId: "d", count: 4, total: 34 },
    ]);
    expect(repeats[1]?.lines.map(({ position, qty }) => [position, qty])).toEqual([[2, 2], [5, 5], [6, 6]]);
    expect(repeatedCounts(entries.filter((entry) => entry.itemId === "c"))).toEqual([]);
  });

  it("adds up every entry line of the same item", () => {
    const t = computerTotals([
      { id: "1", itemId: "a", qty: 20, at: "" },
      { id: "2", itemId: "b", qty: 5, at: "" },
      { id: "3", itemId: "a", qty: 10, at: "" },
    ]);
    expect(t.get("a")).toBe(30);
    expect(t.get("b")).toBe(5);
  });

  it("puts a repeated item's second line directly under its first line", () => {
    const groups = groupLinesByItem([
      { id: "1", itemId: "a" },
      { id: "2", itemId: "b" },
      { id: "3", itemId: "a" },
    ]);
    expect(groups.map((g) => g.map((l) => l.id))).toEqual([["1", "3"], ["2"]]);
  });

  it("item code is the first word of the description", () => {
    expect(itemCode("1045 MEAT MINDER")).toBe("1045");
  });
});

const item = (over: Partial<StockItem> = {}): StockItem => ({
  id: "a",
  description: "04 CHOPPER",
  inHand: 27,
  rate: 1800,
  computer: 30,
  ...over,
});

describe("stock reconciliation", () => {
  it("computer more than in hand is a shortage costed at rate", () => {
    const r = reconcileItem(item(), 0);
    expect(r.status).toBe("short");
    expect(r.diff).toBe(-3);
    expect(r.diffValue).toBe(-5400);
  });

  it("unposted sales are removed from computer stock before comparing", () => {
    const r = reconcileItem(item({ computer: 30 }), 3);
    expect(r.computerAfterSales).toBe(27);
    expect(r.status).toBe("matched");
  });

  it("in hand more than computer is an excess", () => {
    const r = reconcileItem(item({ computer: 25 }), 0);
    expect(r.status).toBe("excess");
    expect(r.diff).toBe(2);
  });

  it("item not yet counted (no in-hand qty) stays pending and out of totals", () => {
    const rows = reconcileAll([item({ inHand: null })], []);
    expect(rows[0]?.status).toBe("pending");
    expect(summarize(rows, []).shortValue).toBe(0);
  });

  it("net value is excess value minus shortage value", () => {
    const items = [
      item({ id: "a", inHand: 27, rate: 1800, computer: 30 }), // short 3 → 5400
      item({ id: "b", inHand: 12, rate: 1000, computer: 10 }), // excess 2 → 2000
    ];
    const sales: Sale[] = [{ id: "s", itemId: "b", qty: 1, saleRate: 1500, date: "2026-11-05" }];
    // b: computer after sale = 9, in hand 12 → excess 3 → 3000
    const s = summarize(reconcileAll(items, sales), sales);
    expect(s.shortValue).toBe(5400);
    expect(s.excessValue).toBe(3000);
    expect(s.netValue).toBe(-2400);
    expect(s.soldSaleValue).toBe(1500);
  });
});
