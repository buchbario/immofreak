import { useState } from 'react';
import type { RentalUnit } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { Modal, Field, FormSection, FormRow } from '../ui/Modal';

type UnitData = Omit<RentalUnit, 'id' | 'createdAt'>;

interface Props {
  propertyId: string;
  unit?: RentalUnit;
  onClose: () => void;
  onSave: (data: UnitData) => void;
}

export function UnitForm({ propertyId, unit, onClose, onSave }: Props) {
  const isEdit = !!unit;
  const [form, setForm] = useState<UnitData>({
    propertyId,
    name: unit?.name ?? '',
    area: unit?.area ?? 0,
    rooms: unit?.rooms ?? 1,
    currentRent: unit?.currentRent ?? 0,
    targetRent: unit?.targetRent ?? 0,
    tenantId: unit?.tenantId,
  });

  const set = (key: keyof UnitData, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={isEdit ? 'Einheit bearbeiten' : 'Neue Einheit'}
      description={isEdit ? 'Miete anpassen, Fläche oder Zimmer aktualisieren.' : 'Wohnung, Gewerbe oder Stellplatz innerhalb des Objekts.'}
      footer={
        <>
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={() => onSave(form)} disabled={!form.name} className="btn btn-md btn-primary">
            {isEdit ? 'Speichern' : 'Anlegen'}
          </button>
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
