import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, Download, FileText, FileX, Image as ImageIcon, FileCode } from 'lucide-react';
import { dataUrlToBlobUrl, detectPreviewKind, formatFileSize } from '../../lib/fileDisplay';

interface Props {
  /** MIME-Type aus dem Datei-Upload (kann leer sein) */
  mimeType: string;
  /** Dateiname (für Endungs-Fallback bei fehlendem MIME) */
  name: string;
  /** Base64-Data-URL oder blob:/http: URL */
  dataUrl?: string;
  /** Datei-Größe in Bytes (für Info-Zeile) */
  size?: number;
  /** Optional: Zusatztext unter der Vorschau */
  subtitle?: string;
  /** Download-Handler */
  onDownload?: () => void;
}

/**
 * Universelle Datei-Vorschau.
 *
 * Wichtig: Konvertiert `data:`-URLs zu `blob:`-URLs, damit PDFs im iframe
 * rendern (Browser blockieren `data:`-URLs in iframes aus Sicherheitsgründen).
 * Die erzeugten Blob-URLs werden beim Unmount automatisch revoked.
 */
export function FilePreview({ mimeType, name, dataUrl, size, subtitle, onDownload }: Props) {
  const kind = useMemo(() => detectPreviewKind(mimeType, name), [mimeType, name]);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  // Blob-URL aus data:-URL bauen, damit iframe sie rendern darf
  useEffect(() => {
    if (!dataUrl) {
      setBlobUrl(null);
      return;
    }
    if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http:') || dataUrl.startsWith('https:')) {
      setBlobUrl(dataUrl);
      return;
    }
    let url: string | null = null;
    try {
      url = dataUrlToBlobUrl(dataUrl, mimeType || undefined);
      setBlobUrl(url);
    } catch {
      setBlobUrl(null);
    }
    return () => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [dataUrl, mimeType]);

  // Text-Inhalt decodieren für Textdateien
  useEffect(() => {
    if (kind !== 'text' || !dataUrl) {
      setTextContent(null);
      return;
    }
    try {
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) return;
      const data = dataUrl.substring(commaIdx + 1);
      const isBase64 = dataUrl.substring(0, commaIdx).includes(';base64');
      const decoded = isBase64 ? atob(data) : decodeURIComponent(data);
      setTextContent(decoded);
    } catch {
      setTextContent(null);
    }
  }, [dataUrl, kind]);

  const hasData = Boolean(blobUrl);
  const infoLine = [
    size != null ? formatFileSize(size) : null,
    mimeType || null,
    subtitle || null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-3">
      {/* Vorschau-Fläche */}
      <div className="relative w-full rounded-[12px] border border-card-line bg-layer-1 overflow-hidden">
        {kind === 'image' && hasData && (
          <img
            src={blobUrl!}
            alt={name}
            className="w-full max-h-[70vh] object-contain bg-[#0b0b0e]"
          />
        )}

        {kind === 'pdf' && hasData && (
          <iframe
            key={blobUrl}
            src={blobUrl!}
            title={name}
            className="w-full h-[70vh] block bg-white"
            style={{ border: 'none' }}
          />
        )}

        {kind === 'text' && (
          textContent != null ? (
            <pre className="w-full max-h-[70vh] overflow-auto p-4 m-0 text-[12.5px] leading-relaxed font-mono whitespace-pre-wrap break-words text-foreground bg-layer-2">
              {textContent}
            </pre>
          ) : (
            <EmptyState
              icon={<FileCode size={24} className="text-slate-500" />}
              tint="bg-slate-500/10"
              title="Text-Inhalt konnte nicht gelesen werden"
              description="Die Datei liegt nur als Referenz vor oder die Kodierung wird nicht unterstützt."
            />
          )
        )}

        {kind === 'office' && (
          <EmptyState
            icon={<FileText size={24} className="text-sky-500" />}
            tint="bg-sky-500/10"
            title="Office-Dokument"
            description="Word-, Excel- und PowerPoint-Dateien können im Browser nicht direkt angezeigt werden. Lade die Datei herunter, um sie in deiner gewohnten Anwendung zu öffnen."
          />
        )}

        {kind === 'unsupported' && (
          <EmptyState
            icon={<FileX size={24} className="text-[#4F6BFF]" />}
            tint="bg-[#4F6BFF]/10"
            title="Keine Vorschau verfügbar"
            description={
              !dataUrl
                ? 'Die Datei ist zu groß und wurde nur als Referenz (Name + Größe) gespeichert. Lade die Original-Datei aus deinem externen Speicher.'
                : `Dateityp „${mimeType || 'unbekannt'}" kann nicht direkt im Browser angezeigt werden.`
            }
          />
        )}

        {!hasData && (kind === 'image' || kind === 'pdf') && (
          <EmptyState
            icon={<AlertCircle size={24} className="text-amber-500" />}
            tint="bg-amber-500/10"
            title="Vorschau nicht geladen"
            description={
              !dataUrl
                ? 'Datei ist >5 MB und wurde nicht eingebettet. Lade die Original-Datei stattdessen herunter.'
                : 'Die eingebetteten Daten konnten nicht geöffnet werden.'
            }
          />
        )}
      </div>

      {/* Info + Aktionen */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate" title={infoLine}>{infoLine}</span>
        <div className="flex items-center gap-2 shrink-0">
          {blobUrl && (kind === 'pdf' || kind === 'image') && (
            <a
              href={blobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-ghost"
            >
              <ExternalLink size={13} /> In neuem Tab öffnen
            </a>
          )}
          {onDownload && dataUrl && (
            <button onClick={onDownload} className="btn btn-sm btn-secondary">
              <Download size={14} /> Herunterladen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  tint,
  title,
  description,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-10 min-h-[280px]">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${tint}`}>
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground-2 mt-1.5 max-w-md leading-relaxed">{description}</p>
    </div>
  );
}

// Unused import guard (kept for tree-shake tolerance)
void ImageIcon;
