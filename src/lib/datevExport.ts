// ============================================================
// DATEV-Export: Buchhaltungs-Export im DATEV-kompatiblen Format
// ------------------------------------------------------------
// Erzeugt CSV-Dateien, die vom Steuerberater via DATEV Unternehmen
// Online, DATEV Kanzlei-Rechnungswesen oder anderen Buchhaltungen
// (Lexware, Buchhaltungsbutler, sevdesk) importiert werden können.
//
// Basiert auf dem offiziellen DATEV-Format „Buchungsstapel" (EXTF 700)
// mit SKR03-Kontenrahmen (Standard für private Vermietung V+V).
//
// Wichtige Hinweise für rechtliche Sicherheit:
// - § 147 AO: Aufbewahrung 10 Jahre, GoBD-konform
// - Datum im Format TTMMJJJJ (DATEV-Anforderung)
// - Beträge mit Komma als Dezimaltrenner, keine Tausenderpunkte
// - UTF-8 mit BOM (Excel-kompatibel)
// - Semikolon als Trennzeichen
// - Umsatz IMMER positiv, Richtung über Soll-/Haben-Kennzeichen
// ============================================================

import type { TenantPayment, Expense, RentalProperty, Tenant, RentalUnit } from '../types';

// ============================================================
// SKR03-Konten für Vermietung & Verpachtung (private Vermieter)
// Quelle: DATEV SKR03 Standardkontenrahmen
// ============================================================
export const SKR03 = {
  // Erlöskonten (Haben bei Mieteingang)
  ERLOES_MIETE_UMSATZSTEUERFREI: '8110', // Wohnraumvermietung § 4 Nr. 12a UStG
  ERLOES_NEBENKOSTEN_UMLAGEN: '8120', // Nebenkosten-Vorauszahlungen
  ERLOES_NEBENKOSTEN_NACHZAHLUNG: '8130', // NK-Nachzahlung / Abrechnung
  ERLOES_KAUTION: '1780', // Erhaltene Anzahlungen / Kaution (Verbindlichkeit!)

  // Aufwandskonten (Soll bei Ausgabe)
  AUFWAND_GRUNDSTEUER: '4510', // Grundsteuer, Abwasser etc.
  AUFWAND_VERSICHERUNG: '4360', // Versicherungsbeiträge (Gebäude, Haftpflicht)
  AUFWAND_VERWALTUNG: '4100', // Verwaltungskosten / Hausverwaltung
  AUFWAND_INSTANDHALTUNG: '4210', // Instandhaltung Gebäude
  AUFWAND_HAUSGELD: '4220', // Hausgeld WEG (anteilig)
  AUFWAND_SONSTIGES: '4980', // Sonstige betriebliche Aufwendungen
  AUFWAND_HEIZUNG: '4240', // Heizkosten
  AUFWAND_WASSER: '4250', // Wasserkosten
  AUFWAND_STROM: '4230', // Strom Allgemein

  // Geldkonten (Sachkonten)
  BANK: '1200', // Bank
  KASSE: '1000', // Kasse
} as const;

// ============================================================
// DATEV-Formatierung
// ============================================================

/** Datum von ISO "YYYY-MM-DD" nach DATEV "TTMM" (Belegdatum innerhalb WJ) */
function toDatevDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}${mm}`;
}

/** Datum von ISO "YYYY-MM-DD" nach DATEV-Header-Format "JJJJMMTT" */
function toDatevDateFull(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${yyyy}${mm}${dd}`;
}

/** Betrag DATEV-konform: Komma-Dezimaltrenner, 2 Nachkomma, immer positiv */
function toDatevAmount(amount: number): string {
  return Math.abs(amount).toFixed(2).replace('.', ',');
}

/** Text DATEV-konform: max. 60 Zeichen, keine Semikolons, Umlaute erlaubt */
function sanitizeText(text: string, maxLen = 60): string {
  return text.replace(/[;"\r\n]/g, ' ').substring(0, maxLen).trim();
}

/** CSV-Zelle korrekt quoten (Semikolons escapen) */
function csvCell(value: string | number): string {
  const s = String(value);
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ============================================================
// DATEV-Buchungssatz
// ============================================================
export interface DatevBuchung {
  umsatz: number; // immer positiv
  sollHaben: 'S' | 'H'; // Soll oder Haben am Konto
  konto: string; // Sachkonto (SKR03)
  gegenkonto: string; // Gegenkonto
  belegdatum: string; // ISO YYYY-MM-DD
  belegfeld1: string; // Beleg-Nr.
  buchungstext: string; // max. 60 Zeichen
  kostStelle1?: string; // Kostenstelle 1 (Objekt-ID)
  kostStelle2?: string; // Kostenstelle 2 (Einheit-ID)
}

// ============================================================
// Kategorie-Mapping: Expense → SKR03-Konto
// ============================================================
export function expenseToKonto(category: Expense['category']): string {
  switch (category) {
    case 'Grundsteuer': return SKR03.AUFWAND_GRUNDSTEUER;
    case 'Versicherung': return SKR03.AUFWAND_VERSICHERUNG;
    case 'Verwaltung': return SKR03.AUFWAND_VERWALTUNG;
    case 'Instandhaltung': return SKR03.AUFWAND_INSTANDHALTUNG;
    case 'Hausgeld': return SKR03.AUFWAND_HAUSGELD;
    case 'Sonstiges':
    default: return SKR03.AUFWAND_SONSTIGES;
  }
}

/**
 * Payment-Typ → SKR03-Erlöskonto.
 * Hinweis: `Gutschrift` nutzt bewusst dasselbe Erlöskonto wie `Miete` — die Umkehrung
 * (Storno) geschieht über das Soll-/Haben-Kennzeichen (`S` statt `H`) in
 * `buildDatevBuchungen`, nicht über ein anderes Konto.
 */
export function paymentToKonto(type: TenantPayment['type']): string {
  switch (type) {
    case 'Miete': return SKR03.ERLOES_MIETE_UMSATZSTEUERFREI;
    case 'Nachzahlung': return SKR03.ERLOES_NEBENKOSTEN_NACHZAHLUNG;
    case 'Kaution': return SKR03.ERLOES_KAUTION;
    case 'Gutschrift':
    default: return SKR03.ERLOES_MIETE_UMSATZSTEUERFREI;
  }
}

// ============================================================
// Haupt-Export-Funktion
// ============================================================
export interface DatevExportInput {
  year: number;
  payments: TenantPayment[];
  expenses: Expense[];
  properties: RentalProperty[];
  tenants: Tenant[];
  units: RentalUnit[];
  propertyFilter?: string; // '__all__' oder Property-ID
  // Metadaten für DATEV-Header
  beraterNr?: string; // Berater-Nummer (7-stellig)
  mandantNr?: string; // Mandanten-Nummer
  bezeichnung?: string; // Bezeichnung des Buchungsstapels
}

/**
 * Konvertiert Zahlungen und Ausgaben in DATEV-Buchungssätze.
 * Konvention: Bankkonto (1200) ist Gegenkonto; Sachkonto ist das jeweilige Erlös-/Aufwandskonto.
 */
export function buildDatevBuchungen(input: DatevExportInput): DatevBuchung[] {
  const { year, payments, expenses, properties, tenants, units, propertyFilter } = input;
  const yearStr = String(year);
  const filterProp = propertyFilter && propertyFilter !== '__all__' ? propertyFilter : null;

  const buchungen: DatevBuchung[] = [];

  // ===== Einnahmen (Mietzahlungen) =====
  payments
    .filter((p) => p.date.startsWith(yearStr))
    .filter((p) => !filterProp || p.propertyId === filterProp)
    .filter((p) => p.status === 'eingegangen')
    .forEach((p, idx) => {
      const tenant = tenants.find((t) => t.id === p.tenantId);
      const prop = properties.find((pr) => pr.id === p.propertyId);
      const unit = units.find((u) => u.id === p.unitId);
      const tenantName = tenant?.name || 'unbekannt';
      const propName = prop?.name || 'Objekt';
      const unitName = unit?.name || '';

      // Einnahme: Bank im Soll (+), Erlöskonto im Haben (−)
      // DATEV-Konvention: Umsatz positiv, Sollkennzeichen zeigt Richtung am „Konto"
      // „Konto" = das Sachkonto, „Gegenkonto" = Bank
      // Bei Einnahme: Haben auf Erlöskonto → „S"-Kennzeichen heißt Soll auf Konto = falsche Richtung
      // Richtig: Umsatz auf Konto im „H" (Haben) = Erlös
      //
      // Sonderfall Gutschrift: Rückzahlung/Minderung an den Mieter → Storno-Buchung
      //   Erlöskonto Soll (gegen die bisherige Haben-Richtung), Bank Haben (Geld fließt ab).
      //   Umsatz bleibt positiv (DATEV-Regel), Richtung über Soll-/Haben-Kennzeichen.
      const isGutschrift = p.type === 'Gutschrift';
      buchungen.push({
        umsatz: p.amount,
        sollHaben: isGutschrift ? 'S' : 'H',
        konto: paymentToKonto(p.type),
        gegenkonto: SKR03.BANK,
        belegdatum: p.date,
        belegfeld1: `${isGutschrift ? 'GS' : 'EZ'}-${yearStr.slice(2)}-${String(idx + 1).padStart(4, '0')}`,
        buchungstext: sanitizeText(
          `${isGutschrift ? 'Storno ' : ''}${p.type} ${tenantName} ${propName}${unitName ? ' ' + unitName : ''}`
        ),
        kostStelle1: prop?.id ? `OBJ-${prop.id.slice(-6)}` : undefined,
        kostStelle2: unit?.id ? `EH-${unit.id.slice(-6)}` : undefined,
      });
    });

  // ===== Ausgaben (Expenses) =====
  // Umlagefähige Kosten werden mit „[umlagefähig]" markiert, damit der Steuerberater
  // erkennt, dass sie über die Nebenkosten-Abrechnung an den Mieter weitergereicht werden
  // (und somit in der Summe ertragsneutral sind). Nicht-umlagefähige Kosten trägt der
  // Vermieter selbst und sind voll als Werbungskosten nach § 9 EStG absetzbar.
  expenses
    .filter((e) => e.date.startsWith(yearStr))
    .filter((e) => !filterProp || e.propertyId === filterProp)
    .forEach((e, idx) => {
      const prop = properties.find((pr) => pr.id === e.propertyId);
      const unit = e.unitId ? units.find((u) => u.id === e.unitId) : undefined;
      const propName = prop?.name || 'Objekt';
      const umlageTag = e.isUmlagefaehig ? ' [umlagefähig]' : '';

      // Ausgabe: Aufwandskonto im Soll (+), Bank im Haben (−)
      buchungen.push({
        umsatz: e.amount,
        sollHaben: 'S', // Aufwand auf der Sollseite des Aufwandskontos
        konto: expenseToKonto(e.category),
        gegenkonto: SKR03.BANK,
        belegdatum: e.date,
        belegfeld1: `AUS-${yearStr.slice(2)}-${String(idx + 1).padStart(4, '0')}`,
        buchungstext: sanitizeText(`${e.category} ${e.description} ${propName}${umlageTag}`),
        kostStelle1: prop?.id ? `OBJ-${prop.id.slice(-6)}` : undefined,
        kostStelle2: unit?.id ? `EH-${unit.id.slice(-6)}` : undefined,
      });
    });

  // Sortierung nach Datum (GoBD-konforme chronologische Reihenfolge)
  buchungen.sort((a, b) => a.belegdatum.localeCompare(b.belegdatum));

  return buchungen;
}

// ============================================================
// DATEV-CSV-Generator (Buchungsstapel Format EXTF 700)
// ============================================================
/**
 * Generiert eine DATEV-EXTF-kompatible CSV-Datei.
 * Format: erste Zeile = DTVF-Header, zweite Zeile = Spaltenköpfe, dann Datenzeilen.
 *
 * Struktur laut DATEV-Dokumentation „Format DTVF Buchungsstapel v7.00":
 * Zeile 1: Header mit Mandanten-/Berater-Daten, WJ, Zeitraum
 * Zeile 2: Feldnamen
 * Zeile 3+: Buchungsdaten
 */
export function generateDatevCsv(input: DatevExportInput): string {
  const buchungen = buildDatevBuchungen(input);
  const { year, beraterNr = '0000000', mandantNr = '00000', bezeichnung = 'Vermietung' } = input;

  const wjBeginn = `${year}0101`; // Wirtschaftsjahr-Beginn
  const datumVon = `${year}0101`;
  const datumBis = `${year}1231`;
  const now = new Date();
  const erzeugt = `${toDatevDateFull(now.toISOString().slice(0, 10))}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}000`;

  // Zeile 1: DTVF-Header (27 Felder — DATEV v7.00)
  // Siehe https://developer.datev.de/datev/platform/de/dtvf/formate/buchungsstapel
  const header = [
    'EXTF',         // 01 Format-Kennzeichen
    '700',          // 02 Versions-Nr.
    '21',           // 03 Format-Kategorie (21 = Buchungsstapel)
    'Buchungsstapel', // 04 Format-Name
    '7',            // 05 Format-Version
    erzeugt,        // 06 erzeugt am
    '',             // 07 importiert
    'RE',           // 08 Herkunft-Kennzeichen (RE = Rechnungswesen)
    'ImmoFreak',    // 09 Exportiert von
    '',             // 10 Importiert von
    beraterNr,      // 11 Beraternummer
    mandantNr,      // 12 Mandantennummer
    wjBeginn,       // 13 WJ-Beginn JJJJMMTT
    '4',            // 14 Sachkontenlänge
    datumVon,       // 15 Datum von JJJJMMTT
    datumBis,       // 16 Datum bis JJJJMMTT
    sanitizeText(bezeichnung, 30), // 17 Bezeichnung
    '',             // 18 Diktatkürzel
    '1',            // 19 Buchungstyp (1 = Finanzbuchführung)
    '0',            // 20 Rechnungslegungszweck (0 = unabhängig)
    '0',            // 21 Festschreibung (0 = nicht festgeschrieben)
    'EUR',          // 22 WKZ
    '',             // 23–26 reserved
    '',
    '',
    '',
    '',             // 27 Sachkontenrahmen-Nummer (optional)
  ];

  // Zeile 2: Spaltenköpfe (für DATEV-Import nur die ersten 16 Kern-Felder)
  const columns = [
    'Umsatz (ohne Soll-/Haben-Kennzeichen)',
    'Soll-/Haben-Kennzeichen',
    'WKZ Umsatz',
    'Kurs',
    'Basisumsatz',
    'WKZ Basisumsatz',
    'Konto',
    'Gegenkonto (ohne BU-Schlüssel)',
    'BU-Schlüssel',
    'Belegdatum',
    'Belegfeld 1',
    'Belegfeld 2',
    'Skonto',
    'Buchungstext',
    'Kost1-Kostenstelle',
    'Kost2-Kostenstelle',
  ];

  // Zeile 3+: Buchungen
  const rows = buchungen.map((b) => [
    toDatevAmount(b.umsatz),
    b.sollHaben,
    'EUR',
    '', // Kurs (nur bei Fremdwährung)
    '', // Basisumsatz
    '', // WKZ Basisumsatz
    b.konto,
    b.gegenkonto,
    '', // BU-Schlüssel (Umsatzsteuer-Schlüssel — bei USt-freier V+V leer)
    toDatevDate(b.belegdatum),
    b.belegfeld1,
    '', // Belegfeld 2
    '', // Skonto
    b.buchungstext,
    b.kostStelle1 || '',
    b.kostStelle2 || '',
  ]);

  const lines = [
    header.map(csvCell).join(';'),
    columns.map(csvCell).join(';'),
    ...rows.map((r) => r.map(csvCell).join(';')),
  ];

  // UTF-8 mit BOM (DATEV/Excel-kompatibel)
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

// ============================================================
// Download-Helper
// ============================================================
export function downloadDatevCsv(input: DatevExportInput, filename?: string): void {
  const csv = generateDatevCsv(input);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `EXTF_Buchungsstapel_${input.year}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// Preview-Helper (für Anzeige in UI)
// ============================================================
export interface DatevPreviewRow {
  belegdatum: string; // deutsch formatiert
  belegNr: string;
  konto: string;
  gegenkonto: string;
  sollHaben: 'S' | 'H';
  umsatz: number;
  buchungstext: string;
  isEinnahme: boolean;
}

export function buildDatevPreview(input: DatevExportInput): DatevPreviewRow[] {
  const buchungen = buildDatevBuchungen(input);
  return buchungen.map((b) => ({
    belegdatum: new Date(b.belegdatum).toLocaleDateString('de-DE'),
    belegNr: b.belegfeld1,
    konto: b.konto,
    gegenkonto: b.gegenkonto,
    sollHaben: b.sollHaben,
    umsatz: b.umsatz,
    buchungstext: b.buchungstext,
    // Einnahme-Flag über die Konto-Klasse: SKR03-Klasse 8 = Erlöse.
    // So landen Gutschrift-Stornos (Soll auf 8110) korrekt auf der Einnahmen-Seite
    // (als Minderung), nicht auf der Ausgaben-Seite.
    isEinnahme: b.konto.startsWith('8'),
  }));
}

// ============================================================
// Summen-Helper für KPIs
// ============================================================
export interface DatevSummary {
  anzahlBuchungen: number;
  einnahmenGesamt: number;
  ausgabenGesamt: number;
  saldo: number;
  kontenUebersicht: { konto: string; soll: number; haben: number; saldo: number }[];
}

export function buildDatevSummary(input: DatevExportInput): DatevSummary {
  const buchungen = buildDatevBuchungen(input);

  // Ein Konto ist ein Erlöskonto, wenn es mit '8' beginnt (SKR03: Klasse 8 = Erlöse).
  // Ein Konto ist ein Aufwandskonto, wenn es mit '4' beginnt (SKR03: Klasse 4 = Aufwand).
  // So werden Gutschrift-Stornos (Soll auf 8110) korrekt als negative Einnahme gezählt
  // und nicht fälschlich als Ausgabe verbucht.
  const isErloes = (konto: string) => konto.startsWith('8');
  const isAufwand = (konto: string) => konto.startsWith('4');

  let einnahmenGesamt = 0;
  let ausgabenGesamt = 0;
  buchungen.forEach((b) => {
    if (isErloes(b.konto)) {
      // Haben auf Erlöskonto = +Einnahme, Soll (Storno) = −Einnahme
      einnahmenGesamt += b.sollHaben === 'H' ? b.umsatz : -b.umsatz;
    } else if (isAufwand(b.konto)) {
      // Soll auf Aufwandskonto = +Ausgabe, Haben (Storno) = −Ausgabe
      ausgabenGesamt += b.sollHaben === 'S' ? b.umsatz : -b.umsatz;
    }
  });

  const kontenMap = new Map<string, { soll: number; haben: number }>();
  buchungen.forEach((b) => {
    if (!kontenMap.has(b.konto)) kontenMap.set(b.konto, { soll: 0, haben: 0 });
    const k = kontenMap.get(b.konto)!;
    if (b.sollHaben === 'S') k.soll += b.umsatz;
    else k.haben += b.umsatz;
  });

  const kontenUebersicht = Array.from(kontenMap.entries())
    .map(([konto, v]) => ({ konto, soll: v.soll, haben: v.haben, saldo: v.haben - v.soll }))
    .sort((a, b) => a.konto.localeCompare(b.konto));

  return {
    anzahlBuchungen: buchungen.length,
    einnahmenGesamt,
    ausgabenGesamt,
    saldo: einnahmenGesamt - ausgabenGesamt,
    kontenUebersicht,
  };
}
