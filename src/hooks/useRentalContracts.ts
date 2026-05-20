import { useCallback } from 'react';
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

  // useCallback macht createContract/deleteContract stabil über Re-Renders.
  // Wichtig für `useEnsureContractTemplates`, das diese als Effect-Deps benutzt —
  // unstable refs lösen sonst bei jedem Render ein neues Insert aus.
  const createContract = useCallback((data: Omit<RentalContract, 'id' | 'createdAt'>) => {
    return store.create({ ...data, id: generateId(), createdAt: new Date().toISOString() });
  }, [store]);

  const updateContract = useCallback((id: string, data: Partial<RentalContract>) => {
    return store.update(id, data);
  }, [store]);

  const deleteContract = useCallback((id: string) => store.remove(id), [store]);

  return {
    contracts,
    allContracts: store.items,
    createContract,
    updateContract,
    deleteContract,
    getContract: store.getById,
  };
}
