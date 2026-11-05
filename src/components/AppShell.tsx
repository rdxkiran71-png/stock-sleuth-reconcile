import { Link } from "@tanstack/react-router";
import { ClipboardList, FileText, ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";
import { useAppState } from "@/lib/store";
import { reconcileAll, summarize } from "@/lib/stock";

const nav = [
  { to: "/", label: "Stock Entry", icon: ClipboardList },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/report", label: "A4 Report", icon: FileText },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { items, sales, meta } = useAppState();
  const s = summarize(reconcileAll(items, sales), sales);
  const pct = s.totalItems ? Math.round((s.enteredItems / s.totalItems) * 100) : 0;

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold">{meta.storeName || "Stock"}</span>
            <span className="text-xs uppercase tracking-[0.2em] opacity-70">Stock Audit</span>
          </Link>
          <nav className="flex gap-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true }}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm opacity-80 transition hover:bg-ink-foreground/10 hover:opacity-100"
                activeProps={{ className: "!bg-accent !text-accent-foreground !opacity-100 font-medium" }}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="opacity-70">Computer entry</span>
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-ink-foreground/15">
              <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="num">
              {s.enteredItems}/{s.totalItems}
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "short" | "excess" | "pending" | "ink";
}) {
  const tones = {
    default: "bg-card",
    short: "bg-short-soft text-short",
    excess: "bg-excess-soft text-excess",
    pending: "bg-pending-soft",
    ink: "bg-ink text-ink-foreground",
  } as const;
  return (
    <div className={`rounded-lg border border-border p-4 shadow-card ${tones[tone]}`}>
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-75">{label}</div>
      <div className="num mt-1 text-xl font-semibold">{value}</div>
      {sub && <div className="num mt-0.5 text-xs opacity-75">{sub}</div>}
    </div>
  );
}
