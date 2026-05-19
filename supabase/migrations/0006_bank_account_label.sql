-- =====================================================================
-- Migration 0006 — Konto-Bezeichnung (Label)
-- =====================================================================
-- Optionaler User-vergebener interner Name pro Bankkonto, z.B.
-- "Mietkonto Berlin". Wenn leer fällt das Frontend auf `bank_name` zurück.
-- Im SQL-Editor einmal ausführen.

alter table public.bank_accounts
  add column if not exists label text;
