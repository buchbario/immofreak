import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Building2, MapPin, TrendingUp, Home, Users,
  LayoutGrid, List,
} from 'lucide-react';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { usePropertyPhotos } from '../../hooks/usePropertyPhotos';
import { PropertyForm } from './PropertyForm';
import { cn } from '../../lib/utils';

type ViewMode = 'grid' | 'list';

const VIEW_MODE_STORAGE_KEY = 'immofreak_bh_property_view';
const LEGACY_VIEW_MODE_KEY = 'bh_property_view';

function readPersistedViewMode(): ViewMode {
  try {
    // Prefer the new prefixed key, but honour the legacy key once so we don't
    // reset users who already saved a preference.
    const saved =
      localStorage.getItem(VIEW_MODE_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_VIEW_MODE_KEY);
    return saved === 'list' || saved === 'grid' ? saved : 'grid';
  } catch {
    return 'grid';
  }
}

export function PropertyListPage() {
  const { properties, createProperty } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allPhotos } = usePropertyPhotos();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(readPersistedViewMode);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
      // Clean up the legacy key so we don't keep two out-of-sync values.
      localStorage.removeItem(LEGACY_VIEW_MODE_KEY);
    } catch {
      /* storage unavailable — preference just won't persist this session */
    }
  }, [viewMode]);

  const filtered = properties.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.address.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });

  const getCover = (propertyId: string) => {
    const photo = allPhotos.find(p => p.propertyId === propertyId);
    return photo?.dataUrl;
  };

  return (
    <div className="page-container">
      {properties.length === 0 ? (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-title">Mietobjekte</h1>
              <p className="page-subtitle">Lege dein erstes Mietobjekt an.</p>
            </div>
            <button onClick={() => setShowForm(true)} className="btn btn-md btn-primary">
              <Plus size={15} /> Objekt anlegen
            </button>
          </div>
          <div className="surface empty-state">
            <div className="size-14 rounded-2xl flex items-center justify-center mb-4 bg-layer-hover">
              <Building2 size={22} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold mb-1 text-foreground">Keine Objekte</p>
            <p className="text-sm mb-5 text-muted-foreground-2">Lege dein erstes Mietobjekt an.</p>
            <button onClick={() => setShowForm(true)} className="btn btn-md btn-primary">Objekt anlegen</button>
          </div>
        </>
      ) : (
        <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          {/* Header */}
          <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-card-divider">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <h1 className="text-[24px] sm:text-[26px] font-bold text-foreground tracking-tight leading-tight mb-1">Mietobjekte</h1>
                <p className="text-[13px] text-muted-foreground max-w-2xl leading-relaxed">
                  Dein Buy-&-Hold-Portfolio mit Kaufpreis, Marktwert, Mieteinnahmen und Belegungsrate je Objekt.
                </p>
              </div>
              <button onClick={() => setShowForm(true)} className="btn btn-sm btn-primary shrink-0">
                <Plus size={14} /> Neues Objekt
              </button>
            </div>
          </div>

          {/* View toggle + Search — toggle deutlich größer und mit klarer Active-Farbe */}
          <div className="px-5 sm:px-7 py-3 border-b border-card-divider flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center bg-layer-hover rounded-lg p-1 gap-1 border border-card-line">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-semibold transition-all cursor-pointer',
                  viewMode === 'grid'
                    ? 'bg-[#4F6BFF] text-white shadow-[0_1px_2px_rgba(79,107,255,0.25)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
                )}
                title="Kachel-Ansicht"
              >
                <LayoutGrid size={14} strokeWidth={viewMode === 'grid' ? 2.4 : 2} />
                Kacheln
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-semibold transition-all cursor-pointer',
                  viewMode === 'list'
                    ? 'bg-[#4F6BFF] text-white shadow-[0_1px_2px_rgba(79,107,255,0.25)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
                )}
                title="Listen-Ansicht"
              >
                <List size={14} strokeWidth={viewMode === 'list' ? 2.4 : 2} />
                Liste
              </button>
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
              <p className="text-[13px] text-muted-foreground">Keine Objekte gefunden.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" data-tour="property-list">
            {filtered.map((p) => {
              const units = allUnits.filter((u) => u.propertyId === p.id);
              const monthlyRent = units.reduce((s, u) => s + u.currentRent, 0);
              const yearlyRent = monthlyRent * 12;
              const rendite = p.purchasePrice > 0 ? (yearlyRent / p.purchasePrice) * 100 : 0;
              const occupied = units.filter((u) => u.tenantId).length;
              const occupancyRate = units.length > 0 ? (occupied / units.length) * 100 : 0;
              const cover = getCover(p.id);

              const occState = occupancyRate === 100 ? 'full' : occupancyRate > 0 ? 'partial' : 'empty';
              const renditeState = rendite >= 4 ? 'good' : rendite >= 2.5 ? 'medium' : 'low';

              return (
                <div
                  key={p.id}
                  className="group flex flex-col bg-card border border-card-line rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-[0_10px_28px_-8px_rgba(15,23,42,0.14)] hover:border-[#4F6BFF]/40 hover:-translate-y-0.5"
                  onClick={() => navigate(`/bh/objekte/${p.id}`)}
                >
                  {/* Cover — clean, with tiny status chip top-left only */}
                  <div className="relative aspect-[16/9] overflow-hidden bg-card-line/30">
                    {cover ? (
                      <img
                        src={cover}
                        alt={p.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <Building2 size={32} className="text-slate-400" strokeWidth={1.5} />
                      </div>
                    )}
                    {/* Single subtle status chip (no overlay needed since cover is decoupled from title) */}
                    <div className="absolute top-3 left-3">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold backdrop-blur-md',
                        occState === 'full' && 'bg-emerald-500/90 text-white',
                        occState === 'partial' && 'bg-amber-500/90 text-white',
                        occState === 'empty' && 'bg-rose-500/90 text-white',
                      )}>
                        <span className="size-1.5 rounded-full bg-white/95" />
                        {occState === 'full' ? 'Vollbelegt' : occState === 'partial' ? 'Teilbelegt' : 'Leerstand'}
                      </span>
                    </div>
                  </div>

                  {/* Body — clear hierarchy */}
                  <div className="flex-1 flex flex-col p-4">
                    {/* Title block */}
                    <div className="mb-3.5">
                      <h3 className="text-[15.5px] font-semibold text-foreground leading-snug tracking-tight line-clamp-1 group-hover:text-[#4F6BFF] transition-colors">
                        {p.name}
                      </h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={12} className="text-muted-foreground shrink-0" />
                        <span className="text-[12px] text-muted-foreground truncate">{p.address}</span>
                      </div>
                    </div>

                    {/* KPI cells — 2x2 grid in a tinted container */}
                    <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden bg-card-line/60 mb-3.5">
                      <KpiCell label="Marktwert" value={`${fmt(p.currentValue)} €`} />
                      <KpiCell label="Miete / Monat" value={`${fmt(monthlyRent)} €`} />
                      <KpiCell label="Einheiten" value={`${units.length}`} sub={`${occupied} belegt`} />
                      <KpiCell
                        label="Bruttorendite"
                        value={`${rendite.toFixed(1)} %`}
                        valueClass={cn(
                          renditeState === 'good' && 'text-emerald-600',
                          renditeState === 'medium' && 'text-amber-600',
                          renditeState === 'low' && 'text-rose-600',
                        )}
                      />
                    </div>

                    {/* Occupancy bar pinned to bottom */}
                    <div className="mt-auto">
                      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-1.5">
                        <span>Belegung</span>
                        <span className="tabular-nums">{occupied}/{units.length}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full overflow-hidden bg-card-line/80">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            occState === 'full' && 'bg-emerald-500',
                            occState === 'partial' && 'bg-amber-500',
                            occState === 'empty' && 'bg-rose-500',
                          )}
                          style={{ width: `${Math.max(occupancyRate, occState === 'empty' ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
            </div>
          ) : (
            <>
          {/* ─── LIST VIEW ─── */}
          <div className="hidden md:block overflow-hidden" data-tour="property-list">
            <div className="grid grid-cols-[56px_minmax(0,2.5fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_160px] gap-4 px-5 sm:px-7 py-2.5 border-b border-card-divider">
              <div />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Objekt</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Adresse</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Kaufpreis</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Miete/M</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Rendite</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Belegung</p>
            </div>
            <div className="divide-y divide-card-divider">
              {filtered.map((p) => {
                const units = allUnits.filter((u) => u.propertyId === p.id);
                const monthlyRent = units.reduce((s, u) => s + u.currentRent, 0);
                const yearlyRent = monthlyRent * 12;
                const rendite = p.purchasePrice > 0 ? (yearlyRent / p.purchasePrice) * 100 : 0;
                const occupied = units.filter((u) => u.tenantId).length;
                const occupancyRate = units.length > 0 ? (occupied / units.length) * 100 : 0;
                const cover = getCover(p.id);

                return (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/bh/objekte/${p.id}`)}
                    className="grid grid-cols-[56px_minmax(0,2.5fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_160px] gap-4 px-5 sm:px-7 py-3.5 items-center cursor-pointer hover:bg-layer-hover transition-colors group"
                  >
                    {/* Thumbnail */}
                    <div className="size-11 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-[#4F6BFF] to-[#8B9FFF] flex items-center justify-center">
                      {cover ? (
                        <img src={cover} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 size={18} className="text-white/70" />
                      )}
                    </div>

                    {/* Name + units */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-[#4F6BFF] transition-colors">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Home size={11} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{units.length} {units.length === 1 ? 'Einheit' : 'Einheiten'}</span>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="min-w-0 flex items-center gap-1.5">
                      <MapPin size={12} className="text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground truncate">{p.address}</span>
                    </div>

                    {/* Purchase price */}
                    <p className="text-sm font-semibold tabular-nums text-foreground text-right">{fmt(p.purchasePrice)} €</p>

                    {/* Monthly rent */}
                    <p className="text-sm font-semibold tabular-nums text-foreground text-right">{fmt(monthlyRent)} €</p>

                    {/* Rendite badge */}
                    <div className="flex justify-end">
                      <div className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold tabular-nums',
                        rendite >= 4
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                          : rendite >= 2.5
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                      )}>
                        <TrendingUp size={11} />
                        {rendite.toFixed(1)}%
                      </div>
                    </div>

                    {/* Occupancy */}
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex items-center gap-1">
                        <Users size={11} className="text-muted-foreground" />
                        <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{occupied}/{units.length}</span>
                      </div>
                      <div className="w-14 h-1.5 rounded-full overflow-hidden bg-muted/80">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${occupancyRate}%`,
                            background: occupancyRate === 100 ? 'var(--success)' : occupancyRate >= 50 ? 'var(--warning)' : 'var(--danger)',
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-8 text-right">{Math.round(occupancyRate)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── LIST VIEW · MOBILE (stacked rows) ─── */}
          <div className="md:hidden divide-y divide-card-divider" data-tour="property-list">
            {filtered.map((p) => {
              const units = allUnits.filter((u) => u.propertyId === p.id);
              const monthlyRent = units.reduce((s, u) => s + u.currentRent, 0);
              const yearlyRent = monthlyRent * 12;
              const rendite = p.purchasePrice > 0 ? (yearlyRent / p.purchasePrice) * 100 : 0;
              const occupied = units.filter((u) => u.tenantId).length;
              const cover = getCover(p.id);

              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/bh/objekte/${p.id}`)}
                  className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-layer-hover transition-colors"
                >
                  <div className="size-12 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-[#4F6BFF] to-[#8B9FFF] flex items-center justify-center">
                    {cover ? (
                      <img src={cover} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 size={20} className="text-white/70" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.address}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{fmt(monthlyRent)} €/M</span>
                      <span className="text-[11px] text-muted-foreground">·</span>
                      <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{occupied}/{units.length}</span>
                    </div>
                  </div>
                  <div className={cn(
                    'shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold tabular-nums',
                    rendite >= 4
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                      : rendite >= 2.5
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                  )}>
                    <TrendingUp size={11} />
                    {rendite.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>

            </>
          )}

          {/* Footer */}
          <div className="px-5 sm:px-7 py-3 border-t border-card-divider">
            <p className="text-[11.5px] text-muted-foreground tabular-nums">
              {filtered.length} von {properties.length} {properties.length === 1 ? 'Objekt' : 'Objekte'}
            </p>
          </div>
        </div>
      )}

      {showForm && (
        <PropertyForm
          onClose={() => setShowForm(false)}
          onSave={(data) => { createProperty(data); setShowForm(false); }}
        />
      )}
    </div>
  );
}

/**
 * Kompakte KPI-Zelle fürs neue Property-Card-Layout: Label oben (uppercase tiny),
 * Value mittig (sm font-semibold), optionaler Sub-Hint darunter (xs muted).
 * Liegt in einem Grid mit `gap-px` + `bg-card-line/60` auf der Card → ergibt
 * sauber getrennte Zellen ohne harte Border.
 */
function KpiCell({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-card p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">{label}</p>
      <p className={cn('text-[14px] font-semibold tabular-nums text-foreground mt-1.5 leading-tight', valueClass)}>
        {value}
      </p>
      {sub && (
        <p className="text-[10.5px] text-muted-foreground tabular-nums mt-0.5 leading-tight">{sub}</p>
      )}
    </div>
  );
}
