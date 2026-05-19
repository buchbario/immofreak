import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Building2, Search, List, Kanban, MoreHorizontal, GripVertical,
  MapPin,
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { useProjects } from '../../hooks/useProjects';
import { useBudgetItems } from '../../hooks/useBudgetItems';
import { useProjectPhotos } from '../../hooks/useProjectPhotos';
import { useTour } from '../../context/TourContext';
import { useTranslation } from '../../context/LocaleContext';
import { ProjectForm } from './ProjectForm';
import { formatCurrency, getBudgetPercentage, calculateProjectedProfit, cn } from '../../lib/utils';
import { PROJECT_STATUSES } from '../../types';
import type { Project, ProjectStatus } from '../../types';

/**
 * Collision-Detection für Kanban-DnD.
 *
 * `closestCorners` (das default war) erkennt bei unterschiedlich hohen
 * Spalten (leere vs. volle) oft die falsche Spalte, weil es die Distanz zu
 * Eck-Punkten misst. Nutzer, die eine Karte klar über eine Spalte ziehen,
 * landeten dann manchmal in der Nachbarspalte oder nirgends.
 *
 * Strategie:
 *  1. `pointerWithin` – Droppable, das den Pointer tatsächlich enthält.
 *     Präzise, genau dort wo der User zeigt.
 *  2. Fallback `rectIntersection` – falls der Pointer knapp außerhalb aller
 *     Droppables liegt (z. B. beim schnellen Dragging), wähle das Rect mit
 *     der größten Überlappung.
 */
const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return rectIntersection(args);
};

const STATUS_DOT_CLASS: Record<string, string> = {
  Akquise: 'dot-blue',
  Planung: 'dot-amber',
  Sanierung: 'dot-orange',
  Verkauf: 'dot-green',
  Abgeschlossen: 'dot-gray',
};

const COLUMN_BG: Record<string, string> = {
  Akquise: 'bg-blue-500/5',
  Planung: 'bg-amber-500/5',
  Sanierung: 'bg-orange-500/5',
  Verkauf: 'bg-emerald-500/5',
  Abgeschlossen: 'bg-gray-500/5',
};

const COLUMN_BORDER: Record<string, string> = {
  Akquise: 'border-blue-500/15',
  Planung: 'border-amber-500/15',
  Sanierung: 'border-orange-500/15',
  Verkauf: 'border-emerald-500/15',
  Abgeschlossen: 'border-gray-500/15',
};

const DROP_HIGHLIGHT: Record<string, string> = {
  Akquise: 'ring-blue-500/30 bg-blue-500/10',
  Planung: 'ring-amber-500/30 bg-amber-500/10',
  Sanierung: 'ring-orange-500/30 bg-orange-500/10',
  Verkauf: 'ring-emerald-500/30 bg-emerald-500/10',
  Abgeschlossen: 'ring-blue-500/30 bg-gray-500/10',
};

// ─── Kanban Card ─────────────────────────────────────────────

function KanbanCardContent({ project, budgetSpent }: { project: Project; budgetSpent: number }) {
  const { percentage } = getBudgetPercentage(budgetSpent, project.renovationBudget);
  // Konsistent mit ProjectDetailPage: projizierter Gewinn nutzt max(Plan, Ist).
  const profit = calculateProjectedProfit(
    project.targetSellPrice,
    project.purchasePrice,
    project.renovationBudget,
    budgetSpent,
  );

  return (
    <div className="p-3.5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold truncate text-foreground">{project.name}</h3>
        <GripVertical size={14} className="flex-shrink-0 mt-0.5 text-muted-foreground" />
      </div>
      <p className="text-xs truncate mt-0.5 text-muted-foreground">{project.address || 'Keine Adresse'}</p>
      <p className="text-lg font-semibold tabular-nums mt-2.5 text-foreground">{formatCurrency(project.targetSellPrice)}</p>

      {(project.renovationBudget > 0 || profit !== 0) && (
        <>
          <div className="my-2.5 border-t border-card-divider" />
          <div className="flex items-center justify-between text-xs">
            {project.renovationBudget > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 w-14 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-active)' }}>
                  <div
                    className={`h-full rounded-full transition-all ${percentage > 90 ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <span className={`font-medium ${percentage > 90 ? 'text-red-400' : 'text-muted-foreground-2'}`}>
                  {percentage}%
                </span>
              </div>
            )}
            {profit !== 0 && (
              <span className={`font-medium ${profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {profit > 0 ? '+' : ''}{formatCurrency(profit)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SortableKanbanCard({ project, budgetSpent, onClick }: {
  project: Project; budgetSpent: number; onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    data: { status: project.status },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-20 scale-95' : ''}`}
      onClick={(e) => { if (!isDragging) { e.stopPropagation(); onClick(); } }}
    >
      <div
        className="rounded-lg hover:brightness-110 transition-all bg-card border border-card-line"
      >
        <KanbanCardContent project={project} budgetSpent={budgetSpent} />
      </div>
    </div>
  );
}

// ─── Kanban Column ───────────────────────────────────────────

function KanbanColumn({ status, projects, budgetMap, onCardClick }: {
  status: ProjectStatus;
  projects: Project[];
  budgetMap: Record<string, number>;
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const bg = COLUMN_BG[status] || 'bg-gray-500/5';
  const border = COLUMN_BORDER[status] || 'border-gray-500/15';
  const dropHl = DROP_HIGHLIGHT[status] || 'ring-blue-500/30 bg-blue-500/10';

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-1 min-w-[280px] rounded-[10px] border transition-all ${
        isOver ? `ring-2 ${dropHl}` : `${bg} ${border}`
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className={`dot ${STATUS_DOT_CLASS[status]}`} />
          <span className="text-sm font-semibold text-foreground">{status}</span>
          <span className="badge badge-gray">
            {projects.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button className="btn btn-ghost w-7 h-7 !p-0 flex items-center justify-center rounded-lg">
            <MoreHorizontal size={14} />
          </button>
          <button className="btn btn-ghost w-7 h-7 !p-0 flex items-center justify-center rounded-lg">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 px-2.5 pb-3 space-y-2.5 overflow-y-auto min-h-[120px]">
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {projects.map((project) => (
            <SortableKanbanCard
              key={project.id}
              project={project}
              budgetSpent={budgetMap[project.id] ?? 0}
              onClick={() => onCardClick(project.id)}
            />
          ))}
        </SortableContext>
        {projects.length === 0 && (
          <div
            className="flex items-center justify-center h-24 text-xs font-medium border-2 border-dashed rounded-lg mx-0.5 text-muted-foreground border-card-line bg-transparent"
          >
            Keine Projekte
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────

type ViewMode = 'list' | 'kanban';

export function ProjectListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { projects, updateStatus } = useProjects();
  const { allBudgetItems } = useBudgetItems();
  const { allPhotos: projectPhotos } = useProjectPhotos();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [prefill, setPrefill] = useState<Partial<Project> | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const { active: tourActive, currentStep: tourStep } = useTour();
  const { t } = useTranslation();

  // Force Kanban view when the tour lands on the "Projekte & Kanban" step (index 7)
  useEffect(() => {
    if (tourActive && tourStep === 7) {
      setViewMode('kanban');
    }
  }, [tourActive, tourStep]);

  // Handle calculator redirect
  useEffect(() => {
    if (searchParams.get('fromCalc') === 'true') {
      setPrefill({
        name: searchParams.get('name') || '',
        address: searchParams.get('address') || '',
        purchasePrice: Number(searchParams.get('purchasePrice')) || 0,
        targetSellPrice: Number(searchParams.get('targetSellPrice')) || 0,
        arv: Number(searchParams.get('arv')) || 0,
        renovationBudget: Number(searchParams.get('renovationBudget')) || 0,
      });
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const budgetMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of allBudgetItems) m[i.projectId] = (m[i.projectId] ?? 0) + i.actualCost;
    return m;
  }, [allBudgetItems]);

  const columns = useMemo(() => {
    const g: Record<ProjectStatus, Project[]> = {
      Akquise: [], Planung: [], Sanierung: [], Verkauf: [], Abgeschlossen: [],
    };
    for (const p of projects) g[p.status]?.push(p);
    return g;
  }, [projects]);

  const filtered = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.address.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function handleDragStart(e: DragStartEvent) {
    setActiveProject(projects.find((p) => p.id === e.active.id) ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveProject(null);
    const { active, over } = e;
    if (!over) return;
    let ns: ProjectStatus | undefined;
    if (PROJECT_STATUSES.includes(over.id as ProjectStatus)) ns = over.id as ProjectStatus;
    else { const op = projects.find((p) => p.id === over.id); ns = op?.status; }
    if (!ns) return;
    const cp = projects.find((p) => p.id === active.id);
    if (!cp || cp.status === ns) return;
    updateStatus(active.id as string, ns);
  }

  return (
    <div className={`min-h-full ${viewMode === 'kanban' ? 'flex flex-col h-full' : ''}`}>
      {/* Header */}
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('project.title')}</h1>
            <p className="page-subtitle">
              {projects.length} {t(projects.length === 1 ? 'word.project.singular' : 'word.project.plural')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Toggle — prominent, matches PropertyListPage */}
            <div className="inline-flex items-center bg-layer-hover rounded-lg p-1 gap-1 border border-card-line">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-semibold transition-all cursor-pointer',
                  viewMode === 'list'
                    ? 'bg-[#4F6BFF] text-white shadow-[0_1px_2px_rgba(79,107,255,0.25)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
                )}
                title={t('project.view.list')}
              >
                <List size={14} strokeWidth={viewMode === 'list' ? 2.4 : 2} />
                {t('project.view.list')}
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-semibold transition-all cursor-pointer',
                  viewMode === 'kanban'
                    ? 'bg-[#4F6BFF] text-white shadow-[0_1px_2px_rgba(79,107,255,0.25)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
                )}
                title={t('project.view.kanban')}
              >
                <Kanban size={14} strokeWidth={viewMode === 'kanban' ? 2.4 : 2} />
                {t('project.view.kanban')}
              </button>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-md btn-primary"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">{t('project.cta.new')}</span>
              <span className="sm:hidden">{t('common.new')}</span>
            </button>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="page-container">
          <div className="empty-state">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--accent-dim)' }}>
              <Building2 size={22} className="text-blue-400" />
            </div>
            <p className="text-sm font-semibold mb-1 text-foreground">Noch keine Projekte</p>
            <p className="text-sm mb-5 text-muted-foreground-2">Erstelle dein erstes Fix & Flip Projekt.</p>
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-md btn-primary"
            >
              <Plus size={15} />
              Projekt anlegen
            </button>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* ─── LIST VIEW ──────────────────────────────────────── */
        <div className="page-container">
          <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            {/* Tabs + Search */}
            <div className="px-5 sm:px-7 py-3 border-b border-card-divider flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-3 sm:gap-4 -mb-3 flex-wrap">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={cn(
                    'group relative inline-flex items-center gap-1.5 pb-2 text-[13px] font-medium transition-colors cursor-pointer',
                    statusFilter === 'all' ? 'text-[#4F6BFF]' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Alle
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[10.5px] font-semibold tabular-nums',
                    statusFilter === 'all' ? 'bg-[#4F6BFF]/15 text-[#4F6BFF]' : 'bg-layer-hover text-muted-foreground/80',
                  )}>
                    {projects.length}
                  </span>
                  {statusFilter === 'all' && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#4F6BFF]" />}
                </button>
                {PROJECT_STATUSES.map((status) => {
                  const cnt = projects.filter((p) => p.status === status).length;
                  if (cnt === 0) return null;
                  const isActive = statusFilter === status;
                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        'group relative inline-flex items-center gap-1.5 pb-2 text-[13px] font-medium transition-colors cursor-pointer',
                        isActive ? 'text-[#4F6BFF]' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {status}
                      <span className={cn(
                        'inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[10.5px] font-semibold tabular-nums',
                        isActive ? 'bg-[#4F6BFF]/15 text-[#4F6BFF]' : 'bg-layer-hover text-muted-foreground/80',
                      )}>
                        {cnt}
                      </span>
                      {isActive && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#4F6BFF]" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1" />

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t('common.search_placeholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-7 pr-3 rounded-md bg-layer-hover text-[12px] text-foreground placeholder:text-muted-foreground/70 border border-transparent hover:border-card-line focus:bg-card focus:border-[#4F6BFF]/40 focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/15 transition-all w-[160px] focus:w-[220px]"
                />
              </div>
            </div>

          {/* Project grid */}
          <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
            {filtered.map((project) => {
              const spent = budgetMap[project.id] ?? 0;
              const { percentage } = getBudgetPercentage(spent, project.renovationBudget);
              // Konsistent mit ProjectDetailPage: projizierter Gewinn nutzt max(Plan, Ist).
              const profit = calculateProjectedProfit(
                project.targetSellPrice,
                project.purchasePrice,
                project.renovationBudget,
                spent,
              );
              const cover = projectPhotos.find(p => p.projectId === project.id)?.dataUrl;

              const statusConf = {
                Akquise:       { dot: 'bg-blue-500',    pill: 'bg-blue-50 text-black ring-blue-200/60' },
                Planung:       { dot: 'bg-amber-500',   pill: 'bg-amber-50 text-black ring-amber-200/60' },
                Sanierung:     { dot: 'bg-orange-500',  pill: 'bg-orange-50 text-black ring-orange-200/60' },
                Verkauf:       { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-black ring-emerald-200/60' },
                Abgeschlossen: { dot: 'bg-slate-400',   pill: 'bg-slate-50 text-slate-700 ring-slate-200/60' },
              }[project.status];

              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projekte/${project.id}`)}
                  className="group flex flex-col bg-card border border-card-line rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-[0_10px_28px_-8px_rgba(15,23,42,0.14)] hover:border-[#4F6BFF]/40 hover:-translate-y-0.5"
                >
                  {/* Cover — clean image, no overlay or title */}
                  <div className="relative aspect-[16/9] overflow-hidden bg-card-line/30">
                    {cover ? (
                      <img
                        src={cover}
                        alt={project.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <Building2 size={32} className="text-slate-400" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>

                  {/* Body — clear hierarchy */}
                  <div className="flex-1 flex flex-col p-4">
                    {/* Title + status pill */}
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h3 className="text-[15.5px] font-semibold text-foreground leading-snug tracking-tight line-clamp-1 group-hover:text-[#4F6BFF] transition-colors">
                        {project.name}
                      </h3>
                      <span className={cn(
                        'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold ring-1 ring-inset',
                        statusConf.pill,
                      )}>
                        <span className={cn('size-1.5 rounded-full', statusConf.dot)} />
                        {project.status}
                      </span>
                    </div>
                    {project.address && (
                      <div className="flex items-center gap-1 mb-3.5">
                        <MapPin size={12} className="text-muted-foreground shrink-0" />
                        <span className="text-[12px] text-muted-foreground truncate">{project.address}</span>
                      </div>
                    )}

                    {/* KPI cells — 2x2 grid in a tinted container */}
                    <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden bg-card-line/60 mb-3.5">
                      <ProjectKpiCell label={t('project.kpi.purchase')} value={formatCurrency(project.purchasePrice)} />
                      <ProjectKpiCell label={t('project.kpi.targetSell')} value={formatCurrency(project.targetSellPrice)} />
                      <ProjectKpiCell
                        label={t('project.kpi.profit')}
                        value={`${profit >= 0 ? '+' : ''}${formatCurrency(profit)}`}
                        valueClass={profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}
                      />
                      <ProjectKpiCell
                        label={t('project.kpi.budget')}
                        value={`${percentage}%`}
                        sub={`${formatCurrency(spent)} / ${formatCurrency(project.renovationBudget)}`}
                        valueClass={percentage > 90 ? 'text-rose-600' : undefined}
                      />
                    </div>

                    {/* Budget bar pinned to bottom */}
                    <div className="mt-auto">
                      <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-1.5">
                        <span>{t('project.budget.utilization')}</span>
                        <span className="tabular-nums">{percentage}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full overflow-hidden bg-card-line/80">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            percentage > 90 ? 'bg-rose-500' : percentage > 70 ? 'bg-amber-500' : 'bg-[#4F6BFF]',
                          )}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          </div>

          {filtered.length === 0 && (
            <div className="text-center py-10 px-5">
              <Search size={20} className="mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-[13px] text-muted-foreground">{t('project.notFound')}</p>
            </div>
          )}

            {/* Footer */}
            <div className="px-5 sm:px-7 py-3 border-t border-card-divider">
              <p className="text-[11.5px] text-muted-foreground tabular-nums">
                {filtered.length} {t('common.of')} {projects.length} {t(projects.length === 1 ? 'word.project.singular' : 'word.project.plural')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ─── KANBAN VIEW ────────────────────────────────────── */
        <div className="flex-1 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-8" data-tour="project-kanban">
          <p className="text-xs mb-4 text-muted-foreground hidden sm:block">Ziehe Projekte zwischen den Spalten, um den Status zu ändern</p>
          <DndContext
            sensors={sensors}
            collisionDetection={kanbanCollisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3 h-full min-w-max lg:min-w-0">
              {PROJECT_STATUSES.map((s) => (
                <KanbanColumn
                  key={s}
                  status={s}
                  projects={columns[s]}
                  budgetMap={budgetMap}
                  onCardClick={(id) => navigate(`/projekte/${id}`)}
                />
              ))}
            </div>
            <DragOverlay>
              {activeProject ? (
                <div
                  className="rounded-lg shadow-xl w-[268px] -rotate-2 opacity-95 ring-2 ring-blue-500/30 bg-card border border-primary"
                >
                  <KanbanCardContent project={activeProject} budgetSpent={budgetMap[activeProject.id] ?? 0} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {showForm && <ProjectForm onClose={() => { setShowForm(false); setPrefill(undefined); }} prefill={prefill} />}
    </div>
  );
}

/**
 * Kompakte KPI-Zelle fürs neue Projekt-Card-Layout — gleicher Aufbau wie
 * `KpiCell` in `PropertyListPage.tsx`. Bewusst dupliziert, weil beide Pages
 * unabhängige Card-Identitäten haben sollen; bei einer dritten Verwendung
 * sollte man das in `components/ui/` extrahieren.
 */
function ProjectKpiCell({
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
        <p className="text-[10.5px] text-muted-foreground tabular-nums mt-0.5 leading-tight truncate">{sub}</p>
      )}
    </div>
  );
}
