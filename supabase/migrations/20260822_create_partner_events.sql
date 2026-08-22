-- Migration: create partner_events table
-- Run this in Supabase SQL editor or include in your migration flow

create table if not exists partner_events (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null,
  type text not null,
  metadata jsonb,
  ts timestamptz not null default now(),
  ip text,
  ua text
);

create index if not exists idx_partner_events_partner_id on partner_events(partner_id);
create index if not exists idx_partner_events_ts on partner_events(ts desc);

-- Enable Row Level Security and add conservative policies to prevent anonymous access.
-- The server uses the SUPABASE_SERVICE_ROLE_KEY for admin reads/writes (service role bypasses RLS).
ALTER TABLE partner_events ENABLE ROW LEVEL SECURITY;

-- Allow SELECT only for authenticated users (prevents public/anon access).
CREATE POLICY "allow_select_authenticated" ON partner_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow INSERT only for authenticated users. Server-side inserts using service role bypass RLS.
CREATE POLICY "allow_insert_authenticated" ON partner_events
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- (Optional) Deny updates/deletes from anon clients by default — only allow via service role.
CREATE POLICY "deny_update" ON partner_events
  FOR UPDATE
  USING (false);

CREATE POLICY "deny_delete" ON partner_events
  FOR DELETE
  USING (false);
