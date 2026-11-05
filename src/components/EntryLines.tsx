import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { actions } from "@/lib/store";
import { fmtNum, groupLinesByItem, itemCode, type ComputerEntry, type StockItem } from "@/lib/stock";

/** Bill-style list of computer entry lines; repeat entries of an item sit directly under the first. */
export function EntryLines({
  entries,
  byId,
  lastAddedId,
}: {
  entries: ComputerEntry[];
  byId: Map<string, StockItem>;
  lastAddedId: string | null;
}) {
  const groups = groupLinesByItem(entries);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lastAddedId) return;
    const el = boxRef.current?.querySelector(`[data-line="${lastAddedId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [lastAddedId, entries.length]);

  let line = 0;
  return (
    <div ref={boxRef} className="max-h-[420px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-secondary text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="w-12 px-3 py-2">Line</th>
            <th className="w-16 px-2 py-2">Code</th>
            <th className="px-2 py-2">Description</th>
            <th className="px-2 py-2">Entry</th>
            <th className="px-2 py-2 text-right">Qty</th>
            <th className="px-2 py-2 text-right">In hand</th>
            <th className="px-2 py-2 text-right">Time</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const item = byId.get(g[0]!.itemId);
            const multi = g.length > 1;
            const total = g.reduce((a, e) => a + e.qty, 0);
            return [
              ...g.map((e, i) => {
                line++;
                const fresh = e.id === lastAddedId;
                return (
                  <tr
                    key={e.id}
                    data-line={e.id}
                    className={`border-b border-border/60 ${multi ? "bg-pending-soft/70" : ""} ${
                      fresh ? "animate-in fade-in bg-accent/40" : ""
                    }`}
                  >
                    <td className="num px-3 py-1.5 text-xs text-muted-foreground">{line}</td>
                    <td className="num px-2 py-1.5 font-semibold">
                      {multi && i > 0 ? <span className="text-pending">↳</span> : itemCode(item?.description ?? "")}
                    </td>
                    <td className="px-2 py-1.5 font-medium">{item?.description ?? "Deleted item"}</td>
                    <td className="px-2 py-1.5">
                      {multi && (
                        <span className="rounded bg-pending/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-pending">
                          {i + 1} of {g.length}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input
                        type="number"
                        min={0}
                        defaultValue={e.qty}
                        key={e.qty}
                        aria-label="Entry quantity"
                        onBlur={(ev) => {
                          const v = Number(ev.target.value);
                          if (Number.isInteger(v) && v >= 0 && v !== e.qty) actions.updateEntry(e.id, v);
                          else ev.target.value = String(e.qty);
                        }}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") ev.currentTarget.blur();
                        }}
                        className="num h-7 w-20 rounded border border-transparent bg-transparent px-2 text-right font-semibold outline-none hover:border-input focus:border-primary focus:bg-paper"
                      />
                    </td>
                    <td className="num px-2 py-1.5 text-right text-muted-foreground">
                      {i === 0 ? fmtNum(item?.inHand ?? 0) : ""}
                    </td>
                    <td className="num px-2 py-1.5 text-right text-xs text-muted-foreground">
                      {new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-1 py-1.5">
                      <button
                        type="button"
                        title="Delete line"
                        onClick={() => actions.deleteEntry(e.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-short-soft hover:text-short"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              }),
              multi ? (
                <tr key={`${g[0]!.itemId}-total`} className="border-b-2 border-pending/40 bg-pending-soft">
                  <td colSpan={4} className="px-3 py-1 text-right text-xs font-semibold uppercase tracking-wide text-pending">
                    Total for {itemCode(item?.description ?? "")} ({g.length} entries)
                  </td>
                  <td className="num px-2 py-1 text-right font-bold">{fmtNum(total)}</td>
                  <td colSpan={3} />
                </tr>
              ) : null,
            ];
          })}
          {entries.length === 0 && (
            <tr>
              <td colSpan={8} className="p-8 text-center text-muted-foreground">
                No entries yet. Type an item code above and press Enter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
