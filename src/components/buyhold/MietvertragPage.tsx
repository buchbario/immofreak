import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Search, ArrowRight, Eye,
} from 'lucide-react';
import { useRentalContracts } from '../../hooks/useRentalContracts';
import { useTenants } from '../../hooks/useTenants';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { cn } from '../../lib/utils';
import { ContractPreviewModal } from './ContractPreviewModal';
import type { RentalContract } from '../../types';

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
  const [previewContract, setPreviewContract] = useState<RentalContract | null>(null);

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
  const unbefristetCount = enriched.filter((c) => c.contractType === 'unbefristet').length;
  const befristetCount = enriched.filter((c) => c.contractType === 'befristet').length;

  return (
    <div className="page-container">
      {allContracts.length === 0 ? (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-title">Mietverträge</h1>
              <p className="page-subtitle">Lege deinen ersten Mietvertrag an.</p>
            </div>
          </div>
          <div className="surface empty-state">
            <div className="size-12 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center mb-4">
              <FileText size={22} className="text-[#4F6BFF]" />
            </div>
            <p className="text-sm font-semibold mb-1 text-foreground">Noch keine Mietverträge</p>
            <p className="text-sm text-muted-foreground-2">Verträge erscheinen hier, sobald du sie über die Mieter-Detailseite anlegst.</p>
          </div>
        </>
      ) : (
        <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          {/* Header */}
          <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-card-divider">
            <h1 className="text-[24px] sm:text-[26px] font-bold text-foreground tracking-tight leading-tight mb-1">Mietverträge</h1>
            <p className="text-[13px] text-muted-foreground max-w-2xl leading-relaxed">
              Übersicht aller aktiven und befristeten Mietverhältnisse mit Warmmiete, Kaution und Vertragslaufzeit.
            </p>
          </div>

          {/* Tabs + Search */}
          <div className="px-5 sm:px-7 py-3 border-b border-card-divider flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-3 sm:gap-4 -mb-3">
              {([
                { key: 'alle', label: 'Alle', cnt: allContracts.length },
                { key: 'unbefristet', label: 'Unbefristet', cnt: unbefristetCount },
                { key: 'befristet', label: 'Befristet', cnt: befristetCount },
                { key: 'auslaufend', label: 'Auslaufend', cnt: expiringCount },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setFilter(opt.key)}
                  className={cn(
                    'group relative inline-flex items-center gap-1.5 pb-2 text-[13px] font-medium transition-colors cursor-pointer',
                    filter === opt.key ? 'text-[#4F6BFF]' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {opt.label}
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[10.5px] font-semibold tabular-nums',
                    filter === opt.key ? 'bg-[#4F6BFF]/15 text-[#4F6BFF]' : 'bg-layer-hover text-muted-foreground/80',
                  )}>
                    {opt.cnt}
                  </span>
                  {filter === opt.key && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#4F6BFF]" />}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen..."
                className="h-8 pl-7 pr-3 rounded-md bg-layer-hover text-[12px] text-foreground placeholder:text-muted-foreground/70 border border-transparent hover:border-card-line focus:bg-card focus:border-[#4F6BFF]/40 focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/15 transition-all w-[160px] focus:w-[220px]"
              />
            </div>
          </div>

          {/* Contract list */}
          {filtered.length === 0 ? (
            <div className="text-center py-10 px-5">
              <Search size={20} className="mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-[13px] text-muted-foreground">Keine Verträge gefunden.</p>
            </div>
          ) : (
            <>
              {/* Table Header (desktop) */}
              <div className="hidden md:grid grid-cols-[1fr_140px_110px_130px_110px_110px_72px] gap-4 px-5 sm:px-7 py-2.5 border-b border-card-divider text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                <span>Mieter / Einheit</span>
                <span>Objekt</span>
                <span>Warmmiete</span>
                <span>Kaution</span>
                <span>Vertragsbeginn</span>
                <span>Status</span>
                <span className="text-right">Vertrag</span>
              </div>

              <div className="divide-y divide-card-divider">
                {filtered.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/bh/mietvertraege/${c.id}`)}
                    className="grid grid-cols-1 md:grid-cols-[1fr_140px_110px_130px_110px_110px_72px] gap-2 md:gap-4 items-center px-5 sm:px-7 py-3.5 cursor-pointer hover:bg-layer-hover transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-foreground truncate tracking-tight">{c.tenant?.name || '–'}</span>
                      <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">{c.unit?.name || '–'}</p>
                    </div>
                    <p className="text-[12.5px] text-muted-foreground truncate hidden md:block">{c.property?.name || '–'}</p>
                    <p className="text-[13px] font-semibold tabular-nums text-foreground hidden md:block">{fmt(c.warmmiete)} €</p>
                    <div className="hidden md:flex items-center gap-2 whitespace-nowrap">
                      <span
                        className={cn('inline-block size-1.5 rounded-full flex-shrink-0', c.depositPaid ? 'bg-emerald-500' : 'bg-rose-500')}
                        title={c.depositPaid ? 'Kaution bezahlt' : 'Kaution offen'}
                      />
                      <span className="text-[12.5px] tabular-nums text-foreground">{fmt(c.depositAmount)} €</span>
                    </div>
                    <p className="text-[12.5px] text-muted-foreground tabular-nums hidden md:block">{formatDate(c.startDate)}</p>
                    <span className={`badge ${c.status.cls} hidden md:inline-flex w-fit`}>{c.status.label}</span>
                    <div className="hidden md:flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewContract(c); }}
                        className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-[#4F6BFF] hover:bg-[#4F6BFF]/10 transition-colors cursor-pointer"
                        aria-label="Vertrag ansehen"
                        title="Vertrag ansehen"
                      >
                        <Eye size={15} />
                      </button>
                      <ArrowRight size={13} className="text-muted-foreground" />
                    </div>

                    {/* Mobile summary */}
                    <div className="flex items-center justify-between gap-2 md:hidden">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11.5px] text-muted-foreground truncate">{c.property?.name}</span>
                        <span className={`badge ${c.status.cls} flex-shrink-0`}>{c.status.label}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[13px] font-semibold tabular-nums text-foreground">{fmt(c.warmmiete)} €</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewContract(c); }}
                          className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-[#4F6BFF] hover:bg-[#4F6BFF]/10 transition-colors cursor-pointer"
                          aria-label="Vertrag ansehen"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="px-5 sm:px-7 py-3 border-t border-card-divider">
            <p className="text-[11.5px] text-muted-foreground tabular-nums">
              {filtered.length} von {allContracts.length} {allContracts.length === 1 ? 'Vertrag' : 'Verträge'}
            </p>
          </div>
        </div>
      )}

      {previewContract && (
        <ContractPreviewModal
          open
          onClose={() => setPreviewContract(null)}
          contract={previewContract}
          tenant={allTenants.find((t) => t.id === previewContract.tenantId)}
          unit={allUnits.find((u) => u.id === previewContract.unitId)}
          property={properties.find((p) => p.id === previewContract.propertyId)}
        />
      )}
    </div>
  );
}
