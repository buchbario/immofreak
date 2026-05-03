import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Wallet, CalendarClock, Home, User,
  CheckCircle2, XCircle, Edit2, Trash2,
} from 'lucide-react';
import { useRentalContracts } from '../../hooks/useRentalContracts';
import { useTenants } from '../../hooks/useTenants';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useContractDocuments } from '../../hooks/useContractDocuments';
import { useTrash } from '../../hooks/useTrash';
import { cascadeContractToTrash } from '../../lib/cascadeDelete';
import { DocumentList } from '../shared/DocumentList';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../../lib/utils';

export function MietvertragDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { allContracts, updateContract } = useRentalContracts();
  const { allTenants } = useTenants();
  const { allUnits } = useRentalUnits();
  const { properties } = useRentalProperties();
  const { documents, addDocument, deleteDocument } = useContractDocuments(id);
  const { moveToTrash } = useTrash();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editNotes, setEditNotes] = useState(false);
  const [notesVal, setNotesVal] = useState('');

  const contract = allContracts.find((c) => c.id === id);
  if (!contract) {
    return (
      <div className="page-container">
        <p className="text-sm text-muted-foreground-2">Vertrag nicht gefunden.</p>
        <button onClick={() => navigate('/bh/mietvertraege')} className="btn btn-md btn-secondary mt-4">Zurück</button>
      </div>
    );
  }

  const tenant = allTenants.find((t) => t.id === contract.tenantId);
  const unit = allUnits.find((u) => u.id === contract.unitId);
  const property = properties.find((p) => p.id === contract.propertyId);
  const warmmiete = contract.rentAmount + contract.operatingCosts + contract.heatingCosts;

  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const formatDateShort = (dateStr: string) => new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Contract status
  const getStatus = () => {
    if (contract.contractType === 'unbefristet') return { label: 'Unbefristet', cls: 'badge-blue', icon: CheckCircle2 };
    if (!contract.endDate) return { label: 'Befristet', cls: 'badge-amber', icon: CalendarClock };
    const end = new Date(contract.endDate);
    const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: 'Abgelaufen', cls: 'badge-red', icon: XCircle };
    if (daysLeft <= 90) return { label: `Läuft in ${daysLeft}T ab`, cls: 'badge-amber', icon: CalendarClock };
    return { label: 'Befristet', cls: 'badge-green', icon: CalendarClock };
  };
  const status = getStatus();

  const handleSaveNotes = () => {
    updateContract(contract.id, { notes: notesVal });
    setEditNotes(false);
  };

  return (
    <div className="page-container">
      {/* Header card */}
      <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 sm:p-6 mb-4 sm:mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate('/bh/mietvertraege')}
              className="size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-layer-hover transition-colors cursor-pointer shrink-0"
              aria-label="Zurück"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[22px] sm:text-[24px] font-bold text-foreground tracking-tight leading-tight">Mietvertrag</h1>
                <span className={`badge ${status.cls}`}>{status.label}</span>
              </div>
              <p className="text-[12.5px] text-muted-foreground truncate mt-0.5">
                {tenant?.name || '–'} · {unit?.name || '–'} · {property?.name || '–'}
              </p>
            </div>
          </div>
          <button onClick={() => setConfirmDelete(true)} className="btn btn-sm btn-ghost text-rose-600 dark:text-rose-400 shrink-0">
            <Trash2 size={13} /> Löschen
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: Main content */}
        <div className="xl:col-span-2 space-y-5">

          {/* Mietkosten */}
          <div className="bg-card border border-card-line rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-card-divider flex items-center gap-2">
              <Wallet size={15} className="text-[#4F6BFF]" />
              <h2 className="text-sm font-semibold text-foreground">Mietkosten</h2>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Kaltmiete</p>
                  <p className="text-lg font-semibold tabular-nums text-foreground mt-0.5">{fmt(contract.rentAmount)} €</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nebenkosten</p>
                  <p className="text-lg font-semibold tabular-nums text-foreground mt-0.5">{fmt(contract.operatingCosts)} €</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Heizkosten</p>
                  <p className="text-lg font-semibold tabular-nums text-foreground mt-0.5">{fmt(contract.heatingCosts)} €</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Warmmiete</p>
                  <p className="text-lg font-bold tabular-nums text-[#4F6BFF] mt-0.5">{fmt(warmmiete)} €</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-card-divider flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Kaution</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">{fmt(contract.depositAmount)} €</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {contract.depositPaid ? (
                    <>
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-600">
                        Bezahlt{contract.depositPaidDate && ` am ${formatDateShort(contract.depositPaidDate)}`}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} className="text-red-500" />
                      <span className="text-xs font-medium text-red-600">Ausstehend</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Vertragsdaten */}
          <div className="bg-card border border-card-line rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-card-divider flex items-center gap-2">
              <CalendarClock size={15} className="text-[#4F6BFF]" />
              <h2 className="text-sm font-semibold text-foreground">Vertragsdaten</h2>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
              <div>
                <p className="text-xs text-muted-foreground">Vertragsbeginn</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{formatDate(contract.startDate)}</p>
              </div>
              {contract.endDate && (
                <div>
                  <p className="text-xs text-muted-foreground">Vertragsende</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{formatDate(contract.endDate)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Vertragsart</p>
                <p className="text-sm font-medium text-foreground mt-0.5 capitalize">{contract.contractType}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kündigungsfrist</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{contract.noticePeriod} Monate</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mietzahlung am</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{contract.rentPaymentDay}. des Monats</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Erstellt am</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{formatDateShort(contract.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Dokumente */}
          <div className="bg-card border border-card-line rounded-xl overflow-hidden">
            <div className="p-5">
              <DocumentList
                documents={documents}
                onAdd={(name, type, size, dataUrl) => addDocument(contract.id, name, type, size, dataUrl)}
                onDelete={deleteDocument}
              />
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Mieter */}
          <div className="bg-card border border-card-line rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-card-divider flex items-center gap-2">
              <User size={15} className="text-[#4F6BFF]" />
              <h2 className="text-sm font-semibold text-foreground">Mieter</h2>
            </div>
            <div className="p-5">
              {tenant ? (
                <div>
                  <p className="text-sm font-semibold text-foreground">{tenant.name}</p>
                  {tenant.email && <p className="text-xs text-muted-foreground mt-1">{tenant.email}</p>}
                  {tenant.phone && <p className="text-xs text-muted-foreground mt-0.5">{tenant.phone}</p>}
                  <button
                    onClick={() => navigate(`/bh/mieter/${tenant.id}`)}
                    className="btn btn-sm btn-ghost !px-0 mt-3 text-[#4F6BFF]"
                  >
                    Mieter ansehen <ArrowLeft size={12} className="rotate-180" />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Kein Mieter zugewiesen</p>
              )}
            </div>
          </div>

          {/* Objekt / Einheit */}
          <div className="bg-card border border-card-line rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-card-divider flex items-center gap-2">
              <Home size={15} className="text-[#4F6BFF]" />
              <h2 className="text-sm font-semibold text-foreground">Objekt & Einheit</h2>
            </div>
            <div className="p-5 space-y-3">
              {property && (
                <div>
                  <p className="text-sm font-semibold text-foreground">{property.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{property.address}</p>
                  <button
                    onClick={() => navigate(`/bh/objekte/${property.id}`)}
                    className="btn btn-sm btn-ghost !px-0 mt-2 text-[#4F6BFF]"
                  >
                    Objekt ansehen <ArrowLeft size={12} className="rotate-180" />
                  </button>
                </div>
              )}
              {unit && (
                <div className={cn(property && 'pt-3 border-t border-card-divider')}>
                  <p className="text-xs text-muted-foreground">Einheit</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{unit.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{unit.area} m² · {fmt(unit.currentRent)} € Kaltmiete</p>
                </div>
              )}
            </div>
          </div>

          {/* Notizen */}
          <div className="bg-card border border-card-line rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-card-divider flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Notizen</h2>
              {!editNotes && (
                <button
                  onClick={() => { setNotesVal(contract.notes || ''); setEditNotes(true); }}
                  className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Edit2 size={13} />
                </button>
              )}
            </div>
            <div className="p-5">
              {editNotes ? (
                <div className="space-y-2">
                  <textarea
                    value={notesVal}
                    onChange={(e) => setNotesVal(e.target.value)}
                    rows={4}
                    className="input w-full"
                    placeholder="Notizen zum Vertrag..."
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditNotes(false)} className="btn btn-sm btn-ghost">Abbrechen</button>
                    <button onClick={handleSaveNotes} className="btn btn-sm btn-primary">Speichern</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {contract.notes || 'Keine Notizen vorhanden.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Vertrag in den Papierkorb"
          message="Mietvertrag mit allen zugehörigen Vertragsdokumenten in den Papierkorb verschieben? Innerhalb von 30 Tagen wiederherstellbar."
          onConfirm={() => {
            cascadeContractToTrash(contract.id, moveToTrash);
            navigate('/bh/mietvertraege');
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
