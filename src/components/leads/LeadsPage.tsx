import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, MoreHorizontal, X, Trash2, ExternalLink, CheckCircle2, MapPin,
  Phone, Mail, User as UserIcon, Search, Maximize2,
} from 'lucide-react';
import { useLeads } from '../../hooks/useLeads';
import { LEAD_STATUSES, type Lead, type LeadStatus } from '../../types';
import { cn, formatCurrency } from '../../lib/utils';

// Farb-System je Spalte: Akzent-Stripe oben auf Karte, Header-Pill,
// dezenter Spalten-Hintergrund. Bewusst zurückhaltend, damit
// Inhalt im Vordergrund bleibt — keine Bonbon-Optik.
const COLUMN_ACCENT: Record<
  LeadStatus,
  { dot: string; bg: string; pill: string; stripe: string; ring: string }
> = {
  Lead:               { dot: 'bg-slate-400',   bg: 'bg-slate-50',   pill: 'bg-slate-100 text-slate-700',     stripe: 'bg-slate-400',   ring: 'ring-slate-200' },
  Erstkontakt:        { dot: 'bg-sky-500',     bg: 'bg-sky-50/70',  pill: 'bg-sky-100 text-sky-700',         stripe: 'bg-sky-500',     ring: 'ring-sky-200' },
  Kalkulation:        { dot: 'bg-violet-500',  bg: 'bg-violet-50/70', pill: 'bg-violet-100 text-violet-700', stripe: 'bg-violet-500',  ring: 'ring-violet-200' },
  Besichtigung:       { dot: 'bg-amber-500',   bg: 'bg-amber-50/70', pill: 'bg-amber-100 text-amber-700',    stripe: 'bg-amber-500',   ring: 'ring-amber-200' },
  Angebot:            { dot: 'bg-blue-500',    bg: 'bg-blue-50/70', pill: 'bg-blue-100 text-blue-700',       stripe: 'bg-blue-500',    ring: 'ring-blue-200' },
  Unterlagenprüfung:  { dot: 'bg-fuchsia-500', bg: 'bg-fuchsia-50/70', pill: 'bg-fuchsia-100 text-fuchsia-700', stripe: 'bg-fuchsia-500', ring: 'ring-fuchsia-200' },
  'Follow-Up':        { dot: 'bg-orange-500',  bg: 'bg-orange-50/70', pill: 'bg-orange-100 text-orange-700', stripe: 'bg-orange-500',  ring: 'ring-orange-200' },
  Deal:               { dot: 'bg-emerald-500', bg: 'bg-emerald-50/80', pill: 'bg-emerald-100 text-emerald-700', stripe: 'bg-emerald-500', ring: 'ring-emerald-200' },
  Archiv:             { dot: 'bg-zinc-400',    bg: 'bg-zinc-50',    pill: 'bg-zinc-100 text-zinc-600',       stripe: 'bg-zinc-400',    ring: 'ring-zinc-200' },
};

// Initialen aus Name oder Bezeichnung extrahieren (max. 2 Zeichen).
function getInitials(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// =============================================================
// Hauptseite
// =============================================================

export function LeadsPage() {
  const { leadsByStatus, createLead, updateLead, deleteLead, moveLead } = useLeads();
  const [editing, setEditing] = useState<Lead | null>(null);
  const [creatingIn, setCreatingIn] = useState<LeadStatus | null>(null);
  const [draftName, setDraftName] = useState('');
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Custom collision für Kanban-Board:
  // 1. pointerWithin findet zuverlässig die DropZone unter dem Cursor —
  //    auch über LEEREN Spalten (closestCorners tut das nicht, weil es
  //    immer die nächste Karte einer anderen Spalte als "näher" sieht).
  // 2. Karten haben Priorität vor Spalten-DropZones, wenn beides
  //    getroffen wird (intra-Spalten-Sortierung).
  // 3. Fallback rectIntersection für Edge-Cases am Spaltenrand.
  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) {
      const cardHit = pointerHits.find((h) => !String(h.id).startsWith('col:'));
      return cardHit ? [cardHit] : pointerHits;
    }
    const rectHits = rectIntersection(args);
    if (rectHits.length > 0) {
      const cardHit = rectHits.find((h) => !String(h.id).startsWith('col:'));
      return cardHit ? [cardHit] : rectHits;
    }
    return [];
  };

  const filteredByStatus = useMemo(() => {
    if (!search.trim()) return leadsByStatus;
    const q = search.trim().toLowerCase();
    const out = {} as typeof leadsByStatus;
    for (const s of LEAD_STATUSES) {
      out[s] = leadsByStatus[s].filter((l) =>
        [l.name, l.address, l.contactName, l.contactEmail, l.notes]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return out;
  }, [leadsByStatus, search]);

  const totalLeads = useMemo(
    () => Object.values(leadsByStatus).reduce((sum, arr) => sum + arr.length, 0),
    [leadsByStatus],
  );
  const dealCount = leadsByStatus.Deal.length;

  // ─── DnD Handler ───────────────────────────────────────────
  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    const all = Object.values(leadsByStatus).flat();
    setActiveLead(all.find((l) => l.id === id) ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = e;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Drop-Target kann eine Lead-Karte (id = lead-id) oder eine
    // Spalten-Drop-Zone (id = "col:<status>") sein.
    let targetStatus: LeadStatus | null = null;
    let targetIndex = 0;

    if (overId.startsWith('col:')) {
      targetStatus = overId.slice(4) as LeadStatus;
      targetIndex = leadsByStatus[targetStatus].length;
    } else {
      // Drop auf Karte → in deren Spalte, an deren Position
      for (const s of LEAD_STATUSES) {
        const idx = leadsByStatus[s].findIndex((l) => l.id === overId);
        if (idx >= 0) {
          targetStatus = s;
          targetIndex = idx;
          break;
        }
      }
    }
    if (!targetStatus) return;
    moveLead(activeId, targetStatus, targetIndex);
  };

  const startCreate = (status: LeadStatus) => {
    setCreatingIn(status);
    setDraftName('');
  };
  const submitCreate = (status: LeadStatus) => {
    const name = draftName.trim();
    if (!name) {
      setCreatingIn(null);
      return;
    }
    createLead({ name, status });
    setDraftName('');
    setCreatingIn(null);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5 px-1">
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-[30px] font-bold text-foreground tracking-tight leading-[1.1] mb-1">
            Leads
          </h1>
          <p className="text-sm text-muted-foreground">
            Akquise-Pipeline · {totalLeads} {totalLeads === 1 ? 'Lead' : 'Leads'}
            {dealCount > 0 && (
              <>
                {' · '}
                <span className="text-emerald-700 font-semibold">{dealCount} im Deal</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Leads durchsuchen…"
              className="pl-9 pr-3 py-2 text-sm rounded-full bg-card border border-card-line focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/15 focus:border-[#4F6BFF] w-[220px]"
            />
          </div>
          <button
            onClick={() => startCreate('Lead')}
            className="btn btn-md btn-primary"
          >
            <Plus size={15} /> Neuer Lead
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto -mx-2 sm:-mx-4 px-2 sm:px-4 pb-6">
          <div className="flex gap-4 min-w-max">
            {LEAD_STATUSES.map((status) => (
              <Column
                key={status}
                status={status}
                leads={filteredByStatus[status]}
                onAddCard={() => startCreate(status)}
                onEditCard={setEditing}
                creating={creatingIn === status}
                draftName={draftName}
                setDraftName={setDraftName}
                onSubmitCreate={() => submitCreate(status)}
                onCancelCreate={() => { setCreatingIn(null); setDraftName(''); }}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeLead ? <LeadCard lead={activeLead} onEdit={() => {}} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {/* Edit-Modal */}
      {editing && (
        <LeadEditModal
          lead={editing}
          onClose={() => setEditing(null)}
          onSave={(updates) => {
            updateLead(editing.id, updates);
            setEditing(null);
          }}
          onDelete={() => {
            deleteLead(editing.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================
// Spalte
// =============================================================

function Column({
  status,
  leads,
  onAddCard,
  onEditCard,
  creating,
  draftName,
  setDraftName,
  onSubmitCreate,
  onCancelCreate,
}: {
  status: LeadStatus;
  leads: Lead[];
  onAddCard: () => void;
  onEditCard: (lead: Lead) => void;
  creating: boolean;
  draftName: string;
  setDraftName: (v: string) => void;
  onSubmitCreate: () => void;
  onCancelCreate: () => void;
}) {
  const accent = COLUMN_ACCENT[status];

  // Drop-Zone als sortable container — die Items selbst sind sortable.
  const ids = useMemo(() => leads.map((l) => l.id), [leads]);

  // Wert-Summe der Spalte (alle asking_prices)
  const totalValue = leads.reduce((s, l) => s + (l.askingPrice ?? 0), 0);

  return (
    <div
      className={cn(
        'w-[300px] shrink-0 rounded-2xl border border-black/[0.04] flex flex-col max-h-[calc(100vh-220px)]',
        accent.bg,
      )}
    >
      {/* Spalten-Header — sticky */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 sticky top-0 z-10 backdrop-blur-sm rounded-t-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('size-2 rounded-full shrink-0', accent.dot)} />
          <span className="text-[12.5px] font-semibold text-foreground truncate uppercase tracking-wider">
            {status}
          </span>
          <span className={cn('text-[11px] font-bold rounded-full px-2 py-0.5 tabular-nums', accent.pill)}>
            {leads.length}
          </span>
        </div>
        <button
          onClick={onAddCard}
          className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-white/80 transition-colors"
          aria-label={`Lead in ${status} hinzufügen`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Wert-Indikator (wenn Preise vorhanden) */}
      {totalValue > 0 && (
        <div className="px-4 pb-2 -mt-1 text-[10.5px] font-medium text-muted-foreground tabular-nums">
          ∑ {formatCurrency(totalValue)}
        </div>
      )}

      {/* Karten — scrollbarer Inner-Container.
          SortableContext OHNE explizite id (sonst Kollision mit DropZone-Id);
          DropZone ist useDroppable, akzeptiert Drops in leere Spalten + ans Spaltenende. */}
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <DropZone status={status} isEmpty={leads.length === 0}>
          <div className="px-3 pb-3 flex flex-col gap-2.5 overflow-y-auto flex-1">
            {leads.length === 0 && !creating && (
              <button
                onClick={onAddCard}
                className="w-full flex flex-col items-center gap-1.5 py-6 px-3 rounded-xl border border-dashed border-black/10 text-muted-foreground hover:text-foreground hover:border-black/20 hover:bg-white/40 transition-all"
              >
                <Plus size={16} className="opacity-60" />
                <span className="text-[11.5px]">Erster Lead</span>
              </button>
            )}

            {leads.map((lead) => (
              <SortableLeadCard
                key={lead.id}
                lead={lead}
                accentStripe={accent.stripe}
                onEdit={() => onEditCard(lead)}
              />
            ))}

            {/* Inline-Add */}
            {creating ? (
              <div className="rounded-2xl bg-white border border-[#4F6BFF]/40 ring-1 ring-[#4F6BFF]/10 p-3 shadow-md">
                <textarea
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSubmitCreate();
                    }
                    if (e.key === 'Escape') onCancelCreate();
                  }}
                  placeholder="z. B. 3Z. 85m², Schwarzwaldstr. 25"
                  className="w-full text-[13.5px] font-medium resize-none bg-transparent focus:outline-none placeholder:text-muted-foreground/60 leading-snug"
                  rows={2}
                />
                <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-black/5">
                  <span className="text-[10px] text-muted-foreground/70">↵ Hinzufügen · Esc abbrechen</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={onCancelCreate}
                      className="text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-black/5 transition-colors"
                    >
                      <X size={13} />
                    </button>
                    <button
                      onClick={onSubmitCreate}
                      className="text-[12px] font-semibold rounded-full bg-[#0f1430] hover:bg-[#1a2050] text-white px-3.5 py-1.5 transition-colors"
                    >
                      Hinzufügen
                    </button>
                  </div>
                </div>
              </div>
            ) : leads.length > 0 ? (
              <button
                onClick={onAddCard}
                className="w-full flex items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground py-2 px-2 rounded-xl hover:bg-white/60 transition-colors"
              >
                <Plus size={12} /> Karte hinzufügen
              </button>
            ) : null}
          </div>
        </DropZone>
      </SortableContext>
    </div>
  );
}

// Drop-Zone für leere Spalten + Anker für Drop "ans Ende".
// useDroppable (statt useSortable) — DropZone ist KEIN drag-item, sondern
// nur ein Drop-Target. useSortable mit gleicher ID wie der umschließende
// SortableContext kollidiert in dnd-kit und blockt das ganze DnD.
function DropZone({ status, children, isEmpty }: { status: LeadStatus; children: React.ReactNode; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 rounded-xl transition-colors',
        // Mindesthöhe für leere Spalten, damit der Pointer eine echte
        // Drop-Zone trifft — sonst kollabiert die Spalte auf 0px Höhe.
        isEmpty && 'min-h-[160px]',
        isOver && 'ring-2 ring-[#4F6BFF]/30 bg-white/50',
      )}
    >
      {children}
    </div>
  );
}

// =============================================================
// Lead-Karte (Sortable + Display)
// =============================================================

function SortableLeadCard({
  lead,
  accentStripe,
  onEdit,
}: {
  lead: Lead;
  accentStripe: string;
  onEdit: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { status: lead.status }, // hilft beim Cross-Column-Drag
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LeadCard lead={lead} accentStripe={accentStripe} onEdit={onEdit} />
    </div>
  );
}

function LeadCard({
  lead,
  accentStripe,
  onEdit,
  dragging,
}: {
  lead: Lead;
  accentStripe?: string;
  onEdit: () => void;
  dragging?: boolean;
}) {
  const stripe = accentStripe ?? COLUMN_ACCENT[lead.status].stripe;
  const isDeal = lead.status === 'Deal';
  const initials = getInitials(lead.contactName);

  // Anzeige-Stats nur wenn vorhanden
  const stats: Array<{ label: string; value: string }> = [];
  if (typeof lead.rooms === 'number' && lead.rooms > 0) stats.push({ label: 'Zi', value: String(lead.rooms) });
  if (typeof lead.area === 'number' && lead.area > 0) stats.push({ label: 'm²', value: String(lead.area) });

  const hasPrice = typeof lead.askingPrice === 'number' && lead.askingPrice > 0;

  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a')) return;
        onEdit();
      }}
      className={cn(
        'group relative rounded-2xl bg-white border border-black/[0.05] cursor-pointer overflow-hidden',
        'shadow-[0_1px_2px_rgba(15,20,48,0.04)] hover:shadow-[0_8px_24px_-8px_rgba(15,20,48,0.12)]',
        'hover:border-black/[0.10] hover:-translate-y-0.5 transition-all duration-200',
        dragging && '!shadow-[0_24px_48px_-12px_rgba(15,20,48,0.25)] rotate-[1.5deg] scale-[1.02] cursor-grabbing',
      )}
    >
      {/* Akzent-Stripe links */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px]', stripe)} />

      <div className="pl-4 pr-3 py-3">
        {/* Top: Title + Inserat-Link */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-[13.5px] font-semibold text-foreground leading-snug break-words flex-1">
            {lead.name}
          </p>
          {lead.immoscoutUrl && (
            <a
              href={lead.immoscoutUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground/70 hover:text-[#4F6BFF] shrink-0 -mr-1 -mt-0.5 p-1 rounded-md hover:bg-black/[0.03] transition-all opacity-0 group-hover:opacity-100"
              aria-label="Inserat öffnen"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Adresse */}
        {lead.address && (
          <div className="flex items-start gap-1.5 mb-2.5 text-[11.5px] text-muted-foreground">
            <MapPin size={11} className="shrink-0 mt-0.5 opacity-70" />
            <span className="line-clamp-2 leading-snug">{lead.address}</span>
          </div>
        )}

        {/* Stats-Reihe (Zimmer / Fläche als Pills) */}
        {stats.length > 0 && (
          <div className="flex items-center gap-1.5 mb-2.5">
            {stats.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-baseline gap-0.5 text-[10.5px] font-medium text-foreground bg-black/[0.04] rounded-md px-1.5 py-0.5 tabular-nums"
              >
                <span className="font-bold">{s.value}</span>
                <span className="text-muted-foreground/80">{s.label}</span>
              </span>
            ))}
          </div>
        )}

        {/* Bottom: Preis + Kontakt */}
        {(hasPrice || initials || isDeal) && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/[0.05]">
            {hasPrice ? (
              <span className="text-[12.5px] font-bold text-foreground tabular-nums">
                {formatCurrency(lead.askingPrice!)}
              </span>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-1.5">
              {isDeal && (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-full px-1.5 py-0.5">
                  <CheckCircle2 size={9} strokeWidth={2.5} /> Deal
                </span>
              )}
              {initials && (
                <span
                  title={lead.contactName}
                  className="inline-flex items-center justify-center size-6 rounded-full bg-gradient-to-br from-[#4F6BFF] to-[#6B7FFF] text-white text-[10px] font-bold shadow-sm"
                >
                  {initials}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================
// Edit-Modal
// =============================================================

function LeadEditModal({
  lead,
  onClose,
  onSave,
  onDelete,
}: {
  lead: Lead;
  onClose: () => void;
  onSave: (updates: Partial<Lead>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Lead>(lead);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const upd = <K extends keyof Lead>(k: K, v: Lead[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-card-line rounded-2xl shadow-xl max-w-[560px] w-full my-8" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-card-line">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('size-2 rounded-full shrink-0', COLUMN_ACCENT[draft.status].dot)} />
            <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">{draft.status}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-card-line/40">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11.5px] font-semibold text-foreground mb-1">Bezeichnung</label>
            <input
              value={draft.name}
              onChange={(e) => upd('name', e.target.value)}
              className="input text-[14px] font-medium"
              placeholder="3Z. 85m², Schwarzwaldstr. 25 Walldorf"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-foreground mb-1">Status (Spalte)</label>
            <select
              value={draft.status}
              onChange={(e) => upd('status', e.target.value as LeadStatus)}
              className="input"
            >
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-foreground mb-1 flex items-center gap-1">
              <MapPin size={11} /> Adresse
            </label>
            <input
              value={draft.address ?? ''}
              onChange={(e) => upd('address', e.target.value)}
              className="input"
              placeholder="Straße, Hausnummer, PLZ Ort"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11.5px] font-semibold text-foreground mb-1">Zimmer</label>
              <input
                type="number"
                step="0.5"
                value={draft.rooms ?? ''}
                onChange={(e) => upd('rooms', e.target.value === '' ? undefined : Number(e.target.value))}
                className="input tabular-nums"
                placeholder="3"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-foreground mb-1 flex items-center gap-1">
                <Maximize2 size={10} /> Fläche m²
              </label>
              <input
                type="number"
                value={draft.area ?? ''}
                onChange={(e) => upd('area', e.target.value === '' ? undefined : Number(e.target.value))}
                className="input tabular-nums"
                placeholder="85"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-foreground mb-1">Preis €</label>
              <input
                type="number"
                value={draft.askingPrice ?? ''}
                onChange={(e) => upd('askingPrice', e.target.value === '' ? undefined : Number(e.target.value))}
                className="input tabular-nums"
                placeholder="350000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-semibold text-foreground mb-1 flex items-center gap-1">
                <UserIcon size={11} /> Kontakt
              </label>
              <input
                value={draft.contactName ?? ''}
                onChange={(e) => upd('contactName', e.target.value)}
                className="input"
                placeholder="Max Mustermann"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-foreground mb-1 flex items-center gap-1">
                <Phone size={11} /> Telefon
              </label>
              <input
                value={draft.contactPhone ?? ''}
                onChange={(e) => upd('contactPhone', e.target.value)}
                className="input"
                placeholder="+49 …"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-foreground mb-1 flex items-center gap-1">
              <Mail size={11} /> E-Mail
            </label>
            <input
              type="email"
              value={draft.contactEmail ?? ''}
              onChange={(e) => upd('contactEmail', e.target.value)}
              className="input"
              placeholder="kontakt@example.com"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-foreground mb-1">Inserat-URL (optional)</label>
            <input
              type="url"
              value={draft.immoscoutUrl ?? ''}
              onChange={(e) => upd('immoscoutUrl', e.target.value)}
              className="input"
              placeholder="https://www.immobilienscout24.de/…"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-foreground mb-1">Notizen</label>
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => upd('notes', e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Eigentümer-Situation, Verhandlungsstand, etc."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-card-line">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-foreground">Wirklich löschen?</span>
              <button
                onClick={onDelete}
                className="text-[12px] font-semibold rounded-full bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5"
              >
                Ja, löschen
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[12px] text-muted-foreground hover:text-foreground"
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[12px] inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-semibold"
            >
              <Trash2 size={12} /> Löschen
            </button>
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn btn-md btn-outline rounded-full">Abbrechen</button>
            <button
              onClick={() => onSave(draft)}
              className="btn btn-md btn-primary rounded-full"
              disabled={!draft.name.trim()}
            >
              Speichern
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Vermeide unused-import warning für MoreHorizontal (für künftige Spalten-Aktionen)
void MoreHorizontal;
