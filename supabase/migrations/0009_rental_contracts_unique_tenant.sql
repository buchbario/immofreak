-- Migration 0009: ein Mietvertrag pro Mieter
-- ─────────────────────────────────────────────────────────────────────
-- Bisher konnte derselbe Mieter durch Cache-Races im Auto-Generator
-- (useEnsureContractTemplates) mehrere identische Mietverträge bekommen.
-- Diese Migration:
--   1. löscht bestehende Duplikate (älteren Vertrag behalten),
--   2. erzwingt auf DB-Ebene, dass jeder Mieter maximal einen Vertrag hat.

-- Schritt 1: Duplikate aufräumen — pro `tenant_id` bleibt der älteste Vertrag,
-- alle weiteren werden gelöscht. `id` dient als Tiebreaker, falls mehrere
-- Verträge denselben `created_at` haben.
with ranked as (
  select id,
         tenant_id,
         row_number() over (
           partition by tenant_id
           order by created_at asc, id asc
         ) as rn
  from rental_contracts
)
delete from rental_contracts
where id in (select id from ranked where rn > 1);

-- Schritt 2: Eindeutigkeit erzwingen. Ein Mieter kann immer nur einen
-- aktiven Mietvertrag haben — ein optimistischer Doppel-Insert vom Client
-- wird ab jetzt direkt von Postgres abgelehnt.
create unique index if not exists rental_contracts_tenant_id_unique
  on rental_contracts(tenant_id);
