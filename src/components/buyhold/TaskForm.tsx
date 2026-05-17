import { useState } from 'react';
import type { Task, RentalProperty, RentalUnit, Tenant } from '../../types';
import { TASK_STATUSES, TASK_PRIORITIES, TASK_CATEGORIES } from '../../types';
import { Modal, Field, FormSection, FormRow } from '../ui/Modal';
import { DateInput } from '../ui/DateInput';

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
  const isEdit = !!initial?.id;

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={isEdit ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
      description="Halte fest, was zu tun ist — optional verknüpft mit Objekt, Einheit oder Mieter."
      footerLeft={
        onDelete && isEdit ? (
          <button onClick={onDelete} className="btn btn-md btn-ghost text-red-600 hover:bg-red-50">
            Löschen
          </button>
        ) : null
      }
      footer={
        <>
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={() => onSave(form)} disabled={!canSave} className="btn btn-md btn-primary">
            {isEdit ? 'Speichern' : 'Aufgabe anlegen'}
          </button>
        </>
      }
    >
      <FormSection title="Aufgabe">
        <Field label="Titel" required htmlFor="task-title">
          <input
            id="task-title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="z.B. Heizungswartung beauftragen"
            className="input"
            autoFocus
          />
        </Field>

        <Field label="Beschreibung">
          <textarea
            className="input"
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Details, Gesetzesreferenzen, Fristen…"
          />
        </Field>

        <FormRow cols={3}>
          <Field label="Kategorie">
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value as TaskData['category'])}
              className="input"
            >
              {TASK_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Priorität">
            <select
              value={form.priority}
              onChange={(e) => set('priority', e.target.value as TaskData['priority'])}
              className="input"
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as TaskData['status'])}
              className="input"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </Field>
        </FormRow>
      </FormSection>

      <FormSection title="Termin & Zuständigkeit">
        <FormRow cols={2}>
          <Field label="Fälligkeitsdatum">
            <DateInput value={form.dueDate || ''} onChange={(v) => set('dueDate', v)} />
          </Field>
          <Field label="Zuständig">
            <input
              value={form.assignedTo || ''}
              onChange={(e) => set('assignedTo', e.target.value)}
              placeholder="z.B. Eigentümer, Hausverwaltung"
              className="input"
            />
          </Field>
        </FormRow>
      </FormSection>

      <FormSection title="Verknüpfung" description="Optional — verknüpfe die Aufgabe mit einem Objekt oder Mieter.">
        <FormRow cols={3}>
          <Field label="Objekt">
            <select
              value={form.propertyId || ''}
              onChange={(e) => {
                set('propertyId', e.target.value || undefined);
                set('unitId', undefined);
                set('tenantId', undefined);
              }}
              className="input"
            >
              <option value="">— kein Objekt —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Einheit">
            <select
              value={form.unitId || ''}
              onChange={(e) => set('unitId', e.target.value || undefined)}
              className="input"
              disabled={!form.propertyId}
            >
              <option value="">— keine Einheit —</option>
              {availableUnits.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Mieter">
            <select
              value={form.tenantId || ''}
              onChange={(e) => set('tenantId', e.target.value || undefined)}
              className="input"
            >
              <option value="">— kein Mieter —</option>
              {availableTenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
        </FormRow>
      </FormSection>
    </Modal>
  );
}
