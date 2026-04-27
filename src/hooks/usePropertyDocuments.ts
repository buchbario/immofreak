import { propertyDocumentStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';

export function usePropertyDocuments(propertyId?: string) {
  const store = useStorageAdapter(propertyDocumentStore);
  const documents = propertyId ? store.items.filter((d) => d.propertyId === propertyId) : store.items;

  const addDocument = (propertyId: string, name: string, type: string, size: number, dataUrl?: string) => {
    return store.create({
      id: generateId(),
      propertyId,
      name,
      type,
      size,
      dataUrl,
      createdAt: new Date().toISOString(),
    });
  };

  return { documents, allDocuments: store.items, addDocument, deleteDocument: store.remove };
}
