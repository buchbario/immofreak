import { tenantPaymentStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { TenantPayment } from '../types';

export function useTenantPayments(tenantId?: string) {
  const store = useStorageAdapter(tenantPaymentStore);
  const payments = tenantId ? store.items.filter((p) => p.tenantId === tenantId) : store.items;

  const createPayment = (data: Omit<TenantPayment, 'id' | 'createdAt'>) => {
    return store.create({ ...data, id: generateId(), createdAt: new Date().toISOString() });
  };

  const deletePayment = (id: string) => store.remove(id);

  return { payments, allPayments: store.items, createPayment, deletePayment };
}
