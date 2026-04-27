import { useState } from 'react';
import { X } from 'lucide-react';
import type { MeterReading } from '../../types';
import { NumberInput } from '../ui/NumberInput';

interface Props {
  propertyId: string;
  onClose: () => void;
  onSave: (data: Omit<MeterReading, 'id' | 'createdAt'>) => void;
}

export function MeterReadingForm({ propertyId, onClose, onSave }: Props) {
  const [meterId, setMeterId] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [readBy, setReadBy] = useState('');
  const [notes, setNotes] = useState('');

  const parsedValue = parseFloat(value);
  const canSubmit = meterId.trim().length > 0 && !isNaN(parsedValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({
      propertyId,
      meterId: meterId.trim(),
      value: parsedValue,
      date,
      readBy,
      notes,
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-content max-w-md">
        <div className="modal-header">
          <h3 className="text-sm font-semibold text-foreground">Zählerstand erfassen</h3>
          <button onClick={onClose} className="cursor-pointer text-muted-foreground"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Zähler-Nr. *</label>
              <input value={meterId} onChange={(e) => setMeterId(e.target.value)} className="input" placeholder="z.B. S-12345" required />
            </div>
            <div>
              <label className="input-label">Wert *</label>
              <NumberInput
                value={value}
                onChange={(v) => setValue(v === '' ? '' : String(v))}
                decimals={2}
                placeholder="0"
                required
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Datum</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="input-label">Abgelesen von</label>
              <input value={readBy} onChange={(e) => setReadBy(e.target.value)} className="input" placeholder="Name" />
            </div>
          </div>
          <div>
            <label className="input-label">Notiz</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Optional" />
          </div>
          <div className="modal-footer px-0 pb-0 border-t-0">
            <button type="button" onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
            <button type="submit" disabled={!canSubmit} className="btn btn-md btn-primary">Speichern</button>
          </div>
        </form>
      </div>
    </div>
  );
}
