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
  Plus, MoreHorizontal, X, Trash2, ExternalLink, MapPin,
  Phone, Mail, User as UserIcon, Search, Home, Ruler, BadgeEuro,
} from 'lucide-react';
import { useLeads } from '../../hooks/useLeads';
import { LEAD_STATUSES, type Lead, type LeadStatus } from '../../types';
import { cn, formatCurrency } from '../../lib/utils';

// =====================================================================
// Stratify-Style Farben — pastell, sehr dezent, hoher Whitespace
// =====================================================================
// Spalten-Hintergrund ist nahezu weiß; das visuelle "Status"-Signal
// kommt aus dem Header-Dot, der Counter-Pill und einer dünnen
// Bottom-Stripe auf der Karte. Keine intensiven Hintergründe.
const COLUMN_ACCENT: Record<
  LeadStatus,
  { dot: string; pill: string; stripe: string; tag: string }
> = {
  Lead:               { dot: 'bg-slate-400',   pill: 'bg-slate-100 text-slate-700',     stripe: 'bg-slate-300',   tag: 'bg-slate-100 text-slate-700' },
  Erstkontakt:        { dot: 'bg-sky-500',     pill: 'bg-[#DCEBF5] text-[#1A3D52]',    stripe: 'bg-sky-300',     tag: 'bg-[#DCEBF5] text-[#1A3D52]' },
  Kalkulation:        { dot: 'bg-violet-500',  pill: 'bg-[#E8DAFF] text-[#3D1F5A]',    stripe: 'bg-violet-300',  tag: 'bg-[#E8DAFF] text-[#3D1F5A]' },
  Besichtigung:       { dot: 'bg-amber-500',   pill: 'bg-[#FFF1CC] text-[#5A4A1A]',    stripe: 'bg-amber-300',   tag: 'bg-[#FFF1CC] text-[#5A4A1A]' },
  Angebot:            { dot: 'bg-blue-500',    pill: 'bg-[#DCE5F5] text-[#1A2D54]',    stripe: 'bg-blue-300',    tag: 'bg-[#DCE5F5] text-[#1A2D54]' },
  Unterlagenprüfung:  { dot: 'bg-fuchsia-500', pill: 'bg-[#F5DCEC] text-[#5A1F45]',    stripe: 'bg-fuchsia-300', tag: 'bg-[#F5DCEC] text-[#5A1F45]' },
  'Follow-Up':        { dot: 'bg-orange-500',  pill: 'bg-[#FFE0CC] text-[#5A2D1F]',    stripe: 'bg-orange-300',  tag: 'bg-[#FFE0CC] text-[#5A2D1F]' },
  Deal:               { dot: 'bg-emerald-500', pill: 'bg-[#D6F0DC] text-[#1A4D2C]',    stripe: 'bg-emerald-300', tag: 'bg-[#D6F0DC] text-[#1A4D2C]' },
  Archiv:             { dot: 'bg-zinc-400',    pill: 'bg-zinc-100 text-zinc-600',       stripe: 'bg-zinc-300',    tag: 'bg-zinc-100 text-zinc-600' },
};

function getInitials(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// =====================================================================
// Custom Collision-Detection für Kanban
// =====================================================================
const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    const cardHit = pointerHits.find(
      (h) => !(LEAD_STATUSES as readonly string[]).includes(String(h.id)),
    );
    return cardHit ? [cardHit] : pointerHits;
  }
  return rectIntersection(args);
};

// =====================================================================
// Hauptseite
// =====================================================================

export function LeadsPage() {
  const { leadsByStatus, createLead, updateLead, deleteLead } = useLeads();
  const [editing, setEditing] = useState<Lead | null>(null);
  const [creatingIn, setCreatingIn] = useState<LeadStatus | null>(null);
  const [draftName, setDraftName] = useState('');
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    const all = LEAD_STATUSES.flatMap((s) => leadsByStatus[s]);
    setActiveLead(all.find((l) => l.id === id) ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    let targetStatus: LeadStatus | undefined;
    if ((LEAD_STATUSES as readonly string[]).includes(overId)) {
      targetStatus = overId as LeadStatus;
    } else {
      const overLead = LEAD_STATUSES.flatMap((s) => leadsByStatus[s]).find((l) => l.id === overId);
      targetStatus = overLead?.status;
    }
    if (!targetStatus) return;
    const activeLeadObj = LEAD_STATUSES.flatMap((s) => leadsByStatus[s]).find((l) => l.id === activeId);
    if (!activeLeadObj || activeLeadObj.status === targetStatus) return;

    const newOrder = leadsByStatus[targetStatus].length;
    updateLead(activeId, { status: targetStatus, order: newOrder });
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
      {/* ============== Header — Stratify-Stil: big title + sub mit dots ============== */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6 px-1">
        <div className="min-w-0">
          <h1 className="text-[28px] sm:text-[34px] font-bold text-[#0f1430] tracking-tight leading-[1.1] mb-1.5">
            Leads
          </h1>
          <p className="text-[13.5px] text-[#1e1b4b]/55">
            Akquise-Pipeline
            <span className="mx-2 inline-block size-1 rounded-full bg-[#1e1b4b]/25 align-middle" />
            {totalLeads} {totalLeads === 1 ? 'Lead' : 'Leads'}
            {dealCount > 0 && (
              <>
                <span className="mx-2 inline-block size-1 rounded-full bg-[#1e1b4b]/25 align-middle" />
                <span className="text-emerald-700 font-semibold">{dealCount} im Deal</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search — Stratify Pill mit dezenter Border, kein Schatten */}
          <div className="relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1e1b4b]/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Leads durchsuchen…"
              className="pl-10 pr-4 py-2.5 text-[13.5px] rounded-full bg-white border border-[#1e1b4b]/[0.08] focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/15 focus:border-[#4F6BFF]/40 w-[240px] placeholder:text-[#1e1b4b]/40"
            />
          </div>
          <button
            onClick={() => startCreate('Lead')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#4F6BFF] hover:bg-[#3D56E0] text-white text-[13px] font-semibold transition-colors"
          >
            <Plus size={14} strokeWidth={2.2} /> Neuer Lead
          </button>
        </div>
      </div>

      {/* ============== Kanban Board ============== */}
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

// =====================================================================
// Spalte — Stratify clean weiß + dezenter Border, kein bg-tint
// =====================================================================

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
  const totalValue = leads.reduce((s, l) => s + (l.askingPrice ?? 0), 0);

  return (
    <div className="w-[300px] shrink-0 flex flex-col max-h-[calc(100vh-200px)] rounded-3xl bg-white/60 border border-[#1e1b4b]/[0.06]">
      {/* Header — Stratify-Style: Name + kleine Counter-Pill */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('size-2 rounded-full shrink-0', accent.dot)} />
          <span className="text-[13.5px] font-semibold text-[#0f1430] truncate">{status}</span>
          <span className={cn('text-[10.5px] font-bold rounded-full px-1.5 min-w-[20px] text-center py-0.5 tabular-nums', accent.pill)}>
            {leads.length}
          </span>
        </div>
        <button
          onClick={onAddCard}
          className="text-[#1e1b4b]/45 hover:text-[#0f1430] p-1 rounded-full hover:bg-[#1e1b4b]/[0.04] transition-colors"
          aria-label={`Lead in ${status} hinzufügen`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Wert-Summe (nur wenn Preise vorhanden) */}
      {totalValue > 0 && (
        <div className="px-4 pb-2 -mt-1 text-[10.5px] text-[#1e1b4b]/45 tabular-nums">
          Pipeline-Wert: <span className="font-semibold text-[#0f1430]/70">{formatCurrency(totalValue)}</span>
        </div>
      )}

      <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <DropZone status={status} isEmpty={leads.length === 0}>
          <div className="px-3 pb-3 flex flex-col gap-2.5 overflow-y-auto flex-1">
            {leads.length === 0 && !creating && (
              <button
                onClick={onAddCard}
                className="w-full flex flex-col items-center gap-1.5 py-8 px-3 rounded-2xl border border-dashed border-[#1e1b4b]/15 text-[#1e1b4b]/45 hover:text-[#0f1430] hover:border-[#1e1b4b]/30 hover:bg-white transition-all"
              >
                <Plus size={15} className="opacity-70" />
                <span className="text-[11.5px] font-medium">Erster Lead</span>
              </button>
            )}

            {leads.map((lead) => (
              <SortableLeadCard
                key={lead.id}
                lead={lead}
                onEdit={() => onEditCard(lead)}
              />
            ))}

            {creating ? (
              <div className="rounded-2xl bg-white border border-[#4F6BFF]/30 ring-1 ring-[#4F6BFF]/10 p-3.5">
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
                  className="w-full text-[13.5px] font-medium resize-none bg-transparent focus:outline-none placeholder:text-[#1e1b4b]/40 leading-snug"
                  rows={2}
                />
                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#1e1b4b]/[0.06]">
                  <span className="text-[10px] text-[#1e1b4b]/45">↵ speichern · Esc abbrechen</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={onCancelCreate}
                      className="text-[#1e1b4b]/45 hover:text-[#0f1430] p-1.5 rounded-full hover:bg-[#1e1b4b]/[0.04] transition-colors"
                    >
                      <X size={13} />
                    </button>
                    <button
                      onClick={onSubmitCreate}
                      className="text-[11.5px] font-semibold rounded-full bg-[#4F6BFF] hover:bg-[#3D56E0] text-white px-3.5 py-1.5 transition-colors"
                    >
                      Hinzufügen
                    </button>
                  </div>
                </div>
              </div>
            ) : leads.length > 0 ? (
              <button
                onClick={onAddCard}
                className="w-full flex items-center justify-center gap-1.5 text-[11.5px] text-[#1e1b4b]/45 hover:text-[#0f1430] py-2 px-2 rounded-2xl hover:bg-white transition-colors"
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

function DropZone({ status, children, isEmpty }: { status: LeadStatus; children: React.ReactNode; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 rounded-2xl transition-colors',
        isEmpty && 'min-h-[160px]',
        isOver && 'ring-2 ring-[#4F6BFF]/30 bg-[#4F6BFF]/[0.04]',
      )}
    >
      {children}
    </div>
  );
}

// =====================================================================
// Lead-Karte — Stratify-Stil: weiß, große Border-Radius, dezenter Border,
// Meta-Zeilen mit Icons, Avatar-Stack + Status-Pill rechts unten
// =====================================================================

function SortableLeadCard({ lead, onEdit }: { lead: Lead; onEdit: () => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { status: lead.status },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
      <LeadCard lead={lead} onEdit={onEdit} />
    </div>
  );
}

function LeadCard({ lead, onEdit, dragging }: { lead: Lead; onEdit: () => void; dragging?: boolean }) {
  const accent = COLUMN_ACCENT[lead.status];
  const initials = getInitials(lead.contactName);

  // Meta-Zeilen-Konstruktion
  const hasArea = typeof lead.area === 'number' && lead.area > 0;
  const hasRooms = typeof lead.rooms === 'number' && lead.rooms > 0;
  const hasPrice = typeof lead.askingPrice === 'number' && lead.askingPrice > 0;

  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a, button[data-stop]')) return;
        onEdit();
      }}
      className={cn(
        'group relative rounded-[20px] bg-white border border-[#1e1b4b]/[0.07] overflow-hidden',
        'hover:border-[#1e1b4b]/[0.15] transition-all duration-200',
        dragging && 'shadow-[0_20px_40px_-12px_rgba(15,20,48,0.25)] rotate-[1deg]',
      )}
    >
      <div className="px-4 pt-3.5 pb-3.5">
        {/* Title + 3-Dots */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <p className="text-[13.5px] font-semibold text-[#0f1430] leading-snug break-words flex-1">
            {lead.name}
          </p>
          <button
            data-stop
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="text-[#1e1b4b]/40 hover:text-[#0f1430] -mr-1 -mt-0.5 p-1 rounded-md hover:bg-[#1e1b4b]/[0.04] transition-all opacity-0 group-hover:opacity-100"
            aria-label="Optionen"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>

        {/* Meta-Zeilen (Stratify-Style: Icon + Text in Reihen) */}
        <div className="space-y-1.5 mb-3">
          {lead.address && (
            <div className="flex items-start gap-1.5 text-[12px] text-[#1e1b4b]/65">
              <MapPin size={12} className="shrink-0 mt-0.5 text-[#1e1b4b]/40" strokeWidth={1.8} />
              <span className="line-clamp-1 leading-snug">{lead.address}</span>
            </div>
          )}
          {(hasRooms || hasArea) && (
            <div className="flex items-center gap-3 text-[12px] text-[#1e1b4b]/65">
              {hasRooms && (
                <span className="inline-flex items-center gap-1.5">
                  <Home size={12} className="text-[#1e1b4b]/40" strokeWidth={1.8} />
                  <span className="tabular-nums">{lead.rooms} Zimmer</span>
                </span>
              )}
              {hasArea && (
                <span className="inline-flex items-center gap-1.5">
                  <Ruler size={12} className="text-[#1e1b4b]/40" strokeWidth={1.8} />
                  <span className="tabular-nums">{lead.area} m²</span>
                </span>
              )}
            </div>
          )}
          {hasPrice && (
            <div className="flex items-center gap-1.5 text-[12px] text-[#1e1b4b]/65">
              <BadgeEuro size={12} className="text-[#1e1b4b]/40" strokeWidth={1.8} />
              <span className="font-semibold text-[#0f1430] tabular-nums">
                {formatCurrency(lead.askingPrice!)}
              </span>
            </div>
          )}
        </div>

        {/* Bottom: Avatar / Tool-Link links + Status-Pill rechts (Stratify-Pattern) */}
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#1e1b4b]/[0.06]">
          <div className="flex items-center gap-1.5 min-w-0">
            {initials && (
              <span
                title={lead.contactName}
                className="inline-flex items-center justify-center size-6 rounded-full bg-gradient-to-br from-[#4F6BFF] to-[#3d57e0] text-white text-[10px] font-bold border-2 border-white shadow-[0_0_0_1px_rgba(15,20,48,0.06)]"
              >
                {initials}
              </span>
            )}
            {lead.contactName && (
              <span className="text-[11px] text-[#1e1b4b]/65 truncate">{lead.contactName}</span>
            )}
            {!initials && lead.immoscoutUrl && (
              <a
                href={lead.immoscoutUrl}
                target="_blank"
                rel="noreferrer"
                data-stop
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] text-[#4F6BFF] hover:underline"
              >
                <ExternalLink size={11} /> Inserat
              </a>
            )}
          </div>
          <span className={cn('inline-flex items-center text-[10.5px] font-semibold rounded-full px-2 py-0.5', accent.tag)}>
            {lead.status}
          </span>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Edit-Modal
// =====================================================================

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
    <div className="fixed inset-0 z-50 bg-[#0f1430]/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white border border-[#1e1b4b]/[0.06] rounded-3xl max-w-[560px] w-full my-8 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1b4b]/[0.06]">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('size-2 rounded-full shrink-0', COLUMN_ACCENT[draft.status].dot)} />
            <span className="text-[12px] font-semibold text-[#1e1b4b]/55 uppercase tracking-wider">{draft.status}</span>
          </div>
          <button onClick={onClose} className="text-[#1e1b4b]/45 hover:text-[#0f1430] p-1.5 rounded-full hover:bg-[#1e1b4b]/[0.04]">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11.5px] font-semibold text-[#0f1430] mb-1.5">Bezeichnung</label>
            <input
              value={draft.name}
              onChange={(e) => upd('name', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/[0.10] text-[14px] font-medium focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
              placeholder="3Z. 85m², Schwarzwaldstr. 25 Walldorf"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-[#0f1430] mb-1.5">Status</label>
            <select
              value={draft.status}
              onChange={(e) => upd('status', e.target.value as LeadStatus)}
              className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/[0.10] text-[14px] focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15 appearance-none"
            >
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11.5px] font-semibold text-[#0f1430] mb-1.5 flex items-center gap-1">
              <MapPin size={11} /> Adresse
            </label>
            <input
              value={draft.address ?? ''}
              onChange={(e) => upd('address', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/[0.10] text-[14px] focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
              placeholder="Straße, Hausnummer, PLZ Ort"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11.5px] font-semibold text-[#0f1430] mb-1.5">Zimmer</label>
              <input
                type="number"
                step="0.5"
                value={draft.rooms ?? ''}
                onChange={(e) => upd('rooms', e.target.value === '' ? undefined : Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/[0.10] text-[14px] tabular-nums focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
                placeholder="3"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-[#0f1430] mb-1.5">Fläche m²</label>
              <input
                type="number"
                value={draft.area ?? ''}
                onChange={(e) => upd('area', e.target.value === '' ? undefined : Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/[0.10] text-[14px] tabular-nums focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
                placeholder="85"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-[#0f1430] mb-1.5">Preis €</label>
              <input
                type="number"
                value={draft.askingPrice ?? ''}
                onChange={(e) => upd('askingPrice', e.target.value === '' ? undefined : Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/[0.10] text-[14px] tabular-nums focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
                placeholder="350000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11.5px] font-semibold text-[#0f1430] mb-1.5 flex items-center gap-1">
                <UserIcon size={11} /> Kontakt
              </label>
              <input
                value={draft.contactName ?? ''}
                onChange={(e) => upd('contactName', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/[0.10] text-[14px] focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
                placeholder="Max Mustermann"
              />
            </div>
            <div>
              <label className="text-[11.5px] font-semibold text-[#0f1430] mb-1.5 flex items-center gap-1">
                <Phone size={11} /> Telefon
              </label>
              <input
                value={draft.contactPhone ?? ''}
                onChange={(e) => upd('contactPhone', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/[0.10] text-[14px] focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
                placeholder="+49 …"
              />
            </div>
          </div>

          <div>
            <label className="text-[11.5px] font-semibold text-[#0f1430] mb-1.5 flex items-center gap-1">
              <Mail size={11} /> E-Mail
            </label>
            <input
              type="email"
              value={draft.contactEmail ?? ''}
              onChange={(e) => upd('contactEmail', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/[0.10] text-[14px] focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
              placeholder="kontakt@example.com"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-[#0f1430] mb-1.5">Inserat-URL</label>
            <input
              type="url"
              value={draft.immoscoutUrl ?? ''}
              onChange={(e) => upd('immoscoutUrl', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/[0.10] text-[14px] focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
              placeholder="https://www.immobilienscout24.de/…"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-[#0f1430] mb-1.5">Notizen</label>
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => upd('notes', e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#1e1b4b]/[0.10] text-[14px] focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15 resize-none"
              placeholder="Eigentümer-Situation, Verhandlungsstand, etc."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-[#1e1b4b]/[0.06] bg-[#fafbff]">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#0f1430]">Wirklich löschen?</span>
              <button
                onClick={onDelete}
                className="text-[12px] font-semibold rounded-full bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5"
              >
                Ja, löschen
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[12px] text-[#1e1b4b]/55 hover:text-[#0f1430]"
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
            <button
              onClick={onClose}
              className="text-[12.5px] font-semibold rounded-full bg-white border border-[#1e1b4b]/[0.10] text-[#0f1430] hover:bg-[#1e1b4b]/[0.04] px-4 py-2"
            >
              Abbrechen
            </button>
            <button
              onClick={() => onSave(draft)}
              disabled={!draft.name.trim()}
              className="text-[12.5px] font-semibold rounded-full bg-[#4F6BFF] hover:bg-[#3D56E0] text-white px-4 py-2 disabled:opacity-50"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
