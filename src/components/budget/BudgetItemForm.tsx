import { useState } from 'react';
import { useContractors } from '../../hooks/useContractors';
import { BUDGET_ITEM_STATUSES } from '../../types';
import type { BudgetItem, BudgetItemStatus } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { Modal, Field, FormSection, FormRow } from '../ui/Modal';

interface BudgetItemFormProps {
  onClose: () => void;
  onSubmit: (data: Omit<BudgetItem, 'id' | 'createdAt'>) => void;
  projectId: string;
  item?: BudgetItem;
}

const CATEGORIES = [
  'Malerarbeiten', 'Elektrik', 'Sanitär', 'Bodenbeläge', 'Fliesen',
  'Trockenbau', 'Dach', 'Fenster & Türen', 'Küche', 'Bad',
  'Heizung', 'Außenanlage', 'Home Staging', 'Planung & Genehmigung',
  'Abriss & Entsorgung', 'Sonstiges',
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

  const valid = form.description.trim().length > 0;

  const handleSubmit = () => {
    if (!valid) return;
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
    <Modal
      open
      onClose={onClose}
      size="md"
      title={isEdit ? 'Position bearbeiten' : 'Neue Budgetposition'}
      description="Eine einzelne Gewerk-Position innerhalb des Sanierungsbudgets."
      footer={
        <>
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={handleSubmit} disabled={!valid} className="btn btn-md btn-primary">
            {isEdit ? 'Speichern' : 'Hinzufügen'}
          </button>
        </>
      }
    >
      <FormSection title="Position">
        <FormRow cols={2}>
          <Field label="Kategorie">
            <select value={form.category} onChange={(e) => update('category', e.target.value)} className="input">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => update('status', e.target.value)} className="input">
              {BUDGET_ITEM_STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </Field>
        </FormRow>
        <Field label="Beschreibung" required>
          <input
            required
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="z.B. Wände streichen Wohnung EG"
            className="input"
          />
        </Field>
      </FormSection>

      <FormSection title="Kosten">
        <FormRow cols={2}>
          <Field label="Geschätzte Kosten">
            <NumberInput
              value={form.estimatedCost}
              onChange={(v) => update('estimatedCost', v === '' ? '' : String(v))}
              placeholder="0"
              suffix="€"
              decimals={2}
              className="input"
            />
          </Field>
          <Field label="Tatsächliche Kosten">
            <NumberInput
              value={form.actualCost}
              onChange={(v) => update('actualCost', v === '' ? '' : String(v))}
              placeholder="0"
              suffix="€"
              decimals={2}
              className="input"
            />
          </Field>
        </FormRow>
        <Field label="Handwerker" help="Optional">
          <select value={form.contractorId || ''} onChange={(e) => update('contractorId', e.target.value)} className="input">
            <option value="">— kein Handwerker —</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>{`${c.name} (${c.trade})`}</option>
            ))}
          </select>
        </Field>
      </FormSection>
    </Modal>
  );
}
