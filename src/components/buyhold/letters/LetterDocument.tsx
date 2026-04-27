import { forwardRef } from 'react';
import type { ReactNode } from 'react';

// ===================================================================
// LetterDocument — professionelles DIN-A4-Brief-Layout
// -------------------------------------------------------------------
// Umsetzung nach DIN 676 Form B (Geschäftsbrief) und DIN 5008:
//   • A4 = 210 × 297 mm  →  bei 96 dpi: 794 × 1123 px
//   • Falzmarken („Faltmarken"): linke Kante
//       – 1. Falzmarke bei 105 mm vom Oberkante (Briefober-Drittel)
//       – 2. Falzmarke bei 210 mm vom Oberkante (Zwei-Drittel)
//   • Lochmarke (Heftzeichen): linke Kante, Mitte, 148,5 mm
//   • Anschriftenfeld (Fensterumschlag-kompatibel):
//       – Position: 20 mm von links, 45 mm von oben
//       – Größe: 85 mm breit, 45 mm hoch
//   • Bezugszeichenzeile ab 97 mm von oben
//   • Betreff- und Fließtextbereich beginnt ab 108 mm
//   • Fußzeile im unteren Bereich (Bank/Steuer/Seitenzahl)
// -------------------------------------------------------------------
// Wichtige Design-Entscheidung:
//   Der Inhaltsblock benutzt padding-top (nicht position: absolute),
//   damit längere Dokumente (Mietvertrag, NK-Abrechnung) mehr-seitig
//   wachsen können. Falzmarken/Anschriftenfeld/Briefkopf bleiben auf
//   der ersten Seite fixiert.
// ===================================================================

// mm → px Konvertierung (794 px / 210 mm = 3.7809)
export const MM = (mm: number) => Math.round(mm * 3.7809 * 100) / 100;

export interface LetterSender {
  name: string;
  street?: string;
  cityLine?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export interface LetterRecipient {
  name: string;
  addon?: string;
  street?: string;
  cityLine?: string;
  country?: string;
}

export interface LetterReference {
  ihrZeichen?: string;
  ihreNachrichtVom?: string;
  unserZeichen?: string;
  unsereNachrichtVom?: string;
  sachbearbeiter?: string;
  telefon?: string;
  datum?: string;
}

export interface LetterFooterBank {
  kontoinhaber?: string;
  iban?: string;
  bic?: string;
  bank?: string;
}

export interface LetterFooterTax {
  steuerNr?: string;
  ustId?: string;
  handelsregister?: string;
}

export interface LetterDocumentProps {
  sender: LetterSender;
  recipient: LetterRecipient;
  reference?: LetterReference;
  subject: string;
  /** Anrede – bei '' komplett unterdrückt, sonst Auto-Generat */
  salutation?: string;
  children: ReactNode;
  closing?: string;
  signatureName?: string;
  signatureRole?: string;
  secondSignatureName?: string;
  secondSignatureRole?: string;
  footerBank?: LetterFooterBank;
  footerTax?: LetterFooterTax;
  /** Akzent-Farbe (Briefkopf-Linie, Betreff, Signatur-Linien) */
  accentColor?: string;
  /** Akzent-Farbe Zweit-Ton (für Gradienten, z. B. Mahnstufen) */
  accentColor2?: string;
  logoUrl?: string;
  documentBadge?: { label: string; color?: string };
  attachments?: string[];
  /** bei true: Grußformel + Unterschrift werden NICHT ausgegeben
   *  (für Dokumente wie Mietvertrag/Übergabeprotokoll, die ihre eigene Unterschriften-Sektion haben) */
  hideClosing?: boolean;
  /** bei true: Anrede wird NICHT ausgegeben (für formale Dokumente wie Mietvertrag) */
  hideSalutation?: boolean;
  /** bei true: fester Titel statt Betreff, zentriert dargestellt */
  titleMode?: 'subject' | 'document-title';
  /** Zusatz-Untertitel unter dem Titel (nur im titleMode: document-title) */
  titleSubtitle?: string;
  /** Footer anzeigen? Default: true (erst auf der letzten Seite sichtbar via Sticky-Trick nicht möglich → immer unten) */
  showFooter?: boolean;
}

// ---------------------------------------------------------------
// Komponente
// ---------------------------------------------------------------

export const LetterDocument = forwardRef<HTMLDivElement, LetterDocumentProps>(function LetterDocument(
  {
    sender,
    recipient,
    reference,
    subject,
    salutation,
    children,
    closing = 'Mit freundlichen Grüßen',
    signatureName,
    signatureRole,
    secondSignatureName,
    secondSignatureRole,
    footerBank,
    footerTax,
    accentColor = '#1a1a2e',
    accentColor2,
    logoUrl,
    documentBadge,
    attachments,
    hideClosing = false,
    hideSalutation = false,
    titleMode = 'subject',
    titleSubtitle,
    showFooter = true,
  },
  ref
) {
  const senderReturnLine = [sender.name, sender.street, sender.cityLine].filter(Boolean).join(' · ');
  const headBarBg = accentColor2
    ? `linear-gradient(90deg, ${accentColor}, ${accentColor2})`
    : accentColor;

  return (
    <div
      ref={ref}
      className="letter-document"
      style={{
        width: '794px',
        minHeight: '1123px',
        background: '#ffffff',
        color: '#111111',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        fontSize: '10.5pt',
        lineHeight: 1.45,
        position: 'relative',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #fdfdfe 100%)',
        paddingBottom: showFooter ? `${MM(28)}px` : `${MM(12)}px`,
      }}
    >
      {/* ============ DIN 676 Falzmarken + Lochmarke (linker Rand) ============ */}
      <FoldMark topPx={MM(105)} />
      <PunchMark topPx={MM(148.5)} />
      <FoldMark topPx={MM(210)} />

      {/* ============ Akzent-Linie ganz oben ============ */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '3px',
        background: headBarBg,
      }} aria-hidden="true" />

      {/* ============ Briefkopf (Absender) – oben rechts ============ */}
      <div style={{
        position: 'absolute',
        top: `${MM(16)}px`,
        right: `${MM(20)}px`,
        textAlign: 'right',
        maxWidth: `${MM(90)}px`,
      }}>
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            style={{ maxHeight: '48px', maxWidth: '160px', marginBottom: '6px', objectFit: 'contain' }}
            crossOrigin="anonymous"
          />
        )}
        <div style={{ fontSize: '12pt', fontWeight: 700, color: '#0f172a', letterSpacing: '0.2px' }}>
          {sender.name}
        </div>
        {sender.street && (
          <div style={{ fontSize: '8.5pt', color: '#4b5563', marginTop: '2px' }}>{sender.street}</div>
        )}
        {sender.cityLine && (
          <div style={{ fontSize: '8.5pt', color: '#4b5563' }}>{sender.cityLine}</div>
        )}
        {(sender.phone || sender.email || sender.website) && (
          <div style={{ fontSize: '8pt', color: '#6b7280', marginTop: '4px', lineHeight: 1.4 }}>
            {sender.phone && <div>Tel.: {sender.phone}</div>}
            {sender.email && <div>{sender.email}</div>}
            {sender.website && <div>{sender.website}</div>}
          </div>
        )}
      </div>

      {/* ============ Anschriftenfeld (Fensterumschlag-kompatibel) ============ */}
      <div style={{
        position: 'absolute',
        left: `${MM(20)}px`,
        top: `${MM(45)}px`,
        width: `${MM(85)}px`,
        minHeight: `${MM(45)}px`,
      }}>
        <div style={{
          fontSize: '7pt',
          color: '#6b7280',
          paddingBottom: '2px',
          borderBottom: '0.5px solid #d1d5db',
          marginBottom: '6px',
          lineHeight: 1.3,
          letterSpacing: '0.1px',
        }}>
          {senderReturnLine}
        </div>
        <div style={{ fontSize: '11pt', lineHeight: 1.4, color: '#111111' }}>
          <div style={{ fontWeight: 600 }}>{recipient.name}</div>
          {recipient.addon && <div>{recipient.addon}</div>}
          {recipient.street && <div>{recipient.street}</div>}
          {recipient.cityLine && <div style={{ marginTop: '2px' }}>{recipient.cityLine}</div>}
          {recipient.country && (
            <div style={{ textTransform: 'uppercase', fontWeight: 600, marginTop: '4px', fontSize: '10pt' }}>
              {recipient.country}
            </div>
          )}
        </div>
      </div>

      {/* ============ Bezugszeichenzeile (ab 97 mm) ============ */}
      {reference && (
        <div style={{
          position: 'absolute',
          left: `${MM(20)}px`,
          right: `${MM(20)}px`,
          top: `${MM(97)}px`,
          fontSize: '7.5pt',
          color: '#6b7280',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
        }}>
          <RefCell label="Ihr Zeichen" value={reference.ihrZeichen} />
          <RefCell label="Unser Zeichen" value={reference.unserZeichen} />
          <RefCell
            label={reference.sachbearbeiter ? 'Ansprechpartner' : 'Telefon'}
            value={reference.sachbearbeiter || reference.telefon}
          />
          <RefCell label="Datum" value={reference.datum} align="right" />
        </div>
      )}

      {/* ============ Hauptinhalt (ab 108 mm, flow-layout) ============ */}
      <div style={{
        paddingTop: `${MM(108)}px`,
        paddingLeft: `${MM(20)}px`,
        paddingRight: `${MM(20)}px`,
        position: 'relative',
      }}>
        {/* Betreff/Titel */}
        {titleMode === 'document-title' ? (
          <div style={{ textAlign: 'center', marginBottom: '18px' }}>
            <div style={{
              fontSize: '20pt',
              fontWeight: 700,
              color: accentColor,
              letterSpacing: '0.3px',
            }}>
              {subject}
            </div>
            {titleSubtitle && (
              <div style={{ fontSize: '9.5pt', color: '#6b7280', marginTop: '4px' }}>
                {titleSubtitle}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            fontSize: '12pt',
            fontWeight: 700,
            color: accentColor,
            marginBottom: '4px',
            letterSpacing: '0.1px',
          }}>
            {subject}
          </div>
        )}

        {documentBadge && (
          <div style={{
            display: 'inline-block',
            fontSize: '7.5pt',
            fontWeight: 700,
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            color: '#ffffff',
            background: documentBadge.color || accentColor,
            padding: '3px 8px',
            borderRadius: '3px',
            marginBottom: '14px',
          }}>
            {documentBadge.label}
          </div>
        )}

        {!documentBadge && titleMode === 'subject' && <div style={{ height: '10px' }} />}

        {/* Anrede */}
        {!hideSalutation && salutation !== '' && (
          <div style={{ fontSize: '10.5pt', marginBottom: '10px', color: '#111111' }}>
            {salutation || defaultSalutation(recipient.name)}
          </div>
        )}

        {/* Body */}
        <div style={{ fontSize: '10.5pt', lineHeight: 1.55, color: '#111111' }}>
          {children}
        </div>

        {/* Grußformel + Unterschrift */}
        {!hideClosing && (
          <>
            {closing && (
              <div style={{ marginTop: '22px', fontSize: '10.5pt' }}>
                {closing}
              </div>
            )}
            <div style={{
              marginTop: '42px',
              display: 'grid',
              gridTemplateColumns: secondSignatureName ? '1fr 1fr' : '1fr',
              gap: '32px',
              maxWidth: secondSignatureName ? '100%' : '60%',
            }}>
              <SignatureBlock
                name={signatureName || sender.name}
                role={signatureRole}
                accentColor={accentColor}
              />
              {secondSignatureName && (
                <SignatureBlock
                  name={secondSignatureName}
                  role={secondSignatureRole}
                  accentColor={accentColor}
                />
              )}
            </div>
          </>
        )}

        {/* Anlagen */}
        {attachments && attachments.length > 0 && (
          <div style={{ marginTop: '18px', fontSize: '9pt', color: '#4b5563' }}>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>
              Anlage{attachments.length > 1 ? 'n' : ''}:
            </div>
            <ul style={{ margin: 0, paddingLeft: '16px' }}>
              {attachments.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* ============ Fußzeile ============ */}
      {showFooter && (footerBank || footerTax) && (
        <div style={{
          position: 'absolute',
          left: `${MM(20)}px`,
          right: `${MM(20)}px`,
          bottom: `${MM(8)}px`,
          borderTop: `1px solid ${accentColor}`,
          paddingTop: '6px',
          fontSize: '7pt',
          color: '#6b7280',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '14px',
          lineHeight: 1.45,
        }}>
          <div>
            <FooterTitle>Kontakt</FooterTitle>
            <div>{sender.name}</div>
            {sender.street && <div>{sender.street}</div>}
            {sender.cityLine && <div>{sender.cityLine}</div>}
            {sender.phone && <div>Tel.: {sender.phone}</div>}
            {sender.email && <div>{sender.email}</div>}
          </div>
          <div>
            <FooterTitle>Bankverbindung</FooterTitle>
            {footerBank?.kontoinhaber && <div>{footerBank.kontoinhaber}</div>}
            {footerBank?.iban && <div style={{ fontVariantNumeric: 'tabular-nums' }}>{footerBank.iban}</div>}
            {footerBank?.bic && <div>BIC: {footerBank.bic}</div>}
            {footerBank?.bank && <div>{footerBank.bank}</div>}
            {!footerBank && <div style={{ color: '#9ca3af' }}>—</div>}
          </div>
          <div>
            <FooterTitle>Rechtliches</FooterTitle>
            {footerTax?.steuerNr && <div>St-Nr.: {footerTax.steuerNr}</div>}
            {footerTax?.ustId && <div>USt-ID: {footerTax.ustId}</div>}
            {footerTax?.handelsregister && <div>{footerTax.handelsregister}</div>}
            {!footerTax && <div style={{ color: '#9ca3af' }}>—</div>}
          </div>
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------
// Helferkomponenten
// ---------------------------------------------------------------

function FoldMark({ topPx }: { topPx: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        top: `${topPx}px`,
        width: '10px',
        height: '1px',
        background: '#9ca3af',
      }}
    />
  );
}

function PunchMark({ topPx }: { topPx: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        top: `${topPx}px`,
        width: '18px',
        height: '1px',
        background: '#9ca3af',
      }}
    />
  );
}

function RefCell({ label, value, align = 'left' }: { label: string; value?: string; align?: 'left' | 'right' }) {
  return (
    <div style={{ textAlign: align }}>
      <div style={{
        fontSize: '6.5pt',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        color: '#9ca3af',
        fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{ fontSize: '9.5pt', color: '#111111', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
        {value || '—'}
      </div>
    </div>
  );
}

function SignatureBlock({ name, role, accentColor }: { name: string; role?: string; accentColor: string }) {
  return (
    <div>
      <div style={{
        height: '34px',
        borderBottom: `1px solid ${accentColor}`,
        marginBottom: '4px',
      }} />
      <div style={{ fontSize: '10pt', fontWeight: 600, color: '#111111' }}>{name}</div>
      {role && <div style={{ fontSize: '8.5pt', color: '#6b7280' }}>{role}</div>}
    </div>
  );
}

function FooterTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: '6.5pt',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      fontWeight: 700,
      color: '#9ca3af',
      marginBottom: '2px',
    }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------
// Anrede-Generator
// ---------------------------------------------------------------
export function defaultSalutation(recipientName: string): string {
  const n = (recipientName || '').trim();
  if (!n) return 'Sehr geehrte Damen und Herren,';
  return `Sehr geehrte/r ${n},`;
}

// ---------------------------------------------------------------
// Section-Helfer für juristische Dokumente (Mietvertrag)
// ---------------------------------------------------------------
export function LetterSection({
  title,
  children,
  accentColor = '#1a1a2e',
}: {
  title: string;
  children: ReactNode;
  accentColor?: string;
}) {
  return (
    <div style={{ marginBottom: '14px', pageBreakInside: 'avoid' }}>
      <div style={{
        fontSize: '10pt',
        fontWeight: 700,
        color: accentColor,
        marginBottom: '3px',
        letterSpacing: '0.1px',
      }}>
        {title}
      </div>
      <div style={{ fontSize: '10pt', lineHeight: 1.55, color: '#1f2937', textAlign: 'justify', hyphens: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
