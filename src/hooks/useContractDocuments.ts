import { contractDocumentStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';

export function useContractDocuments(contractId?: string) {
  const store = useStorageAdapter(contractDocumentStore);
  const documents = contractId ? store.items.filter((d) => d.contractId === contractId) : store.items;

  const addDocument = (contractId: string, name: string, type: string, size: number, dataUrl?: string) => {
    return store.create({
      id: generateId(),
      contractId,
      name,
      type,
      size,
      dataUrl,
      createdAt: new Date().toISOString(),
    });
  };

  return { documents, allDocuments: store.items, addDocument, deleteDocument: store.remove };
}
