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
      <div className="page-header">
        <div>
          <h1 className="page-title">Mietobjekte</h1>
          <p className="page-subtitle">{properties.length} Objekte im Portfolio</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex items-center bg-card border border-card-line rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex items-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all cursor-pointer',
                viewMode === 'grid'
                  ? 'bg-[#4F6BFF] text-white'
                  : 'text-muted-foreground-2 hover:text-foreground'
              )}
              title="Kachel-Ansicht"
            >
              <LayoutGrid size={14} />
              Kacheln
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all cursor-pointer',
                viewMode === 'list'
                  ? 'bg-[#4F6BFF] text-white'
                  : 'text-muted-foreground-2 hover:text-foreground'
              )}
              title="Listen-Ansicht"
            >
              <List size={14} />
              Liste
            </button>
          </div>
          <button onClick={() => setShowForm(true)} className="btn btn-md btn-primary">
            <Plus size={15} /> <span className="hidden sm:inline">Objekt anlegen</span><span className="sm:hidden">Neu</span>
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input placeholder="Suchen..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="surface empty-state">
          <div className="size-14 rounded-2xl flex items-center justify-center mb-4 bg-layer-hover">
            <Building2 size={22} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold mb-1 text-foreground">Keine Objekte</p>
          <p className="text-sm mb-5 text-muted-foreground-2">Lege dein erstes Mietobjekt an.</p>
          <button onClick={() => setShowForm(true)} className="btn btn-md btn-primary">Objekt anlegen</button>
        </div>
      ) : viewMode === 'grid' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" data-tour="property-list">
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
                  className="group bg-card border border-card-line rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:border-[#4F6BFF]/30 hover:-translate-y-0.5"
                  onClick={() => navigate(`/bh/objekte/${p.id}`)}
                >
                  {/* Cover */}
                  <div className="relative h-40 overflow-hidden">
                    {cover ? (
                      <img
                        src={cover}
                        alt={p.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#4F6BFF] via-[#6B7FFF] to-[#8B9FFF] flex items-center justify-center">
                        <div className="size-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
                          <Building2 size={28} className="text-white/70" />
                        </div>
                      </div>
                    )}
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                    {/* Rendite badge */}
                    <div className={cn(
                      'absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-bold backdrop-blur-md',
                      rendite >= 4
                        ? 'bg-emerald-500/90 text-white'
                        : rendite >= 2.5
                          ? 'bg-amber-500/90 text-white'
                          : 'bg-red-500/90 text-white'
                    )}>
                      <div className="flex items-center gap-1">
                        <TrendingUp size={11} />
                        {rendite.toFixed(1)}%
                      </div>
                    </div>

                    {/* Title on cover */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-[15px] font-bold text-white truncate drop-shadow-md">{p.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <MapPin size={11} className="text-white/70" />
                        <span className="text-xs text-white/80 truncate">{p.address}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Kaufpreis</p>
                        <p className="text-sm font-bold tabular-nums text-foreground">{fmt(p.purchasePrice)} €</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Marktwert</p>
                        <p className="text-sm font-bold tabular-nums text-foreground">{fmt(p.currentValue)} €</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Miete/M</p>
                        <p className="text-sm font-bold tabular-nums text-foreground">{fmt(monthlyRent)} €</p>
                      </div>
                    </div>

                    {/* Footer row */}
                    <div className="flex items-center justify-between pt-3 border-t border-card-divider">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Home size={13} className="text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">{units.length} Einheiten</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users size={13} className="text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">{occupied}/{units.length}</span>
                        </div>
                      </div>
                      {/* Occupancy bar */}
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 rounded-full overflow-hidden bg-muted/80">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${occupancyRate}%`,
                              background: occupancyRate === 100 ? 'var(--success)' : occupancyRate >= 50 ? 'var(--warning)' : 'var(--danger)',
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{Math.round(occupancyRate)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5">
            <p className="text-xs text-muted-foreground">{filtered.length} von {properties.length} Objekte</p>
          </div>
        </>
      ) : (
        <>
          {/* ─── LIST VIEW ─── */}
          <div className="hidden md:block surface overflow-hidden" data-tour="property-list">
            <div className="grid grid-cols-[56px_minmax(0,2.5fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_160px] gap-4 px-5 py-3 border-b border-card-line bg-muted/30">
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
                    className="grid grid-cols-[56px_minmax(0,2.5fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_160px] gap-4 px-5 py-3 items-center cursor-pointer hover:bg-muted/30 transition-colors group"
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
          <div className="md:hidden space-y-2" data-tour="property-list">
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
                  className="flex items-center gap-3 p-3 bg-card border border-card-line rounded-xl cursor-pointer hover:border-[#4F6BFF]/30 transition-colors"
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

          <div className="mt-5">
            <p className="text-xs text-muted-foreground">{filtered.length} von {properties.length} Objekte</p>
          </div>
        </>
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
