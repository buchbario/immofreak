import { meterReadingStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { MeterReading } from '../types';

export function useMeterReadings(propertyId?: string) {
  const store = useStorageAdapter(meterReadingStore);
  const readings = propertyId ? store.items.filter((r) => r.propertyId === propertyId) : store.items;

  const createReading = (data: Omit<MeterReading, 'id' | 'createdAt'>) => {
    return store.create({ ...data, id: generateId(), createdAt: new Date().toISOString() });
  };

  const updateReading = (id: string, data: Partial<MeterReading>) => {
    return store.update(id, data);
  };

  const deleteReading = (id: string) => {
    store.remove(id);
  };

  return {
    readings,
    allReadings: store.items,
    createReading,
    updateReading,
    deleteReading,
    getReading: store.getById,
  };
}
