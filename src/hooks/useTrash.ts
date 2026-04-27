import { useEffect, useMemo } from 'react';
import {
  trashStore,
  tenantStore,
  tenantPaymentStore,
  rentalUnitStore,
  meterReadingStore,
  utilityStore,
  utilityCostStore,
  distributionKeyStore,
  bankAccountStore,
  bankTransactionStore,
  rentalContractStore,
  rentalPropertyStore,
  expenseStore,
  contractorStore,
  projectStore,
  projectPhotoStore,
  projectDocumentStore,
  projectContractorStore,
  budgetItemStore,
  dealAnalysisStore,
  propertyPhotoStore,
  propertyDocumentStore,
  contractDocumentStore,
  taskStore,
} from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { AppMode, TrashEntityType, TrashItem } from '../types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const ENTITY_MODE: Record<TrashEntityType, AppMode> = {
  tenant: 'buyhold',
  tenantPayment: 'buyhold',
  rentalUnit: 'buyhold',
  meterReading: 'buyhold',
  utility: 'buyhold',
  utilityCost: 'buyhold',
  distributionKey: 'buyhold',
  bankAccount: 'buyhold',
  bankTransaction: 'buyhold',
  rentalContract: 'buyhold',
  rentalProperty: 'buyhold',
  expense: 'buyhold',
  propertyPhoto: 'buyhold',
  propertyDocument: 'buyhold',
  contractDocument: 'buyhold',
  task: 'buyhold',
  contractor: 'fixflip',
  project: 'fixflip',
  projectPhoto: 'fixflip',
  projectDocument: 'fixflip',
  projectContractor: 'fixflip',
  budgetItem: 'fixflip',
  dealAnalysis: 'fixflip',
};

export function entityTypeMode(t: TrashEntityType): AppMode {
  return ENTITY_MODE[t];
}

const STORE_MAP: Record<TrashEntityType, { key: string; store: { create: (x: unknown) => unknown }; label: string }> = {
  tenant: { key: 'tenant', store: tenantStore as never, label: 'Mieter' },
  tenantPayment: { key: 'tenantPayment', store: tenantPaymentStore as never, label: 'Zahlung' },
  rentalUnit: { key: 'rentalUnit', store: rentalUnitStore as never, label: 'Einheit' },
  meterReading: { key: 'meterReading', store: meterReadingStore as never, label: 'Zählerstand' },
  utility: { key: 'utility', store: utilityStore as never, label: 'Versorger' },
  utilityCost: { key: 'utilityCost', store: utilityCostStore as never, label: 'Versorger-Kosten' },
  distributionKey: { key: 'distributionKey', store: distributionKeyStore as never, label: 'Verteilerschlüssel' },
  bankAccount: { key: 'bankAccount', store: bankAccountStore as never, label: 'Bankkonto' },
  bankTransaction: { key: 'bankTransaction', store: bankTransactionStore as never, label: 'Transaktion' },
  rentalContract: { key: 'rentalContract', store: rentalContractStore as never, label: 'Mietvertrag' },
  rentalProperty: { key: 'rentalProperty', store: rentalPropertyStore as never, label: 'Objekt' },
  expense: { key: 'expense', store: expenseStore as never, label: 'Ausgabe' },
  contractor: { key: 'contractor', store: contractorStore as never, label: 'Handwerker' },
  project: { key: 'project', store: projectStore as never, label: 'Projekt' },
  projectPhoto: { key: 'projectPhoto', store: projectPhotoStore as never, label: 'Projekt-Foto' },
  projectDocument: { key: 'projectDocument', store: projectDocumentStore as never, label: 'Projekt-Dokument' },
  projectContractor: { key: 'projectContractor', store: projectContractorStore as never, label: 'Projekt-Zuweisung' },
  budgetItem: { key: 'budgetItem', store: budgetItemStore as never, label: 'Budget-Position' },
  dealAnalysis: { key: 'dealAnalysis', store: dealAnalysisStore as never, label: 'Deal-Analyse' },
  propertyPhoto: { key: 'propertyPhoto', store: propertyPhotoStore as never, label: 'Foto' },
  propertyDocument: { key: 'propertyDocument', store: propertyDocumentStore as never, label: 'Dokument' },
  contractDocument: { key: 'contractDocument', store: contractDocumentStore as never, label: 'Vertragsdokument' },
  task: { key: 'task', store: taskStore as never, label: 'Vorgang' },
};

export function entityTypeLabel(t: TrashEntityType): string {
  return STORE_MAP[t]?.label ?? t;
}

export function daysLeftInTrash(deletedAt: string): number {
  const elapsed = Date.now() - new Date(deletedAt).getTime();
  return Math.max(0, Math.ceil((THIRTY_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000)));
}

export function useTrash() {
  const store = useStorageAdapter(trashStore);

  useEffect(() => {
    const now = Date.now();
    const expired = store.items.filter((i) => now - new Date(i.deletedAt).getTime() > THIRTY_DAYS_MS);
    if (expired.length > 0) {
      expired.forEach((i) => trashStore.delete(i.id));
      store.refresh();
    }
  }, [store]);

  const sorted = useMemo(
    () => [...store.items].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
    [store.items],
  );

  const moveToTrash = (params: {
    entityType: TrashEntityType;
    entityId: string;
    data: unknown;
    label: string;
    sublabel?: string;
  }): TrashItem => {
    const item: TrashItem = {
      id: generateId(),
      entityType: params.entityType,
      entityId: params.entityId,
      data: params.data,
      label: params.label,
      sublabel: params.sublabel,
      deletedAt: new Date().toISOString(),
    };
    store.create(item);
    return item;
  };

  const restore = (trashId: string) => {
    const item = store.items.find((i) => i.id === trashId);
    if (!item) return;
    const mapping = STORE_MAP[item.entityType];
    if (mapping) {
      mapping.store.create(item.data);
    }
    store.remove(trashId);
  };

  const permanentlyDelete = (trashId: string) => {
    store.remove(trashId);
  };

  const emptyTrash = () => {
    store.items.forEach((i) => trashStore.delete(i.id));
    store.refresh();
  };

  return {
    trashItems: sorted,
    moveToTrash,
    restore,
    permanentlyDelete,
    emptyTrash,
  };
}
