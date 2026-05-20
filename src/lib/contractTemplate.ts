/**
 * Mietvertrags-Template-Helfer.
 *
 * Generiert für jeden Mieter einen sinnvollen Standard-Vertrag (sofern noch
 * keiner existiert) und liefert die HTML-Vorlage für die Vertrags-Vorschau.
 * Die Vorlage ist bewusst simpel gehalten — kein 100% rechtssicherer
 * Standardmietvertrag, sondern eine Arbeitsgrundlage die der Vermieter
 * anpassen kann (analog zu den Vorlagen in /bh/schreiben).
 */
import type {
  RentalContract,
  Tenant,
  RentalUnit,
  RentalProperty,
} from '../types';
import type { LandlordSettings } from '../hooks/useLandlordSettings';

/**
 * Default-Vertragswerte aus einem Mieter ableiten:
 * - Kaltmiete = aktuelle Miete der Einheit (Fallback: 0)
 * - Nebenkosten = 20 % der Kaltmiete (geschätzt, anpassbar)
 * - Heizkosten = 10 % der Kaltmiete (geschätzt, anpassbar)
 * - Kaution = 3 Monatskaltmieten oder vorhandener Tenant-Kautionswert
 * - Vertragsbeginn = leaseStart oder moveInDate des Mieters
 * - Vertragstyp = leaseEnd vorhanden → 'befristet', sonst 'unbefristet'
 * - Kündigungsfrist = 3 Monate (gesetzlich für Mieter im unbefristeten Fall)
 * - Mietzahltag = 3. (üblich, weil §556b BGB den 3. Werktag vorgibt)
 */
export function buildDefaultContractFromTenant(
  tenant: Tenant,
  unit: RentalUnit | undefined,
): Omit<RentalContract, 'id' | 'createdAt'> {
  const baseRent = unit?.currentRent ?? unit?.targetRent ?? 0;
  const operatingCosts = Math.round(baseRent * 0.2 * 100) / 100;
  const heatingCosts = Math.round(baseRent * 0.1 * 100) / 100;
  const deposit = tenant.deposit > 0 ? tenant.deposit : Math.round(baseRent * 3 * 100) / 100;
  const startDate = tenant.leaseStart || tenant.moveInDate || new Date().toISOString().slice(0, 10);
  const isFixedTerm = !!tenant.leaseEnd;

  return {
    propertyId: tenant.propertyId,
    unitId: tenant.unitId || '',
    tenantId: tenant.id,
    rentAmount: baseRent,
    operatingCosts,
    heatingCosts,
    depositAmount: deposit,
    depositPaid: false,
    startDate,
    endDate: tenant.leaseEnd ?? null,
    contractType: isFixedTerm ? 'befristet' : 'unbefristet',
    noticePeriod: 3,
    rentPaymentDay: 3,
    notes: 'Automatisch erzeugter Standardvertrag — bitte vor Unterschrift prüfen und ggf. ergänzen.',
    // Lifecycle-Felder (status, signedAt, signedDocumentId) werden bewusst nicht gesetzt:
    // - Ohne angewendete Migration 0008 lehnt die DB die Spalten ab.
    // - Mit Migration: Postgres-Default 'draft' greift, was inhaltlich richtig ist.
    // Damit der TypeScript-Check trotz `Omit<…, 'id'|'createdAt'>` zufrieden ist,
    // bleibt der Rückgabe-Typ kompatibel mit der jetzt optionalen `status`-Property.
  };
}

const fmt = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtUnitMeta = (u?: RentalUnit) => {
  if (!u) return '—';
  const parts: string[] = [u.name];
  if (u.area) parts.push(`${u.area} m²`);
  if (u.rooms) parts.push(`${u.rooms} ${u.rooms === 1 ? 'Zimmer' : 'Zimmer'}`);
  return parts.join(' · ');
};

/**
 * Rendert den Vertrag als formatiertes HTML — wird im "Vertrag ansehen"-Modal
 * angezeigt und kann via window.print() in PDF gespeichert werden.
 */
export function renderContractHTML(opts: {
  contract: RentalContract;
  tenant: Tenant | undefined;
  unit: RentalUnit | undefined;
  property: RentalProperty | undefined;
  landlord: LandlordSettings;
}): string {
  const { contract, tenant, unit, property, landlord } = opts;

  const warmmiete = contract.rentAmount + contract.operatingCosts + contract.heatingCosts;
  const landlordLine =
    [landlord.contactName, landlord.companyName].filter(Boolean).join(', ') || '________________________';
  const landlordAddress = [
    landlord.street,
    [landlord.zip, landlord.city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ') || '________________________';
  const tenantName = tenant?.name || '________________________';
  const tenantContact = [tenant?.email, tenant?.phone].filter(Boolean).join(' · ') || '—';
  const propertyAddress = property?.address || '________________________';
  const unitLabel = fmtUnitMeta(unit);

  const isFixed = contract.contractType === 'befristet';

  return `
    <article class="mietvertrag-doc">
      <header class="mv-header">
        <h1>Wohnraummietvertrag</h1>
        <p class="mv-subtitle">Standardvertrag — automatisch befüllt aus den hinterlegten Mieter- und Objektdaten.</p>
      </header>

      <section class="mv-parties">
        <div class="mv-party">
          <h3>Vermieter</h3>
          <p><strong>${escapeHtml(landlordLine)}</strong></p>
          <p>${escapeHtml(landlordAddress)}</p>
          ${landlord.email ? `<p>${escapeHtml(landlord.email)}</p>` : ''}
          ${landlord.phone ? `<p>${escapeHtml(landlord.phone)}</p>` : ''}
        </div>
        <div class="mv-party">
          <h3>Mieter</h3>
          <p><strong>${escapeHtml(tenantName)}</strong></p>
          <p>${escapeHtml(tenantContact)}</p>
        </div>
      </section>

      <section class="mv-block">
        <h2>§ 1 Mietsache</h2>
        <p>
          Vermietet wird die Wohnung im Objekt
          <strong>${escapeHtml(property?.name || '—')}</strong>,
          ${escapeHtml(propertyAddress)},
          Einheit <strong>${escapeHtml(unitLabel)}</strong>.
        </p>
      </section>

      <section class="mv-block">
        <h2>§ 2 Mietzeit</h2>
        <p>Mietbeginn: <strong>${escapeHtml(fmtDate(contract.startDate))}</strong></p>
        <p>
          Vertragsart:
          <strong>${isFixed ? 'Befristet' : 'Unbefristet'}</strong>
          ${isFixed
            ? `bis <strong>${escapeHtml(fmtDate(contract.endDate))}</strong>`
            : `mit gesetzlicher Kündigungsfrist von <strong>${contract.noticePeriod} Monaten</strong> für den Mieter`}.
        </p>
      </section>

      <section class="mv-block">
        <h2>§ 3 Miete &amp; Nebenkosten</h2>
        <table class="mv-table">
          <tbody>
            <tr><th>Kaltmiete</th><td class="num">${fmt(contract.rentAmount)} €</td></tr>
            <tr><th>Betriebskostenvorauszahlung</th><td class="num">${fmt(contract.operatingCosts)} €</td></tr>
            <tr><th>Heizkostenvorauszahlung</th><td class="num">${fmt(contract.heatingCosts)} €</td></tr>
            <tr class="mv-total"><th>Warmmiete (monatlich)</th><td class="num">${fmt(warmmiete)} €</td></tr>
          </tbody>
        </table>
        <p class="mv-fineprint">
          Die Miete ist monatlich im Voraus, spätestens am <strong>${contract.rentPaymentDay}. Werktag</strong>
          eines Monats, auf das nachfolgend angegebene Konto des Vermieters zu zahlen.
        </p>
        ${landlord.iban
          ? `<p class="mv-fineprint">
              Bankverbindung: ${escapeHtml(landlord.bankName || '—')} ·
              IBAN <strong>${escapeHtml(landlord.iban)}</strong>${landlord.bic ? ` · BIC ${escapeHtml(landlord.bic)}` : ''}.
            </p>`
          : '<p class="mv-fineprint mv-warn">Bankverbindung in den Vermieter-Einstellungen ergänzen.</p>'}
      </section>

      <section class="mv-block">
        <h2>§ 4 Kaution</h2>
        <p>
          Die Kaution beträgt <strong>${fmt(contract.depositAmount)} €</strong>
          (max. drei Nettokaltmieten gem. § 551 BGB).
          Sie ist
          ${contract.depositPaid
            ? `bereits am <strong>${escapeHtml(fmtDate(contract.depositPaidDate || contract.startDate))}</strong> entrichtet.`
            : 'spätestens mit der ersten Mietzahlung in voller Höhe oder in drei gleichen Monatsraten zu leisten.'}
        </p>
      </section>

      <section class="mv-block">
        <h2>§ 5 Übergabe &amp; Schlüssel</h2>
        <p>
          Die Übergabe erfolgt am Tag des Mietbeginns gegen schriftliches Übergabeprotokoll.
          Schlüssel werden vollständig und in funktionsfähigem Zustand ausgehändigt; bei Auszug
          sind sie ebenso zurückzugeben.
        </p>
      </section>

      <section class="mv-block">
        <h2>§ 6 Sonstige Vereinbarungen</h2>
        <p>${escapeHtml(contract.notes || '—')}</p>
      </section>

      <section class="mv-signatures">
        <div class="mv-sig">
          <div class="mv-sig-line"></div>
          <p>Vermieter · ${escapeHtml(landlord.signatureName || landlord.contactName || '')}</p>
          <p class="mv-sig-meta">Ort, Datum</p>
        </div>
        <div class="mv-sig">
          <div class="mv-sig-line"></div>
          <p>Mieter · ${escapeHtml(tenantName)}</p>
          <p class="mv-sig-meta">Ort, Datum</p>
        </div>
      </section>

      <footer class="mv-footer">
        <p>
          Hinweis: Dieser Vertrag ist eine automatisch generierte Vorlage zur internen Verwendung.
          Vor Unterschrift juristische Prüfung empfohlen — insbesondere bei Schönheitsreparaturen,
          Kleinreparaturklauseln und Mieterhöhungen.
        </p>
      </footer>
    </article>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
