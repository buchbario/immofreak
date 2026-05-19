import { useEffect, useRef } from 'react';
import { useTenants } from './useTenants';
import { useRentalContracts } from './useRentalContracts';
import { useRentalUnits } from './useRentalUnits';
import { buildDefaultContractFromTenant } from '../lib/contractTemplate';
import type { RentalContract } from '../types';

/**
 * Stellt sicher, dass jeder Mieter **genau einen** Mietvertrag besitzt.
 *
 * Zwei Aufgaben:
 *  1. Für Mieter ohne Vertrag wird ein Standardvertrag aus den Mieter-Daten
 *     angelegt. Per-Tenant-Lock via `handledRef` verhindert Doppel-Inserts
 *     durch Cache-Races, optimistische Updates, die unmittelbar wieder
 *     überschrieben werden, oder React-StrictMode-Doppel-Effects.
 *  2. Einmaliger Bereinigungs-Pass (`cleanedRef`): findet alte Duplikate
 *     (mehrere Verträge pro Mieter aus früheren fehlerhaften Auto-Inserts)
 *     und löscht alle bis auf den ältesten. So räumt sich der Datenbestand
 *     beim nächsten App-Start selbst auf.
 *
 * Wird einmal pro App-Mount im AppLayout ausgeführt.
 */
export function useEnsureContractTemplates() {
  const { allTenants } = useTenants();
  const { allContracts, createContract, deleteContract } = useRentalContracts();
  const { allUnits } = useRentalUnits();

  // Tenant-IDs für die wir in DIESER Hook-Lifetime bereits einen Vertrag
  // ausgelöst haben. Verhindert dass spätere Effect-Re-Runs (z.B. wenn der
  // Cache durch einen späten Supabase-Fetch zurückgesetzt wird) erneut
  // anlegen.
  const handledRef = useRef<Set<string>>(new Set());
  // Bereinigung läuft genau einmal pro App-Mount.
  const cleanedRef = useRef(false);

  useEffect(() => {
    if (allTenants.length === 0) return;

    // ── 1. Dedupe: alte Mehrfach-Verträge pro Mieter abräumen ────────────
    if (!cleanedRef.current && allContracts.length > 0) {
      cleanedRef.current = true;
      const byTenant = new Map<string, RentalContract[]>();
      for (const c of allContracts) {
        if (!c.tenantId) continue;
        const arr = byTenant.get(c.tenantId);
        if (arr) arr.push(c); else byTenant.set(c.tenantId, [c]);
      }
      for (const [, list] of byTenant) {
        if (list.length <= 1) continue;
        // Ältesten Vertrag (createdAt asc) behalten, Duplikate löschen.
        const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        for (const dup of sorted.slice(1)) deleteContract(dup.id);
      }
    }

    // ── 2. Für Mieter ohne Vertrag einen Standardvertrag anlegen ─────────
    const tenantsWithoutContract = allTenants.filter(
      (t) =>
        !handledRef.current.has(t.id) &&
        !allContracts.some((c) => c.tenantId === t.id),
    );
    if (tenantsWithoutContract.length === 0) return;

    for (const tenant of tenantsWithoutContract) {
      // SOFORT lock setzen — vor dem (asynchronen) Create, damit ein
      // direkter Re-Run nicht denselben Mieter nochmal sieht.
      handledRef.current.add(tenant.id);
      const unit = tenant.unitId ? allUnits.find((u) => u.id === tenant.unitId) : undefined;
      const data = buildDefaultContractFromTenant(tenant, unit);
      createContract(data);
    }
  }, [allTenants, allContracts, allUnits, createContract, deleteContract]);
}
