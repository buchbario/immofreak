import { useState } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { PROJECT_STATUSES } from '../../types';
import type { Project, ProjectStatus } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { Modal, Field, FormSection, FormRow } from '../ui/Modal';

interface ProjectFormProps {
  onClose: () => void;
  project?: Project;
  prefill?: Partial<Project>;
}

export function ProjectForm({ onClose, project, prefill }: ProjectFormProps) {
  const { createProject, updateProject } = useProjects();
  const isEdit = !!project;
  const source = project || prefill;

  const [form, setForm] = useState({
    name: source?.name || '',
    address: source?.address || '',
    purchasePrice: source?.purchasePrice ? source.purchasePrice.toString() : '',
    targetSellPrice: source?.targetSellPrice ? source.targetSellPrice.toString() : '',
    actualSellPrice: source?.actualSellPrice ? source.actualSellPrice.toString() : '',
    renovationBudget: source?.renovationBudget ? source.renovationBudget.toString() : '',
    status: project?.status || 'Akquise' as ProjectStatus,
    notes: project?.notes || '',
  });

  const valid = form.name.trim() && form.address.trim();
  const isDone = form.status === 'Abgeschlossen';

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    const data = {
      name: form.name,
      address: form.address,
      purchasePrice: Number(form.purchasePrice) || 0,
      targetSellPrice: Number(form.targetSellPrice) || 0,
      actualSellPrice: form.actualSellPrice ? Number(form.actualSellPrice) : undefined,
      renovationBudget: Number(form.renovationBudget) || 0,
      status: form.status,
      notes: form.notes,
    };

    if (isEdit) updateProject(project.id, data);
    else createProject(data);
    onClose();
  };

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Projekt bearbeiten' : 'Neues Projekt'}
      description={isEdit ? 'Aktualisiere die Eckdaten des Projekts.' : 'Lege ein neues Fix-&-Flip-Projekt an. Pflichtfelder sind mit * markiert.'}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button type="button" onClick={() => handleSubmit()} disabled={!valid} className="btn btn-md btn-primary">
            {isEdit ? 'Speichern' : 'Projekt anlegen'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormSection title="Stammdaten">
          <FormRow cols={2}>
            <Field label="Projektname" required htmlFor="proj-name">
              <input
                id="proj-name"
                required
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="z.B. Altbauwohnung Berlin"
                className="input"
              />
            </Field>
            <Field label="Adresse" required htmlFor="proj-addr">
              <input
                id="proj-addr"
                required
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder="Strasse, PLZ Ort"
                className="input"
              />
            </Field>
          </FormRow>

          <Field label="Status" htmlFor="proj-status">
            <select
              id="proj-status"
              value={form.status}
              onChange={(e) => update('status', e.target.value)}
              className="input"
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
        </FormSection>

        <FormSection title="Finanzen" description="Werte können nachträglich jederzeit angepasst werden.">
          <FormRow cols={2}>
            <Field label="Kaufpreis">
              <NumberInput
                value={form.purchasePrice}
                onChange={(v) => update('purchasePrice', v === '' ? '' : String(v))}
                placeholder="0"
                suffix="€"
                decimals={2}
                className="input"
              />
            </Field>
            <Field label="Verkaufsziel">
              <NumberInput
                value={form.targetSellPrice}
                onChange={(v) => update('targetSellPrice', v === '' ? '' : String(v))}
                placeholder="0"
                suffix="€"
                decimals={2}
                className="input"
              />
            </Field>
          </FormRow>
          <Field label="Sanierungsbudget">
            <NumberInput
              value={form.renovationBudget}
              onChange={(v) => update('renovationBudget', v === '' ? '' : String(v))}
              placeholder="0"
              suffix="€"
              decimals={2}
              className="input"
            />
          </Field>
          {isDone && (
            <Field
              label="Tatsächlicher Verkaufspreis"
              help="Wird nach Abschluss eingetragen — ersetzt das Verkaufsziel in Auswertungen."
            >
              <NumberInput
                value={form.actualSellPrice}
                onChange={(v) => update('actualSellPrice', v === '' ? '' : String(v))}
                placeholder="0"
                suffix="€"
                decimals={2}
                className="input"
              />
            </Field>
          )}
        </FormSection>

        <FormSection title="Notizen">
          <Field>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={4}
              className="input"
              placeholder="Optionale Notizen zum Projekt…"
            />
          </Field>
        </FormSection>

        {/* Hidden submit so Enter still triggers form submission */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
