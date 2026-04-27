import { budgetItemStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { BudgetItem } from '../types';

export function useBudgetItems(projectId?: string) {
  const store = useStorageAdapter(budgetItemStore);

  const items = projectId
    ? store.items.filter((item) => item.projectId === projectId)
    : store.items;

  const createBudgetItem = (data: Omit<BudgetItem, 'id' | 'createdAt'>) => {
    return store.create({
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    });
  };

  const updateBudgetItem = (id: string, data: Partial<BudgetItem>) => {
    return store.update(id, data);
  };

  // Computed budget summary
  const totalEstimated = items.reduce((sum, item) => sum + item.estimatedCost, 0);
  const totalActual = items.reduce((sum, item) => sum + item.actualCost, 0);

  return {
    budgetItems: items,
    allBudgetItems: store.items,
    createBudgetItem,
    updateBudgetItem,
    deleteBudgetItem: store.remove,
    totalEstimated,
    totalActual,
  };
}
