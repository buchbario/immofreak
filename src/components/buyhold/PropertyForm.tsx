import { useState } from 'react';
import type { RentalProperty } from '../../types';
import { NumberInput } from '../ui/NumberInput';

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

  const set = (key: keyof PropertyData, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-overlay" />
      <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-sm font-semibold text-foreground">{initial ? 'Objekt bearbeiten' : 'Neues Objekt'}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="input-label">Name</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="z.B. MFH Berliner Str. 5" className="input" />
          </div>
          <div>
            <label className="input-label">Adresse</label>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Strasse, PLZ Ort" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Kaufpreis</label>
              <NumberInput
                value={form.purchasePrice || ''}
                onChange={(v) => set('purchasePrice', v === '' ? 0 : v)}
                suffix="€"
                decimals={2}
                className="input"
              />
            </div>
            <div>
              <label className="input-label">Marktwert</label>
              <NumberInput
                value={form.currentValue || ''}
                onChange={(v) => set('currentValue', v === '' ? 0 : v)}
                suffix="€"
                decimals={2}
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Kaufdatum</label>
              <input type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} className="input" />
            </div>
            <div>
              <label className="input-label">Einheiten</label>
              <NumberInput
                value={form.units || ''}
                onChange={(v) => set('units', v === '' ? 0 : v)}
                decimals={0}
                className="input"
              />
            </div>
            <div>
              <label className="input-label">Fläche</label>
              <NumberInput
                value={form.totalArea || ''}
                onChange={(v) => set('totalArea', v === '' ? 0 : v)}
                suffix="m²"
                decimals={2}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="input-label">Notizen</label>
            <textarea
              className="input"
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={() => onSave(form)} disabled={!form.name || !form.address} className="btn btn-md btn-primary">Speichern</button>
        </div>
      </div>
    </div>
  );
}
