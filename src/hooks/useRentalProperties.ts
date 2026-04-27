import { rentalPropertyStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { RentalProperty } from '../types';

/**
 * Objekt-Hook. Lösch-Cascade wird **nicht** hier gemacht — stattdessen
 * `cascadePropertyToTrash(propertyId, moveToTrash)` aus `lib/cascadeDelete.ts`
 * aus der Detail-Page aufrufen. Dadurch landet alles im Papierkorb und
 * kann 30 Tage lang wiederhergestellt werden.
 */
export function useRentalProperties() {
  const store = useStorageAdapter(rentalPropertyStore);

  const createProperty = (data: Omit<RentalProperty, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    return store.create({ ...data, id: generateId(), createdAt: now, updatedAt: now });
  };

  const updateProperty = (id: string, data: Partial<RentalProperty>) => {
    return store.update(id, { ...data, updatedAt: new Date().toISOString() });
  };

  return {
    properties: store.items,
    createProperty,
    updateProperty,
    getProperty: store.getById,
  };
}
