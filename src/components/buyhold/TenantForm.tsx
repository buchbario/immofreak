import { useState } from 'react';
import type { Tenant, RentalProperty, RentalUnit } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { Modal, Field, FormSection, FormRow } from '../ui/Modal';
import { DateInput } from '../ui/DateInput';

type TenantData = Omit<Tenant, 'id' | 'createdAt'>;

interface Props {
  initial?: Partial<TenantData>;
  properties: RentalProperty[];
  units: RentalUnit[];
  onClose: () => void;
  onSave: (data: TenantData) => void;
}

export function TenantForm({ initial, properties, units, onClose, onSave }: Props) {
  const [form, setForm] = useState<TenantData>({
    name: initial?.name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    propertyId: initial?.propertyId || '',
    unitId: initial?.unitId || '',
    moveInDate: initial?.moveInDate || '',
    leaseStart: initial?.leaseStart || '',
    leaseEnd: initial?.leaseEnd || '',
    deposit: initial?.deposit || 0,
    notes: initial?.notes || '',
  });

  const set = (key: keyof TenantData, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const availableUnits = units.filter((u) => u.propertyId === form.propertyId && !u.tenantId);
  const valid = !!form.name && !!form.propertyId;
  const isEdit = !!initial;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Mieter bearbeiten' : 'Neuer Mieter'}
      description="Stammdaten, Objekt-Zuordnung und Mietbeginn / -ende."
      footer={
        <>
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={() => onSave(form)} disabled={!valid} className="btn btn-md btn-primary">
            {isEdit ? 'Speichern' : 'Mieter anlegen'}
          </button>
        </>
      }
    >
      <FormSection title="Kontakt">
        <Field label="Name" required htmlFor="t-name">
          <input
            id="t-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Max Mustermann"
            className="input"
          />
        </Field>
        <FormRow cols={2}>
          <Field label="E-Mail" htmlFor="t-mail">
            <input
              id="t-mail"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="mail@beispiel.de"
              className="input"
            />
          </Field>
          <Field label="Telefon" htmlFor="t-phone">
            <input
              id="t-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+49 …"
              className="input"
            />
          </Field>
        </FormRow>
      </FormSection>

      <FormSection title="Objekt & Einheit">
        <FormRow cols={2}>
          <Field label="Objekt" required>
            <select
              value={form.propertyId || ''}
              onChange={(e) => { set('propertyId', e.target.value); set('unitId', ''); }}
              className="input"
            >
              <option value="">— bitte wählen —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Einheit"
            help={form.propertyId && availableUnits.length === 0 ? 'Keine freien Einheiten in diesem Objekt' : undefined}
          >
            <select
              value={form.unitId || ''}
              onChange={(e) => set('unitId', e.target.value)}
              className="input"
              disabled={!form.propertyId}
            >
              <option value="">— bitte wählen —</option>
              {availableUnits.map((u) => (
                <option key={u.id} value={u.id}>{`${u.name} (${u.area} m²)`}</option>
              ))}
            </select>
          </Field>
        </FormRow>
      </FormSection>

      <FormSection title="Mietverhältnis">
        <FormRow cols={3}>
          <Field label="Einzug">
            <DateInput value={form.moveInDate} onChange={(v) => set('moveInDate', v)} />
          </Field>
          <Field label="Mietbeginn">
            <DateInput value={form.leaseStart} onChange={(v) => set('leaseStart', v)} />
          </Field>
          <Field label="Mietende" help="Leer lassen für unbefristet">
            <DateInput value={form.leaseEnd || ''} onChange={(v) => set('leaseEnd', v)} />
          </Field>
        </FormRow>
        <Field label="Kaution">
          <NumberInput
            value={form.deposit || ''}
            onChange={(v) => set('deposit', v === '' ? 0 : v)}
            suffix="€"
            decimals={2}
            className="input"
          />
        </Field>
      </FormSection>

      <FormSection title="Notizen">
        <Field>
          <textarea
            className="input"
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Bemerkungen, Vereinbarungen, Sonderkonditionen…"
          />
        </Field>
      </FormSection>
    </Modal>
  );
}
