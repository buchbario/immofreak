import { projectPhotoStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
// ProjectPhoto type is inferred from the store

export function useProjectPhotos(projectId?: string) {
  const store = useStorageAdapter(projectPhotoStore);
  const photos = projectId ? store.items.filter((p) => p.projectId === projectId) : store.items;

  const addPhoto = (projectId: string, name: string, dataUrl: string) => {
    return store.create({
      id: generateId(),
      projectId,
      name,
      dataUrl,
      createdAt: new Date().toISOString(),
    });
  };

  return { photos, allPhotos: store.items, addPhoto, deletePhoto: store.remove };
}
