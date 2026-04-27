import { utilityStore, utilityCostStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { Utility, UtilityCost } from '../types';

/**
 * Versorger-Hook. Zum Löschen `cascadeUtilityToTrash(utilityId, moveToTrash)`
 * aus `lib/cascadeDelete.ts` verwenden.
 */
export function useUtilities(propertyId?: string) {
  const store = useStorageAdapter(utilityStore);
  const costStore = useStorageAdapter(utilityCostStore);
  const utilities = propertyId ? store.items.filter((u) => u.propertyId === propertyId) : store.items;

  const createUtility = (data: Omit<Utility, 'id' | 'createdAt'>) => {
    return store.create({ ...data, id: generateId(), createdAt: new Date().toISOString() });
  };

  const updateUtility = (id: string, data: Partial<Utility>) => {
    return store.update(id, data);
  };

  const createCost = (data: Omit<UtilityCost, 'id' | 'createdAt'>) => {
    return costStore.create({ ...data, id: generateId(), createdAt: new Date().toISOString() });
  };

  const totalMonthlyAdvance = utilities.reduce((sum, u) => sum + u.monthlyAdvance, 0);

  const getCostsForYear = (year: number) => {
    return costStore.items.filter((c) => c.year === year && (propertyId ? c.propertyId === propertyId : true));
  };

  return {
    utilities,
    allUtilities: store.items,
    createUtility,
    updateUtility,
    getUtility: store.getById,
    createCost,
    allCosts: costStore.items,
    getCostsForYear,
    totalMonthlyAdvance,
  };
}
