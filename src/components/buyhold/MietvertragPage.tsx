import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Search, ArrowRight, CalendarClock, CheckCircle2, Clock,
} from 'lucide-react';
import { useRentalContracts } from '../../hooks/useRentalContracts';
import { useTenants } from '../../hooks/useTenants';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { cn } from '../../lib/utils';

type Filter = 'alle' | 'unbefristet' | 'befristet' | 'auslaufend';

function getContractStatus(contract: { contractType: string; endDate?: string }) {
  if (contract.contractType === 'unbefristet') return { label: 'Unbefristet', cls: 'badge-blue' };
  if (!contract.endDate) return { label: 'Befristet', cls: 'badge-amber' };
  const end = new Date(contract.endDate);
  const now = new Date();
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: 'Abgelaufen', cls: 'badge-red' };
  if (daysLeft <= 90) return { label: `${daysLeft}T übrig`, cls: 'badge-amber' };
  return { label: 'Befristet', cls: 'badge-green' };
}

export function MietvertragPage() {
  const navigate = useNavigate();
  const { allContracts } = useRentalContracts();
  const { allTenants } = useTenants();
  const { allUnits } = useRentalUnits();
  const { properties } = useRentalProperties();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('alle');

  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const enriched = useMemo(() => allContracts.map((c) => {
    const tenant = allTenants.find((t) => t.id === c.tenantId);
    const unit = allUnits.find((u) => u.id === c.unitId);
    const property = properties.find((p) => p.id === c.propertyId);
    const warmmiete = c.rentAmount + c.operatingCosts + c.heatingCosts;
    const status = getContractStatus(c);
    const isExpiring = c.contractType === 'befristet' && c.endDate && (() => {
      const d = Math.ceil((new Date(c.endDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return d >= 0 && d <= 90;
    })();
    return { ...c, tenant, unit, property, warmmiete, status, isExpiring };
  }), [allContracts, allTenants, allUnits, properties]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.tenant?.name.toLowerCase().includes(q) ||
        c.unit?.name.toLowerCase().includes(q) ||
        c.property?.name.toLowerCase().includes(q)
      );
    }
    if (filter === 'unbefristet') list = list.filter((c) => c.contractType === 'unbefristet');
    if (filter === 'befristet') list = list.filter((c) => c.contractType === 'befristet');
    if (filter === 'auslaufend') list = list.filter((c) => c.isExpiring);
    return list;
  }, [enriched, search, filter]);

  const expiringCount = enriched.filter((c) => c.isExpiring).length;
  const totalRent = enriched.reduce((s, c) => s + c.warmmiete, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mietverträge</h1>
          <p className="page-subtitle">{allContracts.length} {allContracts.length === 1 ? 'Vertrag' : 'Verträge'} · {fmt(totalRent)} € Warmmiete/Monat</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-card border border-card-line rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <FileText size={14} className="text-[#4F6BFF]" />
            <span className="text-xs font-medium text-muted-foreground">Gesamt</span>
          </div>
          <p className="text-lg font-semibold text-foreground tabular-nums">{allContracts.length}</p>
        </div>
        <div className="bg-card border border-card-line rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className="text-xs font-medium text-muted-foreground">Unbefristet</span>
          </div>
          <p className="text-lg font-semibold text-foreground tabular-nums">{enriched.filter((c) => c.contractType === 'unbefristet').length}</p>
        </div>
        <div className="bg-card border border-card-line rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Clock size={14} className="text-amber-500" />
            <span className="text-xs font-medium text-muted-foreground">Befristet</span>
          </div>
          <p className="text-lg font-semibold text-foreground tabular-nums">{enriched.filter((c) => c.contractType === 'befristet').length}</p>
        </div>
        <div className="bg-card border border-card-line rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <CalendarClock size={14} className="text-red-500" />
            <span className="text-xs font-medium text-muted-foreground">Auslaufend</span>
          </div>
          <p className="text-lg font-semibold text-foreground tabular-nums">{expiringCount}</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mieter, Einheit oder Objekt suchen..."
            className="input pl-9 w-full"
          />
        </div>
        <div className="flex gap-1.5">
          {([
            { key: 'alle', label: 'Alle' },
            { key: 'unbefristet', label: 'Unbefristet' },
            { key: 'befristet', label: 'Befristet' },
            { key: 'auslaufend', label: `Auslaufend${expiringCount > 0 ? ` (${expiringCount})` : ''}` },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                filter === opt.key
                  ? 'bg-[#4F6BFF]/10 text-[#4F6BFF]'
                  : 'bg-layer-hover text-foreground/80 hover:bg-layer-active'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contract List */}
      {filtered.length === 0 ? (
        <div className="surface empty-state p-12 text-center">
          <FileText size={22} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Keine Verträge gefunden.</p>
        </div>
      ) : (
        <div className="flex flex-col bg-card border border-card-line rounded-xl shadow-2xs overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[1fr_140px_110px_130px_110px_110px_32px] gap-4 px-5 py-3 border-b border-card-divider text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Mieter / Einheit</span>
            <span>Objekt</span>
            <span>Warmmiete</span>
            <span>Kaution</span>
            <span>Vertragsbeginn</span>
            <span>Status</span>
            <span />
          </div>

          <div className="divide-y divide-card-divider">
            {filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/bh/mietvertraege/${c.id}`)}
                className="grid grid-cols-1 md:grid-cols-[1fr_140px_110px_130px_110px_110px_32px] gap-2 md:gap-4 items-center px-5 py-3.5 cursor-pointer hover:bg-layer-hover transition-colors"
              >
                {/* Mieter / Einheit */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{c.tenant?.name || '–'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{c.unit?.name || '–'}</p>
                </div>

                {/* Objekt */}
                <p className="text-xs text-muted-foreground truncate hidden md:block">{c.property?.name || '–'}</p>

                {/* Warmmiete */}
                <p className="text-sm font-medium tabular-nums text-foreground hidden md:block">{fmt(c.warmmiete)} €</p>

                {/* Kaution mit Status-Punkt */}
                <div className="hidden md:flex items-center gap-2 whitespace-nowrap">
                  <span
                    className={cn('inline-block size-1.5 rounded-full flex-shrink-0', c.depositPaid ? 'bg-emerald-500' : 'bg-red-500')}
                    title={c.depositPaid ? 'Kaution bezahlt' : 'Kaution offen'}
                  />
                  <span className="text-sm font-medium tabular-nums text-foreground">{fmt(c.depositAmount)} €</span>
                </div>

                {/* Vertragsbeginn */}
                <p className="text-sm text-foreground tabular-nums hidden md:block">{formatDate(c.startDate)}</p>

                {/* Status Badge */}
                <span className={`badge ${c.status.cls} hidden md:inline-flex w-fit`}>{c.status.label}</span>

                {/* Arrow */}
                <ArrowRight size={14} className="text-muted-foreground hidden md:block justify-self-end" />

                {/* Mobile summary */}
                <div className="flex items-center justify-between md:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{c.property?.name}</span>
                    <span className={`badge ${c.status.cls}`}>{c.status.label}</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-foreground">{fmt(c.warmmiete)} €</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
