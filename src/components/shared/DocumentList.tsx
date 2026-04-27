import { useRef, useState } from 'react';
import { Plus, Trash2, FileText, Download, Upload, Eye, Check, AlertTriangle } from 'lucide-react';
import { useFileDrop } from '../../hooks/useFileDrop';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { FilePreview } from './FilePreview';
import { getFileVisual, formatFileSize } from '../../lib/fileDisplay';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

interface UploadingFile {
  id: string;
  name: string;
  type: string;
  size: number;
}

interface Props {
  documents: Document[];
  onAdd: (name: string, type: string, size: number, dataUrl?: string) => void;
  onDelete: (id: string) => void;
}

// Mindest-Anzeigedauer des Upload-Items (ms). Genug, damit die Progressbar-
// Animation wahrnehmbar ist — auch bei winzigen Files, die der FileReader
// quasi sofort fertigliest. Deckt sich mit der CSS-Animation `upload-progress-fill`.
const UPLOAD_MIN_VISIBLE_MS = 650;

function makeUploadId(): string {
  // crypto.randomUUID ist in allen modernen Browsern verfügbar; Fallback für
  // alte Umgebungen / nicht-sichere Kontexte (HTTP dev-server ohne localhost).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `up-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const MAX_EMBED_SIZE = 5 * 1024 * 1024;

/**
 * Leitet den Upload-Status eines gespeicherten Dokuments aus den Metadaten ab.
 *
 * - `dataUrl` vorhanden → regulärer Upload, Datei eingebettet → success
 * - `size > 5 MB` ohne `dataUrl` → **bewusst** ohne Einbettung gespeichert
 *   (zu groß für localStorage) → success
 * - `size ≤ 5 MB` ohne `dataUrl` → FileReader ist gescheitert, die Datei wurde
 *   nur als Metadaten-Fallback angelegt (siehe `processFiles.onerror`) → error
 *
 * Dadurch brauchen wir keine zusätzliche `uploadError`-Spalte im Storage und
 * die Erkennung funktioniert auch für Dokumente aus früheren Sessions.
 */
function getUploadStatus(doc: Document): 'success' | 'error' {
  if (doc.dataUrl) return 'success';
  if (doc.size > MAX_EMBED_SIZE) return 'success';
  return 'error';
}

export function DocumentList({ documents, onAdd, onDelete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);
  // Per Datei: solange sie hochgeladen wird, liegt sie hier als temporäres
  // UI-Element. Sobald der FileReader fertig ist UND die Min-Sichtbarkeits-
  // dauer abgelaufen ist, committen wir per `onAdd` und entfernen den Eintrag.
  // Success-/Error-Status wird danach permanent aus `getUploadStatus(doc)`
  // abgeleitet — keine zusätzliche State-Maschine nötig.
  const [uploading, setUploading] = useState<UploadingFile[]>([]);

  const processFiles = (files: File[]) => {
    files.forEach((file) => {
      const uploadId = makeUploadId();
      const startTime = performance.now();

      setUploading((prev) => [
        ...prev,
        { id: uploadId, name: file.name, type: file.type, size: file.size },
      ]);

      const commit = (dataUrl?: string) => {
        const elapsed = performance.now() - startTime;
        const remaining = Math.max(0, UPLOAD_MIN_VISIBLE_MS - elapsed);
        window.setTimeout(() => {
          onAdd(file.name, file.type, file.size, dataUrl);
          setUploading((prev) => prev.filter((u) => u.id !== uploadId));
        }, remaining);
      };

      if (file.size > MAX_EMBED_SIZE) {
        // Zu groß für DataUrl → nur Metadaten. Trotzdem Animation durchlaufen
        // lassen. `getUploadStatus` erkennt das an der Größe als Success.
        commit();
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          commit(reader.result as string);
        };
        reader.onerror = () => {
          console.error(`Datei „${file.name}" konnte nicht gelesen werden`, reader.error);
          // Fallback: Metadaten ohne Inhalt speichern, damit der User das Problem bemerkt
          commit();
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    processFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const { isDragging, dragHandlers } = useFileDrop({ onFiles: processFiles });

  const handleDownload = (doc: Document) => {
    if (!doc.dataUrl) return;
    const a = document.createElement('a');
    a.href = doc.dataUrl;
    a.download = doc.name;
    a.click();
  };

  const hasDocs = documents.length > 0;
  const hasUploads = uploading.length > 0;
  // Während ein Upload läuft, soll die Dropzone auch ohne fertige Docs
  // das Hint-Layout zeigen (gerundet + Padding), damit die Upload-Items
  // nicht im leeren Container „schweben".
  const showHintLayout = hasDocs || hasUploads;

  // Hilfs-Render für Upload-Items: eigene Card mit pulsierendem Icon, Label
  // „Wird hochgeladen…" und Progressbar-Füllung (CSS-Animation).
  const renderUploadingItems = () =>
    uploading.map((up) => {
      const visual = getFileVisual(up.type, up.name);
      const { Icon } = visual;
      return (
        <div
          key={up.id}
          className="upload-item flex flex-row items-center gap-3 p-2.5 rounded-[10px] bg-card border border-[var(--primary)]/35"
          aria-live="polite"
        >
          <div className={`shrink-0 w-10 h-10 rounded-[8px] flex items-center justify-center ${visual.tileClass} upload-icon-pulse`}>
            <Icon size={18} className={visual.iconClass} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate text-foreground leading-tight" title={up.name}>
              {up.name}
            </p>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
              <span className="font-medium tracking-wide uppercase">{visual.label}</span>
              <span aria-hidden="true" className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
              <span className="font-variant-numeric-tabular">{formatFileSize(up.size)}</span>
              <span aria-hidden="true" className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
              <span className="text-[var(--primary)] font-medium">Wird hochgeladen…</span>
            </div>
            <div className="upload-progress mt-1.5" role="progressbar" aria-label="Upload-Fortschritt">
              <div className="upload-progress-bar" />
            </div>
          </div>
        </div>
      );
    });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <p className="section-title">{documents.length} Dokumente</p>
        <button onClick={() => fileRef.current?.click()} className="btn btn-sm btn-primary">
          <Plus size={14} /> Dokument
        </button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
      </div>

      <div
        className={`relative dropzone ${showHintLayout ? 'dropzone-hint p-3' : ''} ${isDragging ? 'dropzone-active' : ''}`}
        {...dragHandlers}
      >
        {showHintLayout && (
          <div className="dropzone-hint-banner">
            <Upload size={12} />
            <span>Weitere Dateien per Drag &amp; Drop hinzufügen</span>
          </div>
        )}

        {!hasDocs && !hasUploads ? (
          <div className="rounded-[10px] p-8 text-center border border-dashed border-card-line">
            <div className="rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 bg-[#4F6BFF]/10">
              <FileText size={24} className="text-[#4F6BFF]" />
            </div>
            <p className="text-sm text-muted-foreground-2">Noch keine Dokumente. Klicke auf "Dokument" oder ziehe Dateien hierher.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Laufende Uploads zuerst — der User sieht, dass seine Aktion greift */}
            {renderUploadingItems()}
            {documents.map((doc) => {
              const visual = getFileVisual(doc.type, doc.name);
              const { Icon } = visual;
              const status = getUploadStatus(doc);
              const isError = status === 'error';
              return (
                <div
                  key={doc.id}
                  className={`dropzone-item group flex flex-row items-center gap-3 p-2.5 rounded-[10px] bg-card border transition-colors hover:bg-layer-hover ${
                    isError
                      ? 'border-rose-500/40 hover:border-rose-500/60'
                      : 'border-card-line hover:border-[var(--primary)]/30'
                  }`}
                >
                  {/* Icon-Kachel + Status-Badge (permanent sichtbar) */}
                  <div className={`relative shrink-0 w-10 h-10 rounded-[8px] flex items-center justify-center ${visual.tileClass}`}>
                    <Icon size={18} className={visual.iconClass} strokeWidth={2} />
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
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                      <span className="font-medium tracking-wide uppercase">{visual.label}</span>
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
                      onClick={() => setDeleteDoc(doc)}
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

        {isDragging && (
          <div className="dropzone-overlay">
            <Upload size={32} className="text-[#4F6BFF] dropzone-icon" />
            <p className="text-sm font-medium text-foreground mt-2">Dateien hier ablegen</p>
          </div>
        )}
      </div>

      {previewDoc && (
        <Modal open={true} onClose={() => setPreviewDoc(null)} title={previewDoc.name} size="lg">
          <FilePreview
            mimeType={previewDoc.type}
            name={previewDoc.name}
            dataUrl={previewDoc.dataUrl}
            size={previewDoc.size}
            onDownload={() => handleDownload(previewDoc)}
          />
        </Modal>
      )}

      {deleteDoc && (
        <ConfirmDialog
          open={true}
          onClose={() => setDeleteDoc(null)}
          onConfirm={() => { onDelete(deleteDoc.id); setDeleteDoc(null); }}
          title="Dokument löschen"
          message={`Möchtest du "${deleteDoc.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        />
      )}
    </div>
  );
}
