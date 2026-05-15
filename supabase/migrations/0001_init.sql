-- =====================================================================
-- ImmoFreak / Fix-and-Flip-CRM — Initial Schema
-- =====================================================================
-- Multi-Tenant via auth.users → user_id auf jeder Tabelle.
-- RLS ist überall aktiv: ein Nutzer sieht/ändert nur seine eigenen Zeilen.
-- Einmal im Supabase SQL-Editor ausführen.
-- =====================================================================

-- ---------- Helpers ----------
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =====================================================================
-- 1) PROFILES (extra Userdaten neben auth.users)
-- =====================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-Insert profile beim Signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- =====================================================================
-- 2) FIX & FLIP
-- =====================================================================

create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                text not null,
  address             text not null default '',
  purchase_price      numeric not null default 0,
  target_sell_price   numeric not null default 0,
  arv                 numeric not null default 0,
  renovation_budget   numeric not null default 0,
  status              text not null default 'Akquise',
  notes               text not null default '',
  immoscout_url       text,
  grundbuch_url       text,
  expose_url          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects(user_id);

create table if not exists public.contractors (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name         text not null,
  company      text not null default '',
  trade        text not null default 'Sonstige',
  phone        text not null default '',
  email        text not null default '',
  address      text not null default '',
  hourly_rate  numeric not null default 0,
  rating       numeric not null default 0,
  notes        text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists contractors_user_idx on public.contractors(user_id);

create table if not exists public.budget_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  contractor_id   uuid references public.contractors(id) on delete set null,
  category        text not null default '',
  description     text not null default '',
  estimated_cost  numeric not null default 0,
  actual_cost     numeric not null default 0,
  status          text not null default 'geplant',
  created_at      timestamptz not null default now()
);
create index if not exists budget_items_user_idx on public.budget_items(user_id);
create index if not exists budget_items_project_idx on public.budget_items(project_id);

create table if not exists public.project_contractors (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id     uuid not null references public.projects(id) on delete cascade,
  contractor_id  uuid not null references public.contractors(id) on delete cascade,
  assigned_at    timestamptz not null default now()
);
create index if not exists project_contractors_user_idx on public.project_contractors(user_id);

create table if not exists public.project_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  data_url    text not null,
  created_at  timestamptz not null default now()
);
create index if not exists project_photos_user_idx on public.project_photos(user_id);

create table if not exists public.project_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  type        text not null default '',
  size        bigint not null default 0,
  data_url    text,
  created_at  timestamptz not null default now()
);
create index if not exists project_documents_user_idx on public.project_documents(user_id);

-- =====================================================================
-- 3) BUY & HOLD
-- =====================================================================

create table if not exists public.rental_properties (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  address         text not null default '',
  purchase_price  numeric not null default 0,
  current_value   numeric not null default 0,
  purchase_date   date,
  units           integer not null default 1,
  total_area      numeric not null default 0,
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists rental_properties_user_idx on public.rental_properties(user_id);

create table if not exists public.rental_units (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id   uuid not null references public.rental_properties(id) on delete cascade,
  name          text not null,
  area          numeric not null default 0,
  rooms         numeric not null default 0,
  current_rent  numeric not null default 0,
  target_rent   numeric not null default 0,
  tenant_id     uuid,
  created_at    timestamptz not null default now()
);
create index if not exists rental_units_user_idx on public.rental_units(user_id);
create index if not exists rental_units_property_idx on public.rental_units(property_id);

create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id   uuid not null references public.rental_properties(id) on delete cascade,
  unit_id       uuid references public.rental_units(id) on delete set null,
  name          text not null,
  email         text not null default '',
  phone         text not null default '',
  move_in_date  date,
  lease_start   date,
  lease_end     date,
  deposit       numeric not null default 0,
  notes         text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists tenants_user_idx on public.tenants(user_id);

-- (Self-Referenz nachträglich, weil units→tenants und tenants→units kreuz-referenzieren.)
alter table public.rental_units
  drop constraint if exists rental_units_tenant_id_fkey,
  add constraint rental_units_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete set null;

create table if not exists public.utilities (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id     uuid not null references public.rental_properties(id) on delete cascade,
  provider        text not null default '',
  type            text not null default 'Sonstige',
  contract_number text not null default '',
  meter_number    text not null default '',
  monthly_advance numeric not null default 0,
  notes           text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists utilities_user_idx on public.utilities(user_id);

create table if not exists public.utility_costs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  utility_id  uuid not null references public.utilities(id) on delete cascade,
  property_id uuid not null references public.rental_properties(id) on delete cascade,
  year        integer not null,
  total_cost  numeric not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists utility_costs_user_idx on public.utility_costs(user_id);

create table if not exists public.tenant_payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  property_id  uuid not null references public.rental_properties(id) on delete cascade,
  unit_id      uuid references public.rental_units(id) on delete set null,
  amount       numeric not null default 0,
  date         date not null,
  type         text not null default 'Miete',
  status       text not null default 'eingegangen',
  notes        text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists tenant_payments_user_idx on public.tenant_payments(user_id);

create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id     uuid not null references public.rental_properties(id) on delete cascade,
  unit_id         uuid references public.rental_units(id) on delete set null,
  category        text not null default 'Sonstiges',
  description     text not null default '',
  amount          numeric not null default 0,
  date            date not null,
  is_umlagefaehig boolean not null default false,
  receipt_url     text,
  created_at      timestamptz not null default now()
);
create index if not exists expenses_user_idx on public.expenses(user_id);

create table if not exists public.meter_readings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id uuid not null references public.rental_properties(id) on delete cascade,
  unit_id     uuid references public.rental_units(id) on delete set null,
  meter_id    text not null,
  value       numeric not null,
  date        date not null,
  read_by     text not null default '',
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists meter_readings_user_idx on public.meter_readings(user_id);

create table if not exists public.rental_contracts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id       uuid not null references public.rental_properties(id) on delete cascade,
  unit_id           uuid not null references public.rental_units(id) on delete cascade,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  rent_amount       numeric not null default 0,
  operating_costs   numeric not null default 0,
  heating_costs     numeric not null default 0,
  deposit_amount    numeric not null default 0,
  deposit_paid      boolean not null default false,
  deposit_paid_date date,
  start_date        date not null,
  end_date          date,
  contract_type     text not null default 'unbefristet',
  notice_period     integer not null default 3,
  rent_payment_day  integer not null default 1,
  notes             text,
  created_at        timestamptz not null default now()
);
create index if not exists rental_contracts_user_idx on public.rental_contracts(user_id);

create table if not exists public.contract_documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contract_id  uuid not null references public.rental_contracts(id) on delete cascade,
  name         text not null,
  type         text not null default '',
  size         bigint not null default 0,
  data_url     text,
  created_at   timestamptz not null default now()
);
create index if not exists contract_documents_user_idx on public.contract_documents(user_id);

create table if not exists public.distribution_keys (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id uuid not null references public.rental_properties(id) on delete cascade,
  name        text not null,
  type        text not null default 'Wohnfläche',
  description text,
  created_at  timestamptz not null default now()
);
create index if not exists distribution_keys_user_idx on public.distribution_keys(user_id);

create table if not exists public.property_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id uuid not null references public.rental_properties(id) on delete cascade,
  name        text not null,
  data_url    text not null,
  created_at  timestamptz not null default now()
);
create index if not exists property_photos_user_idx on public.property_photos(user_id);

create table if not exists public.property_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id uuid not null references public.rental_properties(id) on delete cascade,
  name        text not null,
  type        text not null default '',
  size        bigint not null default 0,
  data_url    text,
  created_at  timestamptz not null default now()
);
create index if not exists property_documents_user_idx on public.property_documents(user_id);

-- =====================================================================
-- 4) DEAL ANALYZER
-- =====================================================================

create table if not exists public.deal_analyses (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                     text not null,
  address                  text not null default '',
  asking_price             numeric not null default 0,
  arv                      numeric not null default 0,
  square_meters            numeric not null default 0,
  renovation_cost          numeric not null default 0,
  renovation_months        integer not null default 0,
  notar_percent            numeric not null default 0,
  grunderwerbsteuer_percent numeric not null default 0,
  makler_percent           numeric not null default 0,
  purchase_price           numeric not null default 0,
  eigenkapital             numeric not null default 0,
  zinssatz                 numeric not null default 0,
  tilgung                  numeric not null default 0,
  holding_costs_monthly    numeric not null default 0,
  verkaufsmakler_percent   numeric not null default 0,
  notes                    text not null default '',
  project_id               uuid references public.projects(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists deal_analyses_user_idx on public.deal_analyses(user_id);

-- =====================================================================
-- 5) BANKING
-- =====================================================================

create table if not exists public.bank_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bank_name      text not null,
  iban           text not null,
  bic            text not null default '',
  account_holder text not null default '',
  balance        numeric not null default 0,
  last_sync      timestamptz,
  status         text not null default 'connected',
  color          text not null default '#3b82f6',
  domain         text,
  created_at     timestamptz not null default now()
);
create index if not exists bank_accounts_user_idx on public.bank_accounts(user_id);

create table if not exists public.bank_transactions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bank_account_id     uuid not null references public.bank_accounts(id) on delete cascade,
  date                date not null,
  amount              numeric not null,
  counterparty        text not null default '',
  purpose             text not null default '',
  iban                text,
  category            text,
  matched_tenant_id   uuid references public.tenants(id) on delete set null,
  matched_property_id uuid references public.rental_properties(id) on delete set null,
  matched_unit_id     uuid references public.rental_units(id) on delete set null,
  is_reconciled       boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists bank_transactions_user_idx on public.bank_transactions(user_id);
create index if not exists bank_transactions_account_idx on public.bank_transactions(bank_account_id);

-- =====================================================================
-- 6) TASKS / VORGÄNGE
-- =====================================================================

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  status       text not null default 'offen',
  priority     text not null default 'mittel',
  category     text not null default 'Sonstiges',
  mode         text,
  property_id  uuid references public.rental_properties(id) on delete cascade,
  unit_id      uuid references public.rental_units(id) on delete cascade,
  tenant_id    uuid references public.tenants(id) on delete cascade,
  contract_id  uuid references public.rental_contracts(id) on delete cascade,
  due_date     date,
  assigned_to  text,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists tasks_user_idx on public.tasks(user_id);

-- =====================================================================
-- 7) PRIVATE BOARDS (Trello-Style)
-- =====================================================================

create table if not exists public.private_boards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  icon       text,
  accent     text,
  "order"    integer not null default 0,
  pinned     boolean not null default false,
  pin_order  integer,
  created_at timestamptz not null default now()
);
create index if not exists private_boards_user_idx on public.private_boards(user_id);

create table if not exists public.private_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  board_id   uuid not null references public.private_boards(id) on delete cascade,
  name       text not null,
  "order"    integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists private_lists_user_idx on public.private_lists(user_id);

create table if not exists public.private_cards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_id      uuid not null references public.private_lists(id) on delete cascade,
  board_id     uuid not null references public.private_boards(id) on delete cascade,
  title        text not null,
  description  text,
  due_date     date,
  priority     text,
  labels       jsonb,
  checklist    jsonb,
  "order"      integer not null default 0,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists private_cards_user_idx on public.private_cards(user_id);

-- =====================================================================
-- 8) TRASH (Papierkorb)
-- =====================================================================

create table if not exists public.trash (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id   uuid not null,
  data        jsonb not null,
  label       text not null,
  sublabel    text,
  deleted_at  timestamptz not null default now()
);
create index if not exists trash_user_idx on public.trash(user_id);

-- =====================================================================
-- 9) ROW-LEVEL SECURITY — überall aktivieren + Owner-Policies
-- =====================================================================

do $$
declare t text;
begin
  for t in select unnest(array[
    'projects','contractors','budget_items','project_contractors','project_photos','project_documents',
    'rental_properties','rental_units','tenants','utilities','utility_costs','tenant_payments',
    'expenses','meter_readings','rental_contracts','contract_documents','distribution_keys',
    'property_photos','property_documents','deal_analyses','bank_accounts','bank_transactions',
    'tasks','private_boards','private_lists','private_cards','trash'
  ]) loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "%1$s_select_own" on public.%1$I;', t);
    execute format('create policy "%1$s_select_own" on public.%1$I for select using (auth.uid() = user_id);', t);

    execute format('drop policy if exists "%1$s_insert_own" on public.%1$I;', t);
    execute format('create policy "%1$s_insert_own" on public.%1$I for insert with check (auth.uid() = user_id);', t);

    execute format('drop policy if exists "%1$s_update_own" on public.%1$I;', t);
    execute format('create policy "%1$s_update_own" on public.%1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);

    execute format('drop policy if exists "%1$s_delete_own" on public.%1$I;', t);
    execute format('create policy "%1$s_delete_own" on public.%1$I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- =====================================================================
-- 10) UPDATED_AT-Trigger für Tabellen mit updated_at
-- =====================================================================

do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','projects','rental_properties','deal_analyses','tasks'
  ]) loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- =====================================================================
-- 11) STORAGE-Buckets — OPTIONAL (für spätere Migration)
-- =====================================================================
-- Aktuell speichern wir Photos/Dokumente als data_url (base64) direkt in
-- den Tabellen. Vorteil: keine Storage-Konfiguration, einfache Migration
-- aus localStorage. Nachteil: Zeilen können groß werden (>1 MB pro Bild).
--
-- Wenn Storage-Bedarf wächst, später Buckets im Dashboard anlegen:
--   • photos       (private)
--   • documents    (private)
--
-- Storage-RLS (Owner = erste Pfadkomponente = user_id):
--
-- create policy "owner_all" on storage.objects for all
--   using  ( auth.uid()::text = (storage.foldername(name))[1] )
--   with check ( auth.uid()::text = (storage.foldername(name))[1] );
--
-- Pfad-Konvention: `${user_id}/${bucket}/${uuid}-${filename}`
-- Spalten dann: storage_path text statt data_url.
