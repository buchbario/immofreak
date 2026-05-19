import { useMemo, useState } from 'react';
import { ArrowDownLeft, Sparkles } from 'lucide-react';
import type { BankTransaction, RentalUnit, Tenant } from '../../types';
import { Modal, Field, FormSection } from '../ui/Modal';
import { formatDate } from '../../lib/utils';

interface Props {
  tx: BankTransaction;
  tenants: Tenant[];
  units: RentalUnit[];
  /** Vorschlag aus dem Matcher (z.B. wenn status='suggested'). */
  suggestedTenantId?: string;
  onClose: () => void;
  onSubmit: (tenantId: string, learn: boolean) => void;
  onUnassign?: () => void;
}

export function MatchTransactionModal({
  tx,
  tenants,
  units,
  suggestedTenantId,
  onClose,
  onSubmit,
  onUnassign,
}: Props) {
  const [tenantId, setTenantId] = useState(tx.matchedTenantId || suggestedTenantId || '');
  const canLearn = Boolean(tx.iban || tx.counterparty);
  const [learn, setLearn] = useState(canLearn);

  const activeTenants = useMemo(
    () => tenants.filter((t) => t.unitId),
    [tenants],
  );

  const handleSubmit = () => {
    if (!tenantId) return;
    onSubmit(tenantId, learn && canLearn);
  };

  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const selectedTenant = activeTenants.find((t) => t.id === tenantId);
  const selectedUnit = selectedTenant ? units.find((u) => u.id === selectedTenant.unitId) : undefined;

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Transaktion zuordnen"
      description="Wähle den Mieter, der diese Zahlung getätigt hat. Optional kannst du die IBAN für künftige Zahlungen merken."
      footerLeft={
        tx.matchedTenantId && onUnassign ? (
          <button onClick={onUnassign} className="btn btn-md btn-ghost text-red-600">
            Zuordnung entfernen
          </button>
        ) : undefined
      }
      footer={
        <>
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={handleSubmit} disabled={!tenantId} className="btn btn-md btn-primary">
            Zuordnen
          </button>
        </>
      }
    >
      <FormSection title="Transaktion">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-card-line">
          <div className="size-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
            <ArrowDownLeft size={18} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{tx.counterparty || '—'}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{tx.purpose || 'Kein Verwendungszweck'}</p>
            {tx.iban && (
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{tx.iban}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              +{fmt(tx.amount)} €
            </p>
            <p className="text-[11px] text-muted-foreground">{formatDate(tx.date)}</p>
          </div>
        </div>
      </FormSection>

      <FormSection title="Mieter">
        <Field label="Mieter auswählen" required>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="input"
            autoFocus
          >
            <option value="">— bitte wählen —</option>
            {activeTenants.map((t) => {
              const unit = units.find((u) => u.id === t.unitId);
              const rent = unit?.currentRent;
              return (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {rent ? ` · ${rent.toLocaleString('de-DE')} € Miete` : ''}
                </option>
              );
            })}
          </select>
        </Field>

        {selectedTenant && selectedUnit && Math.abs(selectedUnit.currentRent - tx.amount) <= 0.5 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <Sparkles size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Betrag stimmt exakt mit der Sollmiete überein.
            </span>
          </div>
        )}
      </FormSection>

      {canLearn && (
        <FormSection title="Für die Zukunft merken">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-card-line hover:bg-muted/30 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={learn}
              onChange={(e) => setLearn(e.target.checked)}
              className="mt-0.5 size-4 accent-[#4F6BFF]"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                IBAN / Absender merken
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Künftige Zahlungen
                {tx.iban && <> von <span className="font-mono">{tx.iban}</span></>}
                {!tx.iban && tx.counterparty && <> mit Absender „{tx.counterparty}"</>}
                {' '}werden automatisch diesem Mieter zugeordnet.
              </p>
            </div>
          </label>
        </FormSection>
      )}
    </Modal>
  );
}
