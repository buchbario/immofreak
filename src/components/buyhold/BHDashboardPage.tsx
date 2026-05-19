import {
  Building2, ArrowRight, Home, Users, Wallet, Percent, Plus,
  UserPlus, Receipt, BarChart3, Clock,
  FileText, KeyRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useTenants } from '../../hooks/useTenants';
import { useUtilities } from '../../hooks/useUtilities';
import { useRentalContracts } from '../../hooks/useRentalContracts';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LocaleContext';
import { QuickTaskWidget } from '../shared/QuickTaskWidget';
import { cn } from '../../lib/utils';

const dateFmtRelativeShort = new Intl.RelativeTimeFormat('de-DE', { numeric: 'auto' });

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = then - now;
  const min = Math.round(diffMs / 60000);
  const hr = Math.round(diffMs / 3600000);
  const day = Math.round(diffMs / 86400000);
  if (Math.abs(min) < 60) return dateFmtRelativeShort.format(min, 'minute');
  if (Math.abs(hr) < 24)  return dateFmtRelativeShort.format(hr, 'hour');
  return dateFmtRelativeShort.format(day, 'day');
}

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
const fmtEur = (n: number) => `${fmt(n)} €`;

type OccupancyKind = 'voll' | 'teil' | 'leer';

const OCC_CFG: Record<OccupancyKind, { label: string; marker: string; iconBg: string; iconColor: string; tagBg: string; tagText: string }> = {
  voll: { label: 'Vollbelegt',  marker: 'bg-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-500/15', iconColor: 'text-emerald-700 dark:text-emerald-300', tagBg: 'bg-emerald-100 dark:bg-emerald-500/15', tagText: 'text-neutral-900' },
  teil: { label: 'Teilbelegt',  marker: 'bg-amber-500',   iconBg: 'bg-amber-100 dark:bg-amber-500/15',     iconColor: 'text-amber-700 dark:text-amber-300',     tagBg: 'bg-amber-100 dark:bg-amber-500/15',     tagText: 'text-neutral-900' },
  leer: { label: 'Leerstand',   marker: 'bg-rose-500',    iconBg: 'bg-rose-100 dark:bg-rose-500/15',       iconColor: 'text-rose-700 dark:text-rose-300',       tagBg: 'bg-rose-100 dark:bg-rose-500/15',       tagText: 'text-neutral-900' },
};

function classifyOccupancy(occupiedCount: number, totalCount: number): OccupancyKind {
  if (totalCount === 0) return 'leer';
  if (occupiedCount === 0) return 'leer';
  if (occupiedCount >= totalCount) return 'voll';
  return 'teil';
}

export function BHDashboardPage() {
  const navigate = useNavigate();
  const { userName } = useAuth();
  const { t } = useTranslation();
  const firstName = (userName || 'da').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 11 ? t('greeting.morning') : hour < 18 ? t('greeting.day') : t('greeting.evening');
  const { properties } = useRentalProperties();
  const { allUnits, totalMonthlyRent, vacancyRate, occupiedUnits } = useRentalUnits();
  const { allTenants } = useTenants();
  const { totalMonthlyAdvance } = useUtilities();
  const { allContracts } = useRentalContracts();

  void totalMonthlyAdvance;

  const totalValue = properties.reduce((s, p) => s + p.currentValue, 0);
  const totalPurchase = properties.reduce((s, p) => s + p.purchasePrice, 0);
  const yearlyRent = totalMonthlyRent * 12;
  const bruttoRendite = totalPurchase > 0 ? (yearlyRent / totalPurchase) * 100 : 0;
  const instandhaltung = totalPurchase * 0.01;
  const verwaltung = allUnits.length * 25 * 12;
  const mietausfall = yearlyRent * 0.03;
  const nichtUmlagefaehig = instandhaltung + verwaltung + mietausfall;
  const kaufpreisMitNK = totalPurchase * 1.12;
  const nettoRendite = kaufpreisMitNK > 0 ? ((yearlyRent - nichtUmlagefaehig) / kaufpreisMitNK) * 100 : 0;
  // Wertentwicklung Marktwert vs Kaufpreis (für Mini-Bar in Gesamtwert-KPI)
  const valueGrowth = totalPurchase > 0 ? ((totalValue - totalPurchase) / totalPurchase) * 100 : 0;
  const valueGrowthCapped = Math.max(0, Math.min(100, 50 + valueGrowth)); // 0% growth = 50% bar

  // (Belegungs-Pipeline-Stufen wurden im aktuellen Layout entfernt.)

  // Occupancy classification for filter chips
  const propertyOccupancy = properties.map(p => {
    const units = allUnits.filter(u => u.propertyId === p.id);
    const occ = units.filter(u => allTenants.some(t => t.unitId === u.id));
    return { property: p, units, occ, kind: classifyOccupancy(occ.length, units.length) };
  });
  const occupancyCounts = {
    voll: propertyOccupancy.filter(p => p.kind === 'voll').length,
    teil: propertyOccupancy.filter(p => p.kind === 'teil').length,
    leer: propertyOccupancy.filter(p => p.kind === 'leer').length,
  };

  // Aktivität — jüngste Mieter / Verträge
  const recentTenants = [...allTenants].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2);
  const recentContracts = [...allContracts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2);
  const recentActivity: { id: string; kind: 'tenant' | 'contract'; date: string; data: any }[] = [
    ...recentTenants.map(t => ({ id: `t-${t.id}`, kind: 'tenant' as const, date: t.createdAt, data: t })),
    ...recentContracts.map(c => ({ id: `c-${c.id}`, kind: 'contract' as const, date: c.createdAt, data: c })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  if (properties.length === 0) {
    return (
      <div className="page-container">
        {/* WELCOME GREETING — auch im Empty-State */}
        <div className="mb-7 sm:mb-9 px-1">
          <h1 className="text-[34px] sm:text-[42px] font-bold text-[#0f172a] tracking-tight leading-[1.1] mb-2 inline-flex items-center gap-3 flex-wrap">
            <span className="bg-[#dbe5ff] px-3 py-1 rounded-lg inline-block">
              {greeting}, {firstName}!
            </span>
            <span className="text-[30px] sm:text-[36px]" role="img" aria-label="wave">👋</span>
          </h1>
          <p className="text-[18px] sm:text-[22px] text-muted-foreground/80 leading-relaxed font-light">
            Willkommen bei Buy &amp; Hold. Lege dein erstes Mietobjekt an.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { icon: Plus,      label: 'Objekt anlegen', desc: 'Starte dein Portfolio', to: '/bh/objekte', primary: true, bg: 'bg-[#4F6BFF] hover:bg-[#3D56E0]', iconBg: 'bg-white/15', iconText: 'text-white', titleText: 'text-white', subText: 'text-white/65' },
            { icon: UserPlus,  label: 'Mieter anlegen', desc: 'Mieter-Stammdaten erfassen', to: '/bh/mieter', bg: 'bg-[#E8DAFF] hover:bg-[#DAC5FF]', iconBg: 'bg-white/60', iconText: 'text-[#3D1F5A]', titleText: 'text-[#3D1F5A]', subText: 'text-[#3D1F5A]/65' },
            { icon: Receipt,   label: 'Transaktionen', desc: 'Banking & Buchungen', to: '/bh/transaktionen', bg: 'bg-[#D6F0DC] hover:bg-[#BFE6C9]', iconBg: 'bg-white/60', iconText: 'text-[#1A4D2C]', titleText: 'text-[#1A4D2C]', subText: 'text-[#1A4D2C]/65' },
            { icon: BarChart3, label: 'Berichte', desc: 'Auswertungen & Analysen', to: '/bh/berichte', bg: 'bg-[#FFF1CC] hover:bg-[#FCE9B4]', iconBg: 'bg-white/60', iconText: 'text-[#5A4A1A]', titleText: 'text-[#5A4A1A]', subText: 'text-[#5A4A1A]/65' },
          ].map(a => (
            <button
              key={a.to}
              onClick={() => navigate(a.to)}
              className={cn(
                'group relative flex flex-col items-start text-left p-5 rounded-2xl transition-all cursor-pointer min-h-[128px] hover:-translate-y-0.5',
                a.bg,
              )}
            >
              <div className={cn('size-10 rounded-xl flex items-center justify-center mb-3', a.iconBg, a.iconText)}>
                <a.icon size={18} strokeWidth={2.1} />
              </div>
              <p className={cn('text-[14.5px] font-semibold leading-tight mb-1', a.titleText)}>{a.label}</p>
              <p className={cn('text-[12px] leading-relaxed', a.subText)}>{a.desc}</p>
              <span className={cn(
                'absolute right-4 bottom-4 size-7 rounded-full flex items-center justify-center transition-all opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5',
                a.primary ? 'bg-white/15 text-white' : 'bg-white/70 text-current',
              )}>
                <ArrowRight size={13} strokeWidth={2.2} />
              </span>
            </button>
          ))}
        </div>

        <div className="bg-card border border-card-line rounded-2xl p-8 sm:p-12 flex flex-col items-center text-center">
          <div className="size-12 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center mb-3">
            <Building2 size={22} className="text-[#4F6BFF]" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">Noch keine Objekte</p>
          <p className="text-xs text-muted-foreground mb-4">Lege dein erstes Mietobjekt an, um dein Portfolio aufzubauen.</p>
          <button onClick={() => navigate('/bh/objekte')} className="btn btn-md btn-primary"><Plus size={15} /> Objekt anlegen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* WELCOME GREETING — Stratify-style */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-7 sm:mb-9 px-1">
        <div className="min-w-0">
          <h1 className="text-[34px] sm:text-[42px] font-bold text-[#0f172a] tracking-tight leading-[1.1] mb-2 inline-flex items-center gap-3 flex-wrap">
            <span className="bg-[#dbe5ff] px-3 py-1 rounded-lg inline-block">
              {greeting}, {firstName}!
            </span>
            <span className="text-[30px] sm:text-[36px]" role="img" aria-label="wave">👋</span>
          </h1>
          <p className="text-[18px] sm:text-[22px] text-muted-foreground/80 leading-relaxed font-light">
            {properties.length === 0
              ? t('bhdashboard.greeting.subtitle.empty')
              : t('bhdashboard.greeting.subtitle.with', {
                  count: properties.length,
                  objWord: t(properties.length === 1 ? 'word.property.singular' : 'word.property.plural'),
                })}
          </p>
        </div>
        <button onClick={() => navigate('/bh/objekte')} className="btn btn-md btn-primary shrink-0 mt-2">
          <Plus size={15} />
          <span className="hidden sm:inline">{t('property.cta.create')}</span>
          <span className="sm:hidden">{t('common.new')}</span>
        </button>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8" data-tour="bh-kpis">
        {/* Gesamtwert */}
        <KpiCard
          icon={<Home size={14} />}
          iconClass="bg-[#4F6BFF]/10 text-[#4F6BFF]"
          label="Gesamtwert"
        >
          <p className="text-2xl sm:text-[28px] leading-[1.1] font-bold text-foreground tabular-nums tracking-tight">{fmtEur(totalValue)}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
            <span className="truncate">Kaufpreis: <span className="tabular-nums">{fmtEur(totalPurchase)}</span></span>
            <span className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums',
              valueGrowth >= 0
                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15'
                : 'text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/15',
            )}>
              {valueGrowth >= 0 ? '▲' : '▼'} {Math.abs(valueGrowth).toFixed(1)}%
            </span>
          </div>
          <div className="mt-3 h-1 bg-layer-hover rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-700', valueGrowth >= 0 ? 'bg-emerald-500' : 'bg-rose-500')}
              style={{ width: `${valueGrowthCapped}%` }} />
          </div>
        </KpiCard>

        {/* Mieteinnahmen */}
        <KpiCard
          icon={<Wallet size={14} />}
          iconClass="bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          label="Mieteinnahmen"
        >
          <p className="text-2xl sm:text-[28px] leading-[1.1] font-bold text-foreground tabular-nums tracking-tight">
            {fmt(totalMonthlyRent)}<span className="text-base font-medium text-muted-foreground ml-1">€/M</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">{fmtEur(yearlyRent)} p.a.</p>
        </KpiCard>

        {/* Belegung */}
        <KpiCard
          icon={<Users size={14} />}
          iconClass="bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400"
          label="Belegung"
        >
          <p className="text-2xl sm:text-[28px] leading-[1.1] font-bold text-foreground tabular-nums tracking-tight">
            {occupiedUnits.length}<span className="text-base font-medium text-muted-foreground ml-1">/ {allUnits.length}</span>
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
            <span>Einheiten belegt</span>
            <span className="font-semibold text-foreground tabular-nums">{(100 - vacancyRate).toFixed(0)}%</span>
          </div>
          <div className="mt-3 h-1 bg-layer-hover rounded-full overflow-hidden">
            <div className={cn(
              'h-full rounded-full transition-all duration-700',
              vacancyRate > 20 ? 'bg-rose-500' : vacancyRate > 10 ? 'bg-amber-500' : 'bg-emerald-500',
            )} style={{ width: `${100 - vacancyRate}%` }} />
          </div>
        </KpiCard>

        {/* Rendite — uniform style */}
        <KpiCard
          icon={<Percent size={14} />}
          iconClass="bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          label="Rendite"
        >
          <p className="text-2xl sm:text-[28px] leading-[1.1] font-bold text-foreground tabular-nums tracking-tight">{bruttoRendite.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1.5">Netto {nettoRendite.toFixed(1)}%</p>
        </KpiCard>
      </div>

      {/* SUGGESTED ACTIONS — pastell-getönte Action-Cards mit Arrow rechts unten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {[
          { icon: Plus,      title: 'Neues Objekt', sub: `${properties.length} ${properties.length === 1 ? 'Objekt' : 'Objekte'} im Portfolio`, to: '/bh/objekte', primary: true, bg: 'bg-[#4F6BFF] hover:bg-[#3D56E0]', iconBg: 'bg-white/15', iconText: 'text-white', titleText: 'text-white', subText: 'text-white/65' },
          { icon: UserPlus,  title: 'Neuer Mieter', sub: `${allTenants.length} ${allTenants.length === 1 ? 'Mieter' : 'Mieter'} verwaltet`, to: '/bh/mieter', bg: 'bg-[#E8DAFF] hover:bg-[#DAC5FF]', iconBg: 'bg-white/60', iconText: 'text-[#3D1F5A]', titleText: 'text-[#3D1F5A]', subText: 'text-[#3D1F5A]/65' },
          { icon: Receipt,   title: 'Transaktionen', sub: 'Banking & Mieteingänge tracken', to: '/bh/transaktionen', bg: 'bg-[#D6F0DC] hover:bg-[#BFE6C9]', iconBg: 'bg-white/60', iconText: 'text-[#1A4D2C]', titleText: 'text-[#1A4D2C]', subText: 'text-[#1A4D2C]/65' },
          { icon: BarChart3, title: 'Berichte', sub: 'Auswertungen & Renditeanalyse', to: '/bh/berichte', bg: 'bg-[#FFF1CC] hover:bg-[#FCE9B4]', iconBg: 'bg-white/60', iconText: 'text-[#5A4A1A]', titleText: 'text-[#5A4A1A]', subText: 'text-[#5A4A1A]/65' },
        ].map(a => (
          <button
            key={a.to}
            onClick={() => navigate(a.to)}
            className={cn(
              'group relative flex flex-col items-start text-left p-5 rounded-2xl transition-all cursor-pointer min-h-[128px] hover:-translate-y-0.5',
              a.bg,
            )}
          >
            <div className={cn('size-10 rounded-xl flex items-center justify-center mb-3 transition-colors', a.iconBg, a.iconText)}>
              <a.icon size={18} strokeWidth={2.1} />
            </div>
            <p className={cn('text-[14.5px] font-semibold leading-tight mb-1', a.titleText)}>{a.title}</p>
            <p className={cn('text-[12px] leading-relaxed', a.subText)}>{a.sub}</p>
            <span className={cn(
              'absolute right-4 bottom-4 size-7 rounded-full flex items-center justify-center transition-all opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5',
              a.primary ? 'bg-white/15 text-white' : 'bg-white/70 text-current',
            )}>
              <ArrowRight size={13} strokeWidth={2.2} />
            </span>
          </button>
        ))}
      </div>
      {/* TWO-COLUMN: PROPERTIES + SIDE STACK */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4 sm:gap-5">
        {/* Properties panel */}
        <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Objekte</h2>
              <span className="text-[13px] text-muted-foreground/80">{properties.length} gesamt</span>
            </div>
            <button onClick={() => navigate('/bh/objekte')} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Alle anzeigen <ArrowRight size={12} />
            </button>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap px-5 sm:px-6 pb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#4F6BFF]/10 text-[#4F6BFF]">
              Alle <span className="text-[11px] font-semibold opacity-80 tabular-nums">{properties.length}</span>
            </span>
            {(['voll', 'teil', 'leer'] as const).map(kind => {
              const cnt = occupancyCounts[kind];
              if (cnt === 0) return null;
              const cfg = OCC_CFG[kind];
              return (
                <span key={kind} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-layer-hover text-foreground/80">
                  <span className={cn('size-1.5 rounded-full', cfg.marker)} />
                  {cfg.label}
                  <span className="text-[11px] font-semibold opacity-60 tabular-nums">{cnt}</span>
                </span>
              );
            })}
          </div>

          {/* Property rows — kompakte Cards mit klarer Hierarchie (wie FF) */}
          <div className="px-3 sm:px-4 pb-4 space-y-2.5">
            {propertyOccupancy.map(({ property: p, units, occ, kind }) => {
              const cfg = OCC_CFG[kind];
              const rent = units.reduce((s, u) => s + u.currentRent, 0);
              const rendite = p.purchasePrice > 0 ? ((rent * 12) / p.purchasePrice) * 100 : 0;
              const occupancyPct = units.length > 0 ? Math.round((occ.length / units.length) * 100) : 0;
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/bh/objekte/${p.id}`)}
                  className="group relative rounded-xl border border-card-line bg-card hover:border-[#4F6BFF]/40 hover:shadow-[0_4px_12px_-4px_rgba(15,23,42,0.08)] transition-all cursor-pointer overflow-hidden p-3.5"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('size-10 rounded-xl flex items-center justify-center shrink-0', cfg.iconBg)}>
                      <Home size={17} className={cfg.iconColor} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <p className="text-[14px] font-semibold text-foreground tracking-tight truncate group-hover:text-[#4F6BFF] transition-colors">{p.name}</p>
                        <span className={cn('shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap', cfg.tagBg, cfg.tagText)}>
                          <span className={cn('size-1.5 rounded-full', cfg.marker)} />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-muted-foreground truncate mb-2.5">{p.address || '—'}</p>

                      <div className="flex items-end gap-x-6 gap-y-3 flex-wrap">
                        <div className="shrink-0">
                          <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-0.5">Miete/M</p>
                          <p className="text-[13px] font-bold text-foreground tabular-nums">{fmtEur(rent)}</p>
                        </div>
                        <div className="shrink-0">
                          <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-0.5">Marktwert</p>
                          <p className="text-[13px] font-bold text-foreground tabular-nums">{fmtEur(p.currentValue)}</p>
                        </div>
                        <div className="shrink-0">
                          <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-0.5">Rendite</p>
                          <p className={cn('text-[13px] font-bold tabular-nums', rendite >= 4 ? 'text-emerald-600 dark:text-emerald-400' : rendite >= 2.5 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-500')}>
                            {rendite.toFixed(1)}%
                          </p>
                        </div>
                        <div className="ml-auto w-full sm:w-[180px] md:w-[220px] shrink-0">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Belegt</span>
                            <span className="text-[11px] font-bold text-foreground tabular-nums">{occ.length}/{units.length}</span>
                          </div>
                          <div className="h-1.5 bg-layer-hover rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-700',
                                occupancyPct === 100 ? 'bg-emerald-500' : occupancyPct > 0 ? 'bg-amber-500' : 'bg-rose-500',
                              )}
                              style={{ width: `${Math.max(2, occupancyPct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side stack: Tasks + Activity */}
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Aufgaben — Quick-Capture-Widget */}
          <QuickTaskWidget mode="buyhold" viewAllHref="/bh/aufgaben" accent="emerald" />

          {/* Aktivität */}
          <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 pb-3">
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Aktivität</h2>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/60">
                {recentActivity.length} {recentActivity.length === 1 ? 'Eintrag' : 'Einträge'}
              </span>
            </div>
            <div className="px-5 sm:px-6 pb-4">
              {recentActivity.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-muted-foreground">Noch keine Aktivität.</p>
                </div>
              ) : (
                <ul className="divide-y divide-card-divider">
                  {recentActivity.map((entry) => {
                    if (entry.kind === 'tenant') {
                      const tenant = entry.data;
                      const property = tenant.propertyId ? properties.find(p => p.id === tenant.propertyId) : undefined;
                      return (
                        <li key={entry.id} className="flex items-start gap-3 py-3">
                          <div className="size-7 rounded-md grid place-items-center shrink-0 mt-px bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-400">
                            <KeyRound size={13} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12.5px] text-foreground/85 leading-snug">
                              Mieter <span className="font-semibold text-foreground">{tenant.name}</span> {property ? <>für <span className="font-semibold text-foreground">{property.name}</span> </> : ''}angelegt.
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                              <Clock size={10} />
                              <span>{formatRelative(entry.date)}</span>
                              {property && (
                                <>
                                  <span className="size-[3px] rounded-full bg-muted-foreground/40" />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); navigate(`/bh/objekte/${property.id}`); }}
                                    className="text-[#4F6BFF] font-medium hover:underline"
                                  >
                                    Objekt öffnen
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    }
                    // contract
                    const contract = entry.data;
                    const property = properties.find(p => p.id === contract.propertyId);
                    const tenant = allTenants.find(t => t.id === contract.tenantId);
                    return (
                      <li key={entry.id} className="flex items-start gap-3 py-3">
                        <div className="size-7 rounded-md grid place-items-center shrink-0 mt-px bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                          <FileText size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] text-foreground/85 leading-snug">
                            Mietvertrag {tenant ? <>mit <span className="font-semibold text-foreground">{tenant.name}</span> </> : ''}{property ? <>für <span className="font-semibold text-foreground">{property.name}</span> </> : ''}angelegt.
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                            <Clock size={10} />
                            <span>{formatRelative(entry.date)}</span>
                            <span className="size-[3px] rounded-full bg-muted-foreground/40" />
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/bh/mietvertraege/${contract.id}`); }}
                              className="text-[#4F6BFF] font-medium hover:underline"
                            >
                              Vertrag öffnen
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable KPI card shell
function KpiCard({ icon, iconClass, label, children }: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative bg-card border border-card-line rounded-2xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_1px_3px_rgba(15,23,42,0.05)] hover:-translate-y-px transition-all cursor-default">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <span className={cn('shrink-0 inline-flex justify-center items-center size-7 rounded-lg', iconClass)}>
          {icon}
        </span>
        <span className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}
