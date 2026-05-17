import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Check,
  ListTodo,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { AppMode, Task, TaskCategory, TaskPriority } from '../../types';
import { TASK_CATEGORIES, TASK_PRIORITIES } from '../../types';
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

// Primärer CTA-Button (Anlegen) ist app-weit konsistent in Brand-Blau —
// nur Header-Icon-Tints und Pill-Active-Farben können pro Dashboard
// variieren (Visual-Variety), damit man im Multi-Dashboard-Kontext sieht
// wo man ist. Der Action-Button selbst bleibt Brand für Wiedererkennbarkeit.
const PRIMARY_BTN = 'bg-[#4F6BFF] hover:bg-[#3D56E0] text-white';

const ACCENTS: Record<AccentTone, { bg: string; text: string; ring: string; btn: string; pillActive: string }> = {
  blue: {
    bg: 'bg-[#4F6BFF]/10',
    text: 'text-[#4F6BFF]',
    ring: 'focus:border-[#4F6BFF]/40 focus:ring-[#4F6BFF]/15',
    btn: PRIMARY_BTN,
    pillActive: 'bg-[#4F6BFF] text-white',
  },
  emerald: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    ring: 'focus:border-emerald-400/50 focus:ring-emerald-400/20',
    btn: PRIMARY_BTN,
    pillActive: 'bg-[#4F6BFF] text-white',
  },
  violet: {
    bg: 'bg-violet-100 dark:bg-violet-500/15',
    text: 'text-violet-700 dark:text-violet-400',
    ring: 'focus:border-violet-400/50 focus:ring-violet-400/20',
    btn: PRIMARY_BTN,
    pillActive: 'bg-[#4F6BFF] text-white',
  },
};

const PRIO_DOT: Record<TaskPriority, string> = {
  hoch: 'bg-rose-500',
  mittel: 'bg-amber-500',
  niedrig: 'bg-violet-500',
};

const PRIO_LABEL: Record<TaskPriority, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
};

function categoriesForMode(mode: AppMode): TaskCategory[] {
  if (mode === 'fixflip') {
    return TASK_CATEGORIES.filter((c) =>
      ['Instandhaltung', 'Besichtigung', 'Behörde', 'Vertragsmanagement', 'Sonstiges'].includes(c),
    );
  }
  if (mode === 'private') return ['Sonstiges'];
  return [...TASK_CATEGORIES];
}

function defaultCategoryForMode(mode: AppMode): TaskCategory {
  if (mode === 'fixflip') return 'Instandhaltung';
  if (mode === 'private') return 'Sonstiges';
  return 'Instandhaltung';
}

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

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmFor, setConfirmFor] = useState<Task | null>(null);

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

      {/* Action: Neuer-Aufgabe-Button */}
      <div className="px-5 sm:px-6 pb-3">
        <button
          onClick={() => setModalOpen(true)}
          className={cn(
            'w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors cursor-pointer',
            tone.btn,
          )}
        >
          <Plus size={14} strokeWidth={2.4} /> Neue Aufgabe anlegen
        </button>
      </div>

      {/* Tasks-Liste */}
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

      {/* New-Task Modal */}
      {modalOpen && (
        <QuickTaskModal
          mode={mode}
          tone={tone}
          onClose={() => setModalOpen(false)}
          onCreate={(data) => {
            createTask({
              title: data.title,
              description: data.description,
              status: 'offen',
              priority: data.priority,
              category: data.category,
              mode,
              dueDate: data.dueDate || undefined,
              assignedTo: data.assignedTo || undefined,
            });
            setModalOpen(false);
          }}
          openFullForm={
            viewAllHref
              ? () => {
                  setModalOpen(false);
                  navigate(viewAllHref);
                }
              : undefined
          }
        />
      )}

      {/* Confirmation dialog */}
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

// =====================================================================
// Quick-Task-Modal
// =====================================================================

interface QuickTaskFormData {
  title: string;
  description: string;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate: string;
  assignedTo: string;
}

function QuickTaskModal({
  mode,
  tone,
  onClose,
  onCreate,
  openFullForm,
}: {
  mode: AppMode;
  tone: (typeof ACCENTS)[AccentTone];
  onClose: () => void;
  onCreate: (data: QuickTaskFormData) => void;
  openFullForm?: () => void;
}) {
  const availableCategories = categoriesForMode(mode);
  const [form, setForm] = useState<QuickTaskFormData>({
    title: '',
    description: '',
    priority: 'mittel',
    category: defaultCategoryForMode(mode),
    dueDate: '',
    assignedTo: '',
  });
  const set = <K extends keyof QuickTaskFormData>(k: K, v: QuickTaskFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const canSave = form.title.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    onCreate({ ...form, title: form.title.trim(), description: form.description.trim(), assignedTo: form.assignedTo.trim() });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0f1430]/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#1e1b4b]/[0.06] rounded-t-3xl sm:rounded-3xl max-w-[520px] w-full max-h-[calc(100dvh-1rem)] sm:max-h-[min(88vh,720px)] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — sticky */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#1e1b4b]/[0.06] flex-shrink-0">
          <h3 className="text-[16px] font-bold text-[#0f1430]">Neue Aufgabe</h3>
          <button onClick={onClose} className="text-[#1e1b4b]/45 hover:text-[#0f1430] p-1.5 rounded-full hover:bg-[#1e1b4b]/[0.04]">
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollbar, Rest vom Modal bleibt sichtbar */}
        <div className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div>
            <label className="block text-[11.5px] font-semibold text-[#0f1430] mb-1.5">Titel</label>
            <input
              type="text"
              autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={mode === 'private' ? 'z. B. Steuererklärung vorbereiten' : 'z. B. Heizungswartung beauftragen'}
              className={cn(
                'w-full rounded-full bg-white border border-[#1e1b4b]/[0.10] px-3.5 py-2.5 text-[14px] font-medium outline-none transition-colors focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15',
              )}
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-[#0f1430] mb-1.5">Beschreibung</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Notizen, Kontext, Fristen…"
              className={cn(
                'w-full rounded-2xl bg-white border border-[#1e1b4b]/[0.10] px-3.5 py-2.5 text-[13.5px] outline-none resize-none transition-colors focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15',
              )}
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-[#0f1430] mb-1.5">Priorität</label>
            <div className="flex items-center gap-1.5">
              {TASK_PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('priority', p)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition-colors cursor-pointer',
                    form.priority === p
                      ? cn(tone.pillActive, 'border-transparent')
                      : 'border-[#1e1b4b]/[0.10] bg-white text-[#1e1b4b]/65 hover:bg-[#1e1b4b]/[0.04] hover:text-[#0f1430]',
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', PRIO_DOT[p])} />
                  {PRIO_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableCategories.length > 1 && (
              <div>
                <label className="block text-[11.5px] font-semibold text-[#0f1430] mb-1.5">Kategorie</label>
                <select
                  value={form.category}
                  onChange={(e) => set('category', e.target.value as TaskCategory)}
                  className="w-full rounded-full bg-white border border-[#1e1b4b]/[0.10] px-3.5 py-2.5 text-[13.5px] outline-none cursor-pointer focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
                >
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-[11.5px] font-semibold text-[#0f1430] mb-1.5 flex items-center gap-1">
                <Calendar size={11} /> Frist
              </label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => set('dueDate', e.target.value)}
                className="w-full rounded-full bg-white border border-[#1e1b4b]/[0.10] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
              />
            </div>
          </div>

          {mode !== 'private' && (
            <div>
              <label className="block text-[11.5px] font-semibold text-[#0f1430] mb-1.5">Zuständig</label>
              <input
                type="text"
                value={form.assignedTo}
                onChange={(e) => set('assignedTo', e.target.value)}
                placeholder="z. B. Hausverwaltung, Eigentümer, Handwerker-Name"
                className="w-full rounded-full bg-white border border-[#1e1b4b]/[0.10] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
              />
            </div>
          )}
        </div>

        {/* Footer — sticky */}
        <div className="flex items-center justify-between gap-2 px-5 sm:px-6 py-3.5 border-t border-[#1e1b4b]/[0.06] bg-[#fafbff] flex-shrink-0"
        style={{ paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom, 0))' }}>
          {openFullForm ? (
            <button
              onClick={openFullForm}
              className="text-[12px] font-medium text-[#1e1b4b]/55 hover:text-[#0f1430] inline-flex items-center gap-1"
            >
              Mehr Details (mit Verknüpfung) <ArrowRight size={11} />
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-[12.5px] font-semibold rounded-full bg-white border border-[#1e1b4b]/[0.10] text-[#0f1430] hover:bg-[#1e1b4b]/[0.04] px-4 py-2"
            >
              Abbrechen
            </button>
            <button
              onClick={submit}
              disabled={!canSave}
              className={cn(
                'text-[12.5px] font-semibold rounded-full px-4 py-2 disabled:opacity-50',
                tone.btn,
              )}
            >
              Aufgabe anlegen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
