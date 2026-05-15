import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Check,
  ListTodo,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { AppMode, Task, TaskPriority } from '../../types';
import { cn } from '../../lib/utils';

type AccentTone = 'blue' | 'emerald' | 'violet';

interface QuickTaskWidgetProps {
  /** Welcher Dashboard-Modus diese Aufgaben gehören. */
  mode: AppMode;
  /** Optionaler Link zur vollständigen Vorgänge-Übersicht. */
  viewAllHref?: string;
  /** Headline-Akzent passend zum jeweiligen Dashboard. */
  accent?: AccentTone;
  /** Anzahl der angezeigten offenen Aufgaben. */
  maxOpen?: number;
}

const ACCENTS: Record<AccentTone, { bg: string; text: string; ring: string; btn: string }> = {
  blue: {
    bg: 'bg-[#4F6BFF]/10',
    text: 'text-[#4F6BFF]',
    ring: 'focus:border-[#4F6BFF]/40 focus:ring-[#4F6BFF]/15',
    btn: 'bg-[#4F6BFF] hover:bg-[#4361e8] text-white',
  },
  emerald: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    ring: 'focus:border-emerald-400/50 focus:ring-emerald-400/20',
    btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  violet: {
    bg: 'bg-violet-100 dark:bg-violet-500/15',
    text: 'text-violet-700 dark:text-violet-400',
    ring: 'focus:border-violet-400/50 focus:ring-violet-400/20',
    btn: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
};

const PRIO_DOT: Record<TaskPriority, string> = {
  hoch: 'bg-rose-500',
  mittel: 'bg-amber-500',
  niedrig: 'bg-violet-500',
};

function formatDueDate(iso: string): { label: string; tone: 'overdue' | 'today' | 'soon' | 'normal' } {
  const due = new Date(iso);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)} T. überfällig`, tone: 'overdue' };
  if (days === 0) return { label: 'Heute', tone: 'today' };
  if (days === 1) return { label: 'Morgen', tone: 'soon' };
  if (days <= 7) return { label: `In ${days} T.`, tone: 'soon' };
  const fmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
  return { label: fmt.format(due), tone: 'normal' };
}

export function QuickTaskWidget({
  mode,
  viewAllHref,
  accent = 'blue',
  maxOpen = 5,
}: QuickTaskWidgetProps) {
  const navigate = useNavigate();
  const { allTasks, createTask, toggleStatus } = useTasks();
  const tone = ACCENTS[accent];

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [confirmFor, setConfirmFor] = useState<Task | null>(null);

  // Aufgaben dieses Dashboards: explizit `mode === <mode>` ODER (für Altbestand)
  // wenn das Feld noch leer ist und der Modus „buyhold" ist — dort sind alle
  // historischen Vorgänge entstanden.
  const scopedTasks = useMemo(
    () => allTasks.filter((t) => t.mode === mode || (!t.mode && mode === 'buyhold')),
    [allTasks, mode],
  );

  const openTasks = useMemo(() => {
    return [...scopedTasks]
      .filter((t) => t.status !== 'erledigt')
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      });
  }, [scopedTasks]);

  const overdueCount = scopedTasks.filter((t) => {
    if (t.status === 'erledigt' || !t.dueDate) return false;
    return new Date(t.dueDate).getTime() < Date.now();
  }).length;

  const handleCreate = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    createTask({
      title: trimmed,
      description: '',
      status: 'offen',
      priority: 'mittel',
      category: 'Sonstiges',
      mode,
      dueDate: dueDate || undefined,
    });
    setTitle('');
    setDueDate('');
    setShowDate(false);
  };

  const handleConfirmDone = () => {
    if (!confirmFor) return;
    toggleStatus(confirmFor.id, 'erledigt');
    setConfirmFor(null);
  };

  const visible = openTasks.slice(0, maxOpen);

  return (
    <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={cn('size-7 rounded-lg flex items-center justify-center', tone.bg, tone.text)}>
            <ListTodo size={14} />
          </span>
          <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Aufgaben</h2>
          {overdueCount > 0 ? (
            <span className="text-[12px] font-semibold text-rose-600 dark:text-rose-400">
              {overdueCount} überfällig
            </span>
          ) : (
            <span className="text-[12px] text-muted-foreground/80">
              {openTasks.length} offen
            </span>
          )}
        </div>
        {viewAllHref && (
          <button
            onClick={() => navigate(viewAllHref)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Alle <ArrowRight size={12} />
          </button>
        )}
      </div>

      {/* Quick create — large rounded input */}
      <div className="px-5 sm:px-6 pb-3">
        <div className={cn(
          'flex items-center gap-2 rounded-full bg-layer-hover/70 border border-transparent px-3 py-1 transition-colors focus-within:bg-card focus-within:ring-2',
          tone.ring,
        )}>
          <Plus size={15} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreate();
              }
            }}
            placeholder="Neue Aufgabe anlegen…"
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/70 py-1.5 outline-none"
          />
          <button
            type="button"
            onClick={() => setShowDate((v) => !v)}
            className={cn(
              'size-7 rounded-full flex items-center justify-center transition-colors cursor-pointer',
              showDate || dueDate ? cn(tone.bg, tone.text) : 'text-muted-foreground/70 hover:bg-card',
            )}
            title="Frist hinzufügen"
            aria-label="Frist hinzufügen"
          >
            <Calendar size={13} />
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!title.trim()}
            className={cn(
              'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
              tone.btn,
            )}
          >
            Anlegen
          </button>
        </div>
        {showDate && (
          <div className="mt-2 flex items-center gap-2 pl-1">
            <label className="text-[11.5px] font-medium text-muted-foreground">Frist:</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-[12px] rounded-full bg-layer-hover/70 border border-transparent px-3 py-1 text-foreground outline-none focus:bg-card focus:ring-2 focus:ring-offset-0 focus:ring-[#4F6BFF]/15 focus:border-[#4F6BFF]/40"
            />
            {dueDate && (
              <button
                type="button"
                onClick={() => setDueDate('')}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                löschen
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="px-2 sm:px-3 pb-3">
        {visible.length === 0 ? (
          <div className="py-7 px-4 text-center">
            <div className={cn('size-10 mx-auto rounded-xl flex items-center justify-center mb-2', tone.bg, tone.text)}>
              <Sparkles size={16} />
            </div>
            <p className="text-[12.5px] font-medium text-foreground mb-0.5">Alles erledigt!</p>
            <p className="text-[11.5px] text-muted-foreground">
              Lege oben eine neue Aufgabe an.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-card-divider">
            {visible.map((task) => {
              const due = task.dueDate ? formatDueDate(task.dueDate) : null;
              return (
                <li key={task.id} className="group flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-layer-hover/60 transition-colors">
                  <button
                    onClick={() => setConfirmFor(task)}
                    className={cn(
                      'mt-0.5 size-[18px] rounded-full border-[1.5px] border-muted-foreground/40 grid place-items-center transition-all shrink-0 cursor-pointer',
                      'hover:border-emerald-500 hover:bg-emerald-500/10 hover:scale-105',
                    )}
                    title="Als erledigt markieren"
                    aria-label="Als erledigt markieren"
                  >
                    <Check size={11} className="opacity-0 group-hover:opacity-100 text-emerald-600 transition-opacity" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground leading-snug">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                      <span className={cn('size-1.5 rounded-full', PRIO_DOT[task.priority])} />
                      {due && (
                        <>
                          <span
                            className={cn(
                              'font-semibold',
                              due.tone === 'overdue' && 'text-rose-600 dark:text-rose-400',
                              due.tone === 'today' && 'text-rose-600 dark:text-rose-400',
                              due.tone === 'soon' && 'text-amber-600 dark:text-amber-400',
                            )}
                          >
                            {due.label}
                          </span>
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
        {openTasks.length > visible.length && (
          <button
            onClick={() => viewAllHref && navigate(viewAllHref)}
            className="w-full mt-1 px-3 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-layer-hover/60 rounded-lg transition-colors cursor-pointer"
            disabled={!viewAllHref}
          >
            +{openTasks.length - visible.length} weitere {viewAllHref ? 'anzeigen' : 'offen'}
          </button>
        )}
      </div>

      {/* Confirmation dialog before completing a task */}
      <ConfirmDialog
        open={!!confirmFor}
        onClose={() => setConfirmFor(null)}
        onConfirm={handleConfirmDone}
        title="Aufgabe erledigt?"
        message={
          <>
            <span className="font-semibold text-foreground">„{confirmFor?.title}"</span> als erledigt
            markieren? Du findest sie weiterhin in der Aufgaben-Liste.
          </>
        }
        confirmLabel="Ja, erledigt"
        cancelLabel="Abbrechen"
        variant="primary"
      />
    </div>
  );
}
