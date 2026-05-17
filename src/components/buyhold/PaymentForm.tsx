import { useState, useMemo } from 'react';
import { Wallet, Building2, User } from 'lucide-react';
import type { TenantPayment, Tenant, RentalProperty, RentalUnit } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { Modal, Field, FormSection, FormRow } from '../ui/Modal';
import { DateInput } from '../ui/DateInput';

const PAYMENT_TYPES: TenantPayment['type'][] = ['Miete', 'Kaution', 'Nachzahlung', 'Gutschrift'];
const PAYMENT_STATUSES: TenantPayment['status'][] = ['eingegangen', 'ausstehend', 'überfällig'];

const STATUS_LABELS: Record<TenantPayment['status'], string> = {
  eingegangen: 'Eingegangen',
  ausstehend: 'Ausstehend',
  'überfällig': 'Überfällig',
};

interface Props {
  /** Pre-selected tenant. When omitted, a tenant picker is shown. */
  tenant?: Pick<Tenant, 'id' | 'name' | 'propertyId' | 'unitId'>;
  /** Optional pool of tenants to pick from (used when `tenant` is omitted). */
  tenants?: Tenant[];
  properties?: RentalProperty[];
  units?: RentalUnit[];
  onClose: () => void;
  onSave: (data: Omit<TenantPayment, 'id' | 'createdAt'>) => void;
}

export function PaymentForm({ tenant, tenants = [], properties = [], units = [], onClose, onSave }: Props) {
  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenant?.id ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<TenantPayment['type']>('Miete');
  const [status, setStatus] = useState<TenantPayment['status']>('eingegangen');
  const [notes, setNotes] = useState('');

  const activeTenant = useMemo(() => {
    if (tenant) return tenant;
    return tenants.find((t) => t.id === selectedTenantId);
  }, [tenant, tenants, selectedTenantId]);

  const property = useMemo(
    () => activeTenant ? properties.find((p) => p.id === activeTenant.propertyId) : undefined,
    [activeTenant, properties],
  );
  const unit = useMemo(
    () => activeTenant?.unitId ? units.find((u) => u.id === activeTenant.unitId) : undefined,
    [activeTenant, units],
  );

  const suggestedRent = unit?.currentRent ?? 0;

  const canSubmit = !!activeTenant && parseFloat(amount) > 0;

  const handleSubmit = () => {
    if (!activeTenant) return;
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;
    onSave({
      tenantId: activeTenant.id,
      propertyId: activeTenant.propertyId,
      unitId: activeTenant.unitId || '',
      amount: parsed,
      date,
      type,
      status,
      notes,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="inline-flex items-center gap-2.5">
          <span className="size-8 rounded-lg bg-[#4F6BFF]/12 inline-flex items-center justify-center">
            <Wallet size={16} className="text-[#4F6BFF]" />
          </span>
          <span>Neue Zahlung erfassen</span>
        </span>
      }
      description="Mieteingang, Kaution oder Nachzahlung dokumentieren."
      footer={
        <>
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={handleSubmit} disabled={!canSubmit} className="btn btn-md btn-primary">
            <Wallet size={14} /> Zahlung speichern
          </button>
        </>
      }
    >
      {!tenant && (
        <FormSection title="Mieter">
          <Field label="Mieter" required>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              required
              className="input"
            >
              <option value="" disabled>Mieter auswählen…</option>
              {tenants.map((t) => {
                const p = properties.find((pp) => pp.id === t.propertyId);
                const u = t.unitId ? units.find((uu) => uu.id === t.unitId) : undefined;
                const suffix = [p?.name, u?.name].filter(Boolean).join(' · ');
                return (
                  <option key={t.id} value={t.id}>
                    {t.name}{suffix ? ` — ${suffix}` : ''}
                  </option>
                );
              })}
            </select>
          </Field>
          {tenants.length === 0 && (
            <p className="text-xs text-muted-foreground">Keine Mieter vorhanden — lege zuerst einen Mieter an.</p>
          )}
        </FormSection>
      )}

      {activeTenant && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-[#4F6BFF]/25 bg-[#4F6BFF]/5">
          <div className="size-9 rounded-lg bg-[#4F6BFF]/15 flex items-center justify-center shrink-0">
            <User size={16} className="text-[#4F6BFF]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {('name' in activeTenant && activeTenant.name) || tenants.find((t) => t.id === activeTenant.id)?.name || '—'}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
              <Building2 size={11} className="shrink-0" />
              <span className="truncate">
                {property?.name || 'Kein Objekt'}{unit ? ` · ${unit.name}` : ''}
              </span>
            </div>
          </div>
          {suggestedRent > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(suggestedRent))}
              className="shrink-0 text-[11px] font-semibold text-[#4F6BFF] hover:underline whitespace-nowrap"
              title="Kaltmiete als Betrag übernehmen"
            >
              Kaltmiete: {suggestedRent.toLocaleString('de-DE')} €
            </button>
          )}
        </div>
      )}

      <FormSection title="Zahlung">
        <FormRow cols={2}>
          <Field label="Betrag" required>
            <NumberInput
              value={amount}
              onChange={(v) => setAmount(v === '' ? '' : String(v))}
              suffix="€"
              decimals={2}
              required
              className="input"
              placeholder="0,00"
              autoFocus={!!tenant}
            />
          </Field>
          <Field label="Datum" required>
            <DateInput value={date} onChange={setDate} />
          </Field>
        </FormRow>
        <FormRow cols={2}>
          <Field label="Typ">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TenantPayment['type'])}
              className="input"
            >
              {PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TenantPayment['status'])}
              className="input"
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </Field>
        </FormRow>
        <Field label="Notiz" help="Optional — Verwendungszweck oder Kommentar">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input"
            placeholder="z. B. Miete März, Nachzahlung NK 2024"
          />
        </Field>
      </FormSection>
    </Modal>
  );
}
