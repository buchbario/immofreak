// ============================================================================
// fileDisplay.ts — gemeinsame Helfer für Datei-Anzeige (Icons, Größen, Vorschau)
// ============================================================================
// Wird genutzt von:
//   • DocumentList.tsx (Kontext-spezifische Listen bei Objekten/Verträgen)
//   • DokumenteArchivPage.tsx (zentrales Archiv)
// ============================================================================

import {
  FileText, FileIcon, FileImage, FileSpreadsheet,
  FileArchive, FileCode, FileAudio, FileVideo,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type FileVisual = {
  Icon: LucideIcon;
  iconClass: string;
  tileClass: string;
  label: string;
};

/** Formatiert Byte-Angaben menschenlesbar (B / KB / MB). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Schätzt die tatsächliche Dateigröße in Bytes aus einer Data-URL.
 *
 * Ein Base64-String ist ca. 33 % länger als die ursprünglichen Bytes (4 Zeichen
 * codieren 3 Bytes). Die naive Annahme `dataUrl.length === size` überschätzt
 * daher deutlich — und ignoriert außerdem den `data:…;base64,`-Header.
 *
 * Korrekte Formel: `atob(data).length` (dekodierte Byte-Länge), oder als
 * Approximation ohne atob-Aufruf: `ceil(base64Len / 4) * 3 − paddingBytes`.
 * Für Archiv-Anzeige reicht die Approximation — sie vermeidet einen kompletten
 * Base64-Decode pro Datei.
 */
export function dataUrlByteSize(dataUrl: string | undefined | null): number {
  if (!dataUrl) return 0;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const header = dataUrl.substring(0, commaIdx);
  const data = dataUrl.substring(commaIdx + 1);
  if (!header.includes(';base64')) {
    // URL-encoded payload → roh-Länge ist eine brauchbare Schätzung
    try {
      return decodeURIComponent(data).length;
    } catch {
      return data.length;
    }
  }
  // Base64-Padding abziehen: jedes "=" entspricht einem fehlenden Byte
  const paddingMatch = data.match(/=+$/);
  const padding = paddingMatch ? paddingMatch[0].length : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

/**
 * Liefert passendes Icon, Farb-Klassen und Kurz-Label für einen Dateityp.
 * Fällt auf die Dateiendung zurück, wenn der MIME-Type fehlt oder generisch ist.
 */
export function getFileVisual(mimeType: string | undefined, filename: string): FileVisual {
  const t = (mimeType || '').toLowerCase();
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  if (t.includes('pdf') || ext === 'pdf') {
    return { Icon: FileText, iconClass: 'text-rose-500', tileClass: 'bg-rose-500/10', label: 'PDF' };
  }
  if (t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'bmp'].includes(ext)) {
    return {
      Icon: FileImage,
      iconClass: 'text-emerald-500',
      tileClass: 'bg-emerald-500/10',
      label: ext ? ext.toUpperCase() : 'Bild',
    };
  }
  if (t.includes('word') || t.includes('wordprocessing') || ['doc', 'docx', 'odt', 'rtf'].includes(ext)) {
    return {
      Icon: FileText,
      iconClass: 'text-sky-500',
      tileClass: 'bg-sky-500/10',
      label: ext ? ext.toUpperCase() : 'DOC',
    };
  }
  if (t.includes('sheet') || t.includes('excel') || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return {
      Icon: FileSpreadsheet,
      iconClass: 'text-emerald-600',
      tileClass: 'bg-emerald-500/10',
      label: ext ? ext.toUpperCase() : 'XLS',
    };
  }
  if (t.includes('zip') || t.includes('compressed') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      Icon: FileArchive,
      iconClass: 'text-amber-500',
      tileClass: 'bg-amber-500/10',
      label: ext ? ext.toUpperCase() : 'ZIP',
    };
  }
  if (t.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
    return {
      Icon: FileAudio,
      iconClass: 'text-violet-500',
      tileClass: 'bg-violet-500/10',
      label: ext ? ext.toUpperCase() : 'Audio',
    };
  }
  if (t.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return {
      Icon: FileVideo,
      iconClass: 'text-fuchsia-500',
      tileClass: 'bg-fuchsia-500/10',
      label: ext ? ext.toUpperCase() : 'Video',
    };
  }
  if (t.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)) {
    return {
      Icon: FileCode,
      iconClass: 'text-slate-500',
      tileClass: 'bg-slate-500/10',
      label: ext ? ext.toUpperCase() : 'Text',
    };
  }
  return {
    Icon: FileIcon,
    iconClass: 'text-[#4F6BFF]',
    tileClass: 'bg-[#4F6BFF]/10',
    label: ext ? ext.toUpperCase() : 'Datei',
  };
}

/** Prüft, ob ein Dateityp direkt im Browser vorschaubar ist (Bild / PDF / Text). */
export function isInlinePreviewable(mimeType: string, filename: string): boolean {
  const t = (mimeType || '').toLowerCase();
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return true;
  if (t === 'application/pdf' || ext === 'pdf') return true;
  if (t.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'csv'].includes(ext)) return true;
  return false;
}

/**
 * Kategorisiert den Dateityp für die Vorschau-Logik.
 * Fällt auf die Dateiendung zurück, falls der MIME-Type fehlt.
 */
export type PreviewKind = 'image' | 'pdf' | 'text' | 'office' | 'unsupported';

export function detectPreviewKind(mimeType: string, filename: string): PreviewKind {
  const t = (mimeType || '').toLowerCase();
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (t === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (t.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'csv'].includes(ext)) return 'text';
  if (
    t.includes('word') || t.includes('wordprocessing') ||
    t.includes('sheet') || t.includes('excel') ||
    t.includes('presentation') ||
    ['doc', 'docx', 'odt', 'rtf', 'xls', 'xlsx', 'ods', 'ppt', 'pptx', 'odp'].includes(ext)
  ) return 'office';
  return 'unsupported';
}

/**
 * Wandelt eine `data:`-URL in eine `blob:`-URL um.
 *
 * **Warum:** Moderne Browser (Chrome, Safari) blockieren `data:`-URLs in
 * `<iframe>`-Elementen aus Sicherheitsgründen — besonders bei PDFs führt das
 * dazu, dass die Vorschau gar nicht oder nur leer geladen wird.
 * `blob:`-URLs werden akzeptiert und rendern zuverlässig.
 *
 * Die Aufrufseite MUSS `URL.revokeObjectURL(result)` aufrufen, wenn die URL
 * nicht mehr benötigt wird, um Speicherlecks zu vermeiden.
 */
export function dataUrlToBlobUrl(dataUrl: string, fallbackMime?: string): string {
  // Bereits eine Blob-/HTTP-URL → unverändert zurückgeben
  if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http:') || dataUrl.startsWith('https:')) {
    return dataUrl;
  }

  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl;

  const header = dataUrl.substring(0, commaIdx);
  const data = dataUrl.substring(commaIdx + 1);
  const mimeMatch = header.match(/data:([^;]+)/i);
  const mime = mimeMatch?.[1] || fallbackMime || 'application/octet-stream';
  const isBase64 = header.includes(';base64');

  let bytes: Uint8Array;
  if (isBase64) {
    try {
      const binary = atob(data);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } catch {
      // Fallback: Daten ungültig → leerer Blob, damit die iframe wenigstens klar fehlschlägt
      bytes = new Uint8Array(0);
    }
  } else {
    try {
      const decoded = decodeURIComponent(data);
      bytes = new TextEncoder().encode(decoded);
    } catch {
      bytes = new TextEncoder().encode(data);
    }
  }

  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
}
