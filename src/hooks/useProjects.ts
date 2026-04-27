import { projectStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { Project, ProjectStatus } from '../types';

/**
 * Projekt-Hook. Zum Löschen `cascadeProjectToTrash(projectId, moveToTrash)` aus
 * `lib/cascadeDelete.ts` verwenden — archiviert Projekt + Budget-Positionen +
 * Handwerker-Zuweisungen + Fotos + Dokumente.
 */
export function useProjects() {
  const store = useStorageAdapter(projectStore);

  const createProject = (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    return store.create({
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    });
  };

  const updateProject = (id: string, data: Partial<Project>) => {
    return store.update(id, { ...data, updatedAt: new Date().toISOString() });
  };

  const updateStatus = (id: string, status: ProjectStatus) => {
    return updateProject(id, { status });
  };

  return {
    projects: store.items,
    createProject,
    updateProject,
    updateStatus,
    getProject: store.getById,
  };
}
