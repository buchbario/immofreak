import { distributionKeyStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { DistributionKey } from '../types';

export function useDistributionKeys() {
  const store = useStorageAdapter(distributionKeyStore);

  const getByProperty = (propertyId: string) => {
    return store.items.filter((k) => k.propertyId === propertyId);
  };

  const create = (data: Omit<DistributionKey, 'id' | 'createdAt'>) => {
    return store.create({ ...data, id: generateId(), createdAt: new Date().toISOString() });
  };

  const update = (id: string, updates: Partial<DistributionKey>) => {
    return store.update(id, updates);
  };

  const remove = (id: string) => store.remove(id);

  return { items: store.items, getByProperty, create, update, delete: remove };
}
