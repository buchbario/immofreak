-- =====================================================================
-- Migration 0007 — Banking: Transaktionen ignorieren
-- =====================================================================
-- Erlaubt es, einzelne Bank-Transaktionen vom Matching/Reporting
-- auszunehmen — z.B. Eigenüberweisungen oder Rückerstattungen, die
-- keine Mietzahlungen sind. Ignorierte Eingänge tauchen weder in der
-- Mieteingang-Übersicht, in den Vorschlägen noch in der synthetischen
-- TenantPayment-Sicht der Transaktionen-/Finanzen-Seiten auf.

alter table public.bank_transactions
  add column if not exists is_ignored boolean not null default false;

create index if not exists bank_transactions_is_ignored_idx
  on public.bank_transactions (user_id, is_ignored)
  where is_ignored = true;
