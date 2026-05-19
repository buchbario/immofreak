-- =====================================================================
-- Migration 0004 — projects.actual_sell_price
-- =====================================================================
-- Tatsächlicher Verkaufspreis, wird nach Abschluss eines Projekts erfasst.
-- ARV-Spalte wird auf optional umgestellt (kein UI-Feld mehr).
-- Im SQL-Editor einmal ausführen.

alter table public.projects
  add column if not exists actual_sell_price numeric;

-- ARV bleibt als Legacy-Spalte erhalten, aber nicht mehr Pflicht.
-- Falls die Spalte als NOT NULL deklariert war, lockern wir das auf,
-- damit neue Inserts ohne ARV-Wert durchgehen.
alter table public.projects
  alter column arv drop not null;
