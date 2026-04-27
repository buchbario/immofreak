import { useState } from 'react';
import type { Task, RentalProperty, RentalUnit, Tenant } from '../../types';
import { TASK_STATUSES, TASK_PRIORITIES, TASK_CATEGORIES } from '../../types';

type TaskData = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

interface Props {
  initial?: Partial<Task>;
  properties: RentalProperty[];
  units: RentalUnit[];
  tenants: Tenant[];
  onClose: () => void;
  onSave: (data: TaskData) => void;
  onDelete?: () => void;
}

export function TaskForm({ initial, properties, units, tenants, onClose, onSave, onDelete }: Props) {
  const [form, setForm] = useState<TaskData>({
    title: initial?.title || '',
    description: initial?.description || '',
    status: initial?.status || 'offen',
    priority: initial?.priority || 'mittel',
    category: initial?.category || 'Instandhaltung',
    propertyId: initial?.propertyId,
    unitId: initial?.unitId,
    tenantId: initial?.tenantId,
    contractId: initial?.contractId,
    dueDate: initial?.dueDate || '',
    assignedTo: initial?.assignedTo || '',
    completedAt: initial?.completedAt,
  });

  const set = <K extends keyof TaskData>(key: K, value: TaskData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const availableUnits = form.propertyId ? units.filter((u) => u.propertyId === form.propertyId) : [];
  const availableTenants = form.propertyId ? tenants.filter((t) => t.propertyId === form.propertyId) : tenants;

  const canSave = form.title.trim().length > 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-overlay" />
      <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-sm font-semibold text-foreground">
            {initial?.id ? 'Vorgang bearbeiten' : 'Neuer Vorgang'}
          </h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="input-label">Titel *</label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="z.B. Heizungswartung beauftragen"
              className="input"
              autoFocus
            />
          </div>

          <div>
            <label className="input-label">Beschreibung</label>
            <textarea
              className="input"
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Details, Gesetzesreferenzen, Fristen..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Kategorie</label>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value as TaskData['category'])}
                className="input"
              >
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Priorität</label>
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value as TaskData['priority'])}
                className="input"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Status</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value as TaskData['status'])}
                className="input"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Fälligkeitsdatum</label>
              <input
                type="date"
                value={form.dueDate || ''}
                onChange={(e) => set('dueDate', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="input-label">Zuständig</label>
              <input
                value={form.assignedTo || ''}
                onChange={(e) => set('assignedTo', e.target.value)}
                placeholder="z.B. Eigentümer, Hausverwaltung"
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Objekt</label>
              <select
                value={form.propertyId || ''}
                onChange={(e) => {
                  set('propertyId', e.target.value || undefined);
                  set('unitId', undefined);
                  set('tenantId', undefined);
                }}
                className="input"
              >
                <option value="">Kein Objekt</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Einheit</label>
              <select
                value={form.unitId || ''}
                onChange={(e) => set('unitId', e.target.value || undefined)}
                className="input"
                disabled={!form.propertyId}
              >
                <option value="">Keine Einheit</option>
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Mieter</label>
              <select
                value={form.tenantId || ''}
                onChange={(e) => set('tenantId', e.target.value || undefined)}
                className="input"
              >
                <option value="">Kein Mieter</option>
                {availableTenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {onDelete && initial?.id ? (
            <button
              onClick={onDelete}
              className="btn btn-md btn-ghost text-red-500 mr-auto"
            >
              Löschen
            </button>
          ) : null}
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button
            onClick={() => onSave(form)}
            disabled={!canSave}
            className="btn btn-md btn-primary"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
