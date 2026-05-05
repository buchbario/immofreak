import { useEffect, useRef } from 'react';
import { Printer, FileText, Download } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { renderContractHTML } from '../../lib/contractTemplate';
import { useLandlordSettings } from '../../hooks/useLandlordSettings';
import type { RentalContract, Tenant, RentalUnit, RentalProperty } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  contract: RentalContract;
  tenant: Tenant | undefined;
  unit: RentalUnit | undefined;
  property: RentalProperty | undefined;
}

/**
 * Vertrags-Vorschau-Modal. Rendert den Mietvertrag als formatiertes HTML
 * (siehe `lib/contractTemplate.ts`) und bietet:
 *  - Print → öffnet das Browser-Druckfenster, dort kann „PDF speichern" gewählt werden
 *  - Download → speichert die Vorschau als eigenständige .html-Datei
 *
 * Bewusst kein PDF-Generator wie jsPDF — die Browser-Print-Funktion liefert
 * für Mietverträge brauchbarere Ergebnisse (Mehrseiten-Umbruch, korrekte Schriften)
 * und vermeidet eine zusätzliche schwergewichtige Dependency.
 */
export function ContractPreviewModal({ open, onClose, contract, tenant, unit, property }: Props) {
  const { settings } = useLandlordSettings();
  const previewRef = useRef<HTMLDivElement>(null);

  const html = renderContractHTML({ contract, tenant, unit, property, landlord: settings });

  useEffect(() => {
    // Sicherstellen, dass der Modal-Body bei Vertrags-Wechsel auch wieder oben startet
    if (open && previewRef.current) previewRef.current.scrollTop = 0;
  }, [open, contract.id]);

  const handlePrint = () => {
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
    if (!win) {
      alert('Bitte Pop-up-Blocker für diese Seite deaktivieren, um den Vertrag zu drucken.');
      return;
    }
    win.document.write(buildStandalonePage(html, `Mietvertrag — ${tenant?.name ?? ''}`));
    win.document.close();
    win.focus();
    // Kleiner Delay, damit die Schriften geladen sind bevor das Druck-Dialog erscheint
    setTimeout(() => win.print(), 300);
  };

  const handleDownload = () => {
    const blob = new Blob(
      [buildStandalonePage(html, `Mietvertrag — ${tenant?.name ?? ''}`)],
      { type: 'text/html;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mietvertrag-${(tenant?.name || 'Mieter').replace(/\s+/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="inline-flex items-center gap-2.5">
          <span className="size-8 rounded-lg bg-[#4F6BFF]/12 inline-flex items-center justify-center">
            <FileText size={16} className="text-[#4F6BFF]" />
          </span>
          <span>Mietvertrag — {tenant?.name || 'Mieter'}</span>
        </span>
      }
      description="Automatisch befüllter Standardvertrag. Drucken oder als HTML speichern."
      footer={
        <>
          <button onClick={handleDownload} className="btn btn-md btn-secondary">
            <Download size={14} /> HTML speichern
          </button>
          <button onClick={handlePrint} className="btn btn-md btn-primary">
            <Printer size={14} /> Drucken / PDF
          </button>
        </>
      }
    >
      <div ref={previewRef} className="contract-preview" dangerouslySetInnerHTML={{ __html: html }} />
    </Modal>
  );
}

function buildStandalonePage(bodyHtml: string, title: string): string {
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtmlAttr(title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${PRINT_STYLES}</style>
  </head>
  <body class="contract-preview-page">
    ${bodyHtml}
  </body>
</html>`;
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Druck-Stylesheet. Identisch zu den Stilen in `index.css` für `.contract-preview`,
 * aber als Standalone-Stylesheet eingebettet, damit das Druckfenster ohne
 * weitere Asset-Loads korrekt rendert.
 */
const PRINT_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: #0f172a; background: #fff; margin: 0; }
  .contract-preview-page { padding: 32px 48px; max-width: 800px; margin: 0 auto; }
  .mietvertrag-doc { font-size: 13px; line-height: 1.55; color: #0f172a; }
  .mietvertrag-doc .mv-header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0f172a; }
  .mietvertrag-doc .mv-header h1 { font-size: 24px; margin: 0 0 6px; letter-spacing: -0.02em; }
  .mietvertrag-doc .mv-subtitle { color: #64748b; margin: 0; font-size: 12px; }
  .mietvertrag-doc .mv-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .mietvertrag-doc .mv-party h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin: 0 0 6px; font-weight: 600; }
  .mietvertrag-doc .mv-party p { margin: 0 0 2px; font-size: 13px; }
  .mietvertrag-doc .mv-block { margin-bottom: 18px; }
  .mietvertrag-doc .mv-block h2 { font-size: 14px; font-weight: 600; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
  .mietvertrag-doc .mv-block p { margin: 0 0 6px; }
  .mietvertrag-doc .mv-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  .mietvertrag-doc .mv-table th, .mietvertrag-doc .mv-table td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #f1f5f9; font-weight: normal; font-size: 13px; }
  .mietvertrag-doc .mv-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .mietvertrag-doc .mv-table tr.mv-total th, .mietvertrag-doc .mv-table tr.mv-total td { font-weight: 700; border-top: 2px solid #0f172a; border-bottom: none; padding-top: 8px; }
  .mietvertrag-doc .mv-fineprint { font-size: 11px; color: #64748b; margin: 4px 0 0; }
  .mietvertrag-doc .mv-warn { color: #b91c1c; }
  .mietvertrag-doc .mv-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 48px; }
  .mietvertrag-doc .mv-sig p { margin: 4px 0 0; font-size: 12px; }
  .mietvertrag-doc .mv-sig-line { height: 1px; background: #0f172a; margin-bottom: 6px; }
  .mietvertrag-doc .mv-sig-meta { color: #64748b; font-size: 10.5px; margin-top: 2px !important; }
  .mietvertrag-doc .mv-footer { margin-top: 32px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 10.5px; color: #94a3b8; }
  @media print {
    body { padding: 0; }
    .contract-preview-page { padding: 0; max-width: none; }
    .mv-block { page-break-inside: avoid; }
    .mv-signatures { page-break-before: avoid; }
  }
`;
