import { tenantPaymentMappingStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { TenantPaymentMapping } from '../types';

export function useTenantPaymentMappings() {
  const store = useStorageAdapter(tenantPaymentMappingStore);

  const addMapping = (data: Omit<TenantPaymentMapping, 'id' | 'createdAt'>) => {
    return store.create({
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    });
  };

  const removeMapping = (id: string) => {
    store.remove(id);
  };

  const findForTenant = (tenantId: string) =>
    store.items.filter((m) => m.tenantId === tenantId);

  return {
    mappings: store.items,
    addMapping,
    removeMapping,
    findForTenant,
  };
}
