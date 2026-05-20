import { taskStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { Task } from '../types';

export function useTasks(propertyId?: string) {
  const store = useStorageAdapter(taskStore);
  const tasks = propertyId ? store.items.filter((t) => t.propertyId === propertyId) : store.items;

  const createTask = (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    return store.create({
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    });
  };

  const updateTask = (id: string, data: Partial<Task>) => {
    return store.update(id, { ...data, updatedAt: new Date().toISOString() });
  };

  const toggleStatus = (id: string, status: Task['status']) => {
    const patch: Partial<Task> = { status, updatedAt: new Date().toISOString() };
    if (status === 'erledigt') patch.completedAt = new Date().toISOString();
    else patch.completedAt = null; // explizit löschen — sonst bleibt der Timestamp in der DB.
    return store.update(id, patch);
  };

  const deleteTask = (id: string) => {
    store.remove(id);
  };

  return {
    tasks,
    allTasks: store.items,
    createTask,
    updateTask,
    toggleStatus,
    deleteTask,
    getTask: store.getById,
  };
}
