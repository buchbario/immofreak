import { useMemo, useState } from 'react';
import {
  Search, Filter, FileText, Download, Eye, Trash2,
  Building2, Users, FileSignature, Camera, Calendar,
  Check, AlertTriangle,
} from 'lucide-react';
import { usePropertyDocuments } from '../../hooks/usePropertyDocuments';
import { useContractDocuments } from '../../hooks/useContractDocuments';
import { usePropertyPhotos } from '../../hooks/usePropertyPhotos';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalContracts } from '../../hooks/useRentalContracts';
import { useTenants } from '../../hooks/useTenants';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useTrash } from '../../hooks/useTrash';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FilePreview } from '../shared/FilePreview';
import { getFileVisual, formatFileSize, dataUrlByteSize } from '../../lib/fileDisplay';

type DocKind = 'property-doc' | 'contract-doc' | 'property-photo';

interface ArchiveDoc {
  id: string;
  kind: DocKind;
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  createdAt: string;
  // Relationen (human-readable)
  propertyId?: string;
  propertyName?: string;
  contractId?: string;
  tenantName?: string;
  unitName?: string;
}

const KIND_LABEL: Record<DocKind, string> = {
  'property-doc': 'Objekt',
  'contract-doc': 'Mietvertrag',
  'property-photo': 'Foto',
};

const KIND_ICON: Record<DocKind, typeof FileText> = {
  'property-doc': Building2,
  'contract-doc': FileSignature,
  'property-photo': Camera,
};

/** Pastell-Farb-Tokens je Kontext (Pill + Icon-Akzent) */
const KIND_STYLE: Record<DocKind, { bg: string; text: string; hex: string }> = {
  'property-doc': { bg: 'bg-[#4F6BFF]/10', text: 'text-[#4F6BFF]', hex: '#4F6BFF' },
  'contract-doc': { bg: 'bg-violet-500/10', text: 'text-violet-500', hex: '#8b5cf6' },
  'property-photo': { bg: 'bg-emerald-500/10', text: 'text-emerald-500', hex: '#10b981' },
};

/**
 * Deckungsgleich mit DocumentList: Dateien bis 5 MB sind eingebettet (`dataUrl`).
 * Größere werden bewusst ohne dataUrl gespeichert (Meta-Only) — das ist kein
 * Fehler. Kein dataUrl **und** kleine Datei → FileReader hat versagt.
 */
const MAX_EMBED_SIZE = 5 * 1024 * 1024;

function getUploadStatus(doc: ArchiveDoc): 'success' | 'error' {
  if (doc.dataUrl) return 'success';
  if (doc.size > MAX_EMBED_SIZE) return 'success';
  return 'error';
}

export function DokumenteArchivPage() {
  const { allDocuments: propertyDocs, deleteDocument: deletePropertyDoc } = usePropertyDocuments();
  const { allDocuments: contractDocs, deleteDocument: deleteContractDoc } = useContractDocuments();
  const { allPhotos: propertyPhotos, deletePhoto: deletePropertyPhoto } = usePropertyPhotos();
  const { properties } = useRentalProperties();
  const { allContracts } = useRentalContracts();
  const { allTenants } = useTenants();
  const { allUnits } = useRentalUnits();
  const { moveToTrash } = useTrash();

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<DocKind | 'all'>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [previewDoc, setPreviewDoc] = useState<ArchiveDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArchiveDoc | null>(null);

  // Aggregiere alle Dokumente in ein einheitliches Array
  const allDocs: ArchiveDoc[] = useMemo(() => {
    const docs: ArchiveDoc[] = [];
    propertyDocs.forEach((d) => {
      const prop = properties.find((p) => p.id === d.propertyId);
      docs.push({
        id: d.id, kind: 'property-doc', name: d.name, mimeType: d.type, size: d.size,
        dataUrl: d.dataUrl, createdAt: d.createdAt,
        propertyId: d.propertyId, propertyName: prop?.name,
      });
    });
    contractDocs.forEach((d) => {
      const contract = allContracts.find((c) => c.id === d.contractId);
      const prop = contract ? properties.find((p) => p.id === contract.propertyId) : undefined;
      const tenant = contract ? allTenants.find((t) => t.id === contract.tenantId) : undefined;
      const unit = contract ? allUnits.find((u) => u.id === contract.unitId) : undefined;
      docs.push({
        id: d.id, kind: 'contract-doc', name: d.name, mimeType: d.type, size: d.size,
        dataUrl: d.dataUrl, createdAt: d.createdAt,
        contractId: d.contractId,
        propertyId: prop?.id, propertyName: prop?.name,
        tenantName: tenant?.name, unitName: unit?.name,
      });
    });
    propertyPhotos.forEach((p) => {
      const prop = properties.find((pr) => pr.id === p.propertyId);
      docs.push({
        id: p.id, kind: 'property-photo', name: p.name, mimeType: 'image/jpeg',
        size: dataUrlByteSize(p.dataUrl),
        dataUrl: p.dataUrl, createdAt: p.createdAt,
        propertyId: p.propertyId, propertyName: prop?.name,
      });
    });
    return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [propertyDocs, contractDocs, propertyPhotos, properties, allContracts, allTenants, allUnits]);

  // Gefilterte Ansicht
  const filteredDocs = useMemo(() => {
    return allDocs.filter((d) => {
      if (kindFilter !== 'all' && d.kind !== kindFilter) return false;
      if (propertyFilter !== 'all' && d.propertyId !== propertyFilter) return false;
      if (yearFilter !== 'all' && !d.createdAt.startsWith(yearFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${d.name} ${d.propertyName || ''} ${d.tenantName || ''} ${d.unitName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allDocs, kindFilter, propertyFilter, yearFilter, search]);

  // KPI-Zahlen
  const kpiCounts = useMemo(() => ({
    total: allDocs.length,
    propertyDocs: allDocs.filter((d) => d.kind === 'property-doc').length,
    contractDocs: allDocs.filter((d) => d.kind === 'contract-doc').length,
    photos: allDocs.filter((d) => d.kind === 'property-photo').length,
    totalSize: allDocs.reduce((s, d) => s + d.size, 0),
  }), [allDocs]);

  // Verfügbare Jahre (für Filter)
  const availableYears = useMemo(() => {
    const years = new Set(allDocs.map((d) => d.createdAt.substring(0, 4)));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [allDocs]);

  const handleDownload = (doc: ArchiveDoc) => {
    if (!doc.dataUrl) return;
    const a = document.createElement('a');
    a.href = doc.dataUrl;
    a.download = doc.name;
    a.click();
  };

  const handleDelete = (doc: ArchiveDoc) => {
    // Alle drei Arten (Objekt-Dok, Vertrags-Dok, Objekt-Foto) wandern zuerst in
    // den Papierkorb und sind 30 Tage wiederherstellbar.
    if (doc.kind === 'property-doc') {
      const full = propertyDocs.find((d) => d.id === doc.id);
      if (full) {
        moveToTrash({
          entityType: 'propertyDocument',
          entityId: doc.id,
          data: full,
          label: doc.name,
          sublabel: doc.propertyName,
        });
      }
      deletePropertyDoc(doc.id);
    } else if (doc.kind === 'contract-doc') {
      const full = contractDocs.find((d) => d.id === doc.id);
      if (full) {
        moveToTrash({
          entityType: 'contractDocument',
          entityId: doc.id,
          data: full,
          label: doc.name,
          sublabel: `${doc.tenantName || ''}${doc.unitName ? ' · ' + doc.unitName : ''}`.trim() || doc.propertyName,
        });
      }
      deleteContractDoc(doc.id);
    } else if (doc.kind === 'property-photo') {
      const full = propertyPhotos.find((p) => p.id === doc.id);
      if (full) {
        moveToTrash({
          entityType: 'propertyPhoto',
          entityId: doc.id,
          data: full,
          label: doc.name,
          sublabel: doc.propertyName,
        });
      }
      deletePropertyPhoto(doc.id);
    }
    setDeleteTarget(null);
  };

  const resetFilters = () => {
    setSearch('');
    setKindFilter('all');
    setPropertyFilter('all');
    setYearFilter('all');
  };

  const hasActiveFilter = kindFilter !== 'all' || propertyFilter !== 'all' || yearFilter !== 'all' || search.length > 0;

  return (
    <div className="page-container">
      {/* Flat header */}
      <div className="mb-5 sm:mb-6 px-1">
        <h1 className="text-[26px] sm:text-[30px] font-bold text-foreground tracking-tight leading-[1.15] mb-1.5">
          Dokumenten-Archiv
        </h1>
        <p className="text-[14px] text-muted-foreground max-w-2xl leading-relaxed">
          Zentrale Ablage aller Verträge, Nachweise und Fotos — gefiltert nach Typ, Objekt und Jahr.
        </p>
      </div>

      <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        {/* KPI strip inside card */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-card-divider border-b border-card-divider">
          <ArchiveKpi label="Gesamt" value={String(kpiCounts.total)} />
          <ArchiveKpi label="Objekt-Dokumente" value={String(kpiCounts.propertyDocs)} color="#4F6BFF" />
          <ArchiveKpi label="Vertrags-Dokumente" value={String(kpiCounts.contractDocs)} color="#8b5cf6" />
          <ArchiveKpi label="Fotos" value={String(kpiCounts.photos)} color="#10b981" />
          <ArchiveKpi label="Gesamt-Größe" value={formatFileSize(kpiCounts.totalSize)} />
        </div>

        {/* Filter-Leiste */}
        <div className="px-5 sm:px-7 py-3 border-b border-card-divider flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Dateiname, Objekt, Mieter suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 pr-3 rounded-md bg-layer-hover text-[12px] text-foreground placeholder:text-muted-foreground/70 border border-transparent hover:border-card-line focus:bg-card focus:border-[#4F6BFF]/40 focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/15 transition-all w-full"
            />
          </div>

          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as DocKind | 'all')} className="h-8 px-2 rounded-md bg-layer-hover hover:bg-layer-active text-[12px] border-0 cursor-pointer">
            <option value="all">Alle Typen</option>
            <option value="property-doc">Objekt-Dokumente</option>
            <option value="contract-doc">Mietvertrags-Dokumente</option>
            <option value="property-photo">Fotos</option>
          </select>

          <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className="h-8 px-2 rounded-md bg-layer-hover hover:bg-layer-active text-[12px] border-0 cursor-pointer">
            <option value="all">Alle Objekte</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="h-8 px-2 rounded-md bg-layer-hover hover:bg-layer-active text-[12px] border-0 cursor-pointer">
            <option value="all">Alle Jahre</option>
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          {hasActiveFilter && (
            <button onClick={resetFilters} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-layer-hover transition-colors cursor-pointer">
              <Filter size={12} /> Zurücksetzen
            </button>
          )}
        </div>

        {/* Dokumentenliste */}
        {filteredDocs.length === 0 ? (
          <div className="text-center py-12 px-5">
            <div className="rounded-2xl w-14 h-14 flex items-center justify-center mx-auto mb-3 bg-[#4F6BFF]/10">
              <FileText size={22} className="text-[#4F6BFF]" />
            </div>
            <p className="text-[13px] text-foreground font-semibold mb-1">Keine Dokumente gefunden</p>
            <p className="text-[12px] text-muted-foreground">
              {hasActiveFilter
                ? 'Passe die Filter an oder setze sie zurück.'
                : 'Lade Dokumente bei Objekten, Mietverträgen oder Fotos hoch — sie erscheinen hier zentral.'}
            </p>
          </div>
        ) : (
          <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredDocs.map((doc) => {
            const visual = getFileVisual(doc.mimeType, doc.name);
            const { Icon: FileTypeIcon } = visual;
            const KindIcon = KIND_ICON[doc.kind];
            const kindStyle = KIND_STYLE[doc.kind];
            const status = getUploadStatus(doc);
            const isError = status === 'error';
            return (
              <div
                key={`${doc.kind}-${doc.id}`}
                className={`group flex flex-row items-center gap-3 p-3 rounded-[10px] bg-card border transition-colors hover:bg-layer-hover ${
                  isError
                    ? 'border-rose-500/40 hover:border-rose-500/60'
                    : 'border-card-line hover:border-[var(--primary)]/30'
                }`}
              >
                {/* Datei-Typ-Kachel + Status-Badge (permanent sichtbar) */}
                <div className={`relative shrink-0 w-11 h-11 rounded-[8px] flex items-center justify-center ${visual.tileClass}`}>
                  <FileTypeIcon size={20} className={visual.iconClass} strokeWidth={2} />
                  {isError ? (
                    <span
                      className="status-badge absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 ring-2 ring-card"
                      title="Upload fehlgeschlagen"
                      aria-label="Upload fehlgeschlagen"
                    >
                      <AlertTriangle size={10} className="text-white" strokeWidth={3} />
                    </span>
                  ) : (
                    <span
                      className="status-badge absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-card"
                      title="Upload erfolgreich"
                      aria-label="Upload erfolgreich"
                    >
                      <Check size={10} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                </div>

                {/* Name + Meta */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-foreground leading-tight" title={doc.name}>
                    {doc.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
                    {/* Kontext-Pill */}
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] font-medium ${kindStyle.bg} ${kindStyle.text}`}>
                      <KindIcon size={10} strokeWidth={2.5} />
                      {KIND_LABEL[doc.kind]}
                    </span>
                    <span aria-hidden="true" className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                    <span className="font-medium uppercase tracking-wide">{visual.label}</span>
                    <span aria-hidden="true" className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                    <span className="font-variant-numeric-tabular">{formatFileSize(doc.size)}</span>
                    {isError && (
                      <>
                        <span aria-hidden="true" className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                        <span className="inline-flex items-center gap-1 text-rose-500 font-medium">
                          <AlertTriangle size={10} strokeWidth={2.5} />
                          Upload fehlgeschlagen
                        </span>
                      </>
                    )}

                    {/* Zweite Zeile: Kontext-Details */}
                    {(doc.propertyName || doc.tenantName || doc.unitName) && (
                      <span className="w-full flex items-center flex-wrap gap-x-2 gap-y-0.5 text-muted-foreground-2">
                        {doc.propertyName && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                            <Building2 size={10} strokeWidth={2} className="shrink-0" />
                            <span className="truncate">{doc.propertyName}</span>
                          </span>
                        )}
                        {doc.tenantName && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                            <Users size={10} strokeWidth={2} className="shrink-0" />
                            <span className="truncate">{doc.tenantName}</span>
                          </span>
                        )}
                        {doc.unitName && <span className="truncate">· {doc.unitName}</span>}
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={10} strokeWidth={2} />
                          {new Date(doc.createdAt).toLocaleDateString('de-DE')}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Aktionen */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setPreviewDoc(doc)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-[6px] text-muted-foreground hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                    title="Vorschau"
                    aria-label="Vorschau"
                  >
                    <Eye size={15} />
                  </button>
                  {doc.dataUrl && (
                    <button
                      onClick={() => handleDownload(doc)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-[6px] text-muted-foreground hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                      title="Herunterladen"
                      aria-label="Herunterladen"
                    >
                      <Download size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTarget(doc)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-[6px] text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Löschen"
                    aria-label="Löschen"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Footer counter */}
        {filteredDocs.length > 0 && (
          <div className="px-5 sm:px-7 py-3 border-t border-card-divider">
            <p className="text-[11.5px] text-muted-foreground tabular-nums">
              {filteredDocs.length} von {allDocs.length} Dokumenten
            </p>
          </div>
        )}
      </div>

      {/* Rechtlicher Hinweis */}
      <div className="mt-4 sm:mt-5 p-4 rounded-2xl border border-card-line bg-card text-[11.5px] leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground mb-1.5">Aufbewahrungsfristen für Vermieter (Deutschland)</p>
        <ul className="list-disc ml-5 space-y-1">
          <li><strong>10 Jahre</strong> — Mietverträge, Nebenkostenabrechnungen, Belege, Rechnungen, Verträge mit Dienstleistern (§ 147 Abs. 3 AO, § 14b UStG)</li>
          <li><strong>6 Jahre</strong> — Geschäftsbriefe, Handelsbriefe, E-Mail-Korrespondenz mit Mietern (§ 147 Abs. 3 AO)</li>
          <li><strong>Bis 30 Jahre</strong> — Kautions-Unterlagen nach Vertragsende, Bauakten, Baugenehmigungen</li>
        </ul>
        <p className="mt-2"><strong className="text-foreground">GoBD-konform:</strong> Unveränderbarkeit, zeitgerechte Erfassung, Nachvollziehbarkeit. Dokumente werden lokal gespeichert — für echte Archivierungssicherheit zusätzlich auf externem Speicher sichern (Festplatte, Cloud mit Verschlüsselung).</p>
        <p className="mt-1"><strong className="text-foreground">DSGVO:</strong> Personenbezogene Daten nach Vertragsende + 10 Jahre löschen. Mieter-Fotos und Selbstauskünfte unterliegen der Zweckbindung (Art. 5 Abs. 1b DSGVO).</p>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <Modal open={true} onClose={() => setPreviewDoc(null)} title={previewDoc.name} size="lg">
          <FilePreview
            mimeType={previewDoc.mimeType}
            name={previewDoc.name}
            dataUrl={previewDoc.dataUrl}
            size={previewDoc.size}
            subtitle={[
              KIND_LABEL[previewDoc.kind],
              previewDoc.propertyName,
              previewDoc.tenantName,
              previewDoc.unitName,
            ].filter(Boolean).join(' · ')}
            onDownload={() => handleDownload(previewDoc)}
          />
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
          title="Dokument löschen"
          message={
            deleteTarget.kind === 'property-photo'
              ? `Möchtest du "${deleteTarget.name}" endgültig löschen? Fotos werden nicht in den Papierkorb verschoben.`
              : `Möchtest du "${deleteTarget.name}" in den Papierkorb verschieben?`
          }
        />
      )}
    </div>
  );
}

function ArchiveKpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-4 bg-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-bold" style={color ? { color } : {}}>{value}</div>
    </div>
  );
}
