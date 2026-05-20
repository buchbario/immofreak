import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Receipt } from 'lucide-react';
import { useTenantPayments } from '../../hooks/useTenantPayments';
import { useTenants } from '../../hooks/useTenants';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { PaymentForm } from './PaymentForm';
import { PageCard, PageCardNoResults } from '../ui/PageCard';

type StatusFilter = 'alle' | 'eingegangen' | 'ausstehend' | 'überfällig';

const fmt = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

const statusDot: Record<string, string> = {
  eingegangen: 'dot-green',
  ausstehend: 'dot-amber',
  'überfällig': 'dot-red',
};

const statusLabel: Record<string, string> = {
  eingegangen: 'Eingegangen',
  ausstehend: 'Ausstehend',
  'überfällig': 'Überfällig',
};

export function TransactionsPage() {
  const { allPayments, createPayment } = useTenantPayments();
  const { allTenants } = useTenants();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('alle');
  const [propertyFilter, setPropertyFilter] = useState('alle');
  const [monthFilter, setMonthFilter] = useState('alle');
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const tenantMap = useMemo(() => {
    const map = new Map<string, (typeof allTenants)[number]>();
    allTenants.forEach((t) => map.set(t.id, t));
    return map;
  }, [allTenants]);

  const propertyMap = useMemo(() => {
    const map = new Map<string, (typeof properties)[number]>();
    properties.forEach((p) => map.set(p.id, p));
    return map;
  }, [properties]);

  const unitMap = useMemo(() => {
    const map = new Map<string, (typeof allUnits)[number]>();
    allUnits.forEach((u) => map.set(u.id, u));
    return map;
  }, [allUnits]);

  const filtered = useMemo(() => {
    return allPayments
      .filter((p) => {
        if (statusFilter !== 'alle' && p.status !== statusFilter) return false;
        if (propertyFilter !== 'alle' && p.propertyId !== propertyFilter) return false;
        if (monthFilter !== 'alle') {
          const d = new Date(p.date);
          const paymentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (paymentMonth !== monthFilter) return false;
        }
        if (search.trim()) {
          const tenant = tenantMap.get(p.tenantId);
          const tenantName = tenant?.name?.toLowerCase() || '';
          if (!tenantName.includes(search.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allPayments, statusFilter, propertyFilter, monthFilter, search, tenantMap]);

  /* KPI calculations */
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const totalEingegangen = allPayments
    .filter((p) => p.status === 'eingegangen')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalOffen = allPayments
    .filter((p) => p.status === 'ausstehend' || p.status === 'überfällig')
    .reduce((sum, p) => sum + p.amount, 0);

  const thisMonthCount = allPayments.filter((p) => {
    const d = new Date(p.date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === currentMonth;
  }).length;

  const avgMonthly = useMemo(() => {
    const eingegangen = allPayments.filter((p) => p.status === 'eingegangen');
    if (eingegangen.length === 0) return 0;
    const months = new Set(
      eingegangen.map((p) => {
        const d = new Date(p.date);
        return `${d.getFullYear()}-${d.getMonth()}`;
      })
    );
    const total = eingegangen.reduce((s, p) => s + p.amount, 0);
    return months.size > 0 ? total / months.size : 0;
  }, [allPayments]);

  const filteredEingegangen = filtered
    .filter((p) => p.status === 'eingegangen')
    .reduce((sum, p) => sum + p.amount, 0);

  // Counts per status for tab badges
  const statusCounts = {
    alle: allPayments.length,
    eingegangen: allPayments.filter((p) => p.status === 'eingegangen').length,
    ausstehend: allPayments.filter((p) => p.status === 'ausstehend').length,
    'überfällig': allPayments.filter((p) => p.status === 'überfällig').length,
  };

  void thisMonthCount; void avgMonthly;

  return (
    <div className="page-container">
      <PageCard
        title="Transaktionen"
        description="Alle Mieteinnahmen und Zahlungen — gefiltert nach Status, Objekt und Monat."
        meta={
          <>
            <Receipt size={11} /> {allPayments.length} {allPayments.length === 1 ? 'Transaktion' : 'Transaktionen'}
            <span className="size-[3px] rounded-full bg-muted-foreground/40 mx-0.5" />
            <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(totalEingegangen)} € eingegangen</span>
            {totalOffen > 0 && (
              <>
                <span className="size-[3px] rounded-full bg-muted-foreground/40 mx-0.5" />
                <span className="text-amber-600 dark:text-amber-400 tabular-nums">{fmt(totalOffen)} € offen</span>
              </>
            )}
          </>
        }
        actions={
          <button onClick={() => setShowPaymentForm(true)} className="btn btn-sm btn-primary">
            <Plus size={14} /> Neue Transaktion
          </button>
        }
        tabs={[
          { key: 'alle', label: 'Alle', count: statusCounts.alle },
          { key: 'eingegangen', label: 'Eingegangen', count: statusCounts.eingegangen },
          { key: 'ausstehend', label: 'Ausstehend', count: statusCounts.ausstehend, tone: 'warn' as const },
          { key: 'überfällig', label: 'Überfällig', count: statusCounts['überfällig'], tone: 'danger' as const },
        ]}
        activeTab={statusFilter}
        onTabChange={(k) => setStatusFilter(k as StatusFilter)}
        tabExtras={
          <div className="flex items-center gap-1.5">
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="h-8 px-2 rounded-md bg-layer-hover hover:bg-layer-active text-[12px] border-0 cursor-pointer"
            >
              <option value="alle">Alle Objekte</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="h-8 px-2 rounded-md bg-layer-hover hover:bg-layer-active text-[12px] border-0 cursor-pointer"
            >
              <option value="alle">Alle Monate</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        }
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Mieter suchen..."
        footer={
          <span className="flex items-center justify-between">
            <span>{filtered.length} von {allPayments.length} {allPayments.length === 1 ? 'Transaktion' : 'Transaktionen'}</span>
            {filtered.length > 0 && (
              <span className="font-semibold text-foreground tabular-nums">Summe: {fmt(filteredEingegangen)} €</span>
            )}
          </span>
        }
      >
        {filtered.length === 0 ? (
          <PageCardNoResults message="Keine Transaktionen gefunden — passe deine Filter an oder erfasse eine neue." />
        ) : (
          <>
            {/* Desktop: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-card-divider">
                    <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Datum</th>
                    <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Mieter</th>
                    <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Objekt / Einheit</th>
                    <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Typ</th>
                    <th className="th text-end text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Betrag</th>
                    <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((payment) => {
                    const tenant = tenantMap.get(payment.tenantId);
                    const property = propertyMap.get(payment.propertyId);
                    const unit = unitMap.get(payment.unitId ?? '');
                    return (
                      <tr key={payment.id} className="transition-colors hover:bg-layer-hover border-b border-card-divider">
                        <td className="td whitespace-nowrap tabular-nums text-muted-foreground text-[12.5px]">
                          {fmtDate(payment.date)}
                        </td>
                        <td className="td whitespace-nowrap">
                          {tenant ? (
                            <button
                              onClick={() => navigate(`/bh/mieter/${tenant.id}`)}
                              className="text-[13px] text-[#4F6BFF] font-semibold hover:underline transition-colors cursor-pointer"
                            >
                              {tenant.name}
                            </button>
                          ) : (
                            <span className="text-[13px] text-muted-foreground">Nicht zugeordnet</span>
                          )}
                        </td>
                        <td className="td whitespace-nowrap text-[12.5px]">
                          <span className="text-foreground/80">{property?.name || '—'}</span>
                          {unit && <span className="text-muted-foreground"> · {unit.name}</span>}
                        </td>
                        <td className="td whitespace-nowrap text-muted-foreground text-[12.5px]">{payment.type}</td>
                        <td className="td whitespace-nowrap text-end font-semibold tabular-nums text-foreground text-[13px]">
                          {fmt(payment.amount)} €
                        </td>
                        <td className="td whitespace-nowrap">
                          <span className="inline-flex items-center gap-2 text-[11.5px] font-medium text-muted-foreground">
                            <span className={`dot ${statusDot[payment.status] || 'dot-amber'}`} />
                            {statusLabel[payment.status] || payment.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: Card list */}
            <div className="md:hidden divide-y divide-card-divider">
              {filtered.map((payment) => {
                const tenant = tenantMap.get(payment.tenantId);
                const property = propertyMap.get(payment.propertyId);
                const unit = unitMap.get(payment.unitId ?? '');
                return (
                  <div key={payment.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {tenant ? (
                          <button
                            onClick={() => navigate(`/bh/mieter/${tenant.id}`)}
                            className="text-[13px] font-semibold text-[#4F6BFF] hover:underline truncate block text-left"
                          >
                            {tenant.name}
                          </button>
                        ) : (
                          <span className="text-[13px] font-medium text-muted-foreground">Nicht zugeordnet</span>
                        )}
                        <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                          {property?.name || '—'}{unit ? ` · ${unit.name}` : ''}
                        </p>
                      </div>
                      <span className="text-[13px] font-bold tabular-nums text-foreground whitespace-nowrap">
                        {fmt(payment.amount)} €
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <span className={`dot ${statusDot[payment.status] || 'dot-amber'}`} />
                        {statusLabel[payment.status] || payment.status}
                      </span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {payment.type} · {fmtDate(payment.date)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </PageCard>

      {showPaymentForm && (
        <PaymentForm
          tenants={allTenants}
          properties={properties}
          units={allUnits}
          onClose={() => setShowPaymentForm(false)}
          onSave={(data) => {
            createPayment(data);
            setShowPaymentForm(false);
          }}
        />
      )}
    </div>
  );
}
