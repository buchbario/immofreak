import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, Calendar, User, ChevronDown, MoreHorizontal,
  Clock, X, FileText, Building2, Users, Tag, Pencil, Trash2,
  CircleDot,
} from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useTenants } from '../../hooks/useTenants';
import { useTrash } from '../../hooks/useTrash';
import { TaskForm } from './TaskForm';
import type { Task, TaskStatus, TaskPriority } from '../../types';
import { cn } from '../../lib/utils';

type FilterKey = 'alle' | 'offen' | 'in-bearbeitung' | 'erledigt' | 'ueberfaellig';

function fmtDate(d?: string) {
  if (!d) return '--';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(new Date(d));
}
function fmtDateLong(d?: string) {
  if (!d) return '--';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d));
}
function daysUntil(date?: string) {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// Soft pastel chip styles (matching screenshot's HIGH/MEDIUM/LOW pills)
const PRIO_CHIP: Record<TaskPriority, { bg: string; dot: string; label: string }> = {
  hoch:    { bg: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',       dot: 'bg-rose-500',    label: 'HOCH' },
  mittel:  { bg: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',   dot: 'bg-amber-500',   label: 'MITTEL' },
  niedrig: { bg: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', dot: 'bg-violet-500',  label: 'NIEDRIG' },
};

const STATUS_CHIP: Record<TaskStatus, { label: string; bg: string; dot: string }> = {
  offen:            { label: 'OFFEN',          bg: 'bg-[#4F6BFF]/10 text-[#4F6BFF]',                                        dot: 'bg-[#4F6BFF]' },
  'in-bearbeitung': { label: 'IN BEARBEITUNG', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',  dot: 'bg-amber-500' },
  erledigt:         { label: 'ERLEDIGT',       bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  offen: 'Offen',
  'in-bearbeitung': 'In Bearbeitung',
  erledigt: 'Erledigt',
};

const STATUS_ORDER: TaskStatus[] = ['offen', 'in-bearbeitung', 'erledigt'];

export function TaskListPage() {
  const { allTasks, createTask, updateTask, toggleStatus, deleteTask } = useTasks();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allTenants } = useTenants();
  const { moveToTrash } = useTrash();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('alle');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [createDefaultStatus, setCreateDefaultStatus] = useState<TaskStatus>('offen');

  const counts = useMemo(() => {
    const now = Date.now();
    const offen = allTasks.filter((t) => t.status === 'offen').length;
    const inBearbeitung = allTasks.filter((t) => t.status === 'in-bearbeitung').length;
    const erledigt = allTasks.filter((t) => t.status === 'erledigt').length;
    const ueberfaellig = allTasks.filter(
      (t) => t.status !== 'erledigt' && t.dueDate && new Date(t.dueDate).getTime() < now,
    ).length;
    return { offen, inBearbeitung, erledigt, ueberfaellig, total: allTasks.length };
  }, [allTasks]);

  const filtered = useMemo(() => {
    let list = [...allTasks];
    const q = search.toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.assignedTo || '').toLowerCase().includes(q) ||
          properties.find((p) => p.id === t.propertyId)?.name.toLowerCase().includes(q),
      );
    }
    const now = Date.now();
    if (filter === 'offen') list = list.filter((t) => t.status === 'offen');
    else if (filter === 'in-bearbeitung') list = list.filter((t) => t.status === 'in-bearbeitung');
    else if (filter === 'erledigt') list = list.filter((t) => t.status === 'erledigt');
    else if (filter === 'ueberfaellig')
      list = list.filter((t) => t.status !== 'erledigt' && t.dueDate && new Date(t.dueDate).getTime() < now);
    return list;
  }, [allTasks, search, filter, properties]);

  // Group filtered tasks by status
  const grouped = useMemo(() => {
    const out: Record<TaskStatus, Task[]> = { offen: [], 'in-bearbeitung': [], erledigt: [] };
    for (const t of filtered) out[t.status].push(t);
    // Sort each group: by dueDate asc, no-date last
    for (const s of STATUS_ORDER) {
      out[s].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    }
    return out;
  }, [filtered]);

  const selectedTask = useMemo(() => allTasks.find((t) => t.id === selectedId) || null, [allTasks, selectedId]);

  // Auto-clear selection if the selected task is filtered out
  useEffect(() => {
    if (selectedId && !filtered.some((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  const handleSave = (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing?.id) updateTask(editing.id, data);
    else createTask(data);
    setShowForm(false);
    setEditing(null);
  };
  const handleDelete = () => {
    if (!editing?.id) return;
    moveToTrash({
      entityType: 'task', entityId: editing.id, data: editing,
      label: `Vorgang: ${editing.title}`, sublabel: editing.category,
    });
    deleteTask(editing.id);
    setShowForm(false); setEditing(null);
    if (selectedId === editing.id) setSelectedId(null);
  };
  const openEdit = (task: Task) => { setEditing(task); setShowForm(true); };
  const handleQuickToggle = (t: Task) => {
    const next: TaskStatus = t.status === 'erledigt' ? 'offen' : 'erledigt';
    toggleStatus(t.id, next);
  };
  const openCreate = (defaultStatus: TaskStatus = 'offen') => {
    setCreateDefaultStatus(defaultStatus);
    setEditing(null);
    setShowForm(true);
  };
  const toggleGroup = (s: TaskStatus) =>
    setCollapsedGroups((prev) => ({ ...prev, [s]: !prev[s] }));

  // ── Empty state (no tasks at all)
  if (allTasks.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Vorgänge</h1>
            <p className="page-subtitle">Lege Aufgaben mit Fristen und Verantwortlichen an.</p>
          </div>
          <button onClick={() => openCreate()} className="btn btn-md btn-primary">
            <Plus size={15} /> Vorgang anlegen
          </button>
        </div>
        <div className="surface empty-state">
          <div className="size-12 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center mb-4">
            <CircleDot size={22} className="text-[#4F6BFF]" />
          </div>
          <p className="text-sm font-semibold mb-1 text-foreground">Noch keine Vorgänge</p>
          <p className="text-sm mb-5 text-muted-foreground-2">
            Z.B. Heizungswartung, Nebenkostenabrechnung, Vertragsverlängerungen.
          </p>
          <button onClick={() => openCreate()} className="btn btn-md btn-primary">
            <Plus size={15} /> Vorgang anlegen
          </button>
        </div>
        {showForm && (
          <TaskForm
            initial={editing || { status: createDefaultStatus } as any}
            properties={properties} units={allUnits} tenants={allTenants}
            onClose={() => { setShowForm(false); setEditing(null); }}
            onSave={handleSave}
            onDelete={editing ? handleDelete : undefined}
          />
        )}
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4 sm:gap-5">
        {/* ╭──────────────────────── MAIN PANEL ──────────────────────────╮ */}
        <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          {/* Header */}
          <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-card-divider">
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80">
                <Clock size={11} />
                <span>{counts.total} {counts.total === 1 ? 'Vorgang' : 'Vorgänge'}</span>
                {counts.ueberfaellig > 0 && (
                  <>
                    <span className="size-[3px] rounded-full bg-muted-foreground/40" />
                    <span className="text-rose-600 dark:text-rose-400 font-medium">
                      {counts.ueberfaellig} überfällig
                    </span>
                  </>
                )}
              </div>
              <button onClick={() => openCreate()} className="btn btn-sm btn-primary">
                <Plus size={14} /> Neuer Vorgang
              </button>
            </div>
            <h1 className="text-[26px] sm:text-[28px] font-bold text-foreground tracking-tight leading-tight mb-1">
              Vorgänge
            </h1>
            <p className="text-[13px] text-muted-foreground max-w-2xl leading-relaxed">
              Aufgaben rund um deine Mietobjekte — Wartung, Abrechnung, Vertragsverlängerung. Klicke einen Eintrag an, um Details rechts zu sehen.
            </p>
          </div>

          {/* Tabs / Filter row */}
          <div className="px-5 sm:px-7 py-3 border-b border-card-divider flex items-center gap-2 sm:gap-4 flex-wrap">
            {(
              [
                { key: 'alle', label: 'Alle', cnt: counts.total },
                { key: 'offen', label: 'Offen', cnt: counts.offen },
                { key: 'in-bearbeitung', label: 'In Bearbeitung', cnt: counts.inBearbeitung },
                { key: 'ueberfaellig', label: 'Überfällig', cnt: counts.ueberfaellig },
                { key: 'erledigt', label: 'Erledigt', cnt: counts.erledigt },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={cn(
                  'group relative inline-flex items-center gap-1.5 pb-2 -mb-3 text-[13px] font-medium transition-colors cursor-pointer',
                  filter === opt.key
                    ? 'text-[#4F6BFF]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[10.5px] font-semibold tabular-nums',
                  filter === opt.key ? 'bg-[#4F6BFF]/15 text-[#4F6BFF]' : 'bg-layer-hover text-muted-foreground/80',
                )}>
                  {opt.cnt}
                </span>
                {filter === opt.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#4F6BFF]" />
                )}
              </button>
            ))}

            <div className="flex-1" />

            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen..."
                className="h-8 pl-7 pr-3 rounded-md bg-layer-hover text-[12px] text-foreground placeholder:text-muted-foreground/70 border border-transparent hover:border-card-line focus:bg-card focus:border-[#4F6BFF]/40 focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/15 transition-all w-[160px] focus:w-[200px]"
              />
            </div>
          </div>

          {/* Grouped task list */}
          <div className="px-2 sm:px-3 py-2">
            {STATUS_ORDER.map((status) => {
              const items = grouped[status];
              const collapsed = collapsedGroups[status];
              if (filter !== 'alle' && filter !== status && filter !== 'ueberfaellig') return null;
              if (filter === 'ueberfaellig' && items.length === 0) return null;
              const cfg = STATUS_CHIP[status];
              return (
                <div key={status} className="mb-1">
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-layer-hover/60 rounded-md mt-1">
                    <button
                      onClick={() => toggleGroup(status)}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <ChevronDown
                        size={14}
                        className={cn('text-muted-foreground transition-transform', collapsed && '-rotate-90')}
                      />
                      <span className={cn('size-2 rounded-full', cfg.dot)} />
                      <span className="text-[13px] font-semibold text-foreground tracking-tight">
                        {STATUS_LABEL[status]}
                      </span>
                      <span className="text-[11.5px] font-semibold text-muted-foreground tabular-nums">
                        {items.length}
                      </span>
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => openCreate(status)}
                      className="size-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                      title="Vorgang hinzufügen"
                    >
                      <Plus size={13} strokeWidth={2.4} />
                    </button>
                  </div>

                  {/* Task rows */}
                  {!collapsed && (
                    <>
                      {/* Column header */}
                      {items.length > 0 && (
                        <div className="hidden sm:grid grid-cols-[24px_1fr_88px_140px_96px] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                          <span></span>
                          <span>Vorgang</span>
                          <span>Frist</span>
                          <span>Zuständig</span>
                          <span>Priorität</span>
                        </div>
                      )}
                      {items.length === 0 ? (
                        <div className="px-4 py-3 text-[12px] text-muted-foreground/70 italic">
                          Keine Einträge in dieser Gruppe.
                        </div>
                      ) : (
                        items.map((t) => {
                          const property = properties.find((p) => p.id === t.propertyId);
                          const days = daysUntil(t.dueDate);
                          const isOverdue = t.status !== 'erledigt' && days !== null && days < 0;
                          const isSoon = t.status !== 'erledigt' && days !== null && days >= 0 && days <= 7;
                          const isDone = t.status === 'erledigt';
                          const prio = PRIO_CHIP[t.priority];
                          const isSelected = t.id === selectedId;

                          return (
                            <div
                              key={t.id}
                              onClick={() => setSelectedId(t.id)}
                              className={cn(
                                'group grid grid-cols-[24px_1fr_auto] sm:grid-cols-[24px_1fr_88px_140px_96px] items-center gap-3 px-3 sm:px-4 py-2.5 rounded-md cursor-pointer transition-colors',
                                isSelected
                                  ? 'bg-[#4F6BFF]/8 ring-1 ring-inset ring-[#4F6BFF]/20'
                                  : 'hover:bg-layer-hover',
                                isSelected && 'relative',
                              )}
                            >
                              {isSelected && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2.5px] rounded-r-full bg-[#4F6BFF]" />
                              )}

                              {/* Checkbox */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleQuickToggle(t); }}
                                className={cn(
                                  'size-[18px] rounded-md border-[1.5px] flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer',
                                  isDone
                                    ? 'bg-[#4F6BFF] border-[#4F6BFF]'
                                    : 'border-muted-foreground/40 hover:border-[#4F6BFF] hover:bg-[#4F6BFF]/5',
                                )}
                              >
                                {isDone && (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                    <path d="M5 12l5 5L20 7" />
                                  </svg>
                                )}
                              </button>

                              {/* Title + sub-line */}
                              <div className="min-w-0">
                                <p className={cn(
                                  'text-[13.5px] font-medium text-foreground truncate tracking-tight',
                                  isDone && 'line-through text-muted-foreground',
                                )}>
                                  {t.title}
                                </p>
                                <div className="sm:hidden flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                                  {t.dueDate && (
                                    <span className={cn(
                                      isOverdue && 'text-rose-600 dark:text-rose-400 font-medium',
                                      isSoon && !isOverdue && 'text-amber-600 dark:text-amber-400 font-medium',
                                    )}>
                                      <Calendar size={10} className="inline mr-1" />
                                      {fmtDate(t.dueDate)}
                                    </span>
                                  )}
                                  {t.assignedTo && <span>{t.assignedTo}</span>}
                                </div>
                              </div>

                              {/* Frist (Deadline) */}
                              <div className="hidden sm:block text-[12.5px] text-muted-foreground tabular-nums">
                                {t.dueDate ? (
                                  <span className={cn(
                                    isOverdue && 'text-rose-600 dark:text-rose-400 font-medium',
                                    isSoon && !isOverdue && 'text-amber-600 dark:text-amber-400 font-medium',
                                  )}>
                                    {fmtDate(t.dueDate)}
                                  </span>
                                ) : '—'}
                              </div>

                              {/* Assignee */}
                              <div className="hidden sm:block text-[12.5px] text-muted-foreground truncate">
                                {t.assignedTo || (property ? property.name : '—')}
                              </div>

                              {/* Priority chip */}
                              <div className="hidden sm:block">
                                <span className={cn(
                                  'inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-wider',
                                  prio.bg,
                                )}>
                                  {prio.label}
                                </span>
                              </div>

                              {/* Mobile: priority chip */}
                              <span className={cn(
                                'sm:hidden inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider justify-self-end',
                                prio.bg,
                              )}>
                                {prio.label}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-10">
                <Search size={20} className="mx-auto mb-2 text-muted-foreground/60" />
                <p className="text-[13px] text-muted-foreground">Keine Vorgänge gefunden.</p>
              </div>
            )}
          </div>
        </div>

        {/* ╭──────────────────────── DETAIL PANEL ────────────────────────╮ */}
        <div className="hidden xl:block">
          <div className="sticky top-4">
            {selectedTask ? (
              <DetailPanel
                task={selectedTask}
                properties={properties}
                allUnits={allUnits}
                allTenants={allTenants}
                onClose={() => setSelectedId(null)}
                onEdit={() => openEdit(selectedTask)}
                onDelete={() => {
                  setEditing(selectedTask);
                  // Use the form's delete to keep the trash flow consistent
                  setTimeout(() => {
                    moveToTrash({
                      entityType: 'task', entityId: selectedTask.id, data: selectedTask,
                      label: `Vorgang: ${selectedTask.title}`, sublabel: selectedTask.category,
                    });
                    deleteTask(selectedTask.id);
                    setEditing(null);
                    setSelectedId(null);
                  }, 0);
                }}
                onStatusChange={(s) => toggleStatus(selectedTask.id, s)}
                onPriorityChange={(p) => updateTask(selectedTask.id, { priority: p })}
              />
            ) : (
              <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-8 text-center">
                <div className="size-12 mx-auto rounded-xl bg-layer-hover flex items-center justify-center mb-3">
                  <FileText size={20} className="text-muted-foreground" />
                </div>
                <p className="text-[13px] font-semibold text-foreground mb-1">Kein Vorgang ausgewählt</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Wähle links einen Vorgang, um Details, Notizen und Verknüpfungen rechts zu sehen.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: floating selected-task panel as a slide-up sheet */}
      {selectedTask && (
        <div className="xl:hidden fixed inset-x-0 bottom-0 z-30 bg-card border-t border-card-line rounded-t-2xl shadow-[0_-8px_24px_rgba(15,23,42,0.08)] max-h-[80vh] overflow-y-auto">
          <DetailPanel
            task={selectedTask}
            properties={properties}
            allUnits={allUnits}
            allTenants={allTenants}
            onClose={() => setSelectedId(null)}
            onEdit={() => openEdit(selectedTask)}
            onDelete={() => {
              moveToTrash({
                entityType: 'task', entityId: selectedTask.id, data: selectedTask,
                label: `Vorgang: ${selectedTask.title}`, sublabel: selectedTask.category,
              });
              deleteTask(selectedTask.id);
              setSelectedId(null);
            }}
            onStatusChange={(s) => toggleStatus(selectedTask.id, s)}
            onPriorityChange={(p) => updateTask(selectedTask.id, { priority: p })}
            embedded
          />
        </div>
      )}

      {showForm && (
        <TaskForm
          initial={editing || ({ status: createDefaultStatus } as any)}
          properties={properties} units={allUnits} tenants={allTenants}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Right-side detail panel for the selected task
// ────────────────────────────────────────────────────────────────────────
function DetailPanel({
  task, properties, allUnits, allTenants,
  onClose, onEdit, onDelete, onStatusChange, onPriorityChange, embedded,
}: {
  task: Task;
  properties: Array<{ id: string; name: string; address?: string }>;
  allUnits: Array<{ id: string; name: string }>;
  allTenants: Array<{ id: string; name: string }>;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: TaskStatus) => void;
  onPriorityChange: (p: TaskPriority) => void;
  embedded?: boolean;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [prioOpen, setPrioOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const property = properties.find((p) => p.id === task.propertyId);
  const unit = allUnits.find((u) => u.id === task.unitId);
  const tenant = allTenants.find((t) => t.id === task.tenantId);
  const days = daysUntil(task.dueDate);
  const isOverdue = task.status !== 'erledigt' && days !== null && days < 0;
  const prio = PRIO_CHIP[task.priority];
  const status = STATUS_CHIP[task.status];

  return (
    <div className={cn(
      'bg-card border border-card-line shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden',
      embedded ? 'rounded-t-2xl' : 'rounded-2xl',
    )}>
      <div className="px-5 pt-5 pb-4 border-b border-card-divider">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {/* Priority dropdown */}
            <div className="relative">
              <button
                onClick={() => { setPrioOpen((o) => !o); setStatusOpen(false); }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold tracking-wider transition-colors',
                  prio.bg,
                )}
              >
                {prio.label}
                <ChevronDown size={10} strokeWidth={2.5} />
              </button>
              {prioOpen && (
                <div className="absolute left-0 mt-1 z-30 bg-dropdown border border-dropdown-line rounded-lg shadow-lg py-1 min-w-[140px]">
                  {(['hoch', 'mittel', 'niedrig'] as TaskPriority[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => { onPriorityChange(p); setPrioOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-dropdown-item-hover text-left"
                    >
                      <span className={cn('size-2 rounded-full', PRIO_CHIP[p].dot)} />
                      {PRIO_CHIP[p].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Status dropdown */}
            <div className="relative">
              <button
                onClick={() => { setStatusOpen((o) => !o); setPrioOpen(false); }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold tracking-wider transition-colors',
                  status.bg,
                )}
              >
                {status.label}
                <ChevronDown size={10} strokeWidth={2.5} />
              </button>
              {statusOpen && (
                <div className="absolute left-0 mt-1 z-30 bg-dropdown border border-dropdown-line rounded-lg shadow-lg py-1 min-w-[160px]">
                  {STATUS_ORDER.map((s) => (
                    <button
                      key={s}
                      onClick={() => { onStatusChange(s); setStatusOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-dropdown-item-hover text-left"
                    >
                      <span className={cn('size-2 rounded-full', STATUS_CHIP[s].dot)} />
                      {STATUS_CHIP[s].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-layer-hover transition-colors cursor-pointer"
                aria-label="Mehr"
              >
                <MoreHorizontal size={15} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 z-30 bg-dropdown border border-dropdown-line rounded-lg shadow-lg py-1 min-w-[140px]">
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-dropdown-item-hover text-left"
                  >
                    <Pencil size={12} /> Bearbeiten
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-rose-600 dark:text-rose-400 hover:bg-dropdown-item-hover text-left"
                  >
                    <Trash2 size={12} /> Löschen
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-layer-hover transition-colors cursor-pointer"
              aria-label="Schließen"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <p className="text-[10.5px] text-muted-foreground/80 mb-2">
          Erstellt {fmtDateLong(task.createdAt)}
          {task.updatedAt && task.updatedAt !== task.createdAt && (
            <> · Aktualisiert {fmtDateLong(task.updatedAt)}</>
          )}
        </p>
        <h2 className="text-[20px] sm:text-[22px] font-bold text-foreground tracking-tight leading-tight">
          {task.title}
        </h2>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-5">
        {/* Description */}
        {task.description ? (
          <p className="text-[13px] text-foreground/85 leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        ) : (
          <p className="text-[12px] text-muted-foreground/80 italic">Keine Beschreibung hinterlegt.</p>
        )}

        {/* Meta grid */}
        <div className="space-y-2">
          {/* Frist */}
          <DetailRow icon={<Calendar size={13} />} label="Frist">
            {task.dueDate ? (
              <span className={cn(
                'tabular-nums',
                isOverdue && 'text-rose-600 dark:text-rose-400 font-medium',
              )}>
                {fmtDateLong(task.dueDate)}
                {isOverdue && ` · ${Math.abs(days!)} Tage überfällig`}
              </span>
            ) : <span className="text-muted-foreground">—</span>}
          </DetailRow>

          {/* Kategorie */}
          <DetailRow icon={<Tag size={13} />} label="Kategorie">
            {task.category}
          </DetailRow>

          {/* Zuständig */}
          {task.assignedTo && (
            <DetailRow icon={<User size={13} />} label="Zuständig">
              {task.assignedTo}
            </DetailRow>
          )}

          {/* Objekt */}
          {property && (
            <DetailRow icon={<Building2 size={13} />} label="Objekt">
              {property.name}
            </DetailRow>
          )}

          {/* Einheit */}
          {unit && (
            <DetailRow icon={<FileText size={13} />} label="Einheit">
              {unit.name}
            </DetailRow>
          )}

          {/* Mieter */}
          {tenant && (
            <DetailRow icon={<Users size={13} />} label="Mieter">
              {tenant.name}
            </DetailRow>
          )}
        </div>

        {/* Edit + Delete */}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={onEdit} className="btn btn-sm btn-secondary flex-1">
            <Pencil size={13} /> Bearbeiten
          </button>
          <button onClick={onDelete} className="btn btn-sm btn-ghost text-rose-600 dark:text-rose-400">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-[12.5px]">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground min-w-[100px] flex-shrink-0">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </span>
      <span className="text-foreground flex-1">{children}</span>
    </div>
  );
}
