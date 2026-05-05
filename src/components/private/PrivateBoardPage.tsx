import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  useDroppable,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  ArrowLeft,
  MoreHorizontal,
  X,
  Calendar,
  CheckSquare,
  AlignLeft,
  Trash2,
  Pencil,
  Check,
  GripVertical,
  Flag,
  Pin,
  PinOff,
} from 'lucide-react';
import { usePrivateBoards } from '../../hooks/usePrivateBoards';
import type { PrivateCard, PrivateCardPriority } from '../../types';
import { Modal, Field, FormSection, FormRow } from '../ui/Modal';
import { cn } from '../../lib/utils';

const PRIORITY_LABEL: Record<PrivateCardPriority, string> = {
  low: 'Niedrig',
  normal: 'Normal',
  high: 'Hoch',
};

const PRIORITY_DOT: Record<PrivateCardPriority, string> = {
  low: 'bg-slate-400',
  normal: 'bg-sky-500',
  high: 'bg-rose-500',
};

const PRIORITY_PILL: Record<PrivateCardPriority, string> = {
  low: 'bg-slate-100 text-slate-700 border-slate-200',
  normal: 'bg-sky-50 text-sky-700 border-sky-100',
  high: 'bg-rose-50 text-rose-700 border-rose-100',
};

const collision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return rectIntersection(args);
};

const ACCENT_GRADIENT_FALLBACK = 'from-violet-400 to-fuchsia-500';

/**
 * Spalten-Farb-Palette analog zur Fix-&-Flip-Pipeline.
 * Da Privat-Boards keine festen Spalten-Namen haben (User benennt selbst),
 * cyclen wir per Index durch die gleiche Blau/Amber/Orange/Grün/Lila-Familie.
 * Spalten mit Namen „Erledigt"/„Done"/„Fertig" bekommen explizit Grün.
 */
type ColumnTint = 'blue' | 'amber' | 'orange' | 'green' | 'purple' | 'gray';

const COLUMN_PALETTE: Record<ColumnTint, {
  dot: string; bg: string; border: string; dropRing: string; dropBg: string;
}> = {
  blue:   { dot: 'dot-blue',   bg: 'bg-[#4F6BFF]/5',   border: 'border-[#4F6BFF]/15',   dropRing: 'ring-[#4F6BFF]/30',   dropBg: 'bg-[#4F6BFF]/10' },
  amber:  { dot: 'dot-amber',  bg: 'bg-amber-500/5',   border: 'border-amber-500/15',   dropRing: 'ring-amber-500/30',   dropBg: 'bg-amber-500/10' },
  orange: { dot: 'dot-orange', bg: 'bg-orange-500/5',  border: 'border-orange-500/15',  dropRing: 'ring-orange-500/30',  dropBg: 'bg-orange-500/10' },
  green:  { dot: 'dot-green',  bg: 'bg-emerald-500/5', border: 'border-emerald-500/15', dropRing: 'ring-emerald-500/30', dropBg: 'bg-emerald-500/10' },
  purple: { dot: 'dot-purple', bg: 'bg-violet-500/5',  border: 'border-violet-500/15',  dropRing: 'ring-violet-500/30',  dropBg: 'bg-violet-500/10' },
  gray:   { dot: 'dot-gray',   bg: 'bg-gray-500/5',    border: 'border-gray-500/15',    dropRing: 'ring-gray-500/30',    dropBg: 'bg-gray-500/10' },
};

const PALETTE_CYCLE: ColumnTint[] = ['blue', 'amber', 'orange', 'purple', 'gray'];

function tintForColumn(name: string, index: number): ColumnTint {
  if (/erledigt|done|fertig|abgeschlossen/i.test(name)) return 'green';
  return PALETTE_CYCLE[index % PALETTE_CYCLE.length];
}

export function PrivateBoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getBoardById,
    updateBoard,
    togglePinBoard,
    deleteBoard,
    listsForBoard,
    createList,
    renameList,
    deleteList,
    cardsForList,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
  } = usePrivateBoards();

  const board = id ? getBoardById(id) : undefined;
  const lists = id ? listsForBoard(id) : [];

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [editingBoardName, setEditingBoardName] = useState(false);
  const [boardName, setBoardName] = useState(board?.name ?? '');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const boardMenuRef = useRef<HTMLDivElement>(null);

  // Build a quick lookup so DnD can find a card across lists by id
  const cardsByList = useMemo(() => {
    const m: Record<string, PrivateCard[]> = {};
    lists.forEach((l) => { m[l.id] = cardsForList(l.id); });
    return m;
  }, [lists, cardsForList]);

  const allCards = useMemo(
    () => Object.values(cardsByList).flat(),
    [cardsByList],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    setBoardName(board?.name ?? '');
  }, [board?.id, board?.name]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boardMenuRef.current && !boardMenuRef.current.contains(e.target as Node)) setBoardMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!board || !id) {
    return (
      <div className="page-container">
        <div className="bg-card border border-card-line rounded-xl p-10 text-center">
          <p className="text-base font-semibold text-foreground mb-1.5">Board nicht gefunden</p>
          <p className="text-sm text-muted-foreground mb-5">Möglicherweise wurde es gelöscht.</p>
          <button onClick={() => navigate('/privat')} className="btn btn-md btn-primary">
            <ArrowLeft size={15} /> Zurück zur Übersicht
          </button>
        </div>
      </div>
    );
  }

  const handleDragStart = (e: DragStartEvent) => {
    setActiveCardId(e.active.id as string);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveCardId(null);
    const { active, over } = e;
    if (!over) return;
    const cardId = active.id as string;
    const overId = over.id as string;

    // Determine target list:
    //  - drop on a list-droppable (id starts with `list:`) → use that list, append at end
    //  - drop on a card → use that card's list, place before/after based on order
    let targetListId: string | undefined;
    let targetOrder = 0;

    if (overId.startsWith('list:')) {
      targetListId = overId.slice('list:'.length);
      targetOrder = (cardsByList[targetListId] ?? []).length;
    } else {
      const overCard = allCards.find((c) => c.id === overId);
      if (!overCard) return;
      targetListId = overCard.listId;
      targetOrder = overCard.order;
    }

    const card = allCards.find((c) => c.id === cardId);
    if (!card || !targetListId) return;

    // No-op if dropped exactly on itself
    if (card.id === overId) return;

    // Mark as completed when moved to a list named "Erledigt"/"Done"
    const targetList = lists.find((l) => l.id === targetListId);
    const isDoneList = !!targetList && /erledigt|done|fertig/i.test(targetList.name);
    const updates: Partial<PrivateCard> = {};
    if (isDoneList && !card.completedAt) updates.completedAt = new Date().toISOString();
    if (!isDoneList && card.completedAt) updates.completedAt = undefined;

    moveCard(cardId, targetListId, targetOrder);
    if (Object.keys(updates).length > 0) updateCard(cardId, updates);
  };

  const accentGradient = board.accent || ACCENT_GRADIENT_FALLBACK;
  const openCard = openCardId ? allCards.find((c) => c.id === openCardId) ?? null : null;

  const commitBoardName = () => {
    const trimmed = boardName.trim();
    if (trimmed && trimmed !== board.name) updateBoard(board.id, { name: trimmed });
    else setBoardName(board.name);
    setEditingBoardName(false);
  };

  const handleDeleteBoard = () => {
    if (!confirm(`Board „${board.name}" und alle Karten wirklich löschen?`)) return;
    deleteBoard(board.id);
    navigate('/privat');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="page-container pb-3">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate('/privat')}
            className="size-9 rounded-lg hover:bg-layer-hover flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex-shrink-0"
            aria-label="Zurück"
          >
            <ArrowLeft size={17} />
          </button>
          <div className={cn('size-12 sm:size-14 rounded-xl bg-gradient-to-br flex items-center justify-center text-2xl ring-1 ring-white/40 shadow-[0_4px_12px_-2px_rgba(15,23,42,0.18)] flex-shrink-0', accentGradient)}>
            <span role="img" aria-hidden>{board.icon || '📋'}</span>
          </div>
          <div className="min-w-0 flex-1">
            {editingBoardName ? (
              <input
                autoFocus
                type="text"
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                onBlur={commitBoardName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitBoardName();
                  if (e.key === 'Escape') { setBoardName(board.name); setEditingBoardName(false); }
                }}
                className="text-[24px] sm:text-[28px] font-bold text-foreground bg-transparent border-b-2 border-[#4F6BFF]/40 focus:outline-none focus:border-[#4F6BFF] tracking-tight leading-tight w-full"
              />
            ) : (
              <button
                onClick={() => setEditingBoardName(true)}
                className="text-[24px] sm:text-[28px] font-bold text-foreground tracking-tight leading-tight text-left hover:text-[#4F6BFF] transition-colors cursor-text truncate w-full block"
              >
                {board.name}
              </button>
            )}
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {lists.length} {lists.length === 1 ? 'Liste' : 'Listen'} · {allCards.length} {allCards.length === 1 ? 'Karte' : 'Karten'}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {/* Quick-Pin: hebt sich farblich ab wenn aktiv, damit man im Header sofort sieht ob das Board in der Sidebar ist */}
            <button
              onClick={() => togglePinBoard(board.id)}
              aria-label={board.pinned ? 'Pin aus Sidebar entfernen' : 'In Sidebar anpinnen'}
              title={board.pinned ? 'Pin aus Sidebar entfernen' : 'In Sidebar anpinnen'}
              className={cn(
                'size-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer',
                board.pinned
                  ? 'bg-[#4F6BFF]/12 text-[#4F6BFF] hover:bg-[#4F6BFF]/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-layer-hover',
              )}
            >
              <Pin size={17} className={cn(board.pinned && 'fill-current')} strokeWidth={board.pinned ? 2 : 1.8} />
            </button>

            <div className="relative" ref={boardMenuRef}>
              <button
                onClick={() => setBoardMenuOpen(!boardMenuOpen)}
                className="size-9 rounded-lg hover:bg-layer-hover flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Board-Menü"
              >
                <MoreHorizontal size={18} />
              </button>
              {boardMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-dropdown border border-dropdown-line rounded-lg shadow-lg p-1 min-w-[200px]">
                  <button
                    onClick={() => { setBoardMenuOpen(false); setEditingBoardName(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-dropdown-item-foreground hover:bg-dropdown-item-hover cursor-pointer text-left"
                  >
                    <Pencil size={14} /> Umbenennen
                  </button>
                  <button
                    onClick={() => { setBoardMenuOpen(false); togglePinBoard(board.id); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-dropdown-item-foreground hover:bg-dropdown-item-hover cursor-pointer text-left"
                  >
                    {board.pinned ? <><PinOff size={14} /> Pin entfernen</> : <><Pin size={14} /> In Sidebar anpinnen</>}
                  </button>
                  <button
                    onClick={() => { setBoardMenuOpen(false); handleDeleteBoard(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-rose-600 hover:bg-rose-50 cursor-pointer text-left"
                  >
                    <Trash2 size={14} /> Board löschen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto px-6 sm:px-8 pb-8">
        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full min-w-max lg:min-w-0">
            {lists.map((l, index) => (
              <Column
                key={l.id}
                listId={l.id}
                title={l.name}
                tint={tintForColumn(l.name, index)}
                cards={cardsByList[l.id] ?? []}
                onAddCard={(title) => createCard({ listId: l.id, boardId: board.id, title })}
                onRenameList={(name) => renameList(l.id, name)}
                onDeleteList={() => {
                  if ((cardsByList[l.id] ?? []).length === 0 || confirm(`Liste „${l.name}" mit allen Karten löschen?`)) {
                    deleteList(l.id);
                  }
                }}
                onOpenCard={(cardId) => setOpenCardId(cardId)}
              />
            ))}

            <AddListColumn onAdd={(name) => createList(board.id, name)} />
          </div>

          <DragOverlay>
            {activeCardId ? (
              <div className="rounded-lg shadow-xl w-[278px] rotate-1 opacity-95 ring-2 ring-[#4F6BFF]/30 bg-card border border-primary">
                {(() => {
                  const c = allCards.find((x) => x.id === activeCardId);
                  return c ? <CardBody card={c} /> : null;
                })()}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {openCard && (
        <CardModal
          card={openCard}
          onClose={() => setOpenCardId(null)}
          onSave={(updates) => updateCard(openCard.id, updates)}
          onDelete={() => { deleteCard(openCard.id); setOpenCardId(null); }}
        />
      )}
    </div>
  );
}

// ============= Column =============

interface ColumnProps {
  listId: string;
  title: string;
  tint: ColumnTint;
  cards: PrivateCard[];
  onAddCard: (title: string) => void;
  onRenameList: (name: string) => void;
  onDeleteList: () => void;
  onOpenCard: (cardId: string) => void;
}

function Column({ listId, title, tint, cards, onAddCard, onRenameList, onDeleteList, onOpenCard }: ColumnProps) {
  const droppableId = `list:${listId}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const [adding, setAdding] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(title);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setName(title), [title]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const commit = () => {
    onAddCard(newCardTitle.trim());
    setNewCardTitle('');
  };

  const commitName = () => {
    const t = name.trim();
    if (t && t !== title) onRenameList(t);
    else setName(title);
    setEditingName(false);
  };

  const c = COLUMN_PALETTE[tint];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col flex-1 min-w-[290px] rounded-[10px] border transition-all',
        isOver ? `ring-2 ${c.dropRing} ${c.dropBg}` : `${c.bg} ${c.border}`,
      )}
    >
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {editingName ? (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <span className={`dot ${c.dot}`} />
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setName(title); setEditingName(false); } }}
                className="text-sm font-semibold text-foreground bg-transparent border-b border-[#4F6BFF]/40 focus:outline-none min-w-0"
              />
            </span>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-[#4F6BFF] transition-colors cursor-text truncate"
            >
              <span className={`dot ${c.dot}`} />
              <span className="truncate">{title}</span>
            </button>
          )}
          <span className="badge badge-gray">
            {cards.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5 relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="btn btn-ghost w-7 h-7 !p-0 flex items-center justify-center rounded-lg"
            aria-label="Listen-Menü"
          >
            <MoreHorizontal size={14} />
          </button>
          <button
            onClick={() => setAdding(true)}
            className="btn btn-ghost w-7 h-7 !p-0 flex items-center justify-center rounded-lg"
            aria-label="Karte hinzufügen"
          >
            <Plus size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 bg-dropdown border border-dropdown-line rounded-lg shadow-lg p-1 min-w-[160px]">
              <button
                onClick={() => { setMenuOpen(false); setEditingName(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-dropdown-item-foreground hover:bg-dropdown-item-hover cursor-pointer text-left"
              >
                <Pencil size={13} /> Umbenennen
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDeleteList(); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-rose-600 hover:bg-rose-50 cursor-pointer text-left"
              >
                <Trash2 size={13} /> Liste löschen
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-2 pb-2 space-y-2.5 overflow-y-auto">
        <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} onClick={() => onOpenCard(card.id)} />
          ))}
        </SortableContext>

        {cards.length === 0 && !adding && (
          <div className="flex items-center justify-center h-24 text-xs font-medium border-2 border-dashed rounded-lg mx-1 text-muted-foreground border-card-line">
            Keine Karten
          </div>
        )}

        {adding && (
          <div className="bg-card border border-[#4F6BFF]/40 rounded-lg p-2.5 shadow-sm mx-1">
            <textarea
              autoFocus
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (newCardTitle.trim()) { commit(); }
                  else { setAdding(false); }
                }
                if (e.key === 'Escape') { setAdding(false); setNewCardTitle(''); }
              }}
              placeholder="Was steht an?"
              rows={2}
              className="w-full text-sm bg-transparent focus:outline-none resize-none placeholder:text-muted-foreground/60"
            />
            <div className="flex items-center justify-end gap-1 mt-1">
              <button
                onClick={() => { setAdding(false); setNewCardTitle(''); }}
                className="size-7 rounded-md hover:bg-layer-hover flex items-center justify-center text-muted-foreground cursor-pointer"
                aria-label="Abbrechen"
              >
                <X size={14} />
              </button>
              <button
                onClick={() => { if (newCardTitle.trim()) commit(); }}
                disabled={!newCardTitle.trim()}
                className="btn btn-sm btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        )}

        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="w-[calc(100%-0.5rem)] mx-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-[#4F6BFF] hover:bg-card transition-colors cursor-pointer"
          >
            <Plus size={13} /> Karte hinzufügen
          </button>
        )}
      </div>
    </div>
  );
}

// ============= Cards =============

function SortableCard({ card, onClick }: { card: PrivateCard; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { listId: card.listId },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
      onClick={(e) => { if (!isDragging) { e.stopPropagation(); onClick(); } }}
    >
      <div className="rounded-lg hover:brightness-110 transition-all bg-card border border-card-line">
        <CardBody card={card} />
      </div>
    </div>
  );
}

function CardBody({ card }: { card: PrivateCard }) {
  const checklistTotal = card.checklist?.length ?? 0;
  const checklistDone = card.checklist?.filter((c) => c.done).length ?? 0;
  const due = card.dueDate ? new Date(card.dueDate) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDays = due ? Math.round((due.getTime() - today.getTime()) / 86400000) : null;
  const dueClass = dueDays === null
    ? ''
    : dueDays < 0 ? 'bg-rose-50 text-rose-700 border-rose-100'
    : dueDays <= 3 ? 'bg-amber-50 text-amber-700 border-amber-100'
    : 'bg-slate-50 text-slate-600 border-slate-100';

  const hasMeta = !!(due || checklistTotal > 0 || card.priority || card.description);
  const checklistComplete = checklistTotal > 0 && checklistDone === checklistTotal;

  return (
    <div className={cn('p-4', card.completedAt && 'opacity-70')}>
      {card.labels && card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.map((l) => (
            <span key={l} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#4F6BFF]/10 text-[#4F6BFF]">{l}</span>
          ))}
        </div>
      )}
      <h3 className={cn('text-sm font-semibold text-foreground leading-snug', card.completedAt && 'line-through text-muted-foreground')}>
        {card.title}
      </h3>
      {card.description && (
        <p className="text-xs truncate mt-0.5 text-muted-foreground">{card.description}</p>
      )}
      {card.priority && (
        <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border mt-3', PRIORITY_PILL[card.priority])}>
          <span className={cn('size-1.5 rounded-full', PRIORITY_DOT[card.priority])} />
          {PRIORITY_LABEL[card.priority]}
        </span>
      )}

      {hasMeta && (due || checklistTotal > 0) && (
        <>
          <div className="my-3 border-t border-card-divider" />
          <div className="flex items-center justify-between text-xs">
            {due && (
              <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border', dueClass)}>
                <Calendar size={10} />
                {due.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
              </span>
            )}
            {checklistTotal > 0 && (
              <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums',
                checklistComplete ? 'text-emerald-600' : 'text-muted-foreground-2')}>
                <CheckSquare size={11} />
                {checklistDone}/{checklistTotal}
              </span>
            )}
            {!due && !checklistTotal && card.description && (
              <span className="inline-flex items-center text-[10px] text-muted-foreground" title="Beschreibung vorhanden">
                <AlignLeft size={11} />
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============= Add list column =============

function AddListColumn({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const commit = () => {
    if (name.trim()) { onAdd(name.trim()); setName(''); setAdding(false); }
  };
  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex-shrink-0 min-w-[290px] self-stretch border-2 border-dashed border-card-line hover:border-[#4F6BFF]/40 hover:bg-[#4F6BFF]/5 transition-all rounded-[10px] flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-[#4F6BFF] cursor-pointer"
      >
        <Plus size={15} /> Liste hinzufügen
      </button>
    );
  }
  return (
    <div className="flex-shrink-0 min-w-[290px] self-start bg-card border border-[#4F6BFF]/40 rounded-[10px] p-3 shadow-sm">
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setAdding(false); setName(''); } }}
        placeholder="Listenname"
        className="input w-full mb-2"
      />
      <div className="flex items-center justify-end gap-1">
        <button onClick={() => { setAdding(false); setName(''); }} className="size-7 rounded-md hover:bg-layer-hover flex items-center justify-center text-muted-foreground cursor-pointer" aria-label="Abbrechen">
          <X size={14} />
        </button>
        <button onClick={commit} disabled={!name.trim()} className="btn btn-sm btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
          Hinzufügen
        </button>
      </div>
    </div>
  );
}

// ============= Card modal =============

interface CardModalProps {
  card: PrivateCard;
  onClose: () => void;
  onSave: (updates: Partial<PrivateCard>) => void;
  onDelete: () => void;
}

function CardModal({ card, onClose, onSave, onDelete }: CardModalProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [dueDate, setDueDate] = useState(card.dueDate ? card.dueDate.slice(0, 10) : '');
  const [priority, setPriority] = useState<PrivateCardPriority | ''>(card.priority ?? '');
  const [labels, setLabels] = useState<string[]>(card.labels ?? []);
  const [labelInput, setLabelInput] = useState('');
  const [checklist, setChecklist] = useState(card.checklist ?? []);
  const [newCheckText, setNewCheckText] = useState('');

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description ?? '');
    setDueDate(card.dueDate ? card.dueDate.slice(0, 10) : '');
    setPriority(card.priority ?? '');
    setLabels(card.labels ?? []);
    setChecklist(card.checklist ?? []);
  }, [card.id]);

  const save = () => {
    onSave({
      title: title.trim() || card.title,
      description: description.trim() || undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      priority: priority || undefined,
      labels: labels.length > 0 ? labels : undefined,
      checklist: checklist.length > 0 ? checklist : undefined,
    });
    onClose();
  };

  const addLabel = () => {
    const t = labelInput.trim();
    if (!t || labels.includes(t)) return;
    setLabels([...labels, t]);
    setLabelInput('');
  };

  const addCheck = () => {
    const t = newCheckText.trim();
    if (!t) return;
    setChecklist([...checklist, { id: Math.random().toString(36).slice(2), text: t, done: false }]);
    setNewCheckText('');
  };

  const checklistDone = checklist.filter((c) => c.done).length;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel"
          className="w-full text-[17px] font-semibold text-foreground bg-transparent focus:outline-none placeholder:text-muted-foreground/60 -my-1"
        />
      }
      footerLeft={
        <button
          onClick={() => { if (confirm('Karte wirklich löschen?')) onDelete(); }}
          className="btn btn-md btn-ghost text-rose-600 hover:bg-rose-50"
        >
          <Trash2 size={14} /> Löschen
        </button>
      }
      footer={
        <>
          <button onClick={onClose} className="btn btn-md btn-secondary">Abbrechen</button>
          <button onClick={save} className="btn btn-md btn-primary">Speichern</button>
        </>
      }
    >
      <FormSection>
        <FormRow cols={2}>
          <Field
            label={<span className="inline-flex items-center gap-1.5"><Calendar size={12} /> Fällig am</span>}
          >
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input"
            />
          </Field>
          <Field
            label={<span className="inline-flex items-center gap-1.5"><Flag size={12} /> Priorität</span>}
          >
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PrivateCardPriority | '')}
              className="input"
            >
              <option value="">— keine —</option>
              <option value="low">Niedrig</option>
              <option value="normal">Normal</option>
              <option value="high">Hoch</option>
            </select>
          </Field>
        </FormRow>

        <Field
          label={<span className="inline-flex items-center gap-1.5"><AlignLeft size={12} /> Beschreibung</span>}
        >
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Notizen, Details, Links…"
            className="input resize-y"
          />
        </Field>
      </FormSection>

      <FormSection title="Labels">
        <Field>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {labels.map((l) => (
              <span key={l} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-[#4F6BFF]/10 text-[#4F6BFF]">
                {l}
                <button onClick={() => setLabels(labels.filter((x) => x !== l))} className="text-[#4F6BFF]/70 hover:text-[#4F6BFF] cursor-pointer" aria-label="Entfernen">
                  <X size={11} />
                </button>
              </span>
            ))}
            {labels.length === 0 && <span className="text-xs text-muted-foreground">Keine Labels</span>}
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLabel())}
              placeholder="Neues Label"
              className="input flex-1"
            />
            <button onClick={addLabel} className="btn btn-md btn-secondary">
              <Plus size={14} />
            </button>
          </div>
        </Field>
      </FormSection>

      <FormSection title={
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5"><CheckSquare size={11} /> Checkliste</span>
          {checklist.length > 0 && (
            <span className="text-[10px] text-muted-foreground font-medium normal-case tracking-normal">
              {checklistDone}/{checklist.length}
            </span>
          )}
        </span>
      }>
        <Field>
          <div className="space-y-1.5">
            {checklist.map((c) => (
              <div key={c.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => setChecklist(checklist.map((x) => x.id === c.id ? { ...x, done: !x.done } : x))}
                  className={cn(
                    'size-[18px] rounded-[5px] border flex items-center justify-center cursor-pointer transition-colors flex-shrink-0',
                    c.done ? 'bg-[#4F6BFF] border-[#4F6BFF]' : 'border-card-line hover:border-[#4F6BFF]',
                  )}
                  aria-label={c.done ? 'Erledigt – wieder öffnen' : 'Als erledigt markieren'}
                >
                  {c.done && <Check size={11} className="text-white" strokeWidth={3} />}
                </button>
                <input
                  type="text"
                  value={c.text}
                  onChange={(e) => setChecklist(checklist.map((x) => x.id === c.id ? { ...x, text: e.target.value } : x))}
                  className={cn(
                    'flex-1 bg-transparent text-sm focus:outline-none px-2 py-1 rounded-md hover:bg-card-line/30 focus:bg-card-line/40',
                    c.done && 'line-through text-muted-foreground',
                  )}
                />
                <button
                  onClick={() => setChecklist(checklist.filter((x) => x.id !== c.id))}
                  className="size-7 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Entfernen"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            <div className="flex gap-1.5 mt-2">
              <input
                type="text"
                value={newCheckText}
                onChange={(e) => setNewCheckText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCheck())}
                placeholder="Neuer Punkt …"
                className="input flex-1"
              />
              <button onClick={addCheck} className="btn btn-md btn-secondary">
                <Plus size={14} />
              </button>
            </div>
          </div>
        </Field>
      </FormSection>
    </Modal>
  );
}

// Suppress unused-import warnings for icons reserved for future use
void GripVertical;
