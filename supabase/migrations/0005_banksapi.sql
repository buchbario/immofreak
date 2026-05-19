-- =====================================================================
-- Migration 0005 — Banking-Erweiterung: IBAN, Provider, Match-Status, Lern-Mapping
-- =====================================================================
-- Fügt Felder für echte Open-Banking-Anbindung (BANKSapi etc.) und die
-- "merke dir die IBAN"-Lernfunktion hinzu. Vorbereitung für die
-- Edge-Function `banksapi-proxy` aus Migration 0006.
-- Im SQL-Editor einmal ausführen.

-- 1) IBAN am Mieter (optional, manuell pflegbar) – wird vom Matcher direkt
--    als High-Confidence-Treffer genutzt.
alter table public.tenants
  add column if not exists iban text;

-- 2) Banking-Provider-Felder am Konto. Bestehende Demo-Konten bleiben mit
--    NULL → Frontend interpretiert NULL als 'demo'.
alter table public.bank_accounts
  add column if not exists provider text,
  add column if not exists banksapi_access_id text,
  add column if not exists banksapi_product_id text,
  add column if not exists consent_expires_at timestamptz;

-- 3) Match-Status + Idempotenz an Transaktionen. `banksapi_transaction_id`
--    bildet zusammen mit `bank_account_id` einen UNIQUE-Index, sodass das
--    Re-Sync eines Kontos idempotent ist (keine Duplikate).
alter table public.bank_transactions
  add column if not exists match_status text,
  add column if not exists match_confidence numeric,
  add column if not exists banksapi_transaction_id text;

create unique index if not exists bank_transactions_banksapi_idem_idx
  on public.bank_transactions (bank_account_id, banksapi_transaction_id)
  where banksapi_transaction_id is not null;

-- 4) Lern-Mapping: Counterparty-Name oder IBAN → Mieter. Wird beim manuellen
--    Zuordnen mit "merken"-Haken angelegt. 1 Mieter : n Mappings (z.B. wenn
--    Partner/Eltern mit eigener IBAN ebenfalls zahlen).
create table if not exists public.tenant_payment_mappings (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  iban                        text,
  counterparty_name           text,
  learned_from_transaction_id uuid references public.bank_transactions(id) on delete set null,
  created_at                  timestamptz not null default now()
);
create index if not exists tenant_payment_mappings_user_idx on public.tenant_payment_mappings(user_id);
create index if not exists tenant_payment_mappings_tenant_idx on public.tenant_payment_mappings(tenant_id);
create index if not exists tenant_payment_mappings_iban_idx
  on public.tenant_payment_mappings(user_id, iban) where iban is not null;

-- RLS — Owner-only, gleiches Muster wie bei den anderen Buy&Hold-Tabellen.
alter table public.tenant_payment_mappings enable row level security;

drop policy if exists "tenant_payment_mappings_select_own" on public.tenant_payment_mappings;
create policy "tenant_payment_mappings_select_own" on public.tenant_payment_mappings
  for select using (auth.uid() = user_id);

drop policy if exists "tenant_payment_mappings_insert_own" on public.tenant_payment_mappings;
create policy "tenant_payment_mappings_insert_own" on public.tenant_payment_mappings
  for insert with check (auth.uid() = user_id);

drop policy if exists "tenant_payment_mappings_update_own" on public.tenant_payment_mappings;
create policy "tenant_payment_mappings_update_own" on public.tenant_payment_mappings
  for update using (auth.uid() = user_id);

drop policy if exists "tenant_payment_mappings_delete_own" on public.tenant_payment_mappings;
create policy "tenant_payment_mappings_delete_own" on public.tenant_payment_mappings
  for delete using (auth.uid() = user_id);
