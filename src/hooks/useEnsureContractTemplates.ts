import { useEffect, useRef } from 'react';
import { useTenants } from './useTenants';
import { useRentalContracts } from './useRentalContracts';
import { useRentalUnits } from './useRentalUnits';
import { buildDefaultContractFromTenant } from '../lib/contractTemplate';
import type { RentalContract } from '../types';

/**
 * Stellt sicher, dass jeder Mieter **genau einen** Mietvertrag besitzt.
 *
 * Der Hook ist idempotent und läuft bei jedem relevanten Render-Schritt:
 *  1. **Dedup (jeder Tick)**: findet Mieter mit ≥2 Verträgen und löscht die
 *     jüngeren — der älteste (`createdAt asc`) bleibt erhalten. Läuft IMMER,
 *     nicht nur einmal, damit auch Duplikate aus FK-Races/Cache-Echos
 *     abgeräumt werden, sobald sie sichtbar werden.
 *  2. **Auto-Erstellung**: für Mieter ohne Vertrag wird ein Standardvertrag
 *     angelegt. Doppelte Inserts werden über `inFlightRef` (kein Vertrag
 *     im Cache, aber gerade angelegt) UND `handledRef` (in dieser Hook-
 *     Lifetime schon ausgelöst) verhindert. Zusätzlich greift auf DB-Ebene
 *     der UNIQUE INDEX auf `rental_contracts(tenant_id)` (Migration 0011).
 */
export function useEnsureContractTemplates() {
  const { allTenants } = useTenants();
  const { allContracts, createContract, deleteContract } = useRentalContracts();
  const { allUnits } = useRentalUnits();

  // Tenant-IDs für die in DIESER Hook-Lifetime ein Insert ausgelöst wurde.
  const handledRef = useRef<Set<string>>(new Set());
  // Schon-gelöschte Contract-IDs (für die Dedup-Logik), damit derselbe
  // Duplikat nicht mehrfach delete()d wird, falls er kurzzeitig wieder
  // im Cache erscheint.
  const deletedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (allTenants.length === 0) return;

    // ── 1. Dedup: bei jedem Render Duplikate abräumen ─────────────────────
    const byTenant = new Map<string, RentalContract[]>();
    for (const c of allContracts) {
      if (!c.tenantId) continue;
      if (deletedRef.current.has(c.id)) continue;
      const arr = byTenant.get(c.tenantId);
      if (arr) arr.push(c); else byTenant.set(c.tenantId, [c]);
    }
    for (const [, list] of byTenant) {
      if (list.length <= 1) continue;
      // Ältesten Vertrag (createdAt asc, id asc als Tiebreaker) behalten,
      // alle anderen löschen. Tiebreaker via `id` macht die Auswahl stabil,
      // falls zwei Verträge im selben Millisekunden-Frame erzeugt wurden.
      const sorted = [...list].sort((a, b) => {
        const t = a.createdAt.localeCompare(b.createdAt);
        return t !== 0 ? t : a.id.localeCompare(b.id);
      });
      for (const dup of sorted.slice(1)) {
        deletedRef.current.add(dup.id);
        deleteContract(dup.id);
      }
    }

    // ── 2. Für Mieter ohne Vertrag einen Standardvertrag anlegen ─────────
    // Wir betrachten nur Verträge, die NICHT bereits zum Löschen markiert
    // sind — sonst würde nach dem Dedup-Schritt sofort wieder neu angelegt.
    const liveContracts = allContracts.filter((c) => !deletedRef.current.has(c.id));
    const tenantsWithoutContract = allTenants.filter(
      (t) =>
        !handledRef.current.has(t.id) &&
        !liveContracts.some((c) => c.tenantId === t.id),
    );
    if (tenantsWithoutContract.length === 0) return;

    for (const tenant of tenantsWithoutContract) {
      // SOFORT lock setzen — vor dem (asynchronen) Create, damit ein
      // direkter Re-Run denselben Mieter nicht noch einmal sieht.
      handledRef.current.add(tenant.id);
      const unit = tenant.unitId ? allUnits.find((u) => u.id === tenant.unitId) : undefined;
      const data = buildDefaultContractFromTenant(tenant, unit);
      createContract(data);
    }
  }, [allTenants, allContracts, allUnits, createContract, deleteContract]);
}
