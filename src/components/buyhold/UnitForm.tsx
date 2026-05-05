import { useState } from 'react';
import type { RentalUnit } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { Modal, Field, FormSection, FormRow } from '../ui/Modal';

type UnitData = Omit<RentalUnit, 'id' | 'createdAt'>;

interface Props {
  propertyId: string;
  onClose: () => void;
  onSave: (data: UnitData) => void;
}

export function UnitForm({ propertyId, onClose, onSave }: Props) {
  const [form, setForm] = useState<UnitData>({
    propertyId,
    name: '',
    area: 0,
    rooms: 1,
    currentRent: 0,
    targetRent: 0,
  });

  const set = (key: keyof UnitData, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Neue Einheit"
      description="Wohnung, Gewerbe oder Stellplatz innerhalb des Objekts."
      footer={
        <>
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={() => onSave(form)} disabled={!form.name} className="btn btn-md btn-primary">Anlegen</button>
        </>
      }
    >
      <FormSection title="Einheit">
        <Field label="Bezeichnung" required htmlFor="u-name">
          <input id="u-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="z.B. EG Links" className="input" />
        </Field>
        <FormRow cols={2}>
          <Field label="Fläche">
            <NumberInput
              value={form.area || ''}
              onChange={(v) => set('area', v === '' ? 0 : v)}
              suffix="m²"
              decimals={2}
              className="input"
            />
          </Field>
          <Field label="Zimmer">
            <NumberInput
              value={form.rooms || ''}
              onChange={(v) => set('rooms', v === '' ? 0 : v)}
              decimals={0}
              className="input"
            />
          </Field>
        </FormRow>
      </FormSection>

      <FormSection title="Miete">
        <FormRow cols={2}>
          <Field label="Kaltmiete">
            <NumberInput
              value={form.currentRent || ''}
              onChange={(v) => set('currentRent', v === '' ? 0 : v)}
              suffix="€"
              decimals={2}
              className="input"
            />
          </Field>
          <Field label="Soll-Miete" help="Optional — Zielmiete bei Wiedervermietung">
            <NumberInput
              value={form.targetRent || ''}
              onChange={(v) => set('targetRent', v === '' ? 0 : v)}
              suffix="€"
              decimals={2}
              className="input"
            />
          </Field>
        </FormRow>
      </FormSection>
    </Modal>
  );
}
