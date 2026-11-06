CREATE TABLE public.audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  store_name TEXT NOT NULL DEFAULT 'Westpoint',
  count_date TEXT NOT NULL DEFAULT '',
  prepared_by TEXT NOT NULL DEFAULT '',
  checked_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO authenticated;
GRANT ALL ON public.audits TO service_role;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read audits" ON public.audits FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can create audits" ON public.audits FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update audits" ON public.audits FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete audits" ON public.audits FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE public.audit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  position INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_entries TO authenticated;
GRANT ALL ON public.audit_entries TO service_role;
ALTER TABLE public.audit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read entries" ON public.audit_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can create entries" ON public.audit_entries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update entries" ON public.audit_entries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete entries" ON public.audit_entries FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX audit_entries_audit_id_idx ON public.audit_entries (audit_id);

CREATE TABLE public.audit_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  sale_rate NUMERIC NOT NULL DEFAULT 0,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_sales TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_sales TO authenticated;
GRANT ALL ON public.audit_sales TO service_role;
ALTER TABLE public.audit_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read sales" ON public.audit_sales FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can create sales" ON public.audit_sales FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update sales" ON public.audit_sales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete sales" ON public.audit_sales FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX audit_sales_audit_id_idx ON public.audit_sales (audit_id);