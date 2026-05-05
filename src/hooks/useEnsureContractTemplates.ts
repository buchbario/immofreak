import { useEffect } from 'react';
import { useTenants } from './useTenants';
import { useRentalContracts } from './useRentalContracts';
import { useRentalUnits } from './useRentalUnits';
import { buildDefaultContractFromTenant } from '../lib/contractTemplate';

/**
 * Stellt sicher, dass jeder Mieter einen Mietvertrag besitzt — wenn nicht,
 * wird ein automatisch befüllter Standardvertrag aus den Mieter-Daten angelegt.
 *
 * Läuft idempotent: Mieter mit existierendem Vertrag werden übersprungen.
 * Wird einmal pro Mount im AppLayout ausgeführt, damit auch Bestandsmieter
 * ohne Vertrag (z.B. aus einer früheren Version) nachträglich einen bekommen.
 */
export function useEnsureContractTemplates() {
  const { allTenants } = useTenants();
  const { allContracts, createContract } = useRentalContracts();
  const { allUnits } = useRentalUnits();

  useEffect(() => {
    if (allTenants.length === 0) return;

    const tenantsWithoutContract = allTenants.filter(
      (t) => !allContracts.some((c) => c.tenantId === t.id),
    );

    if (tenantsWithoutContract.length === 0) return;

    tenantsWithoutContract.forEach((tenant) => {
      const unit = tenant.unitId ? allUnits.find((u) => u.id === tenant.unitId) : undefined;
      const data = buildDefaultContractFromTenant(tenant, unit);
      createContract(data);
    });
    // Bewusst nur auf Tenant-/Contract-/Unit-Listenlängen reagieren — nicht auf
    // jede Mutation in den Stores. Sonst würde der Effect bei jedem Re-Render
    // erneut feuern und potenziell mehrere Verträge pro Tenant anlegen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTenants.length, allContracts.length, allUnits.length]);
}
