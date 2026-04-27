import { useState } from 'react';
import { UTILITY_TYPES } from '../../types';
import type { Utility, RentalProperty, UtilityType } from '../../types';
import { NumberInput } from '../ui/NumberInput';

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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-overlay" />
      <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-sm font-semibold text-foreground">Neuer Versorger</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="input-label">Objekt</label>
            <select value={form.propertyId} onChange={(e) => set('propertyId', e.target.value)} className="input">
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Anbieter</label>
              <input value={form.provider} onChange={(e) => set('provider', e.target.value)} placeholder="z.B. Vattenfall" className="input" />
            </div>
            <div>
              <label className="input-label">Typ</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className="input">
                {UTILITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Vertragsnummer</label>
              <input value={form.contractNumber} onChange={(e) => set('contractNumber', e.target.value)} className="input" />
            </div>
            <div>
              <label className="input-label">Zahlernummer</label>
              <input value={form.meterNumber} onChange={(e) => set('meterNumber', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="input-label">Monatl. Abschlag</label>
            <NumberInput
              value={form.monthlyAdvance || ''}
              onChange={(v) => set('monthlyAdvance', v === '' ? 0 : v)}
              suffix="€"
              decimals={2}
              className="input"
            />
          </div>
          <div>
            <label className="input-label">Notizen</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={() => onSave(form)} disabled={!form.provider || !form.propertyId} className="btn btn-md btn-primary">Speichern</button>
        </div>
      </div>
    </div>
  );
}
