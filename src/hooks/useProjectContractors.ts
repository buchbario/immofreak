import { projectContractorStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';

export function useProjectContractors(projectId?: string) {
  const store = useStorageAdapter(projectContractorStore);

  const assignments = projectId
    ? store.items.filter((a) => a.projectId === projectId)
    : store.items;

  const assignContractor = (projectId: string, contractorId: string) => {
    const exists = store.items.find(
      (a) => a.projectId === projectId && a.contractorId === contractorId
    );
    if (exists) return exists;
    return store.create({
      id: generateId(),
      projectId,
      contractorId,
      assignedAt: new Date().toISOString(),
    });
  };

  const unassignContractor = (projectId: string, contractorId: string) => {
    const assignment = store.items.find(
      (a) => a.projectId === projectId && a.contractorId === contractorId
    );
    if (assignment) store.remove(assignment.id);
  };

  return {
    assignments,
    allAssignments: store.items,
    assignContractor,
    unassignContractor,
  };
}
