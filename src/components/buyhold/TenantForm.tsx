import { useState } from 'react';
import type { Tenant, RentalProperty, RentalUnit } from '../../types';
import { NumberInput } from '../ui/NumberInput';

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

  const set = (key: keyof TenantData, value: string | number) => setForm((f) => ({ ...f, [key]: value }));

  const availableUnits = units.filter((u) => u.propertyId === form.propertyId && !u.tenantId);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-overlay" />
      <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-sm font-semibold text-foreground">{initial ? 'Mieter bearbeiten' : 'Neuer Mieter'}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>&#10005;</button>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="input-label">Name</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Max Mustermann" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">E-Mail</label>
              <input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="mail@beispiel.de" className="input" />
            </div>
            <div>
              <label className="input-label">Telefon</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+49 ..." className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Objekt</label>
              <select
                value={form.propertyId || ''}
                onChange={(e) => { set('propertyId', e.target.value); set('unitId', ''); }}
                className="input"
              >
                <option value="">Bitte wählen...</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Einheit</label>
              <select
                value={form.unitId || ''}
                onChange={(e) => set('unitId', e.target.value)}
                className="input"
              >
                <option value="">Bitte wählen...</option>
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>{`${u.name} (${u.area} m2)`}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="input-label">Einzug</label>
              <input type="date" value={form.moveInDate} onChange={(e) => set('moveInDate', e.target.value)} className="input" />
            </div>
            <div>
              <label className="input-label">Mietbeginn</label>
              <input type="date" value={form.leaseStart} onChange={(e) => set('leaseStart', e.target.value)} className="input" />
            </div>
            <div>
              <label className="input-label">Mietende</label>
              <input type="date" value={form.leaseEnd || ''} onChange={(e) => set('leaseEnd', e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="input-label">Kaution</label>
            <NumberInput
              value={form.deposit || ''}
              onChange={(v) => set('deposit', v === '' ? 0 : v)}
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
          <button onClick={() => onSave(form)} disabled={!form.name || !form.propertyId} className="btn btn-md btn-primary">Speichern</button>
        </div>
      </div>
    </div>
  );
}
