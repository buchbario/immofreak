import { useState, useMemo } from 'react';
import { X, Wallet, Building2, User } from 'lucide-react';
import type { TenantPayment, Tenant, RentalProperty, RentalUnit } from '../../types';
import { NumberInput } from '../ui/NumberInput';

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
    return tenants.find(t => t.id === selectedTenantId);
  }, [tenant, tenants, selectedTenantId]);

  const property = useMemo(
    () => activeTenant ? properties.find(p => p.id === activeTenant.propertyId) : undefined,
    [activeTenant, properties]
  );
  const unit = useMemo(
    () => activeTenant?.unitId ? units.find(u => u.id === activeTenant.unitId) : undefined,
    [activeTenant, units]
  );

  // Pre-fill the suggested amount when Miete is selected and we know the unit rent
  const suggestedRent = unit?.currentRent ?? 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  const canSubmit = !!activeTenant && parseFloat(amount) > 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-overlay" />
      <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wallet size={16} className="text-[#4F6BFF]" />
              Neue Zahlung erfassen
            </h3>
            <button type="button" onClick={onClose} className="cursor-pointer text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>

          <div className="modal-body space-y-4">
            {/* Tenant picker (only when no tenant pre-selected) */}
            {!tenant && (
              <div>
                <label className="input-label">Mieter *</label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  required
                  className="input"
                >
                  <option value="" disabled>Mieter auswählen…</option>
                  {tenants.map(t => {
                    const p = properties.find(pp => pp.id === t.propertyId);
                    const u = t.unitId ? units.find(uu => uu.id === t.unitId) : undefined;
                    const suffix = [p?.name, u?.name].filter(Boolean).join(' · ');
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name}{suffix ? ` — ${suffix}` : ''}
                      </option>
                    );
                  })}
                </select>
                {tenants.length === 0 && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Keine Mieter vorhanden. Lege zuerst einen Mieter an.
                  </p>
                )}
              </div>
            )}

            {/* Tenant preview card (always visible once a tenant is selected) */}
            {activeTenant && (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-[#4F6BFF]/25 bg-[#4F6BFF]/5">
                <div className="size-9 rounded-lg bg-[#4F6BFF]/15 flex items-center justify-center shrink-0">
                  <User size={16} className="text-[#4F6BFF]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {('name' in activeTenant && activeTenant.name) || tenants.find(t => t.id === activeTenant.id)?.name || '—'}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Betrag *</label>
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
              </div>
              <div>
                <label className="input-label">Datum *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Typ</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TenantPayment['type'])}
                  className="input"
                >
                  {PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TenantPayment['status'])}
                  className="input"
                >
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="input-label">Notiz (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input"
                placeholder="z. B. Verwendungszweck oder Kommentar"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
            <button type="submit" disabled={!canSubmit} className="btn btn-md btn-primary">
              <Wallet size={14} /> Zahlung speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
