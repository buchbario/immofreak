import { bankAccountStore, bankTransactionStore, tenantPaymentMappingStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { BankAccount, BankTransaction } from '../types';

/**
 * Banking-Hook. Zum Konto-Löschen `cascadeBankAccountToTrash(accountId, moveToTrash)`
 * aus `lib/cascadeDelete.ts` verwenden — archiviert Konto + Transaktionen.
 */
export function useBanking() {
  const accountStore = useStorageAdapter(bankAccountStore);
  const txStore = useStorageAdapter(bankTransactionStore);
  const mappingStore = useStorageAdapter(tenantPaymentMappingStore);

  const addAccount = (data: Omit<BankAccount, 'id' | 'createdAt'>) => {
    return accountStore.create({ ...data, id: generateId(), createdAt: new Date().toISOString() });
  };

  const updateAccount = (id: string, data: Partial<BankAccount>) => {
    return accountStore.update(id, data);
  };

  const addTransaction = (data: Omit<BankTransaction, 'id' | 'createdAt'>) => {
    return txStore.create({ ...data, id: generateId(), createdAt: new Date().toISOString() });
  };

  const updateTransaction = (id: string, data: Partial<BankTransaction>) => {
    return txStore.update(id, data);
  };

  const deleteTransaction = (id: string) => {
    txStore.remove(id);
  };

  /**
   * Manuelle Zuordnung einer Transaktion zu einem Mieter.
   * Wenn `learn` aktiv ist, wird ein TenantPaymentMapping (IBAN + Counterparty-Name)
   * persistiert, damit zukünftige Transaktionen mit gleicher IBAN/Name automatisch
   * erkannt werden.
   */
  const assignTransaction = (txId: string, tenantId: string, learn: boolean) => {
    const tx = txStore.getById(txId);
    if (!tx) return;

    txStore.update(txId, {
      matchedTenantId: tenantId,
      matchStatus: 'manual',
      matchConfidence: 1,
    });

    if (learn) {
      mappingStore.create({
        id: generateId(),
        tenantId,
        iban: tx.iban || undefined,
        counterpartyName: tx.counterparty || undefined,
        learnedFromTransactionId: txId,
        createdAt: new Date().toISOString(),
      });
    }
  };

  const unassignTransaction = (txId: string) => {
    txStore.update(txId, {
      matchedTenantId: undefined,
      matchedPropertyId: undefined,
      matchedUnitId: undefined,
      matchStatus: 'unmatched',
      matchConfidence: 0,
    });
  };

  /**
   * Markiert eine Transaktion als „kein Mieteingang". Beim erneuten Toggeln
   * wird die Markierung zurückgenommen und — falls vorhanden — das letzte
   * Match aufgehoben, damit die Transaktion nach dem Reaktivieren wieder
   * sauber durch den Matcher läuft.
   */
  const toggleIgnoreTransaction = (txId: string) => {
    const tx = txStore.getById(txId);
    if (!tx) return;
    if (tx.isIgnored) {
      txStore.update(txId, { isIgnored: false });
    } else {
      txStore.update(txId, {
        isIgnored: true,
        matchedTenantId: undefined,
        matchedPropertyId: undefined,
        matchedUnitId: undefined,
        matchStatus: 'unmatched',
        matchConfidence: 0,
      });
    }
  };

  return {
    accounts: accountStore.items,
    transactions: txStore.items,
    mappings: mappingStore.items,
    addAccount,
    updateAccount,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    assignTransaction,
    unassignTransaction,
    toggleIgnoreTransaction,
    refreshAccounts: accountStore.refresh,
    refreshTransactions: txStore.refresh,
  };
}
