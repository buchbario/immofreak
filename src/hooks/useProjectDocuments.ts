import { projectDocumentStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';

export function useProjectDocuments(projectId?: string) {
  const store = useStorageAdapter(projectDocumentStore);
  const documents = projectId ? store.items.filter((d) => d.projectId === projectId) : store.items;

  const addDocument = (projectId: string, name: string, type: string, size: number, dataUrl?: string) => {
    return store.create({
      id: generateId(),
      projectId,
      name,
      type,
      size,
      dataUrl,
      createdAt: new Date().toISOString(),
    });
  };

  return { documents, allDocuments: store.items, addDocument, deleteDocument: store.remove };
}
