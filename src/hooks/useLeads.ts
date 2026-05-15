import { useCallback, useMemo } from 'react';
import { leadStore } from '../lib/storage';
import { useStorageAdapter } from './useLocalStorage';
import { generateId } from '../lib/utils';
import type { Lead, LeadStatus } from '../types';

/**
 * Akquise-Pipeline für Fix & Flip.
 * Kanban-Board: jede Spalte = ein LeadStatus, Karten sind Leads sortiert
 * nach `order` innerhalb ihres Status.
 */
export function useLeads() {
  const store = useStorageAdapter<Lead>(leadStore);

  const leads = store.items;

  const leadsByStatus = useMemo(() => {
    const grouped: Record<LeadStatus, Lead[]> = {
      Lead: [],
      Erstkontakt: [],
      Kalkulation: [],
      Besichtigung: [],
      Angebot: [],
      Unterlagenprüfung: [],
      'Follow-Up': [],
      Deal: [],
      Archiv: [],
    };
    for (const l of leads) {
      const bucket = grouped[l.status];
      if (bucket) bucket.push(l);
    }
    for (const k of Object.keys(grouped) as LeadStatus[]) {
      grouped[k].sort((a, b) => a.order - b.order);
    }
    return grouped;
  }, [leads]);

  const createLead = useCallback(
    (data: Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'order'>> & { name: string }) => {
      const status = (data.status ?? 'Lead') as LeadStatus;
      const order = leads.filter((l) => l.status === status).length;
      const now = new Date().toISOString();
      return store.create({
        id: generateId(),
        name: data.name,
        status,
        address: data.address,
        rooms: data.rooms,
        area: data.area,
        askingPrice: data.askingPrice,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        notes: data.notes,
        immoscoutUrl: data.immoscoutUrl,
        order,
        createdAt: now,
        updatedAt: now,
      });
    },
    [leads, store],
  );

  const updateLead = useCallback(
    (id: string, updates: Partial<Lead>) =>
      store.update(id, { ...updates, updatedAt: new Date().toISOString() }),
    [store],
  );

  const deleteLead = useCallback((id: string) => store.remove(id), [store]);

  /**
   * Verschiebt einen Lead in eine andere Spalte und/oder an eine andere
   * Position. Berechnet `order` automatisch und re-indexiert die Quell-
   * sowie die Ziel-Spalte, damit keine Lücken entstehen.
   */
  const moveLead = useCallback(
    (leadId: string, targetStatus: LeadStatus, targetIndex: number) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return;

      const sourceColumn = leads
        .filter((l) => l.status === lead.status && l.id !== leadId)
        .sort((a, b) => a.order - b.order);
      const targetColumn = leads
        .filter((l) => l.status === targetStatus && l.id !== leadId)
        .sort((a, b) => a.order - b.order);

      // Lead ins Ziel an targetIndex einfügen
      const newTarget = [...targetColumn];
      const insertAt = Math.max(0, Math.min(targetIndex, newTarget.length));
      newTarget.splice(insertAt, 0, { ...lead, status: targetStatus });

      // Quell- und Zielspalte neu durchnummerieren
      const writes: Array<{ id: string; updates: Partial<Lead> }> = [];

      // Wenn Quelle != Ziel, Quelle re-index
      if (lead.status !== targetStatus) {
        sourceColumn.forEach((l, i) => {
          if (l.order !== i) writes.push({ id: l.id, updates: { order: i } });
        });
      }
      newTarget.forEach((l, i) => {
        if (l.id === leadId) {
          // den verschobenen Lead hat möglicherweise andere status + order
          if (l.status !== targetStatus || l.order !== i) {
            writes.push({ id: l.id, updates: { status: targetStatus, order: i } });
          }
        } else if (l.order !== i) {
          writes.push({ id: l.id, updates: { order: i } });
        }
      });

      // Alle Writes ausführen
      writes.forEach(({ id, updates }) =>
        store.update(id, { ...updates, updatedAt: new Date().toISOString() }),
      );
    },
    [leads, store],
  );

  return {
    leads,
    leadsByStatus,
    createLead,
    updateLead,
    deleteLead,
    moveLead,
    getById: (id: string) => leads.find((l) => l.id === id),
  };
}
