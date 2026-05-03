import {
  Building2, ArrowRight, Home, Users, Wallet, Percent, Plus,
  UserPlus, Receipt, BarChart3, ChevronRight, Check, Clock,
  FileText, KeyRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useTenants } from '../../hooks/useTenants';
import { useUtilities } from '../../hooks/useUtilities';
import { useRentalContracts } from '../../hooks/useRentalContracts';
import { useTasks } from '../../hooks/useTasks';
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

function formatDueDate(iso: string): { label: string; tone: 'overdue' | 'today' | 'soon' | 'normal' } {
  const due = new Date(iso);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)} Tage überfällig`, tone: 'overdue' };
  if (days === 0) return { label: 'Heute fällig', tone: 'today' };
  if (days === 1) return { label: 'Morgen fällig', tone: 'soon' };
  if (days <= 7) return { label: `In ${days} Tagen`, tone: 'soon' };
  const fmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
  return { label: fmt.format(due), tone: 'normal' };
}

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
const fmtEur = (n: number) => `${fmt(n)} €`;

type OccupancyKind = 'voll' | 'teil' | 'leer';

const OCC_CFG: Record<OccupancyKind, { label: string; marker: string; iconBg: string; iconColor: string; tagBg: string; tagText: string }> = {
  voll: { label: 'Vollbelegt',  marker: 'bg-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-500/15', iconColor: 'text-emerald-700 dark:text-emerald-300', tagBg: 'bg-emerald-100 dark:bg-emerald-500/15', tagText: 'text-emerald-700 dark:text-emerald-300' },
  teil: { label: 'Teilbelegt',  marker: 'bg-amber-500',   iconBg: 'bg-amber-100 dark:bg-amber-500/15',     iconColor: 'text-amber-700 dark:text-amber-300',     tagBg: 'bg-amber-100 dark:bg-amber-500/15',     tagText: 'text-amber-700 dark:text-amber-300' },
  leer: { label: 'Leerstand',   marker: 'bg-rose-500',    iconBg: 'bg-rose-100 dark:bg-rose-500/15',       iconColor: 'text-rose-700 dark:text-rose-300',       tagBg: 'bg-rose-100 dark:bg-rose-500/15',       tagText: 'text-rose-700 dark:text-rose-300' },
};

function classifyOccupancy(occupiedCount: number, totalCount: number): OccupancyKind {
  if (totalCount === 0) return 'leer';
  if (occupiedCount === 0) return 'leer';
  if (occupiedCount >= totalCount) return 'voll';
  return 'teil';
}

export function BHDashboardPage() {
  const navigate = useNavigate();
  const { properties } = useRentalProperties();
  const { allUnits, totalMonthlyRent, vacancyRate, occupiedUnits } = useRentalUnits();
  const { allTenants } = useTenants();
  const { totalMonthlyAdvance } = useUtilities();
  const { allContracts } = useRentalContracts();
  const { allTasks, toggleStatus } = useTasks();

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

  // Belegungs-Pipeline-Stufen (4 Spalten)
  const vacantUnits = allUnits.filter(u => !allTenants.some(t => t.unitId === u.id));
  const avgUnitRent = allUnits.length > 0 ? totalMonthlyRent / Math.max(1, occupiedUnits.length) : 0;
  const lostRent = vacantUnits.reduce((s, u) => s + (u.targetRent || u.currentRent || avgUnitRent), 0);
  const befristeteContracts = allContracts.filter(c => c.contractType === 'befristet').length;
  const unbefristeteContracts = allContracts.filter(c => c.contractType === 'unbefristet').length;
  const stages: {
    key: string; label: string;
    markerClass: string; barClass: string;
    iconBg: string; iconColor: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    primary: string; sub: string; empty: boolean;
  }[] = [
    {
      key: 'vermietet',
      label: 'Vermietet',
      markerClass: 'bg-emerald-500',
      barClass: 'bg-emerald-500',
      iconBg: 'bg-emerald-100 dark:bg-emerald-500/15',
      iconColor: 'text-emerald-700 dark:text-emerald-300',
      Icon: KeyRound,
      primary: `${occupiedUnits.length} ${occupiedUnits.length === 1 ? 'Einheit' : 'Einheiten'}`,
      sub: `${fmtEur(totalMonthlyRent)} / Monat`,
      empty: occupiedUnits.length === 0,
    },
    {
      key: 'frei',
      label: 'Frei',
      markerClass: 'bg-rose-500',
      barClass: 'bg-rose-500',
      iconBg: 'bg-rose-100 dark:bg-rose-500/15',
      iconColor: 'text-rose-700 dark:text-rose-300',
      Icon: Home,
      primary: `${vacantUnits.length} ${vacantUnits.length === 1 ? 'Einheit' : 'Einheiten'}`,
      sub: vacantUnits.length > 0 ? `${fmtEur(lostRent)} entgangen / M` : 'Kein Leerstand',
      empty: vacantUnits.length === 0,
    },
    {
      key: 'befristet',
      label: 'Befristet',
      markerClass: 'bg-amber-500',
      barClass: 'bg-amber-500',
      iconBg: 'bg-amber-100 dark:bg-amber-500/15',
      iconColor: 'text-amber-700 dark:text-amber-300',
      Icon: Clock,
      primary: `${befristeteContracts} ${befristeteContracts === 1 ? 'Vertrag' : 'Verträge'}`,
      sub: 'mit Enddatum',
      empty: befristeteContracts === 0,
    },
    {
      key: 'unbefristet',
      label: 'Unbefristet',
      markerClass: 'bg-sky-500',
      barClass: 'bg-sky-500',
      iconBg: 'bg-sky-100 dark:bg-sky-500/15',
      iconColor: 'text-sky-700 dark:text-sky-300',
      Icon: FileText,
      primary: `${unbefristeteContracts} ${unbefristeteContracts === 1 ? 'Vertrag' : 'Verträge'}`,
      sub: 'ohne Enddatum',
      empty: unbefristeteContracts === 0,
    },
  ];
  const totalStageVolume = occupiedUnits.length + vacantUnits.length;

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

  // Tasks
  const openTasks = [...allTasks]
    .filter(t => t.status !== 'erledigt')
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    })
    .slice(0, 4);
  const overdueTasksCount = allTasks.filter(t => {
    if (t.status === 'erledigt' || !t.dueDate) return false;
    return new Date(t.dueDate).getTime() < Date.now();
  }).length;

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
        <div className="page-header">
          <div>
            <h1 className="page-title">Portfolio</h1>
            <p className="page-subtitle">Willkommen bei Buy &amp; Hold. Lege dein erstes Mietobjekt an.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { icon: Plus,      label: 'Objekt anlegen',     desc: 'Starte dein Portfolio',                to: '/bh/objekte',       primary: true },
            { icon: UserPlus,  label: 'Mieter anlegen',     desc: 'Mieter-Stammdaten erfassen',           to: '/bh/mieter' },
            { icon: Receipt,   label: 'Transaktionen',      desc: 'Banking & Buchungen',                  to: '/bh/transaktionen' },
            { icon: BarChart3, label: 'Berichte',           desc: 'Auswertungen & Analysen',              to: '/bh/berichte' },
          ].map(a => (
            <button key={a.to} onClick={() => navigate(a.to)} className={cn(
              'flex flex-col items-start gap-3 p-4 sm:p-5 rounded-xl border text-left transition-all cursor-pointer',
              a.primary
                ? 'bg-gradient-to-br from-[#4F6BFF] to-[#6B7FFF] border-[#4F6BFF] text-white shadow-md hover:shadow-lg hover:-translate-y-0.5'
                : 'bg-card border-card-line hover:border-[#4F6BFF]/30 hover:shadow-md hover:-translate-y-0.5'
            )}>
              <div className={cn('size-10 rounded-xl flex items-center justify-center', a.primary ? 'bg-white/20' : 'bg-[#4F6BFF]/10')}>
                <a.icon size={18} className={a.primary ? 'text-white' : 'text-[#4F6BFF]'} />
              </div>
              <div>
                <p className={cn('text-sm font-semibold', !a.primary && 'text-foreground')}>{a.label}</p>
                <p className={cn('text-xs mt-0.5', a.primary ? 'text-white/70' : 'text-muted-foreground')}>{a.desc}</p>
              </div>
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
      {/* HEADER CARD — matches the rest of the app's card-header pattern */}
      <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 sm:p-7 mb-4 sm:mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] sm:text-[26px] font-bold text-foreground tracking-tight leading-tight mb-1">
              Portfolio
            </h1>
            <p className="text-[13px] text-muted-foreground max-w-2xl leading-relaxed">
              Übersicht aller Mietobjekte mit Belegung, Mieteinnahmen, Rendite und aktuellen Mieter-Aktivitäten auf einen Blick.
            </p>
          </div>
          <button onClick={() => navigate('/bh/objekte')} className="btn btn-sm btn-primary shrink-0">
            <Plus size={14} />
            <span className="hidden sm:inline">Objekt anlegen</span>
            <span className="sm:hidden">Neu</span>
          </button>
        </div>
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

        {/* Rendite — featured */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#4F6BFF] to-[#6B5BFF] text-white rounded-2xl p-4 sm:p-5 shadow-[0_6px_20px_rgba(79,107,255,0.22)] hover:shadow-[0_8px_24px_rgba(79,107,255,0.28)] transition-all hover:-translate-y-px cursor-default">
          <div className="absolute -top-1/2 -right-1/4 w-[220px] h-[220px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)' }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <span className="shrink-0 inline-flex justify-center items-center size-7 rounded-lg bg-white/20">
                <Percent size={14} />
              </span>
              <span className="text-xs sm:text-sm font-medium text-white/85">Rendite</span>
            </div>
            <p className="text-2xl sm:text-[28px] leading-[1.1] font-bold tabular-nums tracking-tight">{bruttoRendite.toFixed(1)}%</p>
            <div className="flex items-center justify-between text-xs text-white/70 mt-1.5">
              <span>Netto <span className="font-semibold tabular-nums text-white">{nettoRendite.toFixed(1)}%</span></span>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                brutto
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PIPELINE / Belegungs-Übersicht — Stage-Cards mit Akzent-Strip */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4 px-1">
          <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Belegungs-Übersicht</h2>
          <button
            onClick={() => navigate('/bh/mietvertraege')}
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors shrink-0"
          >
            Verträge <ChevronRight size={12} />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stages.map((s) => {
            const widthPct = totalStageVolume > 0 && (s.key === 'vermietet' || s.key === 'frei')
              ? Math.round(((s.key === 'vermietet' ? occupiedUnits.length : vacantUnits.length) / totalStageVolume) * 100)
              : (s.empty ? 0 : 100);
            return (
              <button
                key={s.key}
                onClick={() => navigate(s.key === 'befristet' || s.key === 'unbefristet' ? '/bh/mietvertraege' : '/bh/objekte')}
                className={cn(
                  'group relative text-left cursor-pointer overflow-hidden rounded-2xl bg-card border border-card-line p-4 transition-all',
                  'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
                  s.empty
                    ? 'opacity-70 hover:opacity-100'
                    : 'hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]',
                )}
              >
                <div
                  aria-hidden
                  className={cn('absolute left-0 right-0 top-0 h-[3px]', s.empty ? 'bg-muted-foreground/15' : s.barClass)}
                />

                <div className="flex items-center gap-1.5 mb-3">
                  <span className={cn('size-1.5 rounded-full shrink-0', s.empty ? 'bg-muted-foreground/30' : s.markerClass)} />
                  <span className="text-[12px] font-semibold text-foreground/80 truncate">{s.label}</span>
                </div>

                <p className={cn(
                  'text-[20px] leading-[1.1] tabular-nums tracking-tight font-bold mb-1',
                  s.empty ? 'text-muted-foreground/50' : 'text-foreground',
                )}>
                  {s.empty ? '—' : s.primary}
                </p>
                <p className="text-[10.5px] text-muted-foreground tabular-nums">
                  {s.empty ? 'Keine Einträge' : s.sub}
                </p>

                <div className="mt-3 h-[3px] bg-layer-hover rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', s.empty ? 'bg-muted-foreground/20' : s.barClass)}
                    style={{ width: s.empty ? '0%' : `${Math.max(10, widthPct)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="flex items-baseline justify-between mx-1 mb-3.5">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Schnellzugriff</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6 sm:mb-8">
        {[
          { icon: Plus,      title: 'Objekt anlegen',  sub: `${properties.length} ${properties.length === 1 ? 'Objekt' : 'Objekte'}`, to: '/bh/objekte' },
          { icon: UserPlus,  title: 'Mieter anlegen',  sub: `${allTenants.length} ${allTenants.length === 1 ? 'Mieter' : 'Mieter'}`,  to: '/bh/mieter' },
          { icon: Receipt,   title: 'Transaktionen',   sub: 'Banking & Buchungen',                                                    to: '/bh/transaktionen' },
          { icon: BarChart3, title: 'Berichte',        sub: 'Auswertungen',                                                           to: '/bh/berichte' },
        ].map(a => (
          <button
            key={a.to}
            onClick={() => navigate(a.to)}
            className="group flex items-center gap-3 px-4 py-3.5 bg-card border border-card-line rounded-[10px] text-left hover:-translate-y-px transition-all cursor-pointer hover:shadow-[0_4px_12px_rgba(79,107,255,0.12)]"
          >
            <div className="size-8 rounded-lg bg-layer-hover text-foreground/70 group-hover:bg-[#4F6BFF]/10 group-hover:text-[#4F6BFF] flex items-center justify-center shrink-0 transition-colors">
              <a.icon size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground leading-tight truncate">{a.title}</p>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">{a.sub}</p>
            </div>
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

          {/* Property rows */}
          <div className="px-2 pb-3">
            {propertyOccupancy.map(({ property: p, units, occ, kind }) => {
              const cfg = OCC_CFG[kind];
              const rent = units.reduce((s, u) => s + u.currentRent, 0);
              const rendite = p.purchasePrice > 0 ? ((rent * 12) / p.purchasePrice) * 100 : 0;
              const occupancyPct = units.length > 0 ? Math.round((occ.length / units.length) * 100) : 0;
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/bh/objekte/${p.id}`)}
                  className="group grid grid-cols-[36px_1fr_auto] sm:grid-cols-[36px_1fr_auto_auto_auto] xl:grid-cols-[36px_1fr_auto_auto_100px] items-center gap-3 sm:gap-4 px-4 py-3.5 mx-1 rounded-[10px] cursor-pointer hover:bg-layer-hover transition-colors [&:not(:first-child)]:border-t [&:not(:first-child)]:border-card-line"
                >
                  <div className={cn('size-9 rounded-[9px] flex items-center justify-center shrink-0', cfg.iconBg)}>
                    <Home size={16} className={cfg.iconColor} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground tracking-tight truncate">{p.name}</p>
                      <span className={cn(
                        'inline-flex items-center px-2 py-px rounded-full text-[10.5px] font-semibold whitespace-nowrap tabular-nums',
                        rendite >= 4 ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : rendite >= 2.5 ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          : 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400',
                      )}>
                        {rendite.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                      <span className="truncate">{p.address}</span>
                      <span className={cn('inline-flex items-center px-2 py-px rounded-full text-[10.5px] font-semibold whitespace-nowrap sm:hidden', cfg.tagBg, cfg.tagText)}>{cfg.label}</span>
                    </div>
                  </div>

                  <div className="hidden sm:block text-right min-w-[88px]">
                    <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground/80 font-medium">Miete/M</p>
                    <p className="text-[13.5px] font-semibold text-foreground tabular-nums tracking-tight">{fmtEur(rent)}</p>
                  </div>

                  <div className="hidden sm:block text-right min-w-[88px]">
                    <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground/80 font-medium">Marktwert</p>
                    <p className="text-[13.5px] font-semibold text-foreground tabular-nums tracking-tight">{fmtEur(p.currentValue)}</p>
                  </div>

                  <div className="hidden xl:block w-[100px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground/80 font-medium">Belegt</span>
                      <span className="text-[11.5px] font-semibold text-foreground/80 tabular-nums">{occ.length}/{units.length}</span>
                    </div>
                    <div className="h-1 bg-layer-hover rounded-full overflow-hidden">
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
              );
            })}
          </div>
        </div>

        {/* Side stack: Tasks + Activity */}
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Aufgaben */}
          <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Aufgaben</h2>
                {overdueTasksCount > 0 ? (
                  <span className="text-[13px] font-semibold text-rose-600 dark:text-rose-400">{overdueTasksCount} fällig</span>
                ) : (
                  <span className="text-[13px] text-muted-foreground/80">{openTasks.length} offen</span>
                )}
              </div>
              <button onClick={() => navigate('/bh/vorgaenge')} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                Alle <ArrowRight size={12} />
              </button>
            </div>
            <div className="px-5 sm:px-6 pb-4">
              {openTasks.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-muted-foreground">Keine offenen Aufgaben.</p>
                </div>
              ) : (
                <ul className="divide-y divide-card-divider">
                  {openTasks.map((task) => {
                    const due = task.dueDate ? formatDueDate(task.dueDate) : null;
                    const taskProperty = task.propertyId ? properties.find(p => p.id === task.propertyId) : undefined;
                    return (
                      <li key={task.id} className="flex items-start gap-3 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStatus(task.id, 'erledigt');
                          }}
                          className="mt-0.5 size-4 rounded-[5px] border-[1.5px] border-muted-foreground/40 hover:border-[#4F6BFF] hover:bg-[#4F6BFF]/10 grid place-items-center transition-colors shrink-0"
                          title="Als erledigt markieren"
                        >
                          <Check size={10} className="opacity-0" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-foreground leading-snug">{task.title}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                            {due && (
                              <>
                                <span className={cn(
                                  'font-semibold',
                                  due.tone === 'overdue' && 'text-rose-600 dark:text-rose-400',
                                  due.tone === 'today' && 'text-rose-600 dark:text-rose-400',
                                  due.tone === 'soon' && 'text-amber-600 dark:text-amber-400',
                                )}>{due.label}</span>
                                <span className="size-[3px] rounded-full bg-muted-foreground/40" />
                              </>
                            )}
                            <span>{taskProperty?.name || task.category}</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

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
