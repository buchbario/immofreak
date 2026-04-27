import { expenseStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { Expense } from '../types';

export function useExpenses() {
  const store = useStorageAdapter(expenseStore);

  const getByProperty = (propertyId: string) => {
    return store.items.filter((e) => e.propertyId === propertyId);
  };

  const create = (data: Omit<Expense, 'id' | 'createdAt'>) => {
    return store.create({ ...data, id: generateId(), createdAt: new Date().toISOString() });
  };

  const update = (id: string, updates: Partial<Expense>) => {
    return store.update(id, updates);
  };

  const remove = (id: string) => store.remove(id);

  return { items: store.items, getByProperty, create, update, delete: remove };
}
