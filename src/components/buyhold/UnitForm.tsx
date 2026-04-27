import { useState } from 'react';
import type { RentalUnit } from '../../types';
import { NumberInput } from '../ui/NumberInput';

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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-overlay" />
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-sm font-semibold text-foreground">Neue Einheit</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="input-label">Bezeichnung</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="z.B. EG Links" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Fläche</label>
              <NumberInput
                value={form.area || ''}
                onChange={(v) => set('area', v === '' ? 0 : v)}
                suffix="m²"
                decimals={2}
                className="input"
              />
            </div>
            <div>
              <label className="input-label">Zimmer</label>
              <NumberInput
                value={form.rooms || ''}
                onChange={(v) => set('rooms', v === '' ? 0 : v)}
                decimals={0}
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Kaltmiete</label>
              <NumberInput
                value={form.currentRent || ''}
                onChange={(v) => set('currentRent', v === '' ? 0 : v)}
                suffix="€"
                decimals={2}
                className="input"
              />
            </div>
            <div>
              <label className="input-label">Soll-Miete</label>
              <NumberInput
                value={form.targetRent || ''}
                onChange={(v) => set('targetRent', v === '' ? 0 : v)}
                suffix="€"
                decimals={2}
                className="input"
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={() => onSave(form)} disabled={!form.name} className="btn btn-md btn-primary">Speichern</button>
        </div>
      </div>
    </div>
  );
}
