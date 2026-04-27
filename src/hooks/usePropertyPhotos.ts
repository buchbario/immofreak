import { propertyPhotoStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';

export function usePropertyPhotos(propertyId?: string) {
  const store = useStorageAdapter(propertyPhotoStore);
  const photos = propertyId ? store.items.filter((p) => p.propertyId === propertyId) : store.items;

  const addPhoto = (propertyId: string, name: string, dataUrl: string) => {
    return store.create({
      id: generateId(),
      propertyId,
      name,
      dataUrl,
      createdAt: new Date().toISOString(),
    });
  };

  return { photos, allPhotos: store.items, addPhoto, deletePhoto: store.remove };
}
