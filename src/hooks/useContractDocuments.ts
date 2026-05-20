import { contractDocumentStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { ContractDocument, ContractDocumentType } from '../types';

interface AddDocumentOptions {
  /** Inhaltliche Klassifizierung des Dokuments — Default 'other' für rückwärtskompatibles Verhalten. */
  documentType?: ContractDocumentType;
  /** Markiert das hochgeladene PDF als unterschriebenes Original. */
  isSignedOriginal?: boolean;
}

export function useContractDocuments(contractId?: string) {
  const store = useStorageAdapter(contractDocumentStore);
  const documents = contractId ? store.items.filter((d) => d.contractId === contractId) : store.items;

  const addDocument = (
    contractId: string,
    name: string,
    type: string,
    size: number,
    dataUrl?: string,
    opts: AddDocumentOptions = {},
  ): ContractDocument => {
    return store.create({
      id: generateId(),
      contractId,
      name,
      type,
      size,
      dataUrl,
      documentType: opts.documentType ?? 'other',
      isSignedOriginal: opts.isSignedOriginal ?? false,
      createdAt: new Date().toISOString(),
    });
  };

  return { documents, allDocuments: store.items, addDocument, deleteDocument: store.remove };
}
