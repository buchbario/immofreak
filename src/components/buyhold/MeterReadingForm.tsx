import { useState } from 'react';
import type { MeterReading } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { Modal, Field, FormRow } from '../ui/Modal';
import { DateInput } from '../ui/DateInput';

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

  const handleSubmit = () => {
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
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Zählerstand erfassen"
      description="Strom, Wasser, Gas — manuelle Ablesung dokumentieren."
      footer={
        <>
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={handleSubmit} disabled={!canSubmit} className="btn btn-md btn-primary">Speichern</button>
        </>
      }
    >
      <FormRow cols={2}>
        <Field label="Zähler-Nr." required>
          <input value={meterId} onChange={(e) => setMeterId(e.target.value)} className="input" placeholder="z.B. S-12345" required />
        </Field>
        <Field label="Wert" required>
          <NumberInput
            value={value}
            onChange={(v) => setValue(v === '' ? '' : String(v))}
            decimals={2}
            placeholder="0"
            required
            className="input"
          />
        </Field>
      </FormRow>
      <FormRow cols={2}>
        <Field label="Datum">
          <DateInput value={date} onChange={setDate} />
        </Field>
        <Field label="Abgelesen von">
          <input value={readBy} onChange={(e) => setReadBy(e.target.value)} className="input" placeholder="Name" />
        </Field>
      </FormRow>
      <Field label="Notiz" help="Optional">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="z.B. außerordentliche Ablesung" />
      </Field>
    </Modal>
  );
}
