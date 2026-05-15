-- =====================================================================
-- Migration 0002 — Leads (Akquise-Pipeline für Fix & Flip)
-- =====================================================================
-- Kanban-Board mit 9 Spalten: Lead → Erstkontakt → Kalkulation →
-- Besichtigung → Angebot → Unterlagenprüfung → Follow-Up → Deal → Archiv.
-- Im SQL-Editor einmal ausführen.
-- =====================================================================

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  status          text not null default 'Lead',
  address         text,
  rooms           numeric,
  area            numeric,
  asking_price    numeric,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  notes           text,
  immoscout_url   text,
  "order"         integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists leads_user_idx on public.leads(user_id);
create index if not exists leads_status_idx on public.leads(user_id, status);

-- RLS: nur Eigentümer
alter table public.leads enable row level security;

drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own" on public.leads for select
  using (auth.uid() = user_id);

drop policy if exists "leads_insert_own" on public.leads;
create policy "leads_insert_own" on public.leads for insert
  with check (auth.uid() = user_id);

drop policy if exists "leads_update_own" on public.leads;
create policy "leads_update_own" on public.leads for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "leads_delete_own" on public.leads;
create policy "leads_delete_own" on public.leads for delete
  using (auth.uid() = user_id);

-- updated_at-Trigger (nutzt set_updated_at() aus 0001)
drop trigger if exists set_updated_at on public.leads;
create trigger set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
