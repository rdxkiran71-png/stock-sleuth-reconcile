import { supabase } from "@/integrations/supabase/client";
import type { ComputerEntry, ReportMeta, Sale } from "./stock";

export interface AuditFolder {
  id: string;
  name: string;
  storeName: string;
  countDate: string;
  preparedBy: string;
  checkedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditSnapshot {
  folder: AuditFolder;
  entries: ComputerEntry[];
  sales: Sale[];
}

interface AuditRow {
  id: string;
  name: string;
  store_name: string;
  count_date: string;
  prepared_by: string;
  checked_by: string;
  created_at: string;
  updated_at: string;
}

interface EntryRow {
  id: string;
  audit_id: string;
  item_id: string;
  qty: number;
  at: string;
  position: number;
}

interface SaleRow {
  id: string;
  audit_id: string;
  item_id: string;
  qty: number;
  sale_rate: number;
  at: string;
}

const toFolder = (r: AuditRow): AuditFolder => ({
  id: r.id,
  name: r.name,
  storeName: r.store_name,
  countDate: r.count_date,
  preparedBy: r.prepared_by,
  checkedBy: r.checked_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function listAudits(): Promise<AuditFolder[]> {
  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as AuditRow[]).map(toFolder);
}

export async function createAudit(name: string, meta: ReportMeta): Promise<AuditFolder> {
  const { data, error } = await supabase
    .from("audits")
    .insert({
      name,
      store_name: meta.storeName,
      count_date: meta.countDate,
      prepared_by: meta.preparedBy,
      checked_by: meta.checkedBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toFolder(data as AuditRow);
}

export async function renameAudit(id: string, name: string) {
  const { error } = await supabase
    .from("audits")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAudit(id: string) {
  const { error } = await supabase.from("audits").delete().eq("id", id);
  if (error) throw error;
}

/** Load one audit folder with its entry lines and sales. */
export async function loadAudit(id: string): Promise<AuditSnapshot> {
  const [a, e, s] = await Promise.all([
    supabase.from("audits").select("*").eq("id", id).single(),
    supabase.from("audit_entries").select("*").eq("audit_id", id).order("position", { ascending: true }),
    supabase.from("audit_sales").select("*").eq("audit_id", id).order("at", { ascending: true }),
  ]);
  if (a.error) throw a.error;
  if (e.error) throw e.error;
  if (s.error) throw s.error;
  return {
    folder: toFolder(a.data as AuditRow),
    entries: (e.data as EntryRow[]).map((r) => ({ id: r.id, itemId: r.item_id, qty: Number(r.qty), at: r.at })),
    sales: (s.data as SaleRow[]).map((r) => ({
      id: r.id,
      itemId: r.item_id,
      qty: Number(r.qty),
      saleRate: Number(r.sale_rate),
      date: r.at.slice(0, 10),
    })),
  };
}

/** Mirror a full local state into an audit folder (replaces its entries and sales). */
export async function saveAuditSnapshot(
  id: string,
  meta: ReportMeta,
  entries: ComputerEntry[],
  sales: Sale[],
) {
  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("audits")
    .update({
      store_name: meta.storeName,
      count_date: meta.countDate,
      prepared_by: meta.preparedBy,
      checked_by: meta.checkedBy,
      updated_at: now,
    })
    .eq("id", id);
  if (upErr) throw upErr;

  const { error: delErr } = await supabase.from("audit_entries").delete().eq("audit_id", id);
  if (delErr) throw delErr;
  if (entries.length) {
    const { error } = await supabase.from("audit_entries").insert(
      entries.map((e, i) => ({ audit_id: id, item_id: e.itemId, qty: e.qty, at: e.at, position: i })),
    );
    if (error) throw error;
  }

  const { error: delSalesErr } = await supabase.from("audit_sales").delete().eq("audit_id", id);
  if (delSalesErr) throw delSalesErr;
  if (sales.length) {
    const { error } = await supabase.from("audit_sales").insert(
      sales.map((x) => ({ audit_id: id, item_id: x.itemId, qty: x.qty, sale_rate: x.saleRate, at: x.date })),
    );
    if (error) throw error;
  }
}

/** Real-time channel name for an audit folder (used to ping other open tabs). */
export const auditChannelName = (id: string) => `audit-${id}`;
