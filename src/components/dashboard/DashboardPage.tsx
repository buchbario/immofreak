import { useNavigate } from 'react-router-dom';
import {
  Building2, Plus, ArrowRight, Wallet, Wrench, TrendingUp,
  HardHat, Calculator, SearchCheck, FolderPlus,
  Check,
  Clock, Tag, Search, BarChart3,
} from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';
import { useBudgetItems } from '../../hooks/useBudgetItems';
import { useTasks } from '../../hooks/useTasks';
import { useContractors } from '../../hooks/useContractors';
import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../ui/EmptyState';
import { formatCurrency, cn, effectiveRenovationCost, calculateProjectedProfit } from '../../lib/utils';
import { PROJECT_STATUSES } from '../../types';
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
  Akquise:       { label: 'Akquise',   marker: 'bg-sky-500',     bar: 'bg-sky-500',     iconBg: 'bg-sky-100 dark:bg-sky-500/15',     iconColor: 'text-sky-700 dark:text-sky-300',         tagBg: 'bg-sky-100 dark:bg-sky-500/15',     tagText: 'text-sky-700 dark:text-sky-300',     Icon: Search },
  Planung:       { label: 'Planung',   marker: 'bg-amber-500',   bar: 'bg-amber-500',   iconBg: 'bg-amber-100 dark:bg-amber-500/15', iconColor: 'text-amber-700 dark:text-amber-300',     tagBg: 'bg-amber-100 dark:bg-amber-500/15', tagText: 'text-amber-700 dark:text-amber-300', Icon: BarChart3 },
  Sanierung:     { label: 'Sanierung', marker: 'bg-orange-500',  bar: 'bg-orange-500',  iconBg: 'bg-orange-100 dark:bg-orange-500/15', iconColor: 'text-orange-700 dark:text-orange-300', tagBg: 'bg-orange-100 dark:bg-orange-500/15', tagText: 'text-orange-700 dark:text-orange-300', Icon: Wrench },
  Verkauf:       { label: 'Verkauf',   marker: 'bg-rose-500',    bar: 'bg-rose-500',    iconBg: 'bg-rose-100 dark:bg-rose-500/15',   iconColor: 'text-rose-700 dark:text-rose-300',       tagBg: 'bg-rose-100 dark:bg-rose-500/15',   tagText: 'text-rose-700 dark:text-rose-300',   Icon: Tag },
  Abgeschlossen: { label: 'Fertig',    marker: 'bg-emerald-500', bar: 'bg-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-500/15', iconColor: 'text-emerald-700 dark:text-emerald-300', tagBg: 'bg-emerald-100 dark:bg-emerald-500/15', tagText: 'text-emerald-700 dark:text-emerald-300', Icon: Check },
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

export function DashboardPage() {
  const navigate = useNavigate();
  const { userName } = useAuth();
  const firstName = (userName || 'da').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const { projects } = useProjects();
  const { allBudgetItems } = useBudgetItems();
  const { allTasks, toggleStatus } = useTasks();
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

  // Pipeline Volumes per stage (aktiver Kaufpreis-Anteil je Status)
  const stageCounts = PROJECT_STATUSES.reduce((acc, s) => {
    acc[s] = projects.filter(p => p.status === s).length;
    return acc;
  }, {} as Record<ProjectStatus, number>);

  // Tasks: nur offene / in Bearbeitung, sortiert nach Fälligkeit (offene zuerst).
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

  // Aktivität: jüngste Budget-Positionen (max. 4) mit zugeordnetem Projekt + Handwerker
  const recentActivity = [...allBudgetItems]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  if (projects.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Willkommen bei Fix &amp; Flip. Starte jetzt dein erstes Projekt.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { icon: FolderPlus, label: 'Projekt anlegen', desc: 'Starte dein erstes Flip-Projekt', to: '/projekte', primary: true },
            { icon: SearchCheck, label: 'Deal Analyzer', desc: 'Prüfe ob ein Deal sich lohnt', to: '/deal-analyzer' },
            { icon: Calculator, label: 'Kalkulator', desc: 'Berechne deine Investitionskosten', to: '/kalkulator' },
            { icon: HardHat, label: 'Handwerker', desc: 'Baue deine Handwerker-Datenbank auf', to: '/handwerker' },
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

        <EmptyState
          icon={<Building2 size={32} />}
          title="Noch keine Projekte"
          description="Erstelle dein erstes Fix & Flip Projekt um loszulegen."
          action={<button onClick={() => navigate('/projekte')} className="btn btn-md btn-primary"><Plus size={16} /> Projekt anlegen</button>}
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
              ? 'Bereit für dein erstes Fix-&-Flip-Projekt?'
              : `Du hast ${activeProjects.length} aktive ${activeProjects.length === 1 ? 'Projekt' : 'Projekte'} – was möchtest du heute tun?`}
          </p>
        </div>
        <button onClick={() => navigate('/projekte')} className="btn btn-md btn-primary shrink-0 mt-2">
          <Plus size={15} />
          <span className="hidden sm:inline">Neues Projekt</span>
          <span className="sm:hidden">Neu</span>
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

      {/* SUGGESTED ACTIONS — Stratify-style: 4 prominent cards with icon, title, content */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {[
          { icon: SearchCheck, title: 'Deal prüfen', sub: 'Analysiere ein neues Objekt vor dem Kauf', to: '/deal-analyzer', tint: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400' },
          { icon: Calculator,  title: 'Rendite kalkulieren', sub: 'GIK, Marge und Cashflow berechnen', to: '/kalkulator',     tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
          { icon: HardHat,     title: 'Handwerker', sub: `${contractors.length} ${contractors.length === 1 ? 'Kontakt' : 'Kontakte'} in deiner Datenbank`, to: '/handwerker',     tint: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
          { icon: FolderPlus,  title: 'Neues Projekt', sub: 'Lege ein neues Fix-&-Flip-Projekt an', to: '/projekte', tint: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400' },
        ].map(a => (
          <button
            key={a.to}
            onClick={() => navigate(a.to)}
            className="group flex flex-col items-start text-left p-4 sm:p-5 bg-card border border-card-line rounded-2xl hover:-translate-y-px transition-all cursor-pointer hover:border-[#4F6BFF]/25 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] min-h-[124px]"
          >
            <div className={cn('size-10 rounded-xl flex items-center justify-center mb-3 transition-colors', a.tint)}>
              <a.icon size={18} />
            </div>
            <p className="text-[14px] font-semibold text-foreground leading-tight mb-1">{a.title}</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">{a.sub}</p>
          </button>
        ))}
      </div>

      {/* TWO-COLUMN: PROJECTS + SIDE STACK */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-4 sm:gap-5">
        {/* Projects panel */}
        <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 pb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Projekte</h2>
              <span className="text-[13px] text-muted-foreground/80">{projects.length} gesamt</span>
            </div>
            <button onClick={() => navigate('/projekte')} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Alle anzeigen <ArrowRight size={12} />
            </button>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap px-5 sm:px-6 pb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#4F6BFF]/10 text-[#4F6BFF]">
              Alle <span className="text-[11px] font-semibold opacity-80 tabular-nums">{projects.length}</span>
            </span>
            {PROJECT_STATUSES.map(s => {
              const cnt = stageCounts[s];
              if (cnt === 0) return null;
              const cfg = STATUS_CFG[s];
              return (
                <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-layer-hover text-foreground/80">
                  <span className={cn('size-1.5 rounded-full', cfg.marker)} />
                  {cfg.label}
                  <span className="text-[11px] font-semibold opacity-60 tabular-nums">{cnt}</span>
                </span>
              );
            })}
          </div>

          {/* Project rows */}
          <div className="px-2 pb-3">
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
                <div
                  key={project.id}
                  onClick={() => navigate(`/projekte/${project.id}`)}
                  className="group grid grid-cols-[36px_1fr_auto] sm:grid-cols-[36px_1fr_auto_auto_auto] xl:grid-cols-[36px_1fr_auto_auto_100px] items-center gap-3 sm:gap-4 px-4 py-3.5 mx-1 rounded-[10px] cursor-pointer hover:bg-layer-hover transition-colors [&:not(:first-child)]:border-t [&:not(:first-child)]:border-card-line"
                >
                  {/* Status icon block */}
                  <div className={cn('size-9 rounded-[9px] flex items-center justify-center shrink-0', cfg.iconBg)}>
                    <StatusIcon size={16} className={cfg.iconColor} />
                  </div>

                  {/* Name + meta */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground tracking-tight truncate">{project.name}</p>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                      <span className="truncate">{project.address || '–'}</span>
                      <span className={cn('inline-flex items-center px-2 py-px rounded-full text-[10.5px] font-semibold whitespace-nowrap sm:hidden', cfg.tagBg, cfg.tagText)}>{cfg.label}</span>
                    </div>
                  </div>

                  {/* Kaufpreis */}
                  <div className="hidden sm:block text-right min-w-[88px]">
                    <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground/80 font-medium">Kaufpreis</p>
                    <p className="text-[13.5px] font-semibold text-foreground tabular-nums tracking-tight">{formatCurrency(project.purchasePrice)}</p>
                  </div>

                  {/* Gewinn */}
                  <div className="hidden sm:block text-right min-w-[88px]">
                    <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground/80 font-medium">Gewinn</p>
                    <p className={cn('text-[13.5px] font-semibold tabular-nums tracking-tight', profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-500')}>
                      {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                    </p>
                  </div>

                  {/* Budget progress */}
                  <div className="hidden xl:block w-[100px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground/80 font-medium">Budget</span>
                      <span className="text-[11.5px] font-semibold text-foreground/80 tabular-nums">{budgetPct}%</span>
                    </div>
                    <div className="h-1 bg-layer-hover rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          spent === 0 ? 'bg-muted-foreground/30' : budgetPct > 90 ? 'bg-red-500' : budgetPct > 75 ? 'bg-amber-500' : 'bg-emerald-500',
                        )}
                        style={{ width: spent === 0 ? '2%' : `${Math.max(2, budgetPct)}%` }}
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
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/60">
                {allTasks.length} gesamt
              </span>
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
                            <span>{task.category}</span>
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
