import { useState } from 'react';
import { useContractors } from '../../hooks/useContractors';
import { BUDGET_ITEM_STATUSES } from '../../types';
import type { BudgetItem, BudgetItemStatus } from '../../types';
import { NumberInput } from '../ui/NumberInput';

interface BudgetItemFormProps {
  onClose: () => void;
  onSubmit: (data: Omit<BudgetItem, 'id' | 'createdAt'>) => void;
  projectId: string;
  item?: BudgetItem;
}

const CATEGORIES = [
  'Malerarbeiten',
  'Elektrik',
  'Sanitär',
  'Bodenbeläge',
  'Fliesen',
  'Trockenbau',
  'Dach',
  'Fenster & Türen',
  'Küche',
  'Bad',
  'Heizung',
  'Außenanlage',
  'Home Staging',
  'Planung & Genehmigung',
  'Abriss & Entsorgung',
  'Sonstiges',
];

export function BudgetItemForm({ onClose, onSubmit, projectId, item }: BudgetItemFormProps) {
  const { contractors } = useContractors();
  const isEdit = !!item;

  const [form, setForm] = useState({
    category: item?.category || CATEGORIES[0],
    description: item?.description || '',
    estimatedCost: item?.estimatedCost?.toString() || '',
    actualCost: item?.actualCost?.toString() || '',
    status: item?.status || 'geplant' as BudgetItemStatus,
    contractorId: item?.contractorId || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      projectId,
      category: form.category,
      description: form.description,
      estimatedCost: Number(form.estimatedCost) || 0,
      actualCost: Number(form.actualCost) || 0,
      status: form.status,
      contractorId: form.contractorId || undefined,
    });
    onClose();
  };

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-overlay" />
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="section-title">{isEdit ? 'Position bearbeiten' : 'Neue Budgetposition'}</h3>
          <button className="btn btn-xs btn-ghost" onClick={onClose}>&#10005;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div>
              <label className="input-label">Kategorie</label>
              <select value={form.category} onChange={(e) => update('category', e.target.value)} className="input">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Beschreibung *</label>
              <input
                required
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="z.B. Wände streichen Wohnung EG"
                className="input"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Geschätzte Kosten</label>
                <NumberInput
                  value={form.estimatedCost}
                  onChange={(v) => update('estimatedCost', v === '' ? '' : String(v))}
                  placeholder="0"
                  suffix="€"
                  decimals={2}
                  className="input"
                />
              </div>
              <div>
                <label className="input-label">Tatsächliche Kosten</label>
                <NumberInput
                  value={form.actualCost}
                  onChange={(v) => update('actualCost', v === '' ? '' : String(v))}
                  placeholder="0"
                  suffix="€"
                  decimals={2}
                  className="input"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Status</label>
                <select value={form.status} onChange={(e) => update('status', e.target.value)} className="input">
                  {BUDGET_ITEM_STATUSES.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Handwerker (optional)</label>
                <select value={form.contractorId || ''} onChange={(e) => update('contractorId', e.target.value)} className="input">
                  <option value="">-- Kein Handwerker --</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>{`${c.name} (${c.trade})`}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
            <button type="submit" className="btn btn-md btn-primary">{isEdit ? 'Speichern' : 'Hinzufügen'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
