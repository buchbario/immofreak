import { useState } from 'react';
import type { RentalProperty } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { Modal, Field, FormSection, FormRow } from '../ui/Modal';
import { DateInput } from '../ui/DateInput';

type PropertyData = Omit<RentalProperty, 'id' | 'createdAt' | 'updatedAt'>;

interface Props {
  initial?: Partial<PropertyData>;
  onClose: () => void;
  onSave: (data: PropertyData) => void;
}

export function PropertyForm({ initial, onClose, onSave }: Props) {
  const [form, setForm] = useState<PropertyData>({
    name: initial?.name || '',
    address: initial?.address || '',
    purchasePrice: initial?.purchasePrice || 0,
    currentValue: initial?.currentValue || 0,
    purchaseDate: initial?.purchaseDate || '',
    units: initial?.units || 1,
    totalArea: initial?.totalArea || 0,
    notes: initial?.notes || '',
  });
  const set = (key: keyof PropertyData, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const valid = !!form.name && !!form.address;
  const isEdit = !!initial;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Objekt bearbeiten' : 'Neues Objekt'}
      description={isEdit ? 'Aktualisiere die Stammdaten dieses Objekts.' : 'Lege ein neues Mietobjekt an. Einheiten kannst du später detailliert pflegen.'}
      footer={
        <>
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={() => onSave(form)} disabled={!valid} className="btn btn-md btn-primary">
            {isEdit ? 'Speichern' : 'Objekt anlegen'}
          </button>
        </>
      }
    >
      <FormSection title="Stammdaten">
        <Field label="Name" required htmlFor="prop-name">
          <input
            id="prop-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="z.B. MFH Berliner Str. 5"
            className="input"
          />
        </Field>
        <Field label="Adresse" required htmlFor="prop-addr">
          <input
            id="prop-addr"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Strasse, PLZ Ort"
            className="input"
          />
        </Field>
      </FormSection>

      <FormSection title="Finanzen">
        <FormRow cols={2}>
          <Field label="Kaufpreis">
            <NumberInput
              value={form.purchasePrice || ''}
              onChange={(v) => set('purchasePrice', v === '' ? 0 : v)}
              suffix="€"
              decimals={2}
              className="input"
            />
          </Field>
          <Field label="Marktwert">
            <NumberInput
              value={form.currentValue || ''}
              onChange={(v) => set('currentValue', v === '' ? 0 : v)}
              suffix="€"
              decimals={2}
              className="input"
            />
          </Field>
        </FormRow>
      </FormSection>

      <FormSection title="Objekt-Details">
        <FormRow cols={3}>
          <Field label="Kaufdatum">
            <DateInput value={form.purchaseDate} onChange={(v) => set('purchaseDate', v)} />
          </Field>
          <Field label="Einheiten">
            <NumberInput
              value={form.units || ''}
              onChange={(v) => set('units', v === '' ? 0 : v)}
              decimals={0}
              className="input"
            />
          </Field>
          <Field label="Fläche">
            <NumberInput
              value={form.totalArea || ''}
              onChange={(v) => set('totalArea', v === '' ? 0 : v)}
              suffix="m²"
              decimals={2}
              className="input"
            />
          </Field>
        </FormRow>
      </FormSection>

      <FormSection title="Notizen">
        <Field>
          <textarea
            className="input"
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Optionale Notizen, Auffälligkeiten, Vereinbarungen…"
          />
        </Field>
      </FormSection>
    </Modal>
  );
}
