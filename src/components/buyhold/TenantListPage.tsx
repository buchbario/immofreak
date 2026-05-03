import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, CalendarClock } from 'lucide-react';
import { useTenants } from '../../hooks/useTenants';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { TenantForm } from './TenantForm';
import { cn, formatCurrency } from '../../lib/utils';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getLeaseStatus(leaseEnd?: string): { label: string; cls: string } | null {
  if (!leaseEnd) return { label: 'Unbefristet', cls: 'badge-blue' };
  const now = new Date();
  const end = new Date(leaseEnd);
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: 'Abgelaufen', cls: 'badge-red' };
  if (daysLeft <= 90) return { label: `${daysLeft}T übrig`, cls: 'badge-amber' };
  return null;
}

function fmtDate(d?: string) {
  if (!d) return '--';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));
}

export function TenantListPage() {
  const { allTenants, createTenant } = useTenants();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'expiring' | 'unbefristet'>('all');
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    let list = allTenants;

    // Text search
    const q = search.toLowerCase();
    if (q) {
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) ||
          properties.find(p => p.id === t.propertyId)?.name.toLowerCase().includes(q) || false
      );
    }

    // Filter
    if (filter === 'expiring') {
      const now = new Date();
      const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      list = list.filter(t => t.leaseEnd && new Date(t.leaseEnd) <= in90);
    } else if (filter === 'unbefristet') {
      list = list.filter(t => !t.leaseEnd);
    }

    return list;
  }, [allTenants, search, filter, properties]);

  const expiringCount = useMemo(() => {
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    return allTenants.filter(t => t.leaseEnd && new Date(t.leaseEnd) <= in90).length;
  }, [allTenants]);

  return (
    <div className="page-container">
      {allTenants.length === 0 ? (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-title">Mieter</h1>
              <p className="page-subtitle">Lege deinen ersten Mieter an.</p>
            </div>
            <button onClick={() => setShowForm(true)} className="btn btn-md btn-primary">
              <Plus size={15} /> Mieter anlegen
            </button>
          </div>
          <div className="surface empty-state">
            <div className="size-12 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center mb-4">
              <Users size={22} className="text-[#4F6BFF]" />
            </div>
            <p className="text-sm font-semibold mb-1 text-foreground">Noch keine Mieter</p>
            <p className="text-sm mb-5 text-muted-foreground-2">Lege deinen ersten Mieter an, um Mietverträge und Zahlungen zu verwalten.</p>
            <button onClick={() => setShowForm(true)} className="btn btn-md btn-primary">
              <Plus size={15} /> Mieter anlegen
            </button>
          </div>
        </>
      ) : (
        <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          {/* Header */}
          <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-card-divider">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <h1 className="text-[24px] sm:text-[26px] font-bold text-foreground tracking-tight leading-tight mb-1">Mieter</h1>
                <p className="text-[13px] text-muted-foreground max-w-2xl leading-relaxed">
                  Alle Mieter mit Mietverträgen, Laufzeiten und Kontaktdaten an einem Ort.
                </p>
              </div>
              <button onClick={() => setShowForm(true)} className="btn btn-sm btn-primary shrink-0">
                <Plus size={14} /> Neuer Mieter
              </button>
            </div>
          </div>

          {/* Tabs + Search */}
          <div className="px-5 sm:px-7 py-3 border-b border-card-divider flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-3 sm:gap-4 -mb-3">
              {([
                { key: 'all', label: 'Alle', cnt: allTenants.length },
                { key: 'expiring', label: 'Auslaufend', cnt: expiringCount },
                { key: 'unbefristet', label: 'Unbefristet', cnt: allTenants.filter((t) => !t.leaseEnd).length },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'group relative inline-flex items-center gap-1.5 pb-2 text-[13px] font-medium transition-colors cursor-pointer',
                    filter === f.key ? 'text-[#4F6BFF]' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f.label}
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[10.5px] font-semibold tabular-nums',
                    filter === f.key ? 'bg-[#4F6BFF]/15 text-[#4F6BFF]' : 'bg-layer-hover text-muted-foreground/80',
                  )}>
                    {f.cnt}
                  </span>
                  {filter === f.key && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#4F6BFF]" />}
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

          {filtered.length === 0 ? (
            <div className="text-center py-10 px-5">
              <Search size={20} className="mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-[13px] text-muted-foreground">Keine Mieter gefunden.</p>
            </div>
          ) : (
            <>
          {/* Desktop: table */}
          <div className="surface overflow-hidden hidden md:block" data-tour="tenant-list">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-card-divider">
                    <th className="th">Name</th>
                    <th className="th">Objekt / Einheit</th>
                    <th className="th text-end">Miete</th>
                    <th className="th">Vertragslaufzeit</th>
                    <th className="th">Telefon</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const property = properties.find((p) => p.id === t.propertyId);
                    const unit = allUnits.find((u) => u.id === t.unitId);
                    const leaseStatus = getLeaseStatus(t.leaseEnd);
                    return (
                      <tr
                        key={t.id}
                        className="cursor-pointer transition-colors hover:bg-layer-hover border-b border-card-divider"
                        onClick={() => navigate(`/bh/mieter/${t.id}`)}
                      >
                        <td className="td">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-[#4F6BFF]/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-[#4F6BFF]">{getInitials(t.name)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{t.name}</p>
                              <p className="text-xs text-muted-foreground-2">{t.email || '--'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="td">
                          <p className="text-sm text-foreground">{property?.name || '--'}</p>
                          <p className="text-xs text-muted-foreground-2">{unit?.name || '--'}{unit?.area ? ` · ${unit.area} m²` : ''}</p>
                        </td>
                        <td className="td text-end">
                          <span className="text-sm font-medium tabular-nums text-foreground">{unit?.currentRent ? formatCurrency(unit.currentRent) : '--'}</span>
                        </td>
                        <td className="td">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground-2">
                              {fmtDate(t.leaseStart)}{t.leaseEnd ? ` – ${fmtDate(t.leaseEnd)}` : ''}
                            </span>
                            {leaseStatus && (
                              <span className={cn('badge', leaseStatus.cls)}>{leaseStatus.label}</span>
                            )}
                          </div>
                        </td>
                        <td className="td text-muted-foreground-2">{t.phone || '--'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: card rows */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((t) => {
              const property = properties.find((p) => p.id === t.propertyId);
              const unit = allUnits.find((u) => u.id === t.unitId);
              const leaseStatus = getLeaseStatus(t.leaseEnd);
              return (
                <div
                  key={t.id}
                  className="surface p-3.5 cursor-pointer active:bg-layer-active hover:bg-layer-hover transition-colors"
                  onClick={() => navigate(`/bh/mieter/${t.id}`)}
                >
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-full bg-[#4F6BFF]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-[#4F6BFF]">{getInitials(t.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                          {property && (
                            <p className="text-xs text-muted-foreground-2 truncate mt-0.5">
                              {property.name}{unit?.name ? ` · ${unit.name}` : ''}
                            </p>
                          )}
                        </div>
                        {unit?.currentRent ? (
                          <span className="text-sm font-bold tabular-nums text-foreground flex-shrink-0">{formatCurrency(unit.currentRent)}</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {leaseStatus && (
                          <span className={cn('badge', leaseStatus.cls)}>{leaseStatus.label}</span>
                        )}
                        {t.leaseEnd && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground-2">
                            <CalendarClock size={11} />
                            bis {fmtDate(t.leaseEnd)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
            </>
          )}

          {/* Footer counter inside card */}
          <div className="px-5 sm:px-7 py-3 border-t border-card-divider">
            <p className="text-[11.5px] text-muted-foreground tabular-nums">
              {filtered.length} von {allTenants.length} {allTenants.length === 1 ? 'Mieter' : 'Mieter'}
            </p>
          </div>
        </div>
      )}

      {showForm && (
        <TenantForm
          properties={properties}
          units={allUnits}
          onClose={() => setShowForm(false)}
          onSave={(data) => {
            createTenant(data);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}
