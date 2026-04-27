import { rentalContractStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { RentalContract } from '../types';

/**
 * Mietvertrags-Hook. Zum Löschen `cascadeContractToTrash(contractId, moveToTrash)`
 * aus `lib/cascadeDelete.ts` verwenden — bewegt Vertrag + Vertragsdokumente
 * in den Papierkorb.
 */
export function useRentalContracts(propertyId?: string) {
  const store = useStorageAdapter(rentalContractStore);
  const contracts = propertyId ? store.items.filter((c) => c.propertyId === propertyId) : store.items;

  const createContract = (data: Omit<RentalContract, 'id' | 'createdAt'>) => {
    return store.create({ ...data, id: generateId(), createdAt: new Date().toISOString() });
  };

  const updateContract = (id: string, data: Partial<RentalContract>) => {
    return store.update(id, data);
  };

  return {
    contracts,
    allContracts: store.items,
    createContract,
    updateContract,
    getContract: store.getById,
  };
}
