import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Plus, MoreHorizontal } from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';
import { useBudgetItems } from '../../hooks/useBudgetItems';
import { formatCurrency, getBudgetPercentage, calculateProjectedProfit } from '../../lib/utils';
import type { Project, ProjectStatus } from '../../types';
import { PROJECT_STATUSES } from '../../types';

/**
 * Collision-Detection für Kanban-DnD — siehe ProjectListPage.tsx für die
 * ausführliche Begründung. Kurz: `closestCorners` erkannte Spalten bei
 * unterschiedlichen Höhen unzuverlässig; `pointerWithin` + `rectIntersection`
 * als Fallback liefert präzise, intuitive Drops.
 */
const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return rectIntersection(args);
};

const COLUMN_CONFIG: Record<ProjectStatus, { label: string; dotClass: string }> = {
  Akquise: { label: 'Akquise', dotClass: 'dot-blue' },
  Planung: { label: 'Planung', dotClass: 'dot-amber' },
  Sanierung: { label: 'Sanierung', dotClass: 'dot-orange' },
  Verkauf: { label: 'Verkauf', dotClass: 'dot-green' },
  Abgeschlossen: { label: 'Abgeschlossen', dotClass: 'dot-gray' },
};

const COLUMN_BG: Record<string, string> = {
  Akquise: 'bg-[#4F6BFF]/5',
  Planung: 'bg-amber-500/5',
  Sanierung: 'bg-orange-500/5',
  Verkauf: 'bg-emerald-500/5',
  Abgeschlossen: 'bg-gray-500/5',
};

const COLUMN_BORDER: Record<string, string> = {
  Akquise: 'border-[#4F6BFF]/15',
  Planung: 'border-amber-500/15',
  Sanierung: 'border-orange-500/15',
  Verkauf: 'border-emerald-500/15',
  Abgeschlossen: 'border-gray-500/15',
};

const DROP_HIGHLIGHT: Record<string, string> = {
  Akquise: 'ring-[#4F6BFF]/30 bg-[#4F6BFF]/10',
  Planung: 'ring-amber-500/30 bg-amber-500/10',
  Sanierung: 'ring-orange-500/30 bg-orange-500/10',
  Verkauf: 'ring-emerald-500/30 bg-emerald-500/10',
  Abgeschlossen: 'ring-[#4F6BFF]/30 bg-gray-500/10',
};

interface ProjectCardProps {
  project: Project;
  budgetSpent: number;
  onClick: () => void;
  isDragOverlay?: boolean;
}

function SortableProjectCard({ project, budgetSpent, onClick }: ProjectCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id, data: { status: project.status } });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
      onClick={(e) => { if (!isDragging) { e.stopPropagation(); onClick(); } }}
    >
      <div
        className="rounded-lg hover:brightness-110 transition-all bg-card border border-card-line"
      >
        <ProjectCardContent project={project} budgetSpent={budgetSpent} />
      </div>
    </div>
  );
}

function ProjectCardContent({ project, budgetSpent }: { project: Project; budgetSpent: number }) {
  const budget = getBudgetPercentage(budgetSpent, project.renovationBudget);
  // Konsistent mit ProjectDetailPage: projizierter Gewinn nutzt max(Plan, Ist).
  const targetProfit = calculateProjectedProfit(
    project.targetSellPrice,
    project.purchasePrice,
    project.renovationBudget,
    budgetSpent,
  );

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold truncate text-foreground">{project.name}</h3>
      <p className="text-xs truncate mt-0.5 text-muted-foreground">{project.address || 'Keine Adresse'}</p>
      <p className="text-xl font-semibold tabular-nums mt-3 text-foreground">{formatCurrency(project.targetSellPrice)}</p>

      {(project.renovationBudget > 0 || targetProfit !== 0) && (
        <>
          <div className="my-3 border-t border-card-divider" />
          <div className="flex items-center justify-between text-xs">
            {project.renovationBudget > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 w-16 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-active)' }}>
                  <div className={`h-full rounded-full transition-all ${budget.percentage > 90 ? 'bg-red-500' : 'bg-[#4F6BFF]'}`} style={{ width: `${Math.min(budget.percentage, 100)}%` }} />
                </div>
                <span className={`font-medium text-xs ${budget.percentage > 90 ? 'text-red-400' : 'text-muted-foreground-2'}`}>{budget.percentage}%</span>
              </div>
            )}
            {targetProfit !== 0 && (
              <span className={`font-medium text-xs ${targetProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {targetProfit > 0 ? '+' : ''}{formatCurrency(targetProfit)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface KanbanColumnProps {
  status: ProjectStatus;
  projects: Project[];
  budgetMap: Record<string, number>;
  onCardClick: (projectId: string) => void;
}

function KanbanColumn({ status, projects, budgetMap, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = COLUMN_CONFIG[status];
  const bg = COLUMN_BG[status] || 'bg-gray-500/5';
  const border = COLUMN_BORDER[status] || 'border-gray-500/15';
  const dropHl = DROP_HIGHLIGHT[status] || 'ring-[#4F6BFF]/30 bg-[#4F6BFF]/10';

  return (
    <div ref={setNodeRef} className={`flex flex-col flex-1 min-w-[290px] rounded-[10px] border transition-all ${
      isOver ? `ring-2 ${dropHl}` : `${bg} ${border}`
    }`}>
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <span className={`dot ${config.dotClass}`} />
            {config.label}
          </span>
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

      <div className="flex-1 px-2 pb-2 space-y-2.5 overflow-y-auto">
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {projects.map((project) => (
            <SortableProjectCard key={project.id} project={project} budgetSpent={budgetMap[project.id] ?? 0} onClick={() => onCardClick(project.id)} />
          ))}
        </SortableContext>
        {projects.length === 0 && (
          <div
            className="flex items-center justify-center h-24 text-xs font-medium border-2 border-dashed rounded-lg mx-1 text-muted-foreground border-card-line"
          >
            Keine Projekte
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const navigate = useNavigate();
  const { projects, updateStatus } = useProjects();
  const { allBudgetItems } = useBudgetItems();
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const columns = useMemo(() => {
    const g: Record<ProjectStatus, Project[]> = { Akquise: [], Planung: [], Sanierung: [], Verkauf: [], Abgeschlossen: [] };
    for (const p of projects) g[p.status]?.push(p);
    return g;
  }, [projects]);

  const budgetMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of allBudgetItems) m[i.projectId] = (m[i.projectId] ?? 0) + i.actualCost;
    return m;
  }, [allBudgetItems]);

  function handleDragStart(e: DragStartEvent) { setActiveProject(projects.find((p) => p.id === e.active.id) ?? null); }
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
    <div className="flex flex-col h-full">
      <div className="page-container">
        <div className="page-header">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title">Pipeline</h1>
              <span className="badge badge-blue">
                {projects.length} Projekte
              </span>
            </div>
            <p className="page-subtitle">Ziehe Projekte zwischen den Spalten, um den Status zu ändern</p>
          </div>
          <button onClick={() => navigate('/projekte')} className="btn btn-md btn-primary">
            <Plus size={16} />
            Neues Projekt
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto px-6 sm:px-8 pb-8">
        <DndContext sensors={sensors} collisionDetection={kanbanCollisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full min-w-max lg:min-w-0">
            {PROJECT_STATUSES.map((s) => <KanbanColumn key={s} status={s} projects={columns[s]} budgetMap={budgetMap} onCardClick={(id) => navigate(`/projekte/${id}`)} />)}
          </div>
          <DragOverlay>
            {activeProject ? (
              <div
                className="rounded-lg shadow-xl w-[278px] rotate-1 opacity-95 ring-2 ring-[#4F6BFF]/30 bg-card border border-primary"
              >
                <ProjectCardContent project={activeProject} budgetSpent={budgetMap[activeProject.id] ?? 0} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
