import { useMemo } from 'react';
import {
  bankTransactionStore,
  tenantPaymentStore,
  tenantStore,
} from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { BankTransaction, Tenant, TenantPayment } from '../types';

const BANK_PAYMENT_PREFIX = 'bank:';

export function isBankDerivedPaymentId(id: string): boolean {
  return id.startsWith(BANK_PAYMENT_PREFIX);
}

function bankTxToPayment(
  tx: BankTransaction,
  tenant: Tenant | undefined,
): TenantPayment | null {
  if (!tx.matchedTenantId || tx.amount <= 0 || tx.isIgnored) return null;
  const propertyId = tx.matchedPropertyId ?? tenant?.propertyId ?? '';
  const unitId = tx.matchedUnitId ?? tenant?.unitId ?? '';
  return {
    id: `${BANK_PAYMENT_PREFIX}${tx.id}`,
    tenantId: tx.matchedTenantId,
    propertyId,
    unitId,
    amount: tx.amount,
    date: tx.date,
    type: tx.category === 'nebenkosten' ? 'Nachzahlung' : 'Miete',
    status: 'eingegangen',
    notes: 'Aus Banking zugeordnet',
    createdAt: tx.createdAt,
  };
}

/**
 * Liefert Mieterzahlungen aus zwei Quellen kombiniert:
 *  1. Explizite TenantPayments (manuell über das Zahlungs-Formular erfasst)
 *  2. Synthetische Zahlungen aus Bank-Transaktionen, die auf der Banking-Seite
 *     einem Mieter zugeordnet wurden (matchedTenantId gesetzt, amount > 0).
 *
 * Synthetische Einträge haben IDs mit Prefix `bank:` und können nicht über
 * `deletePayment` entfernt werden — dazu muss die Zuordnung auf der
 * Banking-Seite aufgehoben werden.
 */
export function useTenantPayments(tenantId?: string) {
  const store = useStorageAdapter(tenantPaymentStore);
  const txStore = useStorageAdapter(bankTransactionStore);
  const tenantsStore = useStorageAdapter(tenantStore);

  const allPayments = useMemo<TenantPayment[]>(() => {
    const tenantsById = new Map<string, Tenant>();
    for (const t of tenantsStore.items) tenantsById.set(t.id, t);
    const synthetic: TenantPayment[] = [];
    for (const tx of txStore.items) {
      if (!tx.matchedTenantId) continue;
      const tenant = tenantsById.get(tx.matchedTenantId);
      const p = bankTxToPayment(tx, tenant);
      if (p) synthetic.push(p);
    }
    return [...store.items, ...synthetic];
  }, [store.items, txStore.items, tenantsStore.items]);

  const payments = tenantId ? allPayments.filter((p) => p.tenantId === tenantId) : allPayments;

  const createPayment = (data: Omit<TenantPayment, 'id' | 'createdAt'>) => {
    return store.create({ ...data, id: generateId(), createdAt: new Date().toISOString() });
  };

  const deletePayment = (id: string) => {
    if (isBankDerivedPaymentId(id)) return;
    store.remove(id);
  };

  return { payments, allPayments, createPayment, deletePayment };
}
