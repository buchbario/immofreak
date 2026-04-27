import { useState } from 'react';
import { StarRating } from '../ui/StarRating';
import { useContractors } from '../../hooks/useContractors';
import { TRADES } from '../../types';
import type { Contractor, Trade } from '../../types';
import { NumberInput } from '../ui/NumberInput';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

    if (isEdit) {
      updateContractor(contractor.id, data);
    } else {
      createContractor(data);
    }
    onClose();
  };

  const update = (field: string, value: string | number) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-overlay" />
      <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-sm font-semibold text-foreground">{isEdit ? 'Handwerker bearbeiten' : 'Neuer Handwerker'}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>&#10005;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Name *</label>
                <input required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Max Mustermann" className="input" />
              </div>
              <div>
                <label className="input-label">Firma</label>
                <input value={form.company} onChange={(e) => update('company', e.target.value)} placeholder="Firma GmbH" className="input" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Gewerk</label>
                <select value={form.trade} onChange={(e) => update('trade', e.target.value)} className="input">
                  {TRADES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Stundensatz</label>
                <NumberInput
                  value={form.hourlyRate}
                  onChange={(v) => update('hourlyRate', v === '' ? '' : String(v))}
                  placeholder="0"
                  suffix="€/h"
                  decimals={2}
                  className="input"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Telefon</label>
                <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+49 170 1234567" className="input" />
              </div>
              <div>
                <label className="input-label">E-Mail</label>
                <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="mail@example.com" className="input" />
              </div>
            </div>
            <div>
              <label className="input-label">Adresse</label>
              <input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Straße, PLZ Ort" className="input" />
            </div>
            <div>
              <label className="input-label">Bewertung</label>
              <StarRating rating={form.rating} onChange={(r) => update('rating', r)} size={24} />
            </div>
            <div>
              <label className="input-label">Notizen</label>
              <textarea
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                rows={3}
                className="input"
                placeholder="Optionale Notizen..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
            <button type="submit" className="btn btn-md btn-primary">{isEdit ? 'Speichern' : 'Handwerker anlegen'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
