import { useNavigate } from 'react-router-dom';
import {
  Building2, Plus, ArrowRight, Wallet, Wrench, TrendingUp,
  HardHat, Calculator, SearchCheck, FolderPlus,
  Check,
  Clock, Tag, Search, BarChart3,
} from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';
import { useBudgetItems } from '../../hooks/useBudgetItems';
import { useContractors } from '../../hooks/useContractors';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LocaleContext';
import { EmptyState } from '../ui/EmptyState';
import { QuickTaskWidget } from '../shared/QuickTaskWidget';
import { formatCurrency, cn, effectiveRenovationCost, calculateProjectedProfit } from '../../lib/utils';
import type { ProjectStatus } from '../../types';

// Stage / status configuration — markers, badges, row icon backgrounds.
const STATUS_CFG: Record<ProjectStatus, {
  label: string;
  marker: string;        // dot color
  bar: string;           // progress fill
  iconBg: string;        // status-icon block bg
  iconColor: string;     // status-icon block text
  tagBg: string;         // pill bg
  tagText: string;       // pill text
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}> = {
  Akquise:       { label: 'Akquise',   marker: 'bg-sky-500',     bar: 'bg-sky-500',     iconBg: 'bg-sky-100 dark:bg-sky-500/15',     iconColor: 'text-sky-700 dark:text-sky-300',         tagBg: 'bg-sky-100 dark:bg-sky-500/15',     tagText: 'text-neutral-900',     Icon: Search },
  Planung:       { label: 'Planung',   marker: 'bg-amber-500',   bar: 'bg-amber-500',   iconBg: 'bg-amber-100 dark:bg-amber-500/15', iconColor: 'text-amber-700 dark:text-amber-300',     tagBg: 'bg-amber-100 dark:bg-amber-500/15', tagText: 'text-neutral-900', Icon: BarChart3 },
  Sanierung:     { label: 'Sanierung', marker: 'bg-orange-500',  bar: 'bg-orange-500',  iconBg: 'bg-orange-100 dark:bg-orange-500/15', iconColor: 'text-orange-700 dark:text-orange-300', tagBg: 'bg-orange-100 dark:bg-orange-500/15', tagText: 'text-neutral-900', Icon: Wrench },
  Verkauf:       { label: 'Verkauf',   marker: 'bg-rose-500',    bar: 'bg-rose-500',    iconBg: 'bg-rose-100 dark:bg-rose-500/15',   iconColor: 'text-rose-700 dark:text-rose-300',       tagBg: 'bg-rose-100 dark:bg-rose-500/15',   tagText: 'text-neutral-900',   Icon: Tag },
  Abgeschlossen: { label: 'Fertig',    marker: 'bg-emerald-500', bar: 'bg-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-500/15', iconColor: 'text-emerald-700 dark:text-emerald-300', tagBg: 'bg-emerald-100 dark:bg-emerald-500/15', tagText: 'text-neutral-900', Icon: Check },
};

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

export function DashboardPage() {
  const navigate = useNavigate();
  const { userName } = useAuth();
  const { t } = useTranslation();
  const firstName = (userName || 'da').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 11 ? t('greeting.morning') : hour < 18 ? t('greeting.day') : t('greeting.evening');
  const { projects } = useProjects();
  const { allBudgetItems } = useBudgetItems();
  const { contractors } = useContractors();

  const activeProjects = projects.filter((p) => p.status !== 'Abgeschlossen');
  const totalInvested = projects.reduce((sum, p) => sum + p.purchasePrice, 0);
  const totalTargetRevenue = projects.reduce((sum, p) => sum + p.targetSellPrice, 0);
  // Geplantes Sanierungsbudget — KPI „Renovierung / Budget gesamt".
  const totalBudget = projects.reduce((sum, p) => sum + p.renovationBudget, 0);
  // Konservative Gewinn-Schätzung über alle Projekte: max(Plan, Ist).
  const actualSpentByProject = allBudgetItems.reduce<Record<string, number>>((acc, b) => {
    acc[b.projectId] = (acc[b.projectId] ?? 0) + b.actualCost;
    return acc;
  }, {});
  const totalEffectiveCost = projects.reduce(
    (sum, p) => sum + effectiveRenovationCost(p.renovationBudget, actualSpentByProject[p.id] ?? 0),
    0,
  );
  const projectedProfit = totalTargetRevenue - totalInvested - totalEffectiveCost;
  const roi = totalInvested > 0 ? ((projectedProfit / totalInvested) * 100).toFixed(1) : '0';
  const investedProgress = totalTargetRevenue > 0 ? Math.min(100, Math.round((totalInvested / totalTargetRevenue) * 100)) : 0;

  // Aktivität: jüngste Budget-Positionen (max. 4) mit zugeordnetem Projekt + Handwerker
  const recentActivity = [...allBudgetItems]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  if (projects.length === 0) {
    return (
      <div className="page-container">
        {/* WELCOME GREETING — auch im Empty-State, damit der User weiß wer er ist */}
        <div className="mb-7 sm:mb-9 px-1">
          <h1 className="text-[34px] sm:text-[42px] font-bold text-[#0f172a] tracking-tight leading-[1.1] mb-2 inline-flex items-center gap-3 flex-wrap">
            <span className="bg-[#dbe5ff] px-3 py-1 rounded-lg inline-block">
              {greeting}, {firstName}!
            </span>
            <span className="text-[30px] sm:text-[36px]" role="img" aria-label="wave">👋</span>
          </h1>
          <p className="text-[18px] sm:text-[22px] text-muted-foreground/80 leading-relaxed font-light">
            Willkommen bei Fix &amp; Flip. Starte jetzt dein erstes Projekt.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { icon: FolderPlus, label: 'Projekt anlegen', desc: 'Starte dein erstes Flip-Projekt', to: '/projekte', primary: true, bg: 'bg-[#4F6BFF] hover:bg-[#3D56E0]', iconBg: 'bg-white/15', iconText: 'text-white', titleText: 'text-white', subText: 'text-white/65' },
            { icon: SearchCheck, label: 'Deal Analyzer', desc: 'Prüfe ob ein Deal sich lohnt', to: '/deal-analyzer', bg: 'bg-[#E8DAFF] hover:bg-[#DAC5FF]', iconBg: 'bg-white/60', iconText: 'text-[#3D1F5A]', titleText: 'text-[#3D1F5A]', subText: 'text-[#3D1F5A]/65' },
            { icon: Calculator, label: 'Kalkulator', desc: 'Berechne deine Investitionskosten', to: '/kalkulator', bg: 'bg-[#D6F0DC] hover:bg-[#BFE6C9]', iconBg: 'bg-white/60', iconText: 'text-[#1A4D2C]', titleText: 'text-[#1A4D2C]', subText: 'text-[#1A4D2C]/65' },
            { icon: HardHat, label: 'Handwerker', desc: 'Baue deine Handwerker-Datenbank auf', to: '/handwerker', bg: 'bg-[#FFF1CC] hover:bg-[#FCE9B4]', iconBg: 'bg-white/60', iconText: 'text-[#5A4A1A]', titleText: 'text-[#5A4A1A]', subText: 'text-[#5A4A1A]/65' },
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

        <EmptyState
          icon={<Building2 size={32} />}
          title={t('property.empty.title') === 'Keine Objekte' ? 'Noch keine Projekte' : 'No projects yet'}
          description={t('dashboard.greeting.subtitle.fixflip.empty')}
          action={<button onClick={() => navigate('/projekte')} className="btn btn-md btn-primary"><Plus size={16} /> {t('dashboard.action.newProject')}</button>}
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* WELCOME GREETING — Stratify-style: large + highlighted name + question subtitle */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-7 sm:mb-9 px-1">
        <div className="min-w-0">
          <h1 className="text-[34px] sm:text-[42px] font-bold text-[#0f172a] tracking-tight leading-[1.1] mb-2 inline-flex items-center gap-3 flex-wrap">
            <span className="bg-[#dbe5ff] px-3 py-1 rounded-lg inline-block">
              {greeting}, {firstName}!
            </span>
            <span className="text-[30px] sm:text-[36px]" role="img" aria-label="wave">👋</span>
          </h1>
          <p className="text-[18px] sm:text-[22px] text-muted-foreground/80 leading-relaxed font-light">
            {activeProjects.length === 0
              ? t('dashboard.greeting.subtitle.fixflip.empty')
              : t('dashboard.greeting.subtitle.fixflip.with', {
                  count: activeProjects.length,
                  projectWord: t(activeProjects.length === 1 ? 'word.project.singular' : 'word.project.plural'),
                })}
          </p>
        </div>
        <button onClick={() => navigate('/projekte')} className="btn btn-md btn-primary shrink-0 mt-2">
          <Plus size={15} />
          <span className="hidden sm:inline">{t('dashboard.action.newProject')}</span>
          <span className="sm:hidden">{t('common.new')}</span>
        </button>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8" data-tour="ff-kpis">
        {/* Projekte */}
        <KpiCard
          icon={<Building2 size={14} />}
          iconClass="bg-[#4F6BFF]/10 text-[#4F6BFF]"
          label="Projekte"
        >
          <p className="text-2xl sm:text-[28px] leading-[1.1] font-bold text-foreground tabular-nums tracking-tight">
            {activeProjects.length}<span className="text-base font-medium text-muted-foreground ml-1">/ {projects.length}</span>
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
            <span>aktiv / gesamt</span>
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full tabular-nums">
              {projects.length > 0 ? Math.round((activeProjects.length / projects.length) * 100) : 0}%
            </span>
          </div>
        </KpiCard>

        {/* Investiert */}
        <KpiCard
          icon={<Wallet size={14} />}
          iconClass="bg-[#4F6BFF]/10 text-[#4F6BFF]"
          label="Investiert"
        >
          <p className="text-2xl sm:text-[28px] leading-[1.1] font-bold text-foreground tabular-nums tracking-tight">{formatCurrency(totalInvested)}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
            <span className="truncate">Ziel: <span className="tabular-nums">{formatCurrency(totalTargetRevenue)}</span></span>
            <span className="font-semibold text-foreground tabular-nums">{investedProgress}%</span>
          </div>
          <div className="mt-3 h-1 bg-layer-hover rounded-full overflow-hidden">
            <div className="h-full bg-[#4F6BFF] rounded-full transition-all duration-700" style={{ width: `${investedProgress}%` }} />
          </div>
        </KpiCard>

        {/* Renovierung */}
        <KpiCard
          icon={<Wrench size={14} />}
          iconClass="bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400"
          label="Renovierung"
        >
          <p className="text-2xl sm:text-[28px] leading-[1.1] font-bold text-foreground tabular-nums tracking-tight">{formatCurrency(totalBudget)}</p>
          <p className="text-xs text-muted-foreground mt-1.5">Budget gesamt</p>
        </KpiCard>

        {/* Proj. Gewinn — uniform style, no gradient/featured anymore */}
        <KpiCard
          icon={<TrendingUp size={14} />}
          iconClass="bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          label="Proj. Gewinn"
        >
          <p className={cn(
            'text-2xl sm:text-[28px] leading-[1.1] font-bold tabular-nums tracking-tight',
            projectedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
          )}>
            {formatCurrency(projectedProfit)}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">ROI {roi}%</p>
        </KpiCard>
      </div>

      {/* SUGGESTED ACTIONS — gleiche Palette + Reihenfolge wie das Buy-&-Hold-Dashboard:
          primary blue → purple → green → yellow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {[
          { icon: FolderPlus,  title: 'Neues Projekt', sub: 'Lege ein neues Fix-&-Flip-Projekt an', to: '/projekte', primary: true, bg: 'bg-[#4F6BFF] hover:bg-[#3D56E0]', iconBg: 'bg-white/15', iconText: 'text-white', titleText: 'text-white', subText: 'text-white/65' },
          { icon: SearchCheck, title: 'Deal prüfen', sub: 'Analysiere ein neues Objekt vor dem Kauf', to: '/deal-analyzer', bg: 'bg-[#E8DAFF] hover:bg-[#DAC5FF]', iconBg: 'bg-white/60', iconText: 'text-[#3D1F5A]', titleText: 'text-[#3D1F5A]', subText: 'text-[#3D1F5A]/65' },
          { icon: Calculator,  title: 'Rendite kalkulieren', sub: 'GIK, Marge und Cashflow berechnen', to: '/kalkulator', bg: 'bg-[#D6F0DC] hover:bg-[#BFE6C9]', iconBg: 'bg-white/60', iconText: 'text-[#1A4D2C]', titleText: 'text-[#1A4D2C]', subText: 'text-[#1A4D2C]/65' },
          { icon: HardHat,     title: 'Handwerker', sub: `${contractors.length} ${contractors.length === 1 ? 'Kontakt' : 'Kontakte'} in deiner Datenbank`, to: '/handwerker', bg: 'bg-[#FFF1CC] hover:bg-[#FCE9B4]', iconBg: 'bg-white/60', iconText: 'text-[#5A4A1A]', titleText: 'text-[#5A4A1A]', subText: 'text-[#5A4A1A]/65' },
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

      {/* TWO-COLUMN: PROJECTS + SIDE STACK */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4 sm:gap-5">
        {/* Projects panel — gleiche Listen-Optik wie Aufgaben/Aktivität daneben */}
        <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Projekte</h2>
              <span className="text-[12px] text-muted-foreground/80">
                {projects.length} {projects.length === 1 ? 'Projekt' : 'Projekte'}
              </span>
            </div>
            <button onClick={() => navigate('/projekte')} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              Alle <ArrowRight size={12} />
            </button>
          </div>

          <div className="px-2 sm:px-3 pb-3">
            <ul className="divide-y divide-card-divider">
              {projects.map((project) => {
                const cfg = STATUS_CFG[project.status];
                const items = allBudgetItems.filter(b => b.projectId === project.id);
                const spent = items.reduce((s, b) => s + b.actualCost, 0);
                const budgetPct = project.renovationBudget > 0 ? Math.min(Math.round((spent / project.renovationBudget) * 100), 100) : 0;
                const profit = calculateProjectedProfit(
                  project.targetSellPrice,
                  project.purchasePrice,
                  project.renovationBudget,
                  spent,
                );
                const StatusIcon = cfg.Icon;
                return (
                  <li key={project.id}>
                    <button
                      onClick={() => navigate(`/projekte/${project.id}`)}
                      className="group w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-layer-hover/60 transition-colors cursor-pointer text-left"
                    >
                      <span className={cn('size-9 rounded-lg grid place-items-center shrink-0', cfg.iconBg, cfg.iconColor)}>
                        <StatusIcon size={15} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[13.5px] font-semibold text-foreground truncate group-hover:text-[#4F6BFF] transition-colors">
                            {project.name}
                          </p>
                          <span className={cn('shrink-0 text-[11px] font-medium', cfg.iconColor)}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                          <span className="truncate">{project.address || '—'}</span>
                          <span className="size-[3px] rounded-full bg-muted-foreground/40 shrink-0" />
                          <span className="tabular-nums shrink-0">{formatCurrency(project.purchasePrice)}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-5">
                        <div className="text-right">
                          <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold leading-none mb-1">Gewinn</p>
                          <p className={cn('text-[13px] font-bold tabular-nums leading-none', profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-500')}>
                            {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                          </p>
                        </div>
                        <div className="hidden sm:block w-24">
                          <div className="flex items-center justify-between mb-1 leading-none">
                            <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Budget</span>
                            <span className="text-[10.5px] font-bold text-foreground tabular-nums">{budgetPct}%</span>
                          </div>
                          <div className="h-1 bg-layer-hover rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-700',
                                spent === 0 ? 'bg-muted-foreground/30' : budgetPct > 90 ? 'bg-rose-500' : budgetPct > 75 ? 'bg-amber-500' : 'bg-emerald-500',
                              )}
                              style={{ width: spent === 0 ? '2%' : `${Math.max(2, budgetPct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Side stack: Tasks + Activity */}
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Aufgaben — Quick-Capture-Widget */}
          <QuickTaskWidget mode="fixflip" viewAllHref="/aufgaben" accent="blue" />

          {/* Aktivität */}
          <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 pb-3">
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Aktivität</h2>
              <button onClick={() => navigate('/projekte')} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                Alle
              </button>
            </div>
            <div className="px-5 sm:px-6 pb-4">
              {recentActivity.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-muted-foreground">Noch keine Aktivität.</p>
                </div>
              ) : (
                <ul className="divide-y divide-card-divider">
                  {recentActivity.map((item) => {
                    const project = projects.find(p => p.id === item.projectId);
                    const contractor = item.contractorId ? contractors.find(c => c.id === item.contractorId) : undefined;
                    const paid = item.actualCost > 0;
                    return (
                      <li key={item.id} className="flex items-start gap-3 py-3">
                        <div className={cn(
                          'size-7 rounded-md grid place-items-center shrink-0 mt-px',
                          paid
                            ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : 'bg-[#4F6BFF]/10 text-[#4F6BFF]',
                        )}>
                          {paid ? <Check size={13} strokeWidth={2.4} /> : <Wrench size={13} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] text-foreground/85 leading-snug">
                            {paid && contractor ? (
                              <>Zahlung an <span className="font-semibold text-foreground">{contractor.name}</span> über <span className="tabular-nums font-medium">{formatCurrency(item.actualCost)}</span> bestätigt.</>
                            ) : paid ? (
                              <><span className="font-semibold text-foreground">{project?.name || 'Projekt'}:</span> Zahlung über <span className="tabular-nums font-medium">{formatCurrency(item.actualCost)}</span> bestätigt.</>
                            ) : (
                              <><span className="font-semibold text-foreground">{project?.name || 'Projekt'}:</span> {item.category} — {item.description || 'neue Position'}.</>
                            )}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                            <Clock size={10} />
                            <span>{formatRelative(item.createdAt)}</span>
                            {project && (
                              <>
                                <span className="size-[3px] rounded-full bg-muted-foreground/40" />
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/projekte/${project.id}`); }}
                                  className="text-[#4F6BFF] font-medium hover:underline"
                                >
                                  Projekt öffnen
                                </button>
                              </>
                            )}
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

// Reusable KPI card shell — keeps featured variant inline above for clarity.
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
