import { forwardRef, type ReactNode } from 'react';
import type { LandlordSettings } from '../../../hooks/useLandlordSettings';

/**
 * Einheitliches Brief-Layout für ALLE Anschreiben (NK-Begleitbrief, Mahnung,
 * Mieterhöhung, Kündigung, Vorauszahlungs-Anpassung, etc.).
 *
 * Layout entspricht dem Beispiel-Anschreiben aus dem Praktiker-Feedback
 * (siehe „Anschreiben Abrechnung Beispiel YAN.pdf"):
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ <Sender-Adresszeile, klein, unterstrichen>          │
 *   │                                                      │
 *   │ <Empfänger-Adresse links>                            │
 *   │                                                      │
 *   │                                <Datum, rechts>      │
 *   │                                <Sachbearbeiter>     │
 *   │                                                      │
 *   │ <Betreff-Block, fett, mehrzeilig>                   │
 *   │                                                      │
 *   │ <Anrede>,                                            │
 *   │                                                      │
 *   │ <Body — vom Konsumenten als children>                │
 *   │                                                      │
 *   │ Mit freundlichen Grüßen                              │
 *   │                                                      │
 *   │ <Signatur-Name>                                      │
 *   │                                                      │
 *   │ Anlagen                                              │
 *   │                                                      │
 *   │ ──────────────────────────────────────────────────  │
 *   │ <Geschäftsführer> | <HR>      | <USt-ID>            │
 *   └──────────────────────────────────────────────────────┘
 *
 * Children = Body-Inhalt zwischen Anrede und Grußformel.
 */

export interface BriefRecipient {
  /** Erste Zeile (Empfängername bzw. Firma) */
  name: string;
  /** Zusatz-Zeile (z. B. „c/o Hausverwaltung") */
  addon?: string;
  /** Straße + Hausnummer */
  street?: string;
  /** PLZ + Stadt */
  cityLine?: string;
}

export interface BriefSubject {
  /** Eine oder mehrere Zeilen — z. B. ["Objekt Marie", "Frankfurt", "Mieterhöhung 01.07.2025"] */
  lines: string[];
}

export interface BriefLayoutProps {
  landlord: LandlordSettings;
  recipient: BriefRecipient;
  subject: BriefSubject | string;
  /** ISO-Datum (yyyy-mm-dd) — wird im Brief als „17.09.2025" gerendert. Default: heute. */
  letterDate?: string;
  /** Optional: Sachbearbeiter-Name oben rechts (Default = landlord.contactName) */
  sachbearbeiter?: string;
  /** Anrede inkl. Komma am Ende — z. B. „Sehr geehrter Herr Mustermann," */
  salutation: string;
  /** Body-Inhalt zwischen Anrede und Grußformel */
  children: ReactNode;
  /** Grußformel — Default „Mit freundlichen Grüßen" */
  closing?: string;
  /** Unterschriftsname — Default landlord.signatureName || landlord.contactName */
  signatureName?: string;
  /** Anlagen-Liste (rendert als Bullet-Points). Leer lassen für „Anlagen" ohne Liste. */
  attachments?: string[];
  /** Bei false wird „Anlagen" weggelassen */
  showAttachments?: boolean;
}

const fmtDate = (iso?: string) => {
  if (!iso) return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const BriefLayout = forwardRef<HTMLDivElement, BriefLayoutProps>(function BriefLayout(
  {
    landlord,
    recipient,
    subject,
    letterDate,
    sachbearbeiter,
    salutation,
    children,
    closing = 'Mit freundlichen Grüßen',
    signatureName,
    attachments,
    showAttachments = true,
  },
  ref,
) {
  const senderLine = [landlord.companyName, landlord.contactName].filter(Boolean).join(' · ');
  const senderAddress = [
    landlord.street,
    [landlord.zip, landlord.city].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');
  const senderUnderlineLine = [senderLine, senderAddress].filter(Boolean).join(', ');

  const subjectLines = typeof subject === 'string' ? [subject] : subject.lines;
  const sigName = signatureName || landlord.signatureName || landlord.contactName || '';
  const sachbName = sachbearbeiter ?? landlord.contactName ?? '';

  return (
    <div
      ref={ref}
      className="brief-layout"
      style={{
        width: '794px',
        minHeight: '1123px',
        background: '#ffffff',
        color: '#0f172a',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        padding: '50px 60px 60px',
        boxShadow: '0 4px 24px rgba(15,23,42,0.10)',
        position: 'relative',
        fontSize: '11px',
        lineHeight: 1.5,
      }}
    >
      {/* Sender-Adresszeile (klein, oben — wie ins Brieffenster eingeklebt) */}
      {senderUnderlineLine && (
        <div style={{
          fontSize: '8.5px',
          color: '#64748b',
          textDecoration: 'underline',
          marginBottom: '20px',
        }}>
          {senderUnderlineLine}
        </div>
      )}

      {/* Empfänger-Block links */}
      <div style={{ marginBottom: '40px', fontSize: '11px', lineHeight: 1.4 }}>
        <p style={{ margin: 0 }}>{recipient.name}</p>
        {recipient.addon && <p style={{ margin: '2px 0 0' }}>{recipient.addon}</p>}
        {recipient.street && <p style={{ margin: '2px 0 0' }}>{recipient.street}</p>}
        {recipient.cityLine && <p style={{ margin: '2px 0 0' }}>{recipient.cityLine}</p>}
      </div>

      {/* Datum + Sachbearbeiter rechts */}
      <div style={{ textAlign: 'right', fontSize: '11px', marginBottom: '32px' }}>
        <p style={{ margin: 0 }}>{fmtDate(letterDate)}</p>
        {sachbName && <p style={{ margin: '2px 0 0' }}>{sachbName}</p>}
      </div>

      {/* Betreff (fett, mehrzeilig) */}
      <div style={{ marginBottom: '20px', fontSize: '11px', fontWeight: 700 }}>
        {subjectLines.filter(Boolean).map((line, i) => (
          <p key={i} style={{ margin: 0 }}>{line}</p>
        ))}
      </div>

      {/* Anrede */}
      <p style={{ marginBottom: '14px', fontSize: '11px' }}>{salutation}</p>

      {/* Body */}
      <div style={{ fontSize: '11px', lineHeight: 1.55 }}>
        {children}
      </div>

      {/* Grußformel + Unterschrift */}
      <div style={{ marginTop: '40px' }}>
        <p style={{ margin: 0, fontSize: '11px' }}>{closing}</p>
        <div style={{ height: '40px' }} />
        {sigName && <p style={{ margin: 0, fontSize: '11px' }}>{sigName}</p>}
      </div>

      {/* Anlagen */}
      {showAttachments && (
        <div style={{ marginTop: '40px', fontSize: '11px' }}>
          <p style={{ margin: 0 }}>Anlagen</p>
          {attachments && attachments.length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '10.5px' }}>
              {attachments.map((a, i) => (
                <li key={i} style={{ margin: 0 }}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Footer: Geschäftsführer | HR | USt-ID — nur sichtbar wenn Daten vorliegen */}
      <BriefFooter landlord={landlord} />
    </div>
  );
});

function BriefFooter({ landlord }: { landlord: LandlordSettings }) {
  const left = landlord.contactName ? `Geschäftsführer: ${landlord.contactName}` : '';
  const middle = ''; // Reserviert für Handelsregister — gibt's noch nicht im Schema
  const right = landlord.taxId ? `USt-ID Nr.: ${landlord.taxId}` : '';

  if (!left && !middle && !right) return null;

  return (
    <div style={{
      position: 'absolute',
      left: '60px',
      right: '60px',
      bottom: '30px',
      fontSize: '8.5px',
      color: '#94a3b8',
      display: 'flex',
      justifyContent: 'space-between',
      gap: '12px',
      borderTop: '1px solid #e2e8f0',
      paddingTop: '8px',
    }}>
      <span>{left}</span>
      <span>{middle}</span>
      <span>{right}</span>
    </div>
  );
}
