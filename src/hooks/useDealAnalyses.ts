import { dealAnalysisStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { DealAnalysis } from '../types';

/**
 * Deal-Analyse-Hook. Zum Löschen `dealAnalysisToTrash(id, moveToTrash)` aus
 * `lib/cascadeDelete.ts` verwenden.
 */
export function useDealAnalyses() {
  const store = useStorageAdapter(dealAnalysisStore);

  const createAnalysis = (data: Omit<DealAnalysis, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    return store.create({
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    });
  };

  const updateAnalysis = (id: string, data: Partial<DealAnalysis>) => {
    return store.update(id, { ...data, updatedAt: new Date().toISOString() });
  };

  return {
    analyses: store.items,
    createAnalysis,
    updateAnalysis,
    getAnalysis: store.getById,
  };
}
