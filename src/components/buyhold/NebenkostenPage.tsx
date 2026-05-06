/**
 * Nebenkostenabrechnung — komplett überarbeitet auf Basis Praktiker-Feedback
 * (siehe Feedback_Nebenkostenabrechnung.pdf):
 *
 *  - Eigene Sektion (kein Duplikat mehr unter /bh/schreiben)
 *  - HTML-basierter A4-Vorschau-Druck (statt jsPDF-Text → korrekte €-Zeichen,
 *    keine Zeichenkodierungs-Bugs wie „Hac1smeIster" oder „1.220,00 E")
 *  - Pflichtfelder: Mieter-Nutzungszeitraum (separat vom Abrechnungszeitraum),
 *    Wohnungsnummer/Lage, Tage im Jahr (Schaltjahr-fähig)
 *  - Alle Umlageschlüssel: Wohnfläche, Wohneinheiten, Personenzahl,
 *    Verbrauch (Zähler), MEA, Stellplatz/TG, freier Sonderschlüssel
 *  - Berechnungsformel sichtbar (z. B. 87,3 m² ÷ 732,6 m² × Gesamt)
 *  - Bankverbindung im PDF (für Nachzahlungen)
 *  - §35a EStG-Hinweis (haushaltsnahe Dienstleistungen → Steuerabzug)
 *  - KEINE Paragraphen-Hinweise (§556 BGB, HeizkostenV-Methodik etc.) auf
 *    der Abrechnung — diese gehören ins separate Anschreiben, nicht auf
 *    die Abrechnung selbst
 *  - Heizkosten: Hinweis auf externe Abrechnung statt eigener Methode
 *  - Plausibilitätsprüfung: Anteile = 100 %
 *  - Individueller Haushaltsstrom wird automatisch als nicht-umlagefähig
 *    erkannt (nur Allgemeinstrom Treppenhaus/Keller ist erlaubt)
 */

import { useState, useMemo, useRef, forwardRef } from 'react';
import {
  Plus, Trash2, Download, Printer, Receipt, Building2,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useTenants } from '../../hooks/useTenants';
import { useUtilities } from '../../hooks/useUtilities';
import { useRentalContracts } from '../../hooks/useRentalContracts';
import { useExpenses } from '../../hooks/useExpenses';
import { useMeterReadings } from '../../hooks/useMeterReadings';
import { useLandlordSettings } from '../../hooks/useLandlordSettings';
import { exportElementToPDF } from '../../lib/pdfExport';
import { BriefLayout } from './letters/BriefLayout';
import { NumberInput } from '../ui/NumberInput';
import { cn } from '../../lib/utils';

// ─── Distribution keys ─────────────────────────────────────────

type DistributionKey =
  | 'flaeche'      // Wohnfläche m²
  | 'einheiten'    // Wohneinheiten (pauschal)
  | 'personen'     // Personenzahl
  | 'verbrauch'    // Verbrauch nach Zählerstand
  | 'mea'          // Miteigentumsanteile (WEG)
  | 'stellplatz'   // TG-/Stellplatz (nur betroffene Mieter)
  | 'custom';      // Freier Schlüssel — User definiert Anteil je Einheit

const KEY_LABEL: Record<DistributionKey, string> = {
  flaeche: 'Wohnfläche',
  einheiten: 'Wohneinheit',
  personen: 'Personenzahl',
  verbrauch: 'Verbrauch (Zähler)',
  mea: 'MEA — Miteigentumsanteile',
  stellplatz: 'Stellplatz / TG',
  custom: 'Freier Schlüssel',
};

const KEY_HINT: Record<DistributionKey, string> = {
  flaeche: 'Anteil = m² Mieter ÷ m² Gesamt',
  einheiten: 'Anteil = 1 ÷ Anzahl Einheiten',
  personen: 'Anteil = Personen Mieter ÷ Personen gesamt',
  verbrauch: 'Anteil aus Zählerablesung im Zeitraum',
  mea: 'Anteil aus Teilungserklärung (z. B. 87/1000)',
  stellplatz: 'Nur Mieter mit TG-/Stellplatz tragen die Kosten',
  custom: 'Eigene Aufteilung (z. B. 60/40 aus Mietvertrag)',
};

interface CostEntry {
  id: string;
  name: string;
  provider: string;
  totalCost: number;
  distributionKey: DistributionKey;
  umlagefaehig: boolean;
  /** §35a EStG-tauglich: haushaltsnahe Dienstleistungen oder Handwerker-Arbeiten */
  steuerlichAbsetzbar: boolean;
  /** Anteil "Lohnkosten" am Gesamtbetrag (in %, für §35a) */
  lohnAnteil?: number;
  /** §35a-Kategorie: Dienstleistung oder Handwerker (für Lohnanteil-Bescheinigung) */
  steuerKategorie?: 'dienstleistung' | 'handwerker';
  /**
   * Optional: per-Position-Override für die Verteilerschlüssel.
   * Erlaubt "Untergemeinschaften" wie z.B. "Hausmeister UG A: 18550/340".
   * Wenn gesetzt → diese Werte schlagen die globalen Bezugsgrößen.
   * Format im PDF: "{entryTotal}/{entryOwn}" (Gesamt/Eigen).
   */
  entryTotal?: number;
  entryOwn?: number;
  /** Optional: kurze Bezeichnung der Untergruppe (z.B. "UG A", "TG", "WE") für Lesbarkeit */
  entryGroup?: string;
}

// Keywords für Auto-Klassifizierung
const NICHT_UMLAGEFAEHIG_KEYS = ['hausverwaltung', 'verwaltung', 'instandhaltung', 'reparatur', 'haushaltsstrom', 'haushaltstrom', 'instandsetzung', 'rücklage', 'ruecklage', 'bank'];
const STEUER_ABSETZBAR_KEYS = ['hausmeister', 'gartenpflege', 'reinigung', 'schornstein', 'wartung', 'müllabfuhr', 'mullabfuhr', 'aufzug'];
const VERBRAUCH_KEYS = ['heiz', 'gas', 'fernwärme', 'fernwarme', 'öl', 'oel', 'wasser', 'warmwasser'];
const STELLPLATZ_KEYS = ['stellplatz', 'tiefgarage', 'tg-', 'garage'];

function autoClassify(name: string): {
  umlagefaehig: boolean;
  steuerlichAbsetzbar: boolean;
  distributionKey: DistributionKey;
} {
  const lower = name.toLowerCase();
  const isNonAlloc = NICHT_UMLAGEFAEHIG_KEYS.some((k) => lower.includes(k));
  const isSteuer = STEUER_ABSETZBAR_KEYS.some((k) => lower.includes(k));
  let key: DistributionKey = 'flaeche';
  if (VERBRAUCH_KEYS.some((k) => lower.includes(k))) key = 'verbrauch';
  else if (STELLPLATZ_KEYS.some((k) => lower.includes(k))) key = 'stellplatz';
  else if (lower.includes('müll') || lower.includes('mull') || lower.includes('person')) key = 'personen';
  else if (lower.includes('strom') || lower.includes('aufzug') || lower.includes('hausmeister')) key = 'einheiten';
  return { umlagefaehig: !isNonAlloc, steuerlichAbsetzbar: isSteuer, distributionKey: key };
}

const DEFAULT_COSTS: Omit<CostEntry, 'id'>[] = [
  { name: 'Grundsteuer', provider: 'Stadt/Gemeinde', totalCost: 0, distributionKey: 'flaeche', umlagefaehig: true, steuerlichAbsetzbar: false },
  { name: 'Wohngebäudeversicherung', provider: '', totalCost: 0, distributionKey: 'flaeche', umlagefaehig: true, steuerlichAbsetzbar: false },
  { name: 'Müllabfuhr', provider: '', totalCost: 0, distributionKey: 'personen', umlagefaehig: true, steuerlichAbsetzbar: true, lohnAnteil: 0 },
  { name: 'Wasser & Abwasser', provider: '', totalCost: 0, distributionKey: 'verbrauch', umlagefaehig: true, steuerlichAbsetzbar: false },
  { name: 'Heizkosten (lt. externer Abrechnung)', provider: 'Heizkosten-Abrechner', totalCost: 0, distributionKey: 'verbrauch', umlagefaehig: true, steuerlichAbsetzbar: false },
  { name: 'Hausmeister', provider: '', totalCost: 0, distributionKey: 'einheiten', umlagefaehig: true, steuerlichAbsetzbar: true, lohnAnteil: 100 },
  { name: 'Gartenpflege', provider: '', totalCost: 0, distributionKey: 'flaeche', umlagefaehig: true, steuerlichAbsetzbar: true, lohnAnteil: 100 },
  { name: 'Treppenhausreinigung', provider: '', totalCost: 0, distributionKey: 'einheiten', umlagefaehig: true, steuerlichAbsetzbar: true, lohnAnteil: 100 },
  { name: 'Allgemeinstrom (Treppenhaus, Keller)', provider: '', totalCost: 0, distributionKey: 'einheiten', umlagefaehig: true, steuerlichAbsetzbar: false },
];

let _id = 1;
const makeId = () => `c_${_id++}`;

/**
 * Default-Body für das Anschreiben — direkt aus dem Beispiel übernommen,
 * mit Platzhaltern die zur Render-Zeit befüllt werden:
 *   {nachzahlung}, {guthaben}, {betrag}, {datum}, {falligDatum}, {jahr},
 *   {zeitraum}, {mieter}, {wohnung}, {objekt}
 *
 * Der User kann den Text in Schritt 4 frei editieren.
 */
const defaultLetterBody = `beiliegend erhalten Sie die Betriebskostenabrechnung für das Jahr {jahr} unter Berücksichtigung Ihres gesamten Abrechnungszeitraumes.

Bei Rückfragen bzgl. der Abrechnungen stehen wir Ihnen gerne zur Verfügung. Eine Einsichtnahme in die Belege kann nach vorheriger Terminabsprache in unserem Büro erfolgen.

Wir bitten um Überweisung der Nachzahlung in Höhe von {nachzahlung} bis spätestens zum {falligDatum} auf das Ihnen bekannte Bankkonto.

Ihre Mietzahlung ändert sich durch diese Abrechnung nicht.

Da Sie noch nicht an unserem Lastschriftverfahren teilnehmen, möchten wir dieses nochmals empfehlen. Sie müssten dann künftig nicht mehr den Dauerauftrag ändern und den Termin bei einer eventuellen Guthabensauszahlung / Nachzahlung von Betriebskosten beachten. Dies wird bei bestehendem Lastschriftverfahren von uns berichtigt.`;

/** Variante bei Guthaben (statt Nachzahlung) */
const defaultLetterBodyGuthaben = `beiliegend erhalten Sie die Betriebskostenabrechnung für das Jahr {jahr} unter Berücksichtigung Ihres gesamten Abrechnungszeitraumes.

Bei Rückfragen bzgl. der Abrechnungen stehen wir Ihnen gerne zur Verfügung. Eine Einsichtnahme in die Belege kann nach vorheriger Terminabsprache in unserem Büro erfolgen.

Aus der Abrechnung ergibt sich zu Ihren Gunsten ein Guthaben in Höhe von {guthaben}. Wir werden dieses bis zum {falligDatum} auf Ihr uns bekanntes Konto überweisen oder mit der nächsten Mietzahlung verrechnen.

Ihre Mietzahlung ändert sich durch diese Abrechnung nicht.`;

// ─── Page ──────────────────────────────────────────────────────

export function NebenkostenPage() {
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allTenants } = useTenants();
  const { allUtilities, allCosts } = useUtilities();
  const { allContracts } = useRentalContracts();
  const { items: allExpenses } = useExpenses();
  const { allReadings } = useMeterReadings();
  const { settings: landlord } = useLandlordSettings();

  // Step-Wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 — Objekt + Zeitraum
  const lastYear = new Date().getFullYear() - 1;
  const [propertyId, setPropertyId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [periodFrom, setPeriodFrom] = useState(`${lastYear}-01-01`);
  const [periodTo, setPeriodTo] = useState(`${lastYear}-12-31`);

  // Mieter-Nutzungszeitraum (kann von Abrechnungszeitraum abweichen — Pflichtfeld)
  const [usageFrom, setUsageFrom] = useState(`${lastYear}-01-01`);
  const [usageTo, setUsageTo] = useState(`${lastYear}-12-31`);

  // Step 2 — Personen / Bezugsgrößen
  const [tenantPersons, setTenantPersons] = useState(1);
  const [totalPersons, setTotalPersons] = useState<number | ''>('');
  /** Eigener MEA-Anteil für die Wohnung des Mieters (z. B. 87/1000 → 87) — Default 0 */
  const [tenantMea, setTenantMea] = useState<number | ''>('');
  /** MEA-Summe gesamt (z. B. 1000) */
  const [totalMea, setTotalMea] = useState<number | ''>(1000);
  /** Hat dieser Mieter einen TG-/Stellplatz? */
  const [hasStellplatz, setHasStellplatz] = useState(false);
  /** Anzahl aller Stellplätze im Objekt (Verteilung TG-Kosten) */
  const [totalStellplatz, setTotalStellplatz] = useState<number | ''>('');

  // Step 3 — Kosten
  const [costs, setCosts] = useState<CostEntry[]>(() =>
    DEFAULT_COSTS.map((c) => ({ ...c, id: makeId() })),
  );
  /** Freier Schlüssel: Anteil dieses Mieters in % (z. B. 60 für 60/40 aus Mietvertrag) */
  const [customSharePct, setCustomSharePct] = useState<number | ''>('');

  // Step 4 — Anschreiben & PDF
  /** Welche Vorschau wird angezeigt: Abrechnung oder Anschreiben */
  const [previewMode, setPreviewMode] = useState<'abrechnung' | 'anschreiben'>('abrechnung');
  /** Editierbarer Vorauszahlungs-Text (z. B. "3 x 350,-, 7 x 400,-, 1x 600,-") */
  const [advancesText, setAdvancesText] = useState<string>('');
  /** Briefdatum (Anschreiben) */
  const [letterDate, setLetterDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  /** Zahlungs-/Antwortfrist (Anschreiben) — Default: 4 Wochen ab Briefdatum */
  const [paymentDueDate, setPaymentDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return d.toISOString().slice(0, 10);
  });
  /** Anrede für das Anschreiben (z. B. "Sehr geehrter Herr Mustermann,") */
  const [salutation, setSalutation] = useState<string>('');
  /** Editierbarer Body des Anschreibens (mit Default-Vorlage aus dem Beispiel) */
  const [letterBody, setLetterBody] = useState<string>('');

  // PDF preview refs (zwei separate Dokumente)
  const abrechnungRef = useRef<HTMLDivElement>(null);
  const anschreibenRef = useRef<HTMLDivElement>(null);

  // ─── Derived data ────────────────────────────────────────────

  const property = properties.find((p) => p.id === propertyId);
  const tenant = allTenants.find((t) => t.id === tenantId);
  const unit = tenant ? allUnits.find((u) => u.id === tenant.unitId) : undefined;
  const propertyUnits = useMemo(() => allUnits.filter((u) => u.propertyId === propertyId), [allUnits, propertyId]);
  const propertyTenants = useMemo(() => allTenants.filter((t) => t.propertyId === propertyId), [allTenants, propertyId]);
  const totalArea = property?.totalArea || propertyUnits.reduce((s, u) => s + u.area, 0) || 0;
  const totalUnitsCount = propertyUnits.length || 1;
  const tenantArea = unit?.area || 0;
  const contract = tenant ? allContracts.find((c) => c.tenantId === tenant.id) : undefined;

  // Tage im Abrechnungsjahr (Schaltjahr-aware)
  const daysInPeriod = useMemo(() => {
    if (!periodFrom || !periodTo) return 0;
    const from = new Date(periodFrom);
    const to = new Date(periodTo);
    return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  }, [periodFrom, periodTo]);
  const daysOfUsage = useMemo(() => {
    if (!usageFrom || !usageTo) return 0;
    const from = new Date(usageFrom);
    const to = new Date(usageTo);
    return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  }, [usageFrom, usageTo]);
  const usageFraction = daysInPeriod > 0 ? daysOfUsage / daysInPeriod : 1;
  const isPartialPeriod = usageFraction < 0.999;

  // Verbrauchs-Anteil aus Zählerständen
  const consumptionShare = useMemo(() => {
    if (!property || !unit || !periodFrom || !periodTo) return 0;
    const fromTs = new Date(periodFrom).getTime();
    const toTs = new Date(periodTo).getTime();
    const propReadings = allReadings.filter((r) => r.propertyId === property.id);
    if (propReadings.length === 0) return 0;

    const deltaFor = (uid: string) => {
      const ur = propReadings.filter((r) => r.unitId === uid);
      const meters = Array.from(new Set(ur.map((r) => r.meterId)));
      let sum = 0;
      meters.forEach((mid) => {
        const sorted = ur
          .filter((r) => r.meterId === mid)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const before = [...sorted].reverse().find((r) => new Date(r.date).getTime() <= fromTs) ?? sorted[0];
        const after = [...sorted].reverse().find((r) => new Date(r.date).getTime() <= toTs) ?? sorted[sorted.length - 1];
        if (before && after && after !== before) sum += Math.max(0, after.value - before.value);
      });
      return sum;
    };

    const own = deltaFor(unit.id);
    const total = propertyUnits.reduce((s, u) => s + deltaFor(u.id), 0);
    return total > 0 ? own / total : 0;
  }, [property, unit, periodFrom, periodTo, allReadings, propertyUnits]);

  const hasMeterData = consumptionShare > 0;

  const areaShare = totalArea > 0 ? tenantArea / totalArea : 0;
  const personShare = totalPersons && totalPersons > 0 ? tenantPersons / Number(totalPersons) : 0;
  const unitsShare = 1 / totalUnitsCount;
  const meaShare = (typeof tenantMea === 'number' && typeof totalMea === 'number' && totalMea > 0) ? tenantMea / totalMea : 0;
  const stellplatzShare = (hasStellplatz && totalStellplatz && totalStellplatz > 0) ? 1 / Number(totalStellplatz) : 0;
  const customShare = typeof customSharePct === 'number' ? customSharePct / 100 : 0;

  // Compute share + label per cost entry
  type Computed = CostEntry & {
    shareValue: number;
    /** Verteilerschlüssel-Spalte im PDF — Format wie im Beispiel z.B. "76500/340" */
    schluesselFormatted: string;
    /** Lange Erklärung für Erklärungs-Block am Ende */
    schluesselFullText: string;
    /** Vollanteil bei Vollnutzung (für "Umlageanteil gesamt" Spalte) */
    fullYearAmount: number;
    /** Mieter-Anteil ggf. tagesanteilig gekürzt (für "Ihr Umlageanteil" Spalte) */
    tenantAmount: number;
  };

  const computed: Computed[] = useMemo(() => {
    return costs.map((c) => {
      // Per-Eintrag-Override (Untergemeinschaften) — falls gesetzt, schlägt globale Werte
      const useEntryOverride = typeof c.entryTotal === 'number' && typeof c.entryOwn === 'number' && c.entryTotal > 0;
      let shareValue = 0;
      let schluessel = '';
      let fullText = '';

      if (useEntryOverride) {
        const total = c.entryTotal!;
        const own = c.entryOwn!;
        shareValue = total > 0 ? own / total : 0;
        schluessel = `${total.toLocaleString('de-DE')}/${own.toLocaleString('de-DE')}`;
        fullText = c.entryGroup
          ? `${total.toLocaleString('de-DE')} = MEA Gesamt ${c.entryGroup} · ${own.toLocaleString('de-DE')} = MEA Anteil`
          : `${total.toLocaleString('de-DE')} = Gesamtbezug · ${own.toLocaleString('de-DE')} = Anteil`;
      } else {
        switch (c.distributionKey) {
          case 'flaeche': {
            shareValue = areaShare;
            const t = totalArea.toLocaleString('de-DE', { maximumFractionDigits: 1 });
            const o = tenantArea.toLocaleString('de-DE', { maximumFractionDigits: 1 });
            schluessel = totalArea > 0 ? `${t}/${o} m²` : '—';
            fullText = totalArea > 0 ? `${t} m² Gesamtfläche · ${o} m² Wohnfläche` : 'Wohnfläche fehlt';
            break;
          }
          case 'einheiten':
            shareValue = unitsShare;
            schluessel = `1 / ${totalUnitsCount} EH`;
            fullText = `1 von ${totalUnitsCount} Wohneinheiten`;
            break;
          case 'personen': {
            shareValue = personShare;
            if (totalPersons) {
              schluessel = `${totalPersons}/${tenantPersons}`;
              fullText = `${totalPersons} Personen gesamt · ${tenantPersons} Personen Mieter`;
            } else {
              schluessel = '—';
              fullText = 'Personenzahl fehlt';
            }
            break;
          }
          case 'verbrauch':
            shareValue = hasMeterData ? consumptionShare : areaShare;
            schluessel = hasMeterData ? 'externe Abrechnung' : 'externe Abrechnung';
            fullText = hasMeterData
              ? 'Ihr Umlageanteil ist auf der beiliegenden Heizkosten-/Versorger-Abrechnung dargestellt.'
              : 'Ihr Umlageanteil ist auf der beiliegenden externen Abrechnung dargestellt.';
            break;
          case 'mea': {
            shareValue = meaShare;
            const t = typeof totalMea === 'number' ? totalMea : 0;
            const o = typeof tenantMea === 'number' ? tenantMea : 0;
            schluessel = (t > 0 && o > 0) ? `${t.toLocaleString('de-DE')}/${o.toLocaleString('de-DE')}` : '—';
            fullText = (t > 0 && o > 0)
              ? `${t.toLocaleString('de-DE')} = MEA Gesamt · ${o.toLocaleString('de-DE')} = MEA Wohnung`
              : 'MEA fehlt';
            break;
          }
          case 'stellplatz':
            shareValue = stellplatzShare;
            if (hasStellplatz && totalStellplatz) {
              schluessel = `${totalStellplatz}/1`;
              fullText = `1 von ${totalStellplatz} Stellplätzen`;
            } else if (!hasStellplatz) {
              schluessel = 'kein Stellplatz';
              fullText = 'Mieter hat keinen Stellplatz — keine Umlage';
            } else {
              schluessel = '—';
              fullText = 'Anzahl Stellplätze fehlt';
            }
            break;
          case 'custom':
            shareValue = customShare;
            schluessel = typeof customSharePct === 'number' ? `${customSharePct.toLocaleString('de-DE')} %` : '—';
            fullText = typeof customSharePct === 'number'
              ? `Freier Schlüssel ${customSharePct.toLocaleString('de-DE')} % laut Mietvertrag/Vereinbarung`
              : 'Freier Schlüssel — Anteil fehlt';
            break;
        }
      }

      // Spezialfälle: Grundsteuer und Heizung haben oft "lt. Bescheid" / "externe Abrechnung"
      // unabhängig vom Schlüssel — wir respektieren das wenn der Name passend ist.
      const lower = c.name.toLowerCase();
      if (!useEntryOverride && lower.includes('grundsteuer')) {
        schluessel = 'lt. Bescheid';
        fullText = 'Grundsteuer-Bescheid wird direkt 1:1 übernommen.';
      }

      const fullYearAmount = c.totalCost * shareValue;
      const tenantAmount = fullYearAmount * usageFraction;

      return {
        ...c,
        shareValue,
        schluesselFormatted: schluessel,
        schluesselFullText: fullText,
        fullYearAmount,
        tenantAmount,
      };
    });
  }, [costs, areaShare, unitsShare, personShare, hasMeterData, consumptionShare, tenantArea, totalArea, totalUnitsCount, totalPersons, tenantPersons, meaShare, tenantMea, totalMea, stellplatzShare, hasStellplatz, totalStellplatz, customShare, customSharePct, usageFraction]);

  const allocatable = computed.filter((c) => c.umlagefaehig);
  const nonAllocatable = computed.filter((c) => !c.umlagefaehig);

  const totalAllocSum = allocatable.reduce((s, c) => s + c.totalCost, 0);
  const totalNonAllocSum = nonAllocatable.reduce((s, c) => s + c.totalCost, 0);
  const tenantTotal = allocatable.reduce((s, c) => s + c.tenantAmount, 0);

  const monthlyAdvance = contract ? (contract.operatingCosts + contract.heatingCosts) : 0;
  const yearlyAdvance = monthlyAdvance * 12 * usageFraction;
  const difference = tenantTotal - yearlyAdvance;

  // §35a EStG-Summe (Lohnanteil der haushaltsnahen Dienstleistungen)
  const tax35aTotal = allocatable
    .filter((c) => c.steuerlichAbsetzbar)
    .reduce((s, c) => {
      const lohnFraction = (c.lohnAnteil ?? 100) / 100;
      return s + c.tenantAmount * lohnFraction;
    }, 0);

  // ─── Plausibility checks ────────────────────────────────────

  const sumAreaUnits = propertyUnits.reduce((s, u) => s + u.area, 0);
  const areaConsistent = totalArea > 0 && Math.abs(sumAreaUnits - totalArea) / totalArea < 0.05;

  const checks: { ok: boolean; label: string; hint?: string }[] = [
    {
      ok: !!property && !!tenant && !!unit,
      label: 'Mieter, Objekt und Einheit gewählt',
    },
    {
      ok: areaConsistent || sumAreaUnits === 0,
      label: 'Wohnflächen-Summe stimmt mit Gesamtfläche überein',
      hint: !areaConsistent && sumAreaUnits > 0 ? `Σ Einheiten ${sumAreaUnits.toLocaleString('de-DE', { maximumFractionDigits: 1 })} m² ≠ Gesamt ${totalArea.toLocaleString('de-DE', { maximumFractionDigits: 1 })} m²` : undefined,
    },
    {
      ok: !costs.some((c) => c.distributionKey === 'personen') || (typeof totalPersons === 'number' && totalPersons > 0),
      label: 'Personenzahl vollständig (sofern Schlüssel verwendet)',
    },
    {
      ok: !costs.some((c) => c.distributionKey === 'mea') || (typeof tenantMea === 'number' && tenantMea > 0 && typeof totalMea === 'number' && totalMea > 0),
      label: 'MEA-Anteile vollständig (sofern Schlüssel verwendet)',
    },
    {
      ok: !costs.some((c) => c.distributionKey === 'stellplatz') || (!hasStellplatz || (typeof totalStellplatz === 'number' && totalStellplatz > 0)),
      label: 'Stellplatz-Verteilung vollständig (sofern Schlüssel verwendet)',
    },
    {
      ok: daysOfUsage > 0 && daysOfUsage <= daysInPeriod,
      label: 'Nutzungszeitraum innerhalb des Abrechnungszeitraums',
    },
  ];
  const failedChecks = checks.filter((c) => !c.ok);

  // ─── Helpers ────────────────────────────────────────────────

  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = (n: number) => (n * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  const updateCost = <K extends keyof CostEntry>(idx: number, field: K, value: CostEntry[K]) => {
    setCosts((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const addCost = () => {
    setCosts((prev) => [...prev, {
      id: makeId(),
      name: '',
      provider: '',
      totalCost: 0,
      distributionKey: 'flaeche',
      umlagefaehig: true,
      steuerlichAbsetzbar: false,
    }]);
  };

  const removeCost = (idx: number) => setCosts((prev) => prev.filter((_, i) => i !== idx));

  const handleNameChange = (idx: number, name: string) => {
    setCosts((prev) => {
      const old = prev[idx];
      const cls = autoClassify(name);
      // Nur wenn der User noch nicht selber classifiziert hat (Defaultwerte) updaten wir
      const c = {
        ...old,
        name,
        // Auto-set umlagefähig bei klar nicht-umlagefähigen Stichworten (z. B. "Haushaltsstrom")
        umlagefaehig: NICHT_UMLAGEFAEHIG_KEYS.some((k) => name.toLowerCase().includes(k)) ? false : old.umlagefaehig,
        // Auto-set steuerlich absetzbar bei §35a-Stichworten
        steuerlichAbsetzbar: STEUER_ABSETZBAR_KEYS.some((k) => name.toLowerCase().includes(k)) ? true : old.steuerlichAbsetzbar,
        distributionKey: old.distributionKey,
      };
      // Nur wenn der User vorher noch keine Verteilung gesetzt hat (default flaeche), schlagen wir vor
      if (old.distributionKey === 'flaeche' && cls.distributionKey !== 'flaeche') {
        c.distributionKey = cls.distributionKey;
      }
      const copy = [...prev];
      copy[idx] = c;
      return copy;
    });
  };

  const onSelectProperty = (id: string) => {
    setPropertyId(id);
    setTenantId('');

    if (!id) return;
    // Pre-fill costs from property utilities + expenses
    const year = new Date(periodFrom).getFullYear();
    const propUtilities = allUtilities.filter((u) => u.propertyId === id);
    const fromTs = new Date(periodFrom).getTime();
    const toTs = new Date(periodTo).getTime();
    const propExpenses = allExpenses.filter(
      (e) => e.propertyId === id && new Date(e.date).getTime() >= fromTs && new Date(e.date).getTime() <= toTs,
    );

    const aggregate: Record<string, { total: number; provider: string }> = {};
    propUtilities.forEach((u) => {
      const actual = allCosts.find((c) => c.utilityId === u.id && c.year === year);
      const total = actual ? actual.totalCost : u.monthlyAdvance * 12;
      const k = u.type;
      aggregate[k] = aggregate[k] || { total: 0, provider: u.provider };
      aggregate[k].total += total;
    });
    propExpenses.forEach((e) => {
      const k = e.category;
      aggregate[k] = aggregate[k] || { total: 0, provider: '' };
      aggregate[k].total += e.amount;
    });

    setCosts((prev) =>
      prev.map((c) => {
        const match = Object.entries(aggregate).find(([key]) => key.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]) || c.name.toLowerCase().includes(key.toLowerCase()));
        if (match) {
          return { ...c, totalCost: match[1].total, provider: match[1].provider || c.provider };
        }
        return c;
      }),
    );
  };

  const onSelectTenant = (id: string) => {
    setTenantId(id);
    if (!id) return;
    const t = allTenants.find((x) => x.id === id);
    if (!t) return;
    // Mietverhältnis-Daten als Default für Nutzungszeitraum
    setUsageFrom(t.leaseStart || periodFrom);
    setUsageTo(t.leaseEnd || periodTo);

    // Anrede aus dem Mieternamen ableiten (Default — User kann editieren)
    const name = t.name.trim();
    let defaultSalutation = '';
    if (/^familie\b/i.test(name)) {
      defaultSalutation = `Sehr geehrte ${name},`;
    } else {
      const lastName = name.split(/\s+/).pop() || name;
      defaultSalutation = `Sehr geehrte/r Herr/Frau ${lastName},`;
    }
    if (!salutation) setSalutation(defaultSalutation);

    // Vorauszahlungen-Default: "12 x 350,00 €" oder "11 x 350,00 €" bei Teilnutzung
    const c = allContracts.find((x) => x.tenantId === t.id);
    if (c && !advancesText) {
      const monthly = c.operatingCosts + c.heatingCosts;
      const months = Math.max(1, Math.round(12 * (
        usageFrom && usageTo
          ? Math.max(0, (new Date(usageTo).getTime() - new Date(usageFrom).getTime()) / 86_400_000 + 1)
          : 365
      ) / Math.max(1, daysInPeriod || 365)));
      if (monthly > 0) {
        setAdvancesText(`${months} × ${monthly.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
      }
    }
  };

  // ─── PDF export ─────────────────────────────────────────────

  const exportAbrechnung = async () => {
    if (!abrechnungRef.current || !tenant) return;
    const year = new Date(periodFrom).getFullYear();
    const filename = `Betriebskostenabrechnung_${year}_${tenant.name.replace(/\s+/g, '_')}.pdf`;
    await exportElementToPDF(abrechnungRef.current, filename);
  };

  const exportAnschreiben = async () => {
    if (!anschreibenRef.current || !tenant) return;
    const year = new Date(periodFrom).getFullYear();
    const filename = `Anschreiben_BKA_${year}_${tenant.name.replace(/\s+/g, '_')}.pdf`;
    await exportElementToPDF(anschreibenRef.current, filename);
  };

  /** Beide PDFs nacheinander exportieren — die häufigste Aktion (Anschreiben + Abrechnung). */
  const exportBoth = async () => {
    // Aktiv: zuerst die Vorschau auf das jeweilige Dokument schalten, damit der
    // Browser die DOM-Refs befüllt; dann sequentiell exportieren.
    setPreviewMode('anschreiben');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await exportAnschreiben();
    setPreviewMode('abrechnung');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await exportAbrechnung();
  };

  const handlePrint = () => {
    window.print();
  };

  const ready = !!tenant && !!property && !!unit && costs.some((c) => c.totalCost > 0);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="page-container max-w-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5 px-1">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] sm:text-[30px] font-bold text-foreground tracking-tight leading-[1.15] mb-1">
            Nebenkostenabrechnung
          </h1>
          <p className="text-[13.5px] text-muted-foreground max-w-2xl leading-relaxed">
            Erstellt eine vollständige Betriebs- und Heizkostenabrechnung pro Mieter — mit MEA, Stellplatz, freiem Schlüssel und Schaltjahr-genauer Tagesberechnung.
          </p>
        </div>
        {ready && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handlePrint} className="btn btn-md btn-secondary"><Printer size={14} /> Drucken</button>
            <button onClick={exportBoth} className="btn btn-md btn-primary"><Download size={14} /> Beides als PDF</button>
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5 mb-5 px-1 print:hidden">
        {([
          { n: 1, label: 'Objekt & Zeitraum' },
          { n: 2, label: 'Bezugsgrößen' },
          { n: 3, label: 'Kosten' },
          { n: 4, label: 'Vorschau & PDF' },
        ] as const).map((s, idx, arr) => (
          <div key={s.n} className="flex items-center gap-1.5 flex-1">
            <button
              onClick={() => setStep(s.n)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors cursor-pointer',
                step === s.n
                  ? 'bg-[#4F6BFF] text-white'
                  : step > s.n
                    ? 'bg-[#4F6BFF]/10 text-[#4F6BFF] hover:bg-[#4F6BFF]/15'
                    : 'bg-card-line/40 text-muted-foreground hover:bg-card-line/60',
              )}
            >
              <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[10.5px] tabular-nums">{s.n}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {idx < arr.length - 1 && <div className="flex-1 h-px bg-card-line" />}
          </div>
        ))}
      </div>

      {/* Layout: schmale Wizard-Spalte links (sticky, scrollt nicht mit) +
          breite Vorschau rechts, die den ganzen verbleibenden Platz nutzt. */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[400px_1fr] gap-6 nk-page items-start">
        {/* Left: Settings panel — bleibt beim Scrollen mit dem Preview sichtbar */}
        <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden print:hidden lg:sticky lg:top-3 lg:max-h-[calc(100dvh-100px)] lg:overflow-y-auto">
          {/* STEP 1 — Objekt & Zeitraum */}
          {step === 1 && (
            <div className="p-5 sm:p-6 space-y-4">
              <SectionTitle icon={<Building2 size={14} />} title="Objekt, Mieter & Zeitraum" />

              <Field label="Objekt" required>
                <select value={propertyId} onChange={(e) => onSelectProperty(e.target.value)} className="input">
                  <option value="">— Objekt wählen —</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {p.address}</option>
                  ))}
                </select>
              </Field>

              <Field label="Mieter" required help={!propertyId ? 'Zuerst Objekt wählen' : undefined}>
                <select value={tenantId} onChange={(e) => onSelectTenant(e.target.value)} disabled={!propertyId} className="input">
                  <option value="">— Mieter wählen —</option>
                  {propertyTenants.map((t) => {
                    const u = allUnits.find((x) => x.id === t.unitId);
                    return <option key={t.id} value={t.id}>{t.name} · {u?.name || '—'}</option>;
                  })}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Abrechnungszeitraum von" required>
                  <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="input" />
                </Field>
                <Field label="bis" required>
                  <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="input" />
                </Field>
              </div>
              <div className="px-3 py-2 rounded-lg bg-card-line/30 border border-card-divider flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Tage im Abrechnungsjahr</span>
                <span className="font-semibold tabular-nums text-foreground">{daysInPeriod} {daysInPeriod === 366 && '(Schaltjahr)'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Nutzung Mieter von" required help="Pflicht — bei unterjährigem Mietverhältnis">
                  <input type="date" value={usageFrom} onChange={(e) => setUsageFrom(e.target.value)} min={periodFrom} max={periodTo} className="input" />
                </Field>
                <Field label="bis" required>
                  <input type="date" value={usageTo} onChange={(e) => setUsageTo(e.target.value)} min={periodFrom} max={periodTo} className="input" />
                </Field>
              </div>
              {isPartialPeriod && (
                <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-800 flex items-start gap-2">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>Unterjähriges Verhältnis: {daysOfUsage} von {daysInPeriod} Tagen ({fmtPct(usageFraction)} %). Beträge werden tagesgenau gekürzt.</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!tenant || !property}
                  className="btn btn-md btn-primary"
                >
                  Weiter
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — Bezugsgrößen */}
          {step === 2 && (
            <div className="p-5 sm:p-6 space-y-4">
              <SectionTitle title="Bezugsgrößen für die Verteilung" />

              <div>
                <p className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Wohnfläche</p>
                <div className="grid grid-cols-2 gap-3">
                  <ReadonlyField label="Mieter-Fläche" value={`${tenantArea} m²`} />
                  <ReadonlyField label="Gesamtfläche" value={`${totalArea} m²`} />
                </div>
              </div>

              <div>
                <p className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Personen</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Personen Mieter">
                    <NumberInput value={tenantPersons} onChange={(v) => setTenantPersons(v === '' ? 1 : v)} decimals={0} className="input" />
                  </Field>
                  <Field label="Personen gesamt" help="Summe aller Bewohner im Objekt">
                    <NumberInput value={totalPersons} onChange={setTotalPersons} decimals={0} placeholder="0" className="input" />
                  </Field>
                </div>
              </div>

              <div>
                <p className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">MEA — Miteigentumsanteile</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="MEA Wohnung" help="Aus Teilungserklärung">
                    <NumberInput value={tenantMea} onChange={setTenantMea} decimals={2} placeholder="z. B. 87" className="input" />
                  </Field>
                  <Field label="MEA Summe" help="i. d. R. 1.000 oder 10.000">
                    <NumberInput value={totalMea} onChange={setTotalMea} decimals={2} placeholder="1000" className="input" />
                  </Field>
                </div>
                {meaShare > 0 && (
                  <p className="text-[11.5px] text-muted-foreground mt-1.5">
                    → Anteil: <span className="font-semibold text-foreground tabular-nums">{fmtPct(meaShare)} %</span>
                  </p>
                )}
              </div>

              <div>
                <p className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Stellplatz / Tiefgarage</p>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="checkbox" checked={hasStellplatz} onChange={(e) => setHasStellplatz(e.target.checked)} />
                  <span className="text-[13px] text-foreground">Mieter hat einen TG-/Stellplatz</span>
                </label>
                {hasStellplatz && (
                  <Field label="Stellplätze gesamt im Objekt">
                    <NumberInput value={totalStellplatz} onChange={setTotalStellplatz} decimals={0} placeholder="z. B. 8" className="input" />
                  </Field>
                )}
              </div>

              <div>
                <p className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Freier Schlüssel</p>
                <Field label="Anteil Mieter (%)" help="Für individuelle Regelungen aus dem Mietvertrag, z. B. 60 %">
                  <NumberInput value={customSharePct} onChange={setCustomSharePct} suffix="%" decimals={2} placeholder="z. B. 60" className="input" />
                </Field>
              </div>

              <div className="pt-2 flex justify-between">
                <button onClick={() => setStep(1)} className="btn btn-md btn-secondary">Zurück</button>
                <button onClick={() => setStep(3)} className="btn btn-md btn-primary">Weiter</button>
              </div>
            </div>
          )}

          {/* STEP 3 — Kosten */}
          {step === 3 && (
            <div className="p-5 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <SectionTitle title="Kostenarten" />
                <button onClick={addCost} className="btn btn-sm btn-secondary"><Plus size={13} /> Position</button>
              </div>

              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 -mr-1">
                {costs.map((c, i) => (
                  <CostRow
                    key={c.id}
                    cost={c}
                    onChange={(field, value) => updateCost(i, field, value)}
                    onChangeName={(name) => handleNameChange(i, name)}
                    onRemove={() => removeCost(i)}
                  />
                ))}
              </div>

              <div className="pt-2 flex justify-between">
                <button onClick={() => setStep(2)} className="btn btn-md btn-secondary">Zurück</button>
                <button onClick={() => setStep(4)} className="btn btn-md btn-primary">Vorschau</button>
              </div>
            </div>
          )}

          {/* STEP 4 — Plausibility + summary */}
          {step === 4 && (
            <div className="p-5 sm:p-6 space-y-4">
              <SectionTitle title="Plausibilitätsprüfung" />

              <div className="space-y-1.5">
                {checks.map((c, i) => (
                  <div key={i} className={cn('flex items-start gap-2 px-3 py-2 rounded-lg border text-[12.5px]', c.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800')}>
                    {c.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
                    <div>
                      <p>{c.label}</p>
                      {c.hint && <p className="text-[11.5px] opacity-80 mt-0.5">{c.hint}</p>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-3 rounded-xl bg-[#4F6BFF]/5 border border-[#4F6BFF]/20 space-y-1">
                <Row k="Mieter-Anteil umlagefähig" v={`${fmt(tenantTotal)} €`} />
                <Row k="Vorauszahlungen (anteilig)" v={`−${fmt(yearlyAdvance)} €`} />
                <div className="border-t border-[#4F6BFF]/20 pt-1 mt-1">
                  <Row
                    k={difference > 0 ? 'Nachzahlung' : 'Guthaben'}
                    v={`${fmt(Math.abs(difference))} €`}
                    accent={difference > 0 ? 'text-rose-600' : 'text-emerald-600'}
                    bold
                  />
                </div>
                {tax35aTotal > 0 && (
                  <Row k="davon §35a EStG anrechenbar" v={`${fmt(tax35aTotal)} €`} />
                )}
              </div>

              <Field
                label="Vorauszahlungen-Auflistung"
                help={'Wird im Abrechnungs-PDF angezeigt — z. B. „3 × 350,- € · 7 × 400,- € · 1 × 600,- €"'}
              >
                <input
                  value={advancesText}
                  onChange={(e) => setAdvancesText(e.target.value)}
                  placeholder={`z. B. 12 × ${monthlyAdvance ? monthlyAdvance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} €`}
                  className="input"
                />
              </Field>

              {/* Anschreiben editing */}
              <div className="pt-3 border-t border-card-divider">
                <SectionTitle title="Anschreiben (Begleitbrief)" />
                <p className="text-[11.5px] text-muted-foreground mt-1 mb-3">
                  Wird als zweites PDF erzeugt. Variablen <code>{'{nachzahlung}'}</code>, <code>{'{falligDatum}'}</code>, <code>{'{jahr}'}</code> etc. werden automatisch ersetzt.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Field label="Briefdatum">
                    <input type="date" value={letterDate} onChange={(e) => setLetterDate(e.target.value)} className="input" />
                  </Field>
                  <Field label={difference > 0 ? 'Zahlungsfrist' : 'Auszahlung bis'}>
                    <input type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} className="input" />
                  </Field>
                </div>

                <Field label="Anrede">
                  <input value={salutation} onChange={(e) => setSalutation(e.target.value)} className="input" placeholder="Sehr geehrte/r …" />
                </Field>

                <div className="mt-3">
                  <Field label="Brieftext (Body)" help="Multi-line. Lass leer um Standard-Vorlage zu nutzen.">
                    <textarea
                      value={letterBody}
                      onChange={(e) => setLetterBody(e.target.value)}
                      rows={8}
                      placeholder={difference > 0 ? defaultLetterBody : defaultLetterBodyGuthaben}
                      className="input resize-y font-mono text-[11.5px] leading-relaxed"
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => setLetterBody(difference > 0 ? defaultLetterBody : defaultLetterBodyGuthaben)}
                    className="text-[11.5px] text-[#4F6BFF] hover:underline mt-1.5"
                  >
                    Standard-Vorlage einsetzen
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-3 border-t border-card-divider">
                <button onClick={exportBoth} disabled={!ready || failedChecks.length > 0} className="btn btn-md btn-primary w-full">
                  <Download size={14} /> Anschreiben + Abrechnung als PDF
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={exportAnschreiben} disabled={!ready} className="btn btn-md btn-secondary w-full">
                    <Download size={13} /> Nur Anschreiben
                  </button>
                  <button onClick={exportAbrechnung} disabled={!ready || failedChecks.length > 0} className="btn btn-md btn-secondary w-full">
                    <Download size={13} /> Nur Abrechnung
                  </button>
                </div>
                <button onClick={handlePrint} disabled={!ready} className="btn btn-md btn-ghost w-full">
                  <Printer size={14} /> Drucken
                </button>
                <button onClick={() => setStep(3)} className="btn btn-md btn-ghost w-full">Zurück zu Kosten</button>
              </div>
            </div>
          )}
        </div>

        {/* Right: A4 preview — füllt die ganze restliche Breite, A4 zentriert,
             Skalierung passt sich automatisch dem verfügbaren Raum an. */}
        <div className="min-w-0 print:overflow-visible print:p-0">
          {ready ? (
            <>
              {/* Tab toggle: Anschreiben / Abrechnung */}
              <div className="mb-3 flex items-center gap-1.5 flex-wrap print:hidden">
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-card border border-card-line shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <button
                    onClick={() => setPreviewMode('anschreiben')}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors cursor-pointer',
                      previewMode === 'anschreiben'
                        ? 'bg-[#4F6BFF] text-white'
                        : 'text-muted-foreground hover:text-foreground hover:bg-layer-hover',
                    )}
                  >
                    Anschreiben
                  </button>
                  <button
                    onClick={() => setPreviewMode('abrechnung')}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors cursor-pointer',
                      previewMode === 'abrechnung'
                        ? 'bg-[#4F6BFF] text-white'
                        : 'text-muted-foreground hover:text-foreground hover:bg-layer-hover',
                    )}
                  >
                    Abrechnung
                  </button>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={previewMode === 'anschreiben' ? exportAnschreiben : exportAbrechnung} className="btn btn-sm btn-secondary">
                    <Download size={13} /> {previewMode === 'anschreiben' ? 'Anschreiben PDF' : 'Abrechnung PDF'}
                  </button>
                  <button onClick={exportBoth} className="btn btn-sm btn-primary">
                    <Download size={13} /> Beides
                  </button>
                </div>
              </div>

              {/* A4-Container: Zentriert das 794px breite Dokument, skaliert es
                  automatisch via `--a4-scale` damit es überall ohne Horizontal-
                  Scroll passt. Both documents werden gerendert (eines hidden) — so
                  haben beide refs ihren DOM und exportElementToPDF funktioniert
                  ohne Flicker. */}
              <div className="nk-preview-frame">
                <div className="nk-preview-scale">
                <div style={{ display: previewMode === 'abrechnung' ? 'block' : 'none' }}>
                  <PdfDocument
                    ref={abrechnungRef}
                    tenant={tenant!}
                    unit={unit!}
                    property={property!}
                    landlord={landlord}
                    periodFrom={periodFrom}
                    periodTo={periodTo}
                    usageFrom={usageFrom}
                    usageTo={usageTo}
                    daysInPeriod={daysInPeriod}
                    daysOfUsage={daysOfUsage}
                    isPartialPeriod={isPartialPeriod}
                    computed={computed}
                    allocatable={allocatable}
                    nonAllocatable={nonAllocatable}
                    totalAllocSum={totalAllocSum}
                    totalNonAllocSum={totalNonAllocSum}
                    tenantTotal={tenantTotal}
                    yearlyAdvance={yearlyAdvance}
                    difference={difference}
                    tax35aTotal={tax35aTotal}
                    tenantArea={tenantArea}
                    totalArea={totalArea}
                    advancesText={advancesText}
                    fmt={fmt}
                    fmtDate={fmtDate}
                  />
                </div>
                <div style={{ display: previewMode === 'anschreiben' ? 'block' : 'none' }}>
                  <LetterDocument
                    ref={anschreibenRef}
                    tenant={tenant!}
                    unit={unit!}
                    property={property!}
                    landlord={landlord}
                    periodFrom={periodFrom}
                    periodTo={periodTo}
                    letterDate={letterDate}
                    paymentDueDate={paymentDueDate}
                    salutation={salutation}
                    body={letterBody || defaultLetterBody}
                    difference={difference}
                    fmt={fmt}
                    fmtDate={fmtDate}
                  />
                </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-card border border-dashed border-card-line rounded-2xl p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
              <div className="size-14 rounded-2xl bg-[#4F6BFF]/10 flex items-center justify-center mb-4">
                <Receipt size={22} className="text-[#4F6BFF]" />
              </div>
              <p className="text-[15px] font-semibold text-foreground mb-1">Vorschau erscheint hier</p>
              <p className="text-[13px] text-muted-foreground max-w-md">
                Wähle Objekt + Mieter und trage mindestens eine Position mit Gesamtbetrag ein, um die A4-Vorschau zu sehen.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reused list of property tenants — quick switcher in case user wants to rerun for another tenant */}
      {property && propertyTenants.length > 1 && (
        <div className="mt-6 p-4 rounded-xl bg-card border border-card-line print:hidden">
          <p className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Weitere Mieter im Objekt</p>
          <div className="flex flex-wrap gap-1.5">
            {propertyTenants.map((t) => {
              const u = allUnits.find((x) => x.id === t.unitId);
              const active = t.id === tenantId;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTenant(t.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-colors cursor-pointer',
                    active
                      ? 'bg-[#4F6BFF] text-white border-[#4F6BFF]'
                      : 'bg-card border-card-line text-foreground hover:bg-layer-hover',
                  )}
                >
                  {t.name} <span className="opacity-70">· {u?.name || '—'}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Layout primitives ───────────────────────────────────────

function SectionTitle({ icon, title }: { icon?: React.ReactNode; title: string }) {
  return (
    <h2 className="text-[15px] font-semibold text-foreground tracking-tight inline-flex items-center gap-2">
      {icon}
      {title}
    </h2>
  );
}

function Field({ label, required, help, children }: { label: React.ReactNode; required?: boolean; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="input-label">{label}{required && <span className="text-[#4F6BFF] ml-0.5">*</span>}</label>
      {children}
      {help && <p className="text-[11.5px] text-muted-foreground mt-1">{help}</p>}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="input-label">{label}</label>
      <input value={value} disabled className="input opacity-60 cursor-not-allowed tabular-nums" />
    </div>
  );
}

function Row({ k, v, accent, bold }: { k: string; v: string; accent?: string; bold?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 text-[13px]', bold && 'font-bold text-[14px]')}>
      <span className="text-muted-foreground">{k}</span>
      <span className={cn('tabular-nums font-semibold', accent || 'text-foreground')}>{v}</span>
    </div>
  );
}

// ─── Cost row in the wizard ─────────────────────────────────

function CostRow({ cost, onChange, onChangeName, onRemove }: {
  cost: CostEntry;
  onChange: <K extends keyof CostEntry>(field: K, value: CostEntry[K]) => void;
  onChangeName: (name: string) => void;
  onRemove: () => void;
}) {
  const isHaushaltsstrom = /haushaltsstrom|haushaltstrom/i.test(cost.name);
  return (
    <div className={cn(
      'p-3 rounded-xl border space-y-2',
      cost.umlagefaehig ? 'border-card-line bg-card' : 'border-rose-200 bg-rose-50/40',
    )}>
      <div className="flex items-start gap-2">
        <input
          value={cost.name}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="Bezeichnung (z. B. Müllabfuhr)"
          className="input input-sm flex-1 font-medium"
        />
        <button onClick={onRemove} className="size-8 rounded-md hover:bg-rose-50 hover:text-rose-600 text-muted-foreground flex items-center justify-center cursor-pointer transition-colors" aria-label="Entfernen">
          <Trash2 size={13} />
        </button>
      </div>
      {isHaushaltsstrom && cost.umlagefaehig && (
        <div className="px-2 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-1.5">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          Individueller Haushaltsstrom ist nicht umlagefähig — bitte umstellen.
        </div>
      )}
      <div className="grid grid-cols-[1fr_120px] gap-2">
        <input
          value={cost.provider}
          onChange={(e) => onChange('provider', e.target.value)}
          placeholder="Versorger / Anbieter"
          className="input input-sm"
        />
        <NumberInput
          value={cost.totalCost || ''}
          onChange={(v) => onChange('totalCost', v === '' ? 0 : v)}
          suffix="€"
          decimals={2}
          placeholder="0,00"
          className="input input-sm"
        />
      </div>
      <select
        value={cost.distributionKey}
        onChange={(e) => onChange('distributionKey', e.target.value as DistributionKey)}
        className="input input-sm"
      >
        {(Object.keys(KEY_LABEL) as DistributionKey[]).map((k) => (
          <option key={k} value={k}>{KEY_LABEL[k]} — {KEY_HINT[k]}</option>
        ))}
      </select>

      {/* Optional: Per-Position Schlüssel-Override (Untergemeinschaften) —
          z.B. "Hausmeister UG A: 18550/340" statt globalem MEA */}
      <details className="text-[11.5px]">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
          Eigener Schlüssel für diese Position (Untergemeinschaft)
        </summary>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10.5px] text-muted-foreground mb-1">Gesamt</label>
            <NumberInput
              value={cost.entryTotal ?? ''}
              onChange={(v) => onChange('entryTotal', v === '' ? undefined : v)}
              decimals={2}
              placeholder="z. B. 76500"
              className="input input-sm"
            />
          </div>
          <div>
            <label className="block text-[10.5px] text-muted-foreground mb-1">Eigen</label>
            <NumberInput
              value={cost.entryOwn ?? ''}
              onChange={(v) => onChange('entryOwn', v === '' ? undefined : v)}
              decimals={2}
              placeholder="z. B. 340"
              className="input input-sm"
            />
          </div>
          <div>
            <label className="block text-[10.5px] text-muted-foreground mb-1">Gruppe</label>
            <input
              value={cost.entryGroup ?? ''}
              onChange={(e) => onChange('entryGroup', e.target.value || undefined)}
              placeholder="z. B. UG A"
              className="input input-sm"
            />
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px]">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={cost.umlagefaehig} onChange={(e) => onChange('umlagefaehig', e.target.checked)} />
          <span className={cost.umlagefaehig ? 'text-foreground font-medium' : 'text-rose-700 font-medium'}>
            {cost.umlagefaehig ? 'Umlagefähig' : 'Nicht umlagefähig'}
          </span>
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer" title="Hausnahe Dienstleistungen / Handwerker — anrechenbar nach §35a EStG">
          <input type="checkbox" checked={cost.steuerlichAbsetzbar} onChange={(e) => onChange('steuerlichAbsetzbar', e.target.checked)} />
          <span className="text-muted-foreground">§35a EStG</span>
        </label>
        {cost.steuerlichAbsetzbar && (
          <>
            <select
              value={cost.steuerKategorie ?? 'dienstleistung'}
              onChange={(e) => onChange('steuerKategorie', e.target.value as 'dienstleistung' | 'handwerker')}
              className="input input-sm w-[148px]"
            >
              <option value="dienstleistung">Dienstleistung</option>
              <option value="handwerker">Handwerker</option>
            </select>
            <span className="inline-flex items-center gap-1">
              <span className="text-muted-foreground">Lohnanteil</span>
              <NumberInput
                value={cost.lohnAnteil ?? 100}
                onChange={(v) => onChange('lohnAnteil', v === '' ? undefined : v)}
                decimals={0}
                suffix="%"
                className="input input-sm w-[78px]"
              />
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── A4 PDF Documents ────────────────────────────────────────

import type { Tenant, RentalUnit, RentalProperty } from '../../types';
import type { LandlordSettings } from '../../hooks/useLandlordSettings';

type ComputedCost = CostEntry & {
  shareValue: number;
  schluesselFormatted: string;
  schluesselFullText: string;
  fullYearAmount: number;
  tenantAmount: number;
};

interface PdfDocProps {
  tenant: Tenant;
  unit: RentalUnit;
  property: RentalProperty;
  landlord: LandlordSettings;
  periodFrom: string;
  periodTo: string;
  usageFrom: string;
  usageTo: string;
  daysInPeriod: number;
  daysOfUsage: number;
  isPartialPeriod: boolean;
  computed: ComputedCost[];
  allocatable: ComputedCost[];
  nonAllocatable: ComputedCost[];
  totalAllocSum: number;
  totalNonAllocSum: number;
  tenantTotal: number;
  yearlyAdvance: number;
  difference: number;
  tax35aTotal: number;
  tenantArea: number;
  totalArea: number;
  advancesText: string;
  fmt: (n: number) => string;
  fmtDate: (d: string) => string;
}

/**
 * Hauptdokument: Betriebskostenabrechnung im 5-Spalten-Tabellen-Layout
 * (Beispiel-vorlagen-konform). Jede Zeile zeigt:
 *   Kontobezeichnung | Gesamtkosten | Umlageschlüssel | Umlageanteil gesamt | Ihr Umlageanteil
 *
 * Plus Erklärungs-Block + §35a-EStG-Detailliste am Ende.
 */
const PdfDocument = forwardRef<HTMLDivElement, PdfDocProps>(function PdfDocument(props, ref) {
  const {
    tenant, unit, property, landlord,
    periodFrom, periodTo, usageFrom, usageTo, daysInPeriod, daysOfUsage,
    allocatable, totalAllocSum, tenantTotal,
    yearlyAdvance, difference, advancesText, fmt, fmtDate,
  } = props;

  const year = new Date(periodFrom).getFullYear();

  // Periode-Datums-Strings im Format "01.01.2024 bis 31.12.2024 = 366 Tage"
  const periodLine = `${fmtDate(periodFrom)} bis ${fmtDate(periodTo)} = ${daysInPeriod} Tage`;
  const usageLine = `${fmtDate(usageFrom)} bis ${fmtDate(usageTo)} = ${daysOfUsage} Tage`;

  // Address-Header: "PLZ Stadt, Property-Name, Straße, Wohnung"
  // Wir extrahieren PLZ + Stadt aus property.address (heuristisch — letzter Teil).
  const addressBits: string[] = [];
  if (property.address) addressBits.push(property.address);
  if (property.name && property.name !== property.address) addressBits.push(property.name);
  if (unit.name) addressBits.push(unit.name);

  // Eigentümer-Header (User selbst)
  const ownerName = landlord.signatureName || landlord.contactName || landlord.companyName || '';

  // Gruppierung der §35a-EStG-Einträge — pro Schlüssel-Gruppe ein Eintrag
  // (Dienstl./Handwerker × Schlüssel). Format wie im Beispiel:
  // "Lohnant. HHn Dienstl. insges. EUR 6.718,80, Ihr Anteil n. Miteig. umlagefähig 29,56 €"
  const tax35aLines = useMemo(() => {
    const entries = allocatable.filter((c) => c.steuerlichAbsetzbar && (c.lohnAnteil ?? 100) > 0);
    return entries.map((c) => {
      const lohnFraction = (c.lohnAnteil ?? 100) / 100;
      const totalLohn = c.totalCost * lohnFraction;
      const ownLohn = c.tenantAmount * lohnFraction;
      const kindLabel = c.steuerKategorie === 'handwerker' ? 'HHn Handw.Lstg.' : 'HHn Dienstl.';
      const schluesselShortName =
        c.distributionKey === 'mea' ? 'MEA' :
        c.distributionKey === 'flaeche' ? 'Wohnfläche' :
        c.distributionKey === 'einheiten' ? 'Wohneinheit' :
        c.distributionKey === 'personen' ? 'Personenzahl' :
        c.distributionKey === 'verbrauch' ? 'Ext. Abrechnung' :
        c.distributionKey === 'stellplatz' ? 'Stellplatz' :
        'Sonstiger Schlüssel';
      const groupSuffix = c.entryGroup ? ` ${c.entryGroup}` : '';
      return {
        line: `Lohnant. ${kindLabel} insges. EUR ${fmt(totalLohn)}, Ihr Anteil n. ${schluesselShortName}${groupSuffix} umlagefähig`,
        amount: ownLohn,
      };
    });
  }, [allocatable, fmt]);

  // Erklärungs-Liste der Schlüssel (eindeutig, deduplizieren)
  const explanationLines = useMemo(() => {
    const seen = new Set<string>();
    const lines: string[] = [];
    allocatable.forEach((c) => {
      if (!c.schluesselFormatted || c.schluesselFormatted === '—') return;
      const key = `${c.schluesselFormatted}|${c.schluesselFullText}`;
      if (seen.has(key)) return;
      seen.add(key);
      lines.push(`${c.schluesselFormatted} = ${c.schluesselFullText}`);
    });
    return lines;
  }, [allocatable]);

  return (
    <div
      ref={ref}
      className="nk-doc"
      style={{
        width: '794px',
        minHeight: '1123px',
        background: '#ffffff',
        color: '#0f172a',
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        padding: '50px 50px 40px',
        boxShadow: '0 4px 24px rgba(15,23,42,0.10)',
        position: 'relative',
        fontSize: '10.5px',
        lineHeight: 1.4,
      }}
    >
      {/* Title */}
      <h1 style={{ fontSize: '17px', fontWeight: 700, margin: 0, marginBottom: '24px' }}>
        Betriebskostenabrechnung {year}
      </h1>

      {/* Address header — exakt wie im Beispiel:
          "60318 Frankfurt, Projekt Marie, Nordendstr. 44, A2.4
           Familie Zimmermann
           Mieter: Familie Kloc" */}
      <div style={{ marginBottom: '20px', fontSize: '11px', lineHeight: 1.45 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{addressBits.join(', ')}</p>
        {ownerName && <p style={{ margin: '2px 0 0' }}>{ownerName}</p>}
        <p style={{ margin: '6px 0 0', fontWeight: 600 }}>Mieter: {tenant.name}</p>
      </div>

      {/* Zeitraum-Zeilen */}
      <div style={{ marginBottom: '14px', fontSize: '11px', fontWeight: 600 }}>
        <p style={{ margin: 0 }}>Abrechnungszeitraum: {periodLine}</p>
        <p style={{ margin: '2px 0 0' }}>Ihr Abrechnungszeitraum: {usageLine}</p>
      </div>

      {/* 5-Spalten-Tabelle (Beispiel-Format) */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '12px' }}>
        <thead>
          <tr style={{ borderTop: '1px solid #0f172a', borderBottom: '1px solid #0f172a' }}>
            <th style={{ ...thStyle, textAlign: 'left' }}>Kontobezeichnung</th>
            <th style={thStyle}>Gesamtkosten €</th>
            <th style={{ ...thStyle, textAlign: 'left' }}>Umlageschlüssel</th>
            <th style={thStyle}>
              Umlageanteil {year} gesamt €<br />
              <span style={{ fontWeight: 400, fontSize: '8.5px' }}>{daysInPeriod} Tage</span>
            </th>
            <th style={thStyle}>
              Ihr Umlageanteil €<br />
              <span style={{ fontWeight: 400, fontSize: '8.5px' }}>{daysOfUsage} Tage</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {allocatable.map((c) => (
            <tr key={c.id}>
              <td style={tdStyle}>
                {c.name}
                {c.entryGroup && <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {c.entryGroup}</span>}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {fmt(c.totalCost)} €
              </td>
              <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                {c.schluesselFormatted}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {fmt(c.fullYearAmount)} €
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {fmt(c.tenantAmount)} €
              </td>
            </tr>
          ))}

          {/* Abrechnungsgesamtsumme */}
          <tr style={{ borderTop: '1px solid #0f172a' }}>
            <td style={{ ...tdStyle, fontWeight: 700 }}>Abrechnungsgesamtsumme:</td>
            <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
              {fmt(totalAllocSum)} €
            </td>
            <td style={{ ...tdStyle, fontWeight: 700 }}>Anteil Eigentümer:</td>
            <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
              {fmt(tenantTotal)} €
            </td>
            <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
              <span style={{ fontWeight: 700 }}>Ihr Anteil:</span>{' '}{fmt(tenantTotal)} €
            </td>
          </tr>

          {/* Vorauszahlungen */}
          <tr>
            <td style={{ ...tdStyle, fontWeight: 700 }}>Angeforderte Vorauszahlungen</td>
            <td colSpan={3} style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
              {advancesText || '—'}
            </td>
            <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
              {fmt(yearlyAdvance)} €
            </td>
          </tr>

          {/* Nachzahlung / Guthaben */}
          <tr style={{ background: '#f8fafc' }}>
            <td style={{ ...tdStyle, fontWeight: 700 }}>
              {difference > 0 ? 'Ihre Nachzahlung:' : 'Ihr Guthaben:'}
            </td>
            <td colSpan={3} style={tdStyle} />
            <td style={{
              ...tdStyle,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              color: difference > 0 ? '#dc2626' : '#16a34a',
              fontSize: '11px',
            }}>
              {difference > 0 ? '−' : ''}{fmt(Math.abs(difference))} €
            </td>
          </tr>
        </tbody>
      </table>

      {/* Erklärungs-Block (Beispiel: "Sie können Ihre Umlageberechnung wie folgt nachvollziehen:") */}
      <div style={{ marginTop: '24px', fontSize: '10px', lineHeight: 1.5 }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Sie können Ihre Umlageberechnung wie folgt nachvollziehen:</p>
        {explanationLines.map((line, i) => (
          <p key={i} style={{ margin: '3px 0 0', fontVariantNumeric: 'tabular-nums' }}>{line}</p>
        ))}
      </div>

      {/* §35a-EStG-Detailblock — pro Schlüsselgruppe eine Zeile (Beispiel-Format) */}
      {tax35aLines.length > 0 && (
        <div style={{ marginTop: '20px', fontSize: '10px', lineHeight: 1.5 }}>
          {tax35aLines.map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '1px 0' }}>
              <span style={{ flex: 1 }}>{row.line}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {fmt(row.amount)} €
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer: Erstellt am — diskret unten */}
      <p style={{ marginTop: '32px', fontSize: '9px', color: '#94a3b8', textAlign: 'right' }}>
        Erstellt am {new Date().toLocaleDateString('de-DE')} · {ownerName || 'Vermieter'}
      </p>
    </div>
  );
});

const thStyle: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: '9.5px',
  fontWeight: 700,
  textAlign: 'right',
  verticalAlign: 'top',
};
const tdStyle: React.CSSProperties = {
  padding: '5px 8px',
  fontSize: '10px',
  borderBottom: '1px solid #f1f5f9',
};

// ─── Cover Letter (Anschreiben) ────────────────────────────

interface LetterDocProps {
  tenant: Tenant;
  unit: RentalUnit;
  property: RentalProperty;
  landlord: LandlordSettings;
  periodFrom: string;
  periodTo: string;
  letterDate: string;
  paymentDueDate: string;
  salutation: string;
  body: string;
  difference: number;
  fmt: (n: number) => string;
  fmtDate: (d: string) => string;
}

/**
 * Anschreiben (Cover Letter) für die Nebenkostenabrechnung.
 * Nutzt das einheitliche `BriefLayout` (gleiches Format wie alle anderen
 * Anschreiben: Mieterhöhung, Mahnung, Kündigung, Vorauszahlungs-Anpassung).
 *
 * Variablen werden im Body interpoliert: {nachzahlung}, {guthaben}, {betrag},
 * {datum}, {falligDatum}, {jahr}, {zeitraum}, {mieter}, {wohnung}, {objekt}.
 */
const LetterDocument = forwardRef<HTMLDivElement, LetterDocProps>(function LetterDocument(props, ref) {
  const {
    tenant, unit, property, landlord,
    periodFrom, periodTo, letterDate, paymentDueDate,
    salutation, body, difference, fmt, fmtDate,
  } = props;

  const year = new Date(periodFrom).getFullYear();
  const isNach = difference > 0;
  const betrag = `${fmt(Math.abs(difference))} €`;

  // Body-Variablen ersetzen
  const filledBody = (body || '')
    .replace(/{nachzahlung}/g, isNach ? betrag : '—')
    .replace(/{guthaben}/g, !isNach ? betrag : '—')
    .replace(/{betrag}/g, betrag)
    .replace(/{datum}/g, fmtDate(letterDate))
    .replace(/{falligDatum}/g, fmtDate(paymentDueDate))
    .replace(/{jahr}/g, String(year))
    .replace(/{zeitraum}/g, `${fmtDate(periodFrom)} – ${fmtDate(periodTo)}`)
    .replace(/{mieter}/g, tenant.name)
    .replace(/{wohnung}/g, unit.name)
    .replace(/{objekt}/g, property.name || property.address);

  return (
    <BriefLayout
      ref={ref}
      landlord={landlord}
      letterDate={letterDate}
      recipient={{
        name: tenant.name,
        street: property.address,
        cityLine: unit.name,
      }}
      subject={{
        lines: [
          property.name && property.name !== property.address ? property.name : '',
          `${property.address}${unit.name ? `, ${unit.name}` : ''}`,
          `Betriebskostenabrechnung ${fmtDate(periodFrom)} – ${fmtDate(periodTo)}`,
        ].filter(Boolean),
      }}
      salutation={salutation || `Sehr geehrte/r ${tenant.name},`}
    >
      {filledBody.split('\n').map((p, i) => (
        <p key={i} style={{ margin: '0 0 12px' }}>{p}</p>
      ))}
    </BriefLayout>
  );
});
