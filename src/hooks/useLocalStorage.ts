import { useState, useCallback, useEffect } from 'react';
import type { StorageAdapter } from '../lib/storage';

/**
 * React-Bindings für einen StorageAdapter.
 *
 * Jeder gemountete Hook abonniert sich beim Adapter — d. h. schreibt
 * *irgendjemand* (auch aus einer anderen Komponente / einem anderen Hook)
 * in denselben Store, wird der Snapshot hier automatisch aktualisiert.
 * Das ist die Grundlage für Cascade-Deletes und Trash-Restore, die
 * mehrere Stores gleichzeitig verändern.
 */
export function useStorageAdapter<T extends { id: string }>(adapter: StorageAdapter<T>) {
  const [items, setItems] = useState<T[]>(() => adapter.getAll());

  const refresh = useCallback(() => {
    setItems(adapter.getAll());
  }, [adapter]);

  useEffect(() => {
    // initial Sync (falls der Store vor Mount schon geändert wurde)
    setItems(adapter.getAll());
    return adapter.subscribe(() => setItems(adapter.getAll()));
  }, [adapter]);

  const create = useCallback((item: T) => {
    return adapter.create(item);
    // notify() triggert Re-Render über subscribe
  }, [adapter]);

  const update = useCallback((id: string, updates: Partial<T>) => {
    return adapter.update(id, updates);
  }, [adapter]);

  const remove = useCallback((id: string) => {
    adapter.delete(id);
  }, [adapter]);

  const getById = useCallback((id: string) => {
    return adapter.getById(id);
  }, [adapter]);

  const getByField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    return adapter.getByField(field, value);
  }, [adapter]);

  return { items, create, update, remove, getById, getByField, refresh };
}
