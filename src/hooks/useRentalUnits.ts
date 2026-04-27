import { rentalUnitStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { RentalUnit } from '../types';

export function useRentalUnits(propertyId?: string) {
  const store = useStorageAdapter(rentalUnitStore);
  const units = propertyId ? store.items.filter((u) => u.propertyId === propertyId) : store.items;

  const createUnit = (data: Omit<RentalUnit, 'id' | 'createdAt'>) => {
    return store.create({ ...data, id: generateId(), createdAt: new Date().toISOString() });
  };

  const updateUnit = (id: string, data: Partial<RentalUnit>) => {
    return store.update(id, data);
  };

  const totalMonthlyRent = units.reduce((sum, u) => sum + u.currentRent, 0);
  const occupiedUnits = units.filter((u) => u.tenantId);

  return {
    units,
    allUnits: store.items,
    createUnit,
    updateUnit,
    deleteUnit: store.remove,
    getUnit: store.getById,
    totalMonthlyRent,
    occupiedUnits,
    vacancyRate: units.length > 0 ? ((units.length - occupiedUnits.length) / units.length) * 100 : 0,
  };
}
