import { useState } from 'react';
import { StarRating } from '../ui/StarRating';
import { useContractors } from '../../hooks/useContractors';
import { TRADES } from '../../types';
import type { Contractor, Trade } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { Modal, Field, FormSection, FormRow } from '../ui/Modal';

interface ContractorFormProps {
  onClose: () => void;
  contractor?: Contractor;
}

export function ContractorForm({ onClose, contractor }: ContractorFormProps) {
  const { createContractor, updateContractor } = useContractors();
  const isEdit = !!contractor;

  const [form, setForm] = useState({
    name: contractor?.name || '',
    company: contractor?.company || '',
    trade: contractor?.trade || 'Maler' as Trade,
    phone: contractor?.phone || '',
    email: contractor?.email || '',
    address: contractor?.address || '',
    hourlyRate: contractor?.hourlyRate?.toString() || '',
    rating: contractor?.rating || 3,
    notes: contractor?.notes || '',
  });

  const valid = form.name.trim().length > 0;

  const handleSubmit = () => {
    if (!valid) return;
    const data = {
      name: form.name,
      company: form.company,
      trade: form.trade,
      phone: form.phone,
      email: form.email,
      address: form.address,
      hourlyRate: Number(form.hourlyRate) || 0,
      rating: form.rating,
      notes: form.notes,
    };

    if (isEdit) updateContractor(contractor.id, data);
    else createContractor(data);
    onClose();
  };

  const update = (field: string, value: string | number) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Handwerker bearbeiten' : 'Neuer Handwerker'}
      description="Kontakt, Gewerk und Bewertung — verfügbar in jedem Projekt."
      footer={
        <>
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={handleSubmit} disabled={!valid} className="btn btn-md btn-primary">
            {isEdit ? 'Speichern' : 'Handwerker anlegen'}
          </button>
        </>
      }
    >
      <FormSection title="Stammdaten">
        <FormRow cols={2}>
          <Field label="Name" required htmlFor="c-name">
            <input id="c-name" required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Max Mustermann" className="input" />
          </Field>
          <Field label="Firma">
            <input value={form.company} onChange={(e) => update('company', e.target.value)} placeholder="Firma GmbH" className="input" />
          </Field>
        </FormRow>
        <FormRow cols={2}>
          <Field label="Gewerk">
            <select value={form.trade} onChange={(e) => update('trade', e.target.value)} className="input">
              {TRADES.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </Field>
          <Field label="Stundensatz">
            <NumberInput
              value={form.hourlyRate}
              onChange={(v) => update('hourlyRate', v === '' ? '' : String(v))}
              placeholder="0"
              suffix="€/h"
              decimals={2}
              className="input"
            />
          </Field>
        </FormRow>
      </FormSection>

      <FormSection title="Kontakt">
        <FormRow cols={2}>
          <Field label="Telefon">
            <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+49 170 1234567" className="input" />
          </Field>
          <Field label="E-Mail">
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="mail@example.com" className="input" />
          </Field>
        </FormRow>
        <Field label="Adresse">
          <input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Straße, PLZ Ort" className="input" />
        </Field>
      </FormSection>

      <FormSection title="Bewertung & Notizen">
        <Field label="Bewertung">
          <StarRating rating={form.rating} onChange={(r) => update('rating', r)} size={24} />
        </Field>
        <Field label="Notizen">
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={3}
            className="input"
            placeholder="Erfahrung, Empfehlung, Sonderkonditionen…"
          />
        </Field>
      </FormSection>
    </Modal>
  );
}
