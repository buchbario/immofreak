import { bankAccountStore, bankTransactionStore } from '../lib/storage';
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

  return {
    accounts: accountStore.items,
    transactions: txStore.items,
    addAccount,
    updateAccount,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    refreshAccounts: accountStore.refresh,
    refreshTransactions: txStore.refresh,
  };
}
