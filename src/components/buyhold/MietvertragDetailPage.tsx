import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Wallet, CalendarClock, Home, User,
  CheckCircle2, XCircle, Edit2, Trash2, FileText,
  PenLine, Upload, ShieldAlert, FileSignature, Sparkles,
  Printer, Download, FilePlus2,
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
import { ContractPreviewModal } from './ContractPreviewModal';
import { cn } from '../../lib/utils';
import type { RentalContractStatus } from '../../types';
import { getEffectiveContractStatus } from '../../types';

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
  const [previewOpen, setPreviewOpen] = useState(false);
  // Stabiler Mount-Timestamp — `Date.now()` darf nicht im Render-Body laufen.
  const [nowMs] = useState(() => Date.now());

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

  const effectiveStatus = getEffectiveContractStatus(contract);
  // Status-Badge: kombiniert Lifecycle (`status`) und Lauf-Frist (`endDate`).
  // Reihenfolge: terminated > signed/active mit Ablaufwarnung > generated > draft.
  const getStatus = () => {
    if (effectiveStatus === 'terminated') return { label: 'Beendet', cls: 'badge-red', icon: XCircle };
    if (effectiveStatus === 'draft') return { label: 'Entwurf', cls: 'badge-gray', icon: Edit2 };
    if (effectiveStatus === 'generated') return { label: 'Wartet auf Unterschrift', cls: 'badge-amber', icon: PenLine };
    // signed oder active — Vertrag ist unterschrieben. Zeige zusätzlich Ablauf-Warnung.
    if (contract.endDate) {
      const end = new Date(contract.endDate);
      const daysLeft = Math.ceil((end.getTime() - nowMs) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) return { label: 'Abgelaufen', cls: 'badge-red', icon: XCircle };
      if (daysLeft <= 90) return { label: `Unterschrieben · läuft in ${daysLeft}T ab`, cls: 'badge-amber', icon: CalendarClock };
    }
    return { label: 'Unterschrieben', cls: 'badge-green', icon: CheckCircle2 };
  };
  const status = getStatus();

  const handleSaveNotes = () => {
    updateContract(contract.id, { notes: notesVal });
    setEditNotes(false);
  };

  // ── Vertrags-Lifecycle-Aktionen ───────────────────────────────────────────
  // Generieren = vom Entwurf zum gedruckten/finalen Vertrag wechseln. Nutzer
  // exportiert ihn dann via "Vertrag ansehen" und lässt ihn unterschreiben.
  const handleMarkGenerated = () => {
    updateContract(contract.id, { status: 'generated' });
  };

  // Manuell als unterschrieben markieren (auch ohne PDF-Upload möglich) —
  // setzt `signed_at` auf heute und `status` auf 'signed'.
  const handleMarkSigned = () => {
    updateContract(contract.id, {
      status: 'signed',
      signedAt: new Date().toISOString().slice(0, 10),
    });
  };

  const handleUnsign = () => {
    updateContract(contract.id, {
      status: 'generated',
      signedAt: null,
      signedDocumentId: null,
    });
  };

  // Upload des unterschriebenen Scans → ContractDocument anlegen, als signiert markieren,
  // Vertragsstatus auf 'signed' setzen.
  const handleSignedUpload = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error('Datei konnte nicht gelesen werden.'));
      reader.readAsDataURL(file);
    });
    const doc = addDocument(contract.id, file.name, file.type || 'application/pdf', file.size, dataUrl, {
      documentType: 'signed',
      isSignedOriginal: true,
    });
    updateContract(contract.id, {
      status: 'signed',
      signedAt: new Date().toISOString().slice(0, 10),
      signedDocumentId: doc.id,
    });
  };

  const signedDocument = contract.signedDocumentId
    ? documents.find((d) => d.id === contract.signedDocumentId)
    : null;

  return (
    <div className="page-container">
      {/* Flat header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5 sm:mb-6 px-1">
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
              <h1 className="text-[24px] sm:text-[28px] font-bold text-foreground tracking-tight leading-[1.15]">Mietvertrag</h1>
              <span className={`badge ${status.cls}`}>{status.label}</span>
            </div>
            <p className="text-[13px] text-muted-foreground truncate mt-0.5">
              {tenant?.name || '–'} · {unit?.name || '–'} · {property?.name || '–'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <button onClick={() => setPreviewOpen(true)} className="btn btn-sm btn-primary">
            <FileText size={13} /> Vertrag ansehen
          </button>
          <button onClick={() => setConfirmDelete(true)} className="btn btn-sm btn-ghost text-rose-600 dark:text-rose-400">
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
                {contract.depositPaid ? (
                  <button
                    type="button"
                    onClick={() => updateContract(contract.id, { depositPaid: false, depositPaidDate: null })}
                    title="Status zurücksetzen"
                    className="inline-flex items-center gap-1.5 px-2 py-1 -mr-2 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-600">
                      Bezahlt{contract.depositPaidDate && ` am ${formatDateShort(contract.depositPaidDate)}`}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateContract(contract.id, { depositPaid: true, depositPaidDate: new Date().toISOString().slice(0, 10) })}
                    title="Als bezahlt markieren"
                    className="inline-flex items-center gap-1.5 px-2 py-1 -mr-2 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <XCircle size={14} className="text-red-500" />
                    <span className="text-xs font-medium text-red-600">Ausstehend — als bezahlt markieren</span>
                  </button>
                )}
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

          {/* Signatur & Lifecycle */}
          <SignatureSection
            status={effectiveStatus}
            signedAt={contract.signedAt ?? null}
            signedDocument={signedDocument}
            onGenerate={handleMarkGenerated}
            onMarkSigned={handleMarkSigned}
            onUnsign={handleUnsign}
            onUploadSignedPdf={handleSignedUpload}
            onOpenPreview={() => setPreviewOpen(true)}
            formatDate={formatDate}
          />

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
                    className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#4F6BFF]/10 hover:bg-[#4F6BFF]/15 text-[#4F6BFF] text-xs font-semibold transition-colors cursor-pointer"
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
                    className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#4F6BFF]/10 hover:bg-[#4F6BFF]/15 text-[#4F6BFF] text-xs font-semibold transition-colors cursor-pointer"
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

      <ContractPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        contract={contract}
        tenant={tenant}
        unit={unit}
        property={property}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SignatureSection — Vertrags-Lifecycle UI
// ─────────────────────────────────────────────────────────────────────────────

interface SignatureSectionProps {
  status: RentalContractStatus;
  signedAt: string | null;
  signedDocument: { id: string; name: string; dataUrl?: string } | null | undefined;
  onGenerate: () => void;
  onMarkSigned: () => void;
  onUnsign: () => void;
  onUploadSignedPdf: (file: File) => void | Promise<void>;
  onOpenPreview: () => void;
  formatDate: (s: string) => string;
}

function SignatureSection({
  status,
  signedAt,
  signedDocument,
  onGenerate,
  onMarkSigned,
  onUnsign,
  onUploadSignedPdf,
  onOpenPreview,
  formatDate,
}: SignatureSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setUploadError('Datei ist größer als 15 MB. Bitte komprimiere den Scan.');
      return;
    }
    if (!/pdf|image\//.test(file.type)) {
      setUploadError('Bitte ein PDF oder Bild des unterschriebenen Vertrags hochladen.');
      return;
    }
    setUploadError(null);
    await onUploadSignedPdf(file);
  };

  // Lifecycle-Stepper-Daten — pro Status wird ein bestimmter Schritt aktiv markiert.
  const stepIndex = (() => {
    if (status === 'draft') return 0;
    if (status === 'generated') return 1;
    if (status === 'signed' || status === 'active') return 2;
    return 3; // terminated
  })();

  return (
    <div className="bg-card border border-card-line rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Header mit Lifecycle-Stepper */}
      <div className="px-6 pt-5 pb-4 border-b border-card-divider">
        <div className="flex items-center gap-2 mb-4">
          <FileSignature size={16} className="text-[#4F6BFF]" />
          <h2 className="text-sm font-semibold text-foreground tracking-tight">Mietvertragsstatus</h2>
        </div>
        <Stepper
          steps={[
            { label: 'Entwurf', sub: 'Felder prüfen' },
            { label: 'Generiert', sub: 'Bereit zum Drucken' },
            { label: 'Unterschrieben', sub: 'Original liegt vor' },
          ]}
          activeIndex={stepIndex > 2 ? 2 : stepIndex}
          isCompleted={status === 'signed' || status === 'active' || status === 'terminated'}
        />
      </div>

      <div className="p-6 space-y-5">
        {/* Draft */}
        {status === 'draft' && (
          <StatusCard
            tone="neutral"
            icon={<Edit2 size={20} />}
            title="Dieser Vertrag ist noch ein Entwurf"
            body="Prüfe alle Felder im Vertragstext. Wenn alles passt, generierst du den Vertrag, druckst ihn aus und lässt ihn von beiden Seiten unterschreiben."
            primary={{ label: 'Vorschau & Drucken', icon: <Printer size={14} />, onClick: onOpenPreview }}
            secondary={{ label: 'Als generiert markieren', icon: <Sparkles size={14} />, onClick: onGenerate }}
          />
        )}

        {/* Generated */}
        {status === 'generated' && (
          <StatusCard
            tone="amber"
            icon={<FileText size={20} />}
            title="Vertrag wartet auf Unterschrift"
            body="Drucke den generierten Vertrag aus, lass ihn von Mieter und Vermieter unterschreiben und lade den Scan hoch oder bestätige die Unterschrift manuell."
            primary={{
              label: 'Unterschriebenes PDF hochladen',
              icon: <Upload size={14} />,
              onClick: () => fileInputRef.current?.click(),
            }}
            secondary={{
              label: 'Manuell als unterschrieben markieren',
              icon: <CheckCircle2 size={14} />,
              onClick: onMarkSigned,
            }}
            tertiary={{ label: 'Vorschau erneut öffnen', icon: <FileText size={14} />, onClick: onOpenPreview }}
          />
        )}

        {/* Signed / Active */}
        {(status === 'signed' || status === 'active') && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#4F6BFF]/15 bg-[#4F6BFF]/[0.04] overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="size-11 rounded-full bg-[#4F6BFF] text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} strokeWidth={2.6} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-foreground tracking-tight">
                    Vertrag ist unterschrieben{signedAt ? ` · ${formatDate(signedAt)}` : ''}
                  </p>
                  <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
                    {signedDocument
                      ? 'Original-Scan ist hinterlegt und jederzeit abrufbar.'
                      : 'Noch kein Scan hinterlegt — empfohlen, das unterschriebene Original einzuscannen.'}
                  </p>
                </div>
              </div>

              {signedDocument && (
                <div className="border-t border-[#4F6BFF]/15 bg-card/60 px-5 py-3 flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-[#4F6BFF]" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{signedDocument.name}</p>
                    <p className="text-xs text-muted-foreground">Original des unterschriebenen Mietvertrags</p>
                  </div>
                  {signedDocument.dataUrl && (
                    <a
                      href={signedDocument.dataUrl}
                      download={signedDocument.name}
                      className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[12px] font-semibold bg-[#4F6BFF] hover:bg-[#4F6BFF]/90 text-white transition-colors"
                    >
                      <Download size={13} />
                      Download
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!signedDocument && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold bg-[#4F6BFF] hover:bg-[#4F6BFF]/90 text-white shadow-[0_2px_6px_rgba(79,107,255,0.25)] transition-all hover:shadow-[0_4px_10px_rgba(79,107,255,0.35)] cursor-pointer"
                >
                  <Upload size={14} />
                  Scan nachträglich hochladen
                </button>
              )}
              <button
                onClick={onOpenPreview}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold bg-layer-hover hover:bg-card-line text-foreground transition-colors cursor-pointer"
              >
                <FileText size={14} />
                Vorschau anzeigen
              </button>
              <div className="flex-1" />
              <button
                onClick={onUnsign}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              >
                <ShieldAlert size={13} />
                Unterschrift zurücknehmen
              </button>
            </div>
          </div>
        )}

        {/* Terminated */}
        {status === 'terminated' && (
          <StatusCard
            tone="neutral"
            icon={<XCircle size={20} />}
            title="Dieser Vertrag ist beendet"
            body={'Das Mietverhältnis ist abgeschlossen. Wenn das ein Versehen war, kannst du oben über „Bearbeiten" das Enddatum korrigieren — oder einen Nachfolgevertrag anlegen.'}
            primary={{ label: 'Nachfolgevertrag anlegen', icon: <FilePlus2 size={14} />, onClick: onGenerate }}
          />
        )}

        {uploadError && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
            <XCircle size={14} className="text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">{uploadError}</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={onFileSelected}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stepper — Vertragslebenszyklus visuell darstellen
// ─────────────────────────────────────────────────────────────────────────────

interface StepperProps {
  steps: { label: string; sub: string }[];
  activeIndex: number;
  isCompleted: boolean;
}

function Stepper({ steps, activeIndex, isCompleted }: StepperProps) {
  return (
    <div className="flex items-start gap-2 sm:gap-3">
      {steps.map((step, i) => {
        const done = isCompleted ? i <= activeIndex : i < activeIndex;
        const current = !done && i === activeIndex;
        return (
          <div key={i} className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className={cn(
                  'size-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all',
                  done
                    ? 'bg-emerald-500 text-white shadow-[0_2px_6px_rgba(16,185,129,0.35)]'
                    : current
                    ? 'bg-[#4F6BFF] text-white shadow-[0_2px_6px_rgba(79,107,255,0.35)] ring-4 ring-[#4F6BFF]/15'
                    : 'bg-layer-hover text-muted-foreground border border-card-line',
                )}
              >
                {done ? <CheckCircle2 size={14} strokeWidth={2.6} /> : i + 1}
              </div>
            </div>
            <div className="min-w-0 pt-0.5">
              <p className={cn(
                'text-[12.5px] font-semibold leading-tight',
                done || current ? 'text-foreground' : 'text-muted-foreground',
              )}>
                {step.label}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight truncate">{step.sub}</p>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                'flex-1 h-px mt-3.5 hidden sm:block min-w-[12px]',
                done ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-card-line',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusCard — wiederverwendbare Status-Karte mit Icon + Aktionen
// ─────────────────────────────────────────────────────────────────────────────

interface StatusCardAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface StatusCardProps {
  tone: 'neutral' | 'amber';
  icon: React.ReactNode;
  title: string;
  body: string;
  primary: StatusCardAction;
  secondary?: StatusCardAction;
  tertiary?: StatusCardAction;
}

function StatusCard({ tone, icon, title, body, primary, secondary, tertiary }: StatusCardProps) {
  // Einheitliches Design: heller Blau-Tint + Border. Tone differenziert nur das
  // Icon (Akzentfarbe), Container/Text bleiben in der Brand-Palette.
  const toneClasses = {
    container: 'border-[#4F6BFF]/15 bg-[#4F6BFF]/[0.04]',
    iconBg: tone === 'amber'
      ? 'bg-amber-500 text-white'
      : 'bg-[#4F6BFF] text-white',
    title: 'text-foreground',
    body: 'text-muted-foreground',
  };

  return (
    <div className={cn('rounded-2xl border p-5', toneClasses.container)}>
      <div className="flex items-start gap-4 mb-4">
        <div className={cn('size-11 rounded-full flex items-center justify-center shrink-0', toneClasses.iconBg)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-[15px] font-semibold tracking-tight', toneClasses.title)}>{title}</p>
          <p className={cn('text-[13px] mt-1 leading-relaxed', toneClasses.body)}>{body}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={primary.onClick}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold bg-[#4F6BFF] hover:bg-[#4F6BFF]/90 text-white shadow-[0_2px_6px_rgba(79,107,255,0.25)] transition-all hover:shadow-[0_4px_10px_rgba(79,107,255,0.35)] cursor-pointer"
        >
          {primary.icon}
          {primary.label}
        </button>
        {secondary && (
          <button
            onClick={secondary.onClick}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold bg-card hover:bg-layer-hover text-foreground border border-card-line transition-colors cursor-pointer"
          >
            {secondary.icon}
            {secondary.label}
          </button>
        )}
        {tertiary && (
          <button
            onClick={tertiary.onClick}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-layer-hover transition-colors cursor-pointer"
          >
            {tertiary.icon}
            {tertiary.label}
          </button>
        )}
      </div>
    </div>
  );
}
