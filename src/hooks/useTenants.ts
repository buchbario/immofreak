import { tenantStore, rentalUnitStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { Tenant } from '../types';

/**
 * Mieter-Hook. Zum Löschen `cascadeTenantToTrash(tenantId, moveToTrash)` aus
 * `lib/cascadeDelete.ts` verwenden — archiviert Mieter + Verträge + Zahlungen
 * und gibt die zugeordnete Einheit wieder frei.
 */
export function useTenants(propertyId?: string) {
  const store = useStorageAdapter(tenantStore);
  const tenants = propertyId ? store.items.filter((t) => t.propertyId === propertyId) : store.items;

  const createTenant = (data: Omit<Tenant, 'id' | 'createdAt'>) => {
    const tenant = store.create({ ...data, id: generateId(), createdAt: new Date().toISOString() });
    // Link unit to tenant
    if (data.unitId) {
      rentalUnitStore.update(data.unitId, { tenantId: tenant.id });
    }
    return tenant;
  };

  const updateTenant = (id: string, data: Partial<Tenant>) => {
    return store.update(id, data);
  };

  return {
    tenants,
    allTenants: store.items,
    createTenant,
    updateTenant,
    getTenant: store.getById,
  };
}
