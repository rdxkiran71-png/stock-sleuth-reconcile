import type { Status } from "@/lib/stock";

const map: Record<Status, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-pending-soft text-pending border-pending/30" },
  matched: { label: "Matched", cls: "bg-matched-soft text-matched border-matched/25" },
  short: { label: "Short", cls: "bg-short-soft text-short border-short/30" },
  excess: { label: "Excess", cls: "bg-excess-soft text-excess border-excess/30" },
};

export function StatusBadge({ status }: { status: Status }) {
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
