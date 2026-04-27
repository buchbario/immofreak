import { useState } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { PROJECT_STATUSES } from '../../types';
import type { Project, ProjectStatus } from '../../types';
import { NumberInput } from '../ui/NumberInput';

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
    arv: source?.arv ? source.arv.toString() : '',
    renovationBudget: source?.renovationBudget ? source.renovationBudget.toString() : '',
    status: project?.status || 'Akquise' as ProjectStatus,
    notes: project?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: form.name,
      address: form.address,
      purchasePrice: Number(form.purchasePrice) || 0,
      targetSellPrice: Number(form.targetSellPrice) || 0,
      arv: Number(form.arv) || 0,
      renovationBudget: Number(form.renovationBudget) || 0,
      status: form.status,
      notes: form.notes,
    };

    if (isEdit) {
      updateProject(project.id, data);
    } else {
      createProject(data);
    }
    onClose();
  };

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-overlay" />
      <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="section-title">{isEdit ? 'Projekt bearbeiten' : 'Neues Projekt'}</h3>
          <button className="btn btn-sm btn-ghost rounded-lg" onClick={onClose}>&#10005;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Projektname *</label>
                <input required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="z.B. Altbauwohnung Berlin" className="input" />
              </div>
              <div>
                <label className="input-label">Adresse *</label>
                <input required value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Strasse, PLZ Ort" className="input" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Kaufpreis</label>
                <NumberInput
                  value={form.purchasePrice}
                  onChange={(v) => update('purchasePrice', v === '' ? '' : String(v))}
                  placeholder="0"
                  suffix="€"
                  decimals={2}
                  className="input"
                />
              </div>
              <div>
                <label className="input-label">Verkaufsziel</label>
                <NumberInput
                  value={form.targetSellPrice}
                  onChange={(v) => update('targetSellPrice', v === '' ? '' : String(v))}
                  placeholder="0"
                  suffix="€"
                  decimals={2}
                  className="input"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">ARV (After Repair Value)</label>
                <NumberInput
                  value={form.arv}
                  onChange={(v) => update('arv', v === '' ? '' : String(v))}
                  placeholder="0"
                  suffix="€"
                  decimals={2}
                  className="input"
                />
              </div>
              <div>
                <label className="input-label">Sanierungsbudget</label>
                <NumberInput
                  value={form.renovationBudget}
                  onChange={(v) => update('renovationBudget', v === '' ? '' : String(v))}
                  placeholder="0"
                  suffix="€"
                  decimals={2}
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="input-label">Status</label>
              <select value={form.status} onChange={(e) => update('status', e.target.value)} className="input">
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Notizen</label>
              <textarea
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                rows={3}
                className="input"
                placeholder="Optionale Notizen zum Projekt..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
            <button type="submit" className="btn btn-md btn-primary">{isEdit ? 'Speichern' : 'Projekt anlegen'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
