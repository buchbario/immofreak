import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  ListTodo,
  CheckCircle2,
  Clock,
  ArrowRight,
  LayoutDashboard,
  Sparkles,
  Pin,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LocaleContext';
import { usePrivateBoards } from '../../hooks/usePrivateBoards';
import { EmptyState } from '../ui/EmptyState';
import { Modal, Field, FormSection } from '../ui/Modal';
import { cn } from '../../lib/utils';

const ACCENT_PRESETS: Array<{ name: string; gradient: string; ring: string }> = [
  { name: 'Violet', gradient: 'from-violet-400 to-fuchsia-500', ring: 'ring-violet-300/40' },
  { name: 'Blue', gradient: 'from-sky-400 to-blue-600', ring: 'ring-sky-300/40' },
  { name: 'Emerald', gradient: 'from-emerald-400 to-teal-600', ring: 'ring-emerald-300/40' },
  { name: 'Amber', gradient: 'from-amber-400 to-orange-500', ring: 'ring-amber-300/40' },
  { name: 'Rose', gradient: 'from-rose-400 to-pink-600', ring: 'ring-rose-300/40' },
  { name: 'Slate', gradient: 'from-slate-500 to-slate-700', ring: 'ring-slate-300/40' },
];

function getAccent(accent?: string) {
  return ACCENT_PRESETS.find((a) => a.gradient === accent) || ACCENT_PRESETS[0];
}

export function PrivateDashboardPage() {
  const navigate = useNavigate();
  const { userName } = useAuth();
  const { t } = useTranslation();
  const firstName = (userName || 'da').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 11 ? t('greeting.morning') : hour < 18 ? t('greeting.day') : t('greeting.evening');

  const { boards, createBoard, togglePinBoard, listsForBoard, cardsForList, allCards } = usePrivateBoards();
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📋');
  const [accent, setAccent] = useState(ACCENT_PRESETS[0].gradient);

  // Stats across all boards
  const stats = useMemo(() => {
    const totalCards = allCards.length;
    const open = allCards.filter((c) => !c.completedAt).length;
    const done = allCards.filter((c) => !!c.completedAt).length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueSoon = allCards.filter((c) => {
      if (!c.dueDate || c.completedAt) return false;
      const d = new Date(c.dueDate);
      const diffDays = (d.getTime() - today.getTime()) / 86400000;
      return diffDays <= 3;
    }).length;
    return { totalCards, open, done, dueSoon };
  }, [allCards]);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const board = createBoard({ name: trimmed, icon: icon || '📋', accent });
    setName('');
    setIcon('📋');
    setAccent(ACCENT_PRESETS[0].gradient);
    setShowNewBoard(false);
    navigate(`/privat/boards/${board.id}`);
  };

  return (
    <div className="page-container">
      {/* Welcome — Stratify-style header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-7 sm:mb-9 px-1">
        <div className="min-w-0">
          <h1 className="text-[34px] sm:text-[42px] font-bold text-[#0f172a] tracking-tight leading-[1.1] mb-2 inline-flex items-center gap-3 flex-wrap">
            <span className="bg-[#ede9fe] px-3 py-1 rounded-lg inline-block">
              {greeting}, {firstName}!
            </span>
            <span className="text-[30px] sm:text-[36px]" role="img" aria-label="sparkles">✨</span>
          </h1>
          <p className="text-[18px] sm:text-[22px] text-muted-foreground/80 leading-relaxed font-light">
            {boards.length === 0
              ? t('private.greeting.subtitle.empty')
              : t('private.greeting.subtitle.with', {
                  open: stats.open,
                  done: stats.done,
                  taskWord: t(stats.open === 1 ? 'word.task.singular' : 'word.task.plural'),
                })}
          </p>
        </div>
        <button
          onClick={() => setShowNewBoard(true)}
          className="btn btn-md btn-primary shrink-0 mt-2"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">{t('private.board.new')}</span>
          <span className="sm:hidden">{t('common.new')}</span>
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <KpiCard
          icon={<LayoutDashboard size={14} />}
          tint="bg-violet-500/10 text-violet-600"
          label={t('dashboard.kpi.boards')}
          value={boards.length.toString()}
          hint={t(boards.length === 1 ? 'word.board.singular' : 'word.board.plural')}
        />
        <KpiCard
          icon={<ListTodo size={14} />}
          tint="bg-[#4F6BFF]/10 text-[#4F6BFF]"
          label={t('dashboard.kpi.open')}
          value={stats.open.toString()}
          hint={t('word.card.plural')}
        />
        <KpiCard
          icon={<Clock size={14} />}
          tint="bg-amber-500/10 text-amber-600"
          label={t('dashboard.kpi.due_soon')}
          value={stats.dueSoon.toString()}
          hint=""
        />
        <KpiCard
          icon={<CheckCircle2 size={14} />}
          tint="bg-emerald-500/10 text-emerald-600"
          label={t('dashboard.kpi.completed')}
          value={stats.done.toString()}
          hint=""
        />
      </div>

      {/* Boards grid */}
      {boards.length === 0 ? (
        <div className="bg-card border border-card-line rounded-xl">
          <EmptyState
            icon={<Sparkles size={20} />}
            title={t('private.board.empty.title')}
            description={t('private.board.empty.desc')}
            action={
              <button onClick={() => setShowNewBoard(true)} className="btn btn-md btn-primary">
                <Plus size={16} /> {t('private.board.empty.cta')}
              </button>
            }
          />
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-foreground">{t('private.boards.title')}</h2>
            <span className="text-xs text-muted-foreground">{boards.length} {t(boards.length === 1 ? 'word.board.singular' : 'word.board.plural')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((b) => {
              const lists = listsForBoard(b.id);
              const cardCount = lists.reduce((sum, l) => sum + cardsForList(l.id).length, 0);
              const openCount = lists.reduce(
                (sum, l) => sum + cardsForList(l.id).filter((c) => !c.completedAt).length,
                0,
              );
              const accentCfg = getAccent(b.accent);
              return (
                <div
                  key={b.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/privat/boards/${b.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/privat/boards/${b.id}`); } }}
                  className="group relative text-left bg-card border border-card-line rounded-xl overflow-hidden hover:border-[#4F6BFF]/40 hover:shadow-[0_4px_14px_rgba(15,23,42,0.06)] transition-all cursor-pointer"
                >
                  <div className={cn('h-20 relative bg-gradient-to-br', accentCfg.gradient)}>
                    <div className="absolute inset-0 flex items-end p-4 pb-3 text-white/95">
                      <span className="text-[28px]" role="img" aria-hidden>{b.icon || '📋'}</span>
                    </div>
                    {/* Pin-Toggle oben rechts auf dem Cover — sichtbarer Active-State, sonst nur on-hover */}
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePinBoard(b.id); }}
                      aria-label={b.pinned ? 'Pin aus Sidebar entfernen' : 'In Sidebar anpinnen'}
                      title={b.pinned ? 'Pin aus Sidebar entfernen' : 'In Sidebar anpinnen'}
                      className={cn(
                        'absolute top-2 right-2 size-7 rounded-md flex items-center justify-center backdrop-blur-sm transition-all cursor-pointer',
                        b.pinned
                          ? 'bg-white/85 text-[#4F6BFF] ring-1 ring-white/70 shadow-[0_2px_6px_rgba(15,23,42,0.18)]'
                          : 'bg-black/15 text-white/95 hover:bg-white/85 hover:text-[#4F6BFF] opacity-0 group-hover:opacity-100',
                      )}
                    >
                      <Pin size={13} className={cn(b.pinned && 'fill-current')} strokeWidth={b.pinned ? 2 : 2.2} />
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="text-[15px] font-semibold text-foreground line-clamp-1">{b.name}</p>
                      <ArrowRight size={14} className="text-muted-foreground group-hover:text-[#4F6BFF] group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lists.length} {t(lists.length === 1 ? 'word.list.singular' : 'word.list.plural')} · {cardCount} {t(cardCount === 1 ? 'word.card.singular' : 'word.card.plural')}
                      {openCount > 0 && (
                        <span className="ml-1 text-foreground/80 font-medium">· {openCount} {t('dashboard.kpi.open').toLowerCase()}</span>
                      )}
                      {b.pinned && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#4F6BFF] align-middle">
                          · <Pin size={9} className="fill-current" />
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Add new card */}
            <button
              onClick={() => setShowNewBoard(true)}
              className="bg-card/40 border-2 border-dashed border-card-line hover:border-[#4F6BFF]/40 hover:bg-card transition-all rounded-xl flex items-center justify-center min-h-[152px] cursor-pointer group"
            >
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground group-hover:text-[#4F6BFF] transition-colors">
                <div className="size-9 rounded-full bg-card-line/50 group-hover:bg-[#4F6BFF]/10 flex items-center justify-center transition-colors">
                  <Plus size={16} />
                </div>
                <span className="text-xs font-semibold">{t('private.board.new')}</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Modal: New board */}
      <Modal
        open={showNewBoard}
        onClose={() => setShowNewBoard(false)}
        size="md"
        title={
          <span className="inline-flex items-center gap-2.5">
            <span
              className={cn(
                'size-9 rounded-lg flex items-center justify-center text-lg ring-1 ring-white/40 bg-gradient-to-br',
                accent,
              )}
            >
              <span aria-hidden>{icon}</span>
            </span>
            <span>{t('private.board.new')}</span>
          </span>
        }
        description={t('private.board.empty.desc')}
        footer={
          <>
            <button onClick={() => setShowNewBoard(false)} className="btn btn-md btn-secondary">Abbrechen</button>
            <button onClick={handleCreate} disabled={!name.trim()} className="btn btn-md btn-primary">
              Board anlegen
            </button>
          </>
        }
      >
        <FormSection>
          <Field label="Name" required>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="z. B. Wochenplan, Ideen, Reise…"
              className="input"
            />
          </Field>

          <Field label="Emoji">
            <div className="flex flex-wrap gap-1.5">
              {['📋', '🎯', '✨', '💡', '🏠', '✈️', '🛒', '📚', '💪', '🧠'].map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={cn(
                    'size-9 rounded-lg flex items-center justify-center text-lg transition-all cursor-pointer',
                    icon === e
                      ? 'bg-[#4F6BFF]/15 ring-2 ring-[#4F6BFF]/40 scale-105'
                      : 'bg-card-line/40 hover:bg-card-line/70',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Farbe">
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((a) => (
                <button
                  key={a.gradient}
                  type="button"
                  onClick={() => setAccent(a.gradient)}
                  title={a.name}
                  className={cn(
                    'h-10 w-16 rounded-lg bg-gradient-to-br cursor-pointer transition-all',
                    a.gradient,
                    accent === a.gradient
                      ? 'ring-2 ring-foreground/30 scale-105 shadow-[0_3px_10px_-2px_rgba(15,23,42,0.18)]'
                      : 'opacity-80 hover:opacity-100',
                  )}
                />
              ))}
            </div>
          </Field>
        </FormSection>
      </Modal>
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
  hint: string;
}

function KpiCard({ icon, tint, label, value, hint }: KpiCardProps) {
  return (
    <div className="bg-card border border-card-line rounded-xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('size-7 rounded-lg flex items-center justify-center', tint)}>
          {icon}
        </div>
        <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl sm:text-[28px] leading-[1.1] font-bold text-foreground tabular-nums tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>
    </div>
  );
}
