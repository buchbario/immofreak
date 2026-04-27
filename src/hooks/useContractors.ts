import { contractorStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { Contractor } from '../types';

/**
 * Handwerker-Hook. Zum Löschen `cascadeContractorToTrash(contractorId, moveToTrash)`
 * aus `lib/cascadeDelete.ts` verwenden — archiviert Handwerker + Projekt-Zuweisungen
 * und löst Budget-Item-Referenzen auf.
 */
export function useContractors() {
  const store = useStorageAdapter(contractorStore);

  const createContractor = (data: Omit<Contractor, 'id' | 'createdAt'>) => {
    return store.create({
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    });
  };

  const updateContractor = (id: string, data: Partial<Contractor>) => {
    return store.update(id, data);
  };

  return {
    contractors: store.items,
    createContractor,
    updateContractor,
    getContractor: store.getById,
  };
}
