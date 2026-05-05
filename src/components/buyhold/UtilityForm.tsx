import { useState } from 'react';
import { UTILITY_TYPES } from '../../types';
import type { Utility, RentalProperty, UtilityType } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { Modal, Field, FormSection, FormRow } from '../ui/Modal';

type UtilityData = Omit<Utility, 'id' | 'createdAt'>;

interface Props {
  properties: RentalProperty[];
  onClose: () => void;
  onSave: (data: UtilityData) => void;
}

export function UtilityForm({ properties, onClose, onSave }: Props) {
  const [form, setForm] = useState<UtilityData>({
    propertyId: properties[0]?.id || '',
    provider: '',
    type: 'Strom' as UtilityType,
    contractNumber: '',
    meterNumber: '',
    monthlyAdvance: 0,
    notes: '',
  });

  const set = (key: keyof UtilityData, value: string | number) => setForm((f) => ({ ...f, [key]: value }));
  const valid = !!form.provider && !!form.propertyId;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Neuer Versorger"
      description="Strom, Gas, Wasser, Internet — pro Objekt zentral verwalten."
      footer={
        <>
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={() => onSave(form)} disabled={!valid} className="btn btn-md btn-primary">Anlegen</button>
        </>
      }
    >
      <FormSection title="Vertrag">
        <Field label="Objekt" required>
          <select value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)} className="input">
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
        <FormRow cols={2}>
          <Field label="Anbieter" required>
            <input value={form.provider} onChange={(e) => set('provider', e.target.value)} placeholder="z.B. Vattenfall" className="input" />
          </Field>
          <Field label="Typ">
            <select value={form.type} onChange={(e) => set('type', e.target.value)} className="input">
              {UTILITY_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </Field>
        </FormRow>
        <FormRow cols={2}>
          <Field label="Vertragsnummer">
            <input value={form.contractNumber} onChange={(e) => set('contractNumber', e.target.value)} className="input" />
          </Field>
          <Field label="Zählernummer">
            <input value={form.meterNumber} onChange={(e) => set('meterNumber', e.target.value)} className="input" />
          </Field>
        </FormRow>
      </FormSection>

      <FormSection title="Abrechnung">
        <Field label="Monatlicher Abschlag">
          <NumberInput
            value={form.monthlyAdvance || ''}
            onChange={(v) => set('monthlyAdvance', v === '' ? 0 : v)}
            suffix="€"
            decimals={2}
            className="input"
          />
        </Field>
        <Field label="Notizen">
          <textarea
            className="input"
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Vertragslaufzeit, Sonderkonditionen…"
          />
        </Field>
      </FormSection>
    </Modal>
  );
}
