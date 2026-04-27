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
      <div className="page-header">
        <div>
          <h1 className="page-title">Mieter</h1>
          <p className="page-subtitle">{allTenants.length} Mieter</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-md btn-primary"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Mieter anlegen</span>
          <span className="sm:hidden">Neu</span>
        </button>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3 mb-6">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Name, E-Mail oder Objekt suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {([
            { key: 'all', label: 'Alle' },
            { key: 'expiring', label: `Auslaufend${expiringCount > 0 ? ` (${expiringCount})` : ''}` },
            { key: 'unbefristet', label: 'Unbefristet' },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                filter === f.key ? 'bg-[#4F6BFF]/10 text-[#4F6BFF]' : 'bg-layer-hover text-foreground/80 hover:bg-layer-active'
              )}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {allTenants.length === 0 ? (
        <div className="surface empty-state">
          <div className="size-12 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center mb-4">
            <Users size={22} className="text-[#4F6BFF]" />
          </div>
          <p className="text-sm font-semibold mb-1 text-foreground">Noch keine Mieter</p>
          <p className="text-sm mb-5 text-muted-foreground-2">Lege deinen ersten Mieter an, um Mietverträge und Zahlungen zu verwalten.</p>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-md btn-primary"
          >
            <Plus size={15} /> Mieter anlegen
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface empty-state">
          <div className="size-12 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center mb-4">
            <Search size={22} className="text-[#4F6BFF]" />
          </div>
          <p className="text-sm font-semibold mb-1 text-foreground">Keine Mieter gefunden</p>
          <p className="text-sm text-muted-foreground-2">Versuche einen anderen Suchbegriff oder Filter.</p>
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
            <div className="px-4 py-3 border-t border-card-divider">
              <p className="text-xs text-muted-foreground">{filtered.length} von {allTenants.length} Mieter</p>
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
            <p className="text-xs text-muted-foreground text-center pt-2">{filtered.length} von {allTenants.length} Mieter</p>
          </div>
        </>
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
