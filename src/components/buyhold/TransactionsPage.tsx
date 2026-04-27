import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useTenantPayments } from '../../hooks/useTenantPayments';
import { useTenants } from '../../hooks/useTenants';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { PaymentForm } from './PaymentForm';

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

  const kpis = [
    { label: 'Eingange gesamt', value: `${fmt(totalEingegangen)} EUR`, sub: 'Alle eingegangenen Zahlungen' },
    { label: 'Offene Betrage', value: `${fmt(totalOffen)} EUR`, sub: 'Ausstehend & uberfallig' },
    { label: 'Transaktionen / Monat', value: `${thisMonthCount}`, sub: 'Aktueller Monat' },
    { label: 'Durchschn. Mieteingang', value: `${fmt(avgMonthly)} EUR`, sub: 'Pro Monat' },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Transaktionen</h1>
          <p className="page-subtitle">
            Alle Mieteinnahmen und Zahlungen im Überblick
          </p>
        </div>
        <button
          onClick={() => setShowPaymentForm(true)}
          className="btn btn-md btn-primary"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Erfassen</span>
          <span className="sm:hidden">Neu</span>
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8" data-tour="transactions-kpis">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="surface p-3 sm:p-4 md:p-5">
            <p className="stat-label text-[11px] sm:text-xs truncate">{kpi.label}</p>
            <p className="stat-value mt-1 text-base sm:text-lg truncate">{kpi.value}</p>
            {kpi.sub && <p className="text-[11px] sm:text-xs mt-0.5 text-muted-foreground truncate hidden sm:block">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Mieter suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 sm:w-52"
            />
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scroll-x -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
            {([
              { key: 'alle', label: 'Alle' },
              { key: 'eingegangen', label: 'Eingegangen' },
              { key: 'ausstehend', label: 'Ausstehend' },
              { key: 'überfällig', label: 'Überfällig' },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                className={`btn btn-sm shrink-0 ${
                  statusFilter === opt.key
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Property + Month selects */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="input w-full sm:w-auto"
          >
            <option value="alle">Alle Objekte</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="input w-full sm:w-auto"
          >
            <option value="alle">Alle Monate</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop: Table */}
      <div className="surface hidden md:block">
        <div className="overflow-x-auto scroll-x">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-card-divider">
                <th className="th">Datum</th>
                <th className="th">Mieter</th>
                <th className="th">Objekt / Einheit</th>
                <th className="th">Typ</th>
                <th className="th text-end">Betrag</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <p className="text-sm text-muted-foreground-2">Keine Transaktionen gefunden</p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      Passe deine Filter an oder erfasse eine neue Transaktion
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((payment) => {
                  const tenant = tenantMap.get(payment.tenantId);
                  const property = propertyMap.get(payment.propertyId);
                  const unit = unitMap.get(payment.unitId);

                  return (
                    <tr key={payment.id} className="transition-colors hover:bg-layer-hover border-b border-card-divider">
                      <td className="td whitespace-nowrap tabular-nums text-muted-foreground-2">
                        {fmtDate(payment.date)}
                      </td>
                      <td className="td whitespace-nowrap">
                        {tenant ? (
                          <button
                            onClick={() => navigate(`/bh/mieter/${tenant.id}`)}
                            className="text-sm text-blue-400 font-semibold hover:text-blue-300 transition-colors cursor-pointer"
                          >
                            {tenant.name}
                          </button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Nicht zugeordnet</span>
                        )}
                      </td>
                      <td className="td whitespace-nowrap">
                        <span className="text-sm text-muted-foreground-2">{property?.name || '-'}</span>
                        {unit && (
                          <span className="text-sm text-muted-foreground"> / {unit.name}</span>
                        )}
                      </td>
                      <td className="td whitespace-nowrap text-muted-foreground-2">
                        {payment.type}
                      </td>
                      <td className="td whitespace-nowrap text-end font-semibold tabular-nums text-foreground">
                        {fmt(payment.amount)} EUR
                      </td>
                      <td className="td whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground-2">
                          <span className={`dot ${statusDot[payment.status] || 'dot-amber'}`} />
                          {statusLabel[payment.status] || payment.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-4 py-3.5 flex items-center justify-between border-t border-card-divider">
            <span className="text-xs text-muted-foreground">
              {filtered.length} von {allPayments.length} Transaktionen
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              Summe: {fmt(filteredEingegangen)} EUR
            </span>
          </div>
        )}
      </div>

      {/* Mobile: Card list */}
      <div className="md:hidden space-y-2.5">
        {filtered.length === 0 ? (
          <div className="surface p-8 text-center">
            <p className="text-sm text-muted-foreground-2">Keine Transaktionen gefunden</p>
            <p className="text-xs mt-1 text-muted-foreground">
              Passe deine Filter an oder erfasse eine neue Transaktion
            </p>
          </div>
        ) : (
          <>
            {filtered.map((payment) => {
              const tenant = tenantMap.get(payment.tenantId);
              const property = propertyMap.get(payment.propertyId);
              const unit = unitMap.get(payment.unitId);
              return (
                <div key={payment.id} className="surface p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {tenant ? (
                        <button
                          onClick={() => navigate(`/bh/mieter/${tenant.id}`)}
                          className="text-sm font-semibold text-blue-400 hover:text-blue-300 truncate block text-left"
                        >
                          {tenant.name}
                        </button>
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">Nicht zugeordnet</span>
                      )}
                      <p className="text-xs text-muted-foreground-2 truncate mt-0.5">
                        {property?.name || '-'}{unit ? ` / ${unit.name}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-foreground whitespace-nowrap">
                      {fmt(payment.amount)} €
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-card-divider">
                    <span className="inline-flex items-center gap-2 text-[11px] font-medium text-muted-foreground-2">
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
            <div className="surface p-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{filtered.length} von {allPayments.length}</span>
              <span className="font-semibold tabular-nums text-foreground">
                Summe: {fmt(filteredEingegangen)} EUR
              </span>
            </div>
          </>
        )}
      </div>

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
