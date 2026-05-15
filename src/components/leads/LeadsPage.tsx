import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
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

// Farb-Akzente je Spalte (subtil, leicht erkennbar) ----------------
const COLUMN_ACCENT: Record<LeadStatus, { dot: string; bg: string }> = {
  Lead:               { dot: 'bg-slate-400',   bg: 'bg-slate-50/70' },
  Erstkontakt:        { dot: 'bg-sky-400',     bg: 'bg-sky-50/60' },
  Kalkulation:        { dot: 'bg-violet-400',  bg: 'bg-violet-50/60' },
  Besichtigung:       { dot: 'bg-amber-400',   bg: 'bg-amber-50/60' },
  Angebot:            { dot: 'bg-blue-400',    bg: 'bg-blue-50/60' },
  Unterlagenprüfung:  { dot: 'bg-fuchsia-400', bg: 'bg-fuchsia-50/60' },
  'Follow-Up':        { dot: 'bg-orange-400',  bg: 'bg-orange-50/60' },
  Deal:               { dot: 'bg-emerald-500', bg: 'bg-emerald-50/60' },
  Archiv:             { dot: 'bg-zinc-400',    bg: 'bg-zinc-50/70' },
};

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
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto -mx-2 sm:-mx-4 px-2 sm:px-4 pb-4">
          <div className="flex gap-3 min-w-max">
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

        <DragOverlay>
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

  return (
    <div className={cn('w-[280px] shrink-0 rounded-2xl border border-card-line p-3', accent.bg)}>
      {/* Spalten-Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('size-2 rounded-full shrink-0', accent.dot)} />
          <span className="text-[13px] font-semibold text-foreground truncate">{status}</span>
          <span className="text-[11px] font-medium text-muted-foreground bg-card border border-card-line rounded-full px-1.5 py-0.5">
            {leads.length}
          </span>
        </div>
        <button onClick={onAddCard} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-white/60 transition-colors" aria-label={`Lead in ${status} hinzufügen`}>
          <Plus size={14} />
        </button>
      </div>

      {/* Karten */}
      <SortableContext items={ids} strategy={verticalListSortingStrategy} id={`col:${status}`}>
        <DropZone status={status}>
          <div className="flex flex-col gap-2 min-h-[20px]">
            {leads.map((lead) => (
              <SortableLeadCard key={lead.id} lead={lead} onEdit={() => onEditCard(lead)} />
            ))}

            {/* Inline-Add */}
            {creating ? (
              <div className="rounded-xl bg-card border border-[#4F6BFF]/40 p-2.5 shadow-sm">
                <textarea
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmitCreate(); }
                    if (e.key === 'Escape') onCancelCreate();
                  }}
                  placeholder="z. B. 3Z. 85m², Schwarzwaldstr. 25 Walldorf"
                  className="w-full text-[13px] resize-none bg-transparent focus:outline-none placeholder:text-muted-foreground/70"
                  rows={2}
                />
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={onSubmitCreate} className="text-[12px] font-semibold rounded-full bg-[#0f1430] hover:bg-[#1a2050] text-white px-3 py-1.5 transition-colors">
                    Hinzufügen
                  </button>
                  <button onClick={onCancelCreate} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-card transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={onAddCard} className="w-full flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground py-1.5 px-2 rounded-lg hover:bg-white/60 transition-colors">
                <Plus size={13} /> Eine Karte hinzufügen
              </button>
            )}
          </div>
        </DropZone>
      </SortableContext>
    </div>
  );
}

// Drop-Zone für leere Spalten + Anker für Drop "ans Ende"
function DropZone({ status, children }: { status: LeadStatus; children: React.ReactNode }) {
  const { setNodeRef } = useSortable({ id: `col:${status}` });
  return <div ref={setNodeRef}>{children}</div>;
}

// =============================================================
// Lead-Karte (Sortable + Display)
// =============================================================

function SortableLeadCard({ lead, onEdit }: { lead: Lead; onEdit: () => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: lead.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LeadCard lead={lead} onEdit={onEdit} />
    </div>
  );
}

function LeadCard({ lead, onEdit, dragging }: { lead: Lead; onEdit: () => void; dragging?: boolean }) {
  const isDeal = lead.status === 'Deal';
  return (
    <div
      onClick={(e) => {
        // Klick öffnet Edit-Modal — verhindert Konflikt mit Drag (das hat eigene activationConstraint)
        if ((e.target as HTMLElement).closest('a')) return;
        onEdit();
      }}
      className={cn(
        'group rounded-xl bg-card border border-card-line p-2.5 cursor-pointer hover:border-[#4F6BFF]/40 hover:shadow-sm transition-all',
        dragging && 'shadow-lg rotate-1 scale-[1.02]',
      )}
    >
      <div className="flex items-start gap-2">
        {isDeal && (
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground leading-snug break-words">
            {lead.name}
          </p>
          {(lead.address || lead.askingPrice) && (
            <div className="mt-1.5 space-y-0.5 text-[11.5px] text-muted-foreground">
              {lead.address && (
                <p className="flex items-start gap-1 truncate">
                  <MapPin size={10} className="shrink-0 mt-0.5" /> {lead.address}
                </p>
              )}
              {typeof lead.askingPrice === 'number' && lead.askingPrice > 0 && (
                <p className="font-semibold text-foreground tabular-nums">{formatCurrency(lead.askingPrice)}</p>
              )}
            </div>
          )}
        </div>
        {lead.immoscoutUrl && (
          <a
            href={lead.immoscoutUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-[#4F6BFF] opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Inserat öffnen"
          >
            <ExternalLink size={12} />
          </a>
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
