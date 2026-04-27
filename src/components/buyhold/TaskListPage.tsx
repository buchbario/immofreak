import { useState, useMemo } from 'react';
import {
  Plus, Search, ListTodo, CheckCircle2, Clock, AlertCircle, Calendar, User,
} from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useTenants } from '../../hooks/useTenants';
import { useTrash } from '../../hooks/useTrash';
import { TaskForm } from './TaskForm';
import type { Task } from '../../types';
import { cn } from '../../lib/utils';

type FilterKey = 'alle' | 'offen' | 'in-bearbeitung' | 'erledigt' | 'ueberfaellig';

function fmtDate(d?: string) {
  if (!d) return '--';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));
}

function daysUntil(date?: string) {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

const PRIO_CLS: Record<Task['priority'], string> = {
  hoch: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  mittel: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  niedrig: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
};

const STATUS_CLS: Record<Task['status'], string> = {
  'offen': 'badge-blue',
  'in-bearbeitung': 'badge-amber',
  'erledigt': 'badge-green',
};

const STATUS_LABEL: Record<Task['status'], string> = {
  'offen': 'Offen',
  'in-bearbeitung': 'In Bearbeitung',
  'erledigt': 'Erledigt',
};

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

    // Sort: unfinished first, then by dueDate asc (no date last)
    return list.sort((a, b) => {
      if (a.status === 'erledigt' && b.status !== 'erledigt') return 1;
      if (a.status !== 'erledigt' && b.status === 'erledigt') return -1;
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [allTasks, search, filter, properties]);

  const handleSave = (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing?.id) {
      updateTask(editing.id, data);
    } else {
      createTask(data);
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = () => {
    if (!editing?.id) return;
    moveToTrash({
      entityType: 'task',
      entityId: editing.id,
      data: editing,
      label: `Vorgang: ${editing.title}`,
      sublabel: editing.category,
    });
    deleteTask(editing.id);
    setShowForm(false);
    setEditing(null);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setShowForm(true);
  };

  const handleQuickToggle = (t: Task) => {
    const next: Task['status'] = t.status === 'erledigt' ? 'offen' : 'erledigt';
    toggleStatus(t.id, next);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vorgänge</h1>
          <p className="page-subtitle">
            {counts.total} {counts.total === 1 ? 'Aufgabe' : 'Aufgaben'}
            {counts.ueberfaellig > 0 ? ` · ${counts.ueberfaellig} überfällig` : ''}
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn btn-md btn-primary"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Vorgang anlegen</span>
          <span className="sm:hidden">Neu</span>
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-card border border-card-line rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <ListTodo size={14} className="text-[#4F6BFF]" />
            <span className="text-xs font-medium text-muted-foreground">Offen</span>
          </div>
          <p className="text-lg font-semibold text-foreground tabular-nums">{counts.offen}</p>
        </div>
        <div className="bg-card border border-card-line rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Clock size={14} className="text-amber-500" />
            <span className="text-xs font-medium text-muted-foreground">In Bearbeitung</span>
          </div>
          <p className="text-lg font-semibold text-foreground tabular-nums">{counts.inBearbeitung}</p>
        </div>
        <div className="bg-card border border-card-line rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className="text-xs font-medium text-muted-foreground">Erledigt</span>
          </div>
          <p className="text-lg font-semibold text-foreground tabular-nums">{counts.erledigt}</p>
        </div>
        <div className="bg-card border border-card-line rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertCircle size={14} className="text-red-500" />
            <span className="text-xs font-medium text-muted-foreground">Überfällig</span>
          </div>
          <p className="text-lg font-semibold text-foreground tabular-nums">{counts.ueberfaellig}</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Titel, Beschreibung oder Objekt suchen..."
            className="input pl-9 w-full"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(
            [
              { key: 'alle', label: 'Alle' },
              { key: 'offen', label: `Offen${counts.offen ? ` (${counts.offen})` : ''}` },
              { key: 'in-bearbeitung', label: 'In Bearbeitung' },
              { key: 'ueberfaellig', label: `Überfällig${counts.ueberfaellig ? ` (${counts.ueberfaellig})` : ''}` },
              { key: 'erledigt', label: 'Erledigt' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
                filter === opt.key
                  ? 'bg-[#4F6BFF]/10 text-[#4F6BFF]'
                  : 'bg-layer-hover text-foreground/80 hover:bg-layer-active',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      {allTasks.length === 0 ? (
        <div className="surface empty-state">
          <div className="size-12 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center mb-4">
            <ListTodo size={22} className="text-[#4F6BFF]" />
          </div>
          <p className="text-sm font-semibold mb-1 text-foreground">Noch keine Vorgänge</p>
          <p className="text-sm mb-5 text-muted-foreground-2">
            Lege Aufgaben mit Fristen und Verantwortlichen an — z.B. Heizungswartung, Nebenkostenabrechnung, Vertragsverlängerungen.
          </p>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="btn btn-md btn-primary"
          >
            <Plus size={15} /> Vorgang anlegen
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface empty-state p-12 text-center">
          <Search size={22} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Keine Vorgänge gefunden.</p>
        </div>
      ) : (
        <div className="flex flex-col bg-card border border-card-line rounded-xl shadow-2xs overflow-hidden">
          <div className="divide-y divide-card-divider">
            {filtered.map((t) => {
              const property = properties.find((p) => p.id === t.propertyId);
              const unit = allUnits.find((u) => u.id === t.unitId);
              const tenant = allTenants.find((te) => te.id === t.tenantId);
              const days = daysUntil(t.dueDate);
              const isOverdue = t.status !== 'erledigt' && days !== null && days < 0;
              const isSoon = t.status !== 'erledigt' && days !== null && days >= 0 && days <= 7;
              const isDone = t.status === 'erledigt';
              return (
                <div
                  key={t.id}
                  onClick={() => openEdit(t)}
                  className="flex items-start gap-3 px-5 py-3.5 cursor-pointer hover:bg-layer-hover transition-colors"
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickToggle(t);
                    }}
                    className={cn(
                      'mt-0.5 size-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer',
                      isDone
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-card-line hover:border-primary',
                    )}
                    aria-label={isDone ? 'Als offen markieren' : 'Als erledigt markieren'}
                  >
                    {isDone && <CheckCircle2 size={14} className="text-white" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-sm font-semibold text-foreground',
                            isDone && 'line-through text-muted-foreground',
                          )}
                        >
                          {t.title}
                        </p>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border',
                            PRIO_CLS[t.priority],
                          )}
                        >
                          {t.priority}
                        </span>
                        <span className={cn('badge', STATUS_CLS[t.status])}>{STATUS_LABEL[t.status]}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-primary" /> {t.category}
                      </span>
                      {t.dueDate && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1',
                            isOverdue && 'text-red-600 dark:text-red-400 font-medium',
                            isSoon && !isOverdue && 'text-amber-600 dark:text-amber-400 font-medium',
                          )}
                        >
                          <Calendar size={11} />
                          {fmtDate(t.dueDate)}
                          {isOverdue && ` · ${Math.abs(days!)}T überfällig`}
                          {isSoon && !isOverdue && ` · in ${days}T`}
                        </span>
                      )}
                      {t.assignedTo && (
                        <span className="inline-flex items-center gap-1">
                          <User size={11} /> {t.assignedTo}
                        </span>
                      )}
                      {property && (
                        <span className="truncate">
                          {property.name}
                          {unit?.name ? ` · ${unit.name}` : ''}
                        </span>
                      )}
                      {tenant && <span className="truncate">Mieter: {tenant.name}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 border-t border-card-divider">
            <p className="text-xs text-muted-foreground">
              {filtered.length} von {counts.total} {counts.total === 1 ? 'Vorgang' : 'Vorgänge'}
            </p>
          </div>
        </div>
      )}

      {showForm && (
        <TaskForm
          initial={editing || undefined}
          properties={properties}
          units={allUnits}
          tenants={allTenants}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
        />
      )}
    </div>
  );
}
