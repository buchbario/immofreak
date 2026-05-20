-- Mietvertrag-Lifecycle: Entwurf → generiert → unterschrieben → aktiv → beendet.
--
-- Bisher gab es nur `contract_type` ('befristet'|'unbefristet') und `deposit_paid`.
-- Damit konnte die UI nicht zeigen, dass ein Vertrag generiert wurde aber noch
-- nicht unterschrieben ist — und es gab keinen Anker für den hochgeladenen
-- Original-PDF-Scan der unterschriebenen Fassung.
--
-- Migrations-Logik:
--   • `status` mit CHECK-Constraint, Default 'draft'
--   • `signed_at` (date, nullable) für das Unterschriftsdatum
--   • `signed_document_id` FK auf contract_documents — damit klar ist, welches
--     hochgeladene Dokument der signierte Original-Scan ist.
--   • Bestehende Verträge: heuristisches Update — alles mit `start_date <= today`
--     bekommt 'active', der Rest 'generated'. Reine Defaults wären 'draft' und
--     würden falsche "Bitte unterschreiben"-Hinweise für bestehende Mietverhältnisse anzeigen.
--
-- contract_documents bekommt zusätzlich:
--   • `document_type` (draft|signed|amendment|other) — vorher nur generisches "type" für MIME
--   • `is_signed_original` (bool) — Marker für den maßgeblichen unterschriebenen Vertrag

alter table public.rental_contracts
  add column if not exists status text not null default 'draft',
  add column if not exists signed_at date,
  add column if not exists signed_document_id uuid;

-- CHECK-Constraint für status (drop-and-recreate-Pattern, falls schon ein älterer Constraint da ist)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rental_contracts_status_check'
  ) then
    alter table public.rental_contracts
      add constraint rental_contracts_status_check
      check (status in ('draft', 'generated', 'signed', 'active', 'terminated'));
  end if;
end $$;

alter table public.contract_documents
  add column if not exists document_type text not null default 'other',
  add column if not exists is_signed_original boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contract_documents_document_type_check'
  ) then
    alter table public.contract_documents
      add constraint contract_documents_document_type_check
      check (document_type in ('draft', 'signed', 'amendment', 'other'));
  end if;
end $$;

-- FK rental_contracts.signed_document_id → contract_documents.id (nullable)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rental_contracts_signed_document_id_fkey'
  ) then
    alter table public.rental_contracts
      add constraint rental_contracts_signed_document_id_fkey
      foreign key (signed_document_id) references public.contract_documents(id) on delete set null;
  end if;
end $$;

-- Backfill: bestehende Verträge sinnvoll einordnen.
-- (Die UI darf nicht plötzlich für aktive Mietverhältnisse "Bitte Vertrag unterschreiben" anzeigen.)
update public.rental_contracts
   set status = case
     when end_date is not null and end_date < current_date then 'terminated'
     when start_date is null or start_date <= current_date then 'active'
     else 'generated'
   end
 where status = 'draft';
