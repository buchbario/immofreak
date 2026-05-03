import { useState, useMemo } from 'react';
import {
  Download, X, Users, Building2, TrendingUp, Wallet, PieChart, Receipt,
  AlertTriangle, FileText, Shield, Landmark, FileSpreadsheet, Scale, Calculator,
} from 'lucide-react';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useTenants } from '../../hooks/useTenants';
import { useRentalContracts } from '../../hooks/useRentalContracts';
import { useUtilities } from '../../hooks/useUtilities';
import { useTenantPayments } from '../../hooks/useTenantPayments';
import { useExpenses } from '../../hooks/useExpenses';
import { useLandlordSettings } from '../../hooks/useLandlordSettings';
import { buildDatevPreview, buildDatevSummary, downloadDatevCsv } from '../../lib/datevExport';
import jsPDF from 'jspdf';

const fmtInt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
const fmt2 = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('de-DE') : '—';

type Section = 'verwaltung' | 'rendite' | 'finanzen' | 'steuer' | 'buchhaltung' | 'compliance';

interface ReportDef {
  id: string;
  name: string;
  description: string;
  legalRef?: string;
  icon: typeof Users;
  section: Section;
}

const REPORTS: ReportDef[] = [
  // Verwaltung & Mieter
  { id: 'mieterliste', name: 'Mieterliste', description: 'Alle Mieter mit Kontaktdaten, Objekt und Mietbeginn.', icon: Users, section: 'verwaltung' },
  { id: 'vertraege', name: 'Vertragsübersicht', description: 'Alle Mietverträge inkl. Laufzeit, Kündigungsfrist, Kaution, Warm-/Kaltmiete.', legalRef: '§§ 535, 542 BGB', icon: FileText, section: 'verwaltung' },
  { id: 'rueckstaende', name: 'Mietrückstände', description: 'Offene Forderungen je Mieter mit Verzugsdauer und Kündigungsindikator.', legalRef: '§§ 286, 543 Abs. 2 Nr. 3 BGB', icon: AlertTriangle, section: 'verwaltung' },

  // Objekte & Rendite
  { id: 'objektuebersicht', name: 'Objektübersicht', description: 'Alle Immobilien mit Einheiten, Belegung, Miete und Bruttorendite.', icon: Building2, section: 'rendite' },
  { id: 'rendite', name: 'Rendite-Bericht', description: 'Brutto-/Nettomietrendite, Mietmultiplikator, Cashflow-Rendite je Objekt.', icon: TrendingUp, section: 'rendite' },
  { id: 'leerstand', name: 'Leerstandsquote', description: 'Aktuelle Leerstandsquote nach Einheiten und nach Fläche je Objekt.', icon: PieChart, section: 'rendite' },

  // Finanzen
  { id: 'mieteinnahmen', name: 'Mieteinnahmen', description: 'Soll/Ist-Vergleich Miete pro Monat über 12 Monate.', icon: Wallet, section: 'finanzen' },
  { id: 'cashflow', name: 'Cashflow-Bericht', description: 'Operativer Cashflow — Einnahmen (Miete+NK) abzgl. Ausgaben pro Monat.', icon: Landmark, section: 'finanzen' },
  { id: 'nebenkosten', name: 'Nebenkostenübersicht', description: '17 Kostenarten nach BetrKV § 2, getrennt nach umlagefähig/nicht umlagefähig.', legalRef: '§ 556 BGB · BetrKV § 2 · HeizkostenV', icon: Receipt, section: 'finanzen' },

  // Steuer
  { id: 'anlage-v', name: 'Anlage V (Steuer)', description: 'Einnahmen und Werbungskosten aus Vermietung + AfA für die Steuererklärung.', legalRef: '§ 21 EStG · Anlage V 2025', icon: FileSpreadsheet, section: 'steuer' },
  { id: 'afa', name: 'AfA-Bericht', description: 'Lineare Gebäude-Absetzung je Objekt nach Baujahr (2 %, 2,5 % oder 3 %).', legalRef: '§ 7 Abs. 4 EStG', icon: Scale, section: 'steuer' },

  // Buchhaltung
  { id: 'datev-export', name: 'DATEV-Export', description: 'Buchungsstapel im DATEV-Format (EXTF 700) für Steuerberater-Import — SKR03-Konten, Soll/Haben, Kostenstellen, GoBD-konform.', legalRef: '§ 147 AO · GoBD · DATEV-Format v7.00', icon: Calculator, section: 'buchhaltung' },

  // Compliance
  { id: 'kaution', name: 'Kautionsübersicht', description: 'Alle Kautionen mit 3-Monatsmieten-Obergrenze, Anlagepflicht und Rückzahlungsfristen.', legalRef: '§§ 551, 548 BGB', icon: Shield, section: 'compliance' },
];

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'verwaltung', label: 'Verwaltung & Mieter' },
  { key: 'rendite', label: 'Objekte & Rendite' },
  { key: 'finanzen', label: 'Finanzen & Cashflow' },
  { key: 'steuer', label: 'Steuer' },
  { key: 'buchhaltung', label: 'Buchhaltung & DATEV' },
  { key: 'compliance', label: 'Compliance & Nachweise' },
];

export function BerichtePage() {
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allTenants } = useTenants();
  const { allContracts } = useRentalContracts();
  const { allUtilities, allCosts } = useUtilities();
  const { allPayments } = useTenantPayments();
  const { items: expenses } = useExpenses();
  const { settings } = useLandlordSettings();

  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear() - 1);
  const [propertyFilter, setPropertyFilter] = useState<string>('__all__');

  const activeDef = REPORTS.find((r) => r.id === activeReport);
  const selectedProp = properties.find((p) => p.id === propertyFilter);

  // ============ Data computations ============

  // Mieterliste
  const mieterlisteData = useMemo(() => {
    return allTenants.map((t) => {
      const unit = allUnits.find((u) => u.id === t.unitId);
      const prop = properties.find((p) => p.id === t.propertyId);
      return {
        name: t.name, email: t.email, phone: t.phone,
        objekt: prop?.name || '—', einheit: unit?.name || '—',
        einzug: fmtDate(t.moveInDate),
      };
    });
  }, [allTenants, allUnits, properties]);

  // Vertragsübersicht
  const vertraegeData = useMemo(() => {
    return allContracts.map((c) => {
      const tenant = allTenants.find((t) => t.id === c.tenantId);
      const prop = properties.find((p) => p.id === c.propertyId);
      const unit = allUnits.find((u) => u.id === c.unitId);
      const warmmiete = c.rentAmount + c.operatingCosts + c.heatingCosts;
      const maxDeposit = c.rentAmount * 3;
      const depositOk = c.depositAmount <= maxDeposit;
      return {
        mieter: tenant?.name || '—', objekt: prop?.name || '—', einheit: unit?.name || '—',
        startDate: fmtDate(c.startDate), endDate: c.endDate ? fmtDate(c.endDate) : (c.contractType === 'unbefristet' ? 'unbefristet' : '—'),
        kaltmiete: c.rentAmount, nk: c.operatingCosts, heiz: c.heatingCosts, warmmiete,
        kaution: c.depositAmount, kautionGezahlt: c.depositPaid, depositOk,
        kuendigungsfrist: `${c.noticePeriod} Mon.`, zahltag: c.rentPaymentDay,
      };
    });
  }, [allContracts, allTenants, allUnits, properties]);

  // Mietrückstände — Soll per Monat seit Vertragsbeginn vs Ist-Zahlungen
  const rueckstaendeData = useMemo(() => {
    const today = new Date();
    const monthsBetween = (start: Date, end: Date) => {
      const s = new Date(start.getFullYear(), start.getMonth(), 1);
      const e = new Date(end.getFullYear(), end.getMonth(), 1);
      return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1);
    };
    return allTenants.map((t) => {
      const contract = allContracts.find((c) => c.tenantId === t.id);
      const prop = properties.find((p) => p.id === t.propertyId);
      if (!contract) return null;
      const start = new Date(contract.startDate);
      const endRef = contract.endDate ? new Date(contract.endDate) : today;
      const effEnd = endRef < today ? endRef : today;
      const months = monthsBetween(start, effEnd);
      const warmmiete = contract.rentAmount + contract.operatingCosts + contract.heatingCosts;
      const soll = months * warmmiete;
      const ist = allPayments
        .filter((p) => p.tenantId === t.id && (p.type === 'Miete' || p.type === 'Nachzahlung'))
        .reduce((s, p) => s + p.amount, 0);
      const rueckstand = Math.max(0, soll - ist);
      const mietmonate = warmmiete > 0 ? rueckstand / warmmiete : 0;
      const kuendbar = mietmonate >= 2;
      return {
        tenantId: t.id, name: t.name, objekt: prop?.name || '—', warmmiete, soll, ist, rueckstand, mietmonate, kuendbar,
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => r.rueckstand > 0);
  }, [allTenants, allContracts, allPayments, properties]);

  // Objektübersicht
  const objektData = useMemo(() => {
    return properties.map((p) => {
      const units = allUnits.filter((u) => u.propertyId === p.id);
      const rent = units.reduce((s, u) => s + u.currentRent, 0);
      const occupied = units.filter((u) => u.tenantId);
      const rendite = p.purchasePrice > 0 ? ((rent * 12) / p.purchasePrice) * 100 : 0;
      return {
        name: p.name, address: p.address, einheiten: units.length, vermietet: occupied.length,
        miete: rent, rendite, kaufpreis: p.purchasePrice, marktwert: p.currentValue,
      };
    });
  }, [properties, allUnits]);

  // Rendite-Bericht (Brutto/Netto)
  const renditeData = useMemo(() => {
    return properties.map((p) => {
      const units = allUnits.filter((u) => u.propertyId === p.id);
      const jahresKaltmiete = units.reduce((s, u) => s + u.currentRent, 0) * 12;
      // Nicht-umlagefähige Ausgaben aus Expenses + Utilities des letzten Jahres
      const yearStr = String(year);
      const nichtUmlagefaehig = expenses
        .filter((e) => e.propertyId === p.id && e.date.startsWith(yearStr) && !e.isUmlagefaehig)
        .reduce((s, e) => s + e.amount, 0);
      const nettoJahresMiete = jahresKaltmiete - nichtUmlagefaehig;
      const bruttoRendite = p.purchasePrice > 0 ? (jahresKaltmiete / p.purchasePrice) * 100 : 0;
      const nettoRendite = p.purchasePrice > 0 ? (nettoJahresMiete / p.purchasePrice) * 100 : 0;
      const multiplikator = jahresKaltmiete > 0 ? p.purchasePrice / jahresKaltmiete : 0;
      return {
        name: p.name, kaufpreis: p.purchasePrice, marktwert: p.currentValue,
        jahresKaltmiete, nichtUmlagefaehig, nettoJahresMiete,
        bruttoRendite, nettoRendite, multiplikator,
      };
    });
  }, [properties, allUnits, expenses, year]);

  // Leerstandsquote
  const leerstandData = useMemo(() => {
    return properties.map((p) => {
      const units = allUnits.filter((u) => u.propertyId === p.id);
      const totalUnits = units.length;
      const vacantUnits = units.filter((u) => !u.tenantId).length;
      const totalArea = units.reduce((s, u) => s + u.area, 0);
      const vacantArea = units.filter((u) => !u.tenantId).reduce((s, u) => s + u.area, 0);
      const losMonat = units.filter((u) => !u.tenantId).reduce((s, u) => s + u.targetRent, 0);
      return {
        name: p.name, totalUnits, vacantUnits,
        quoteEinheiten: totalUnits > 0 ? (vacantUnits / totalUnits) * 100 : 0,
        totalArea, vacantArea,
        quoteFlaeche: totalArea > 0 ? (vacantArea / totalArea) * 100 : 0,
        mietausfall: losMonat,
      };
    });
  }, [properties, allUnits]);

  // Mieteinnahmen (12 Monate)
  const mieteinnahmenData = useMemo(() => {
    const months: { month: string; soll: number; ist: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const soll = allUnits.filter((u) => u.tenantId).reduce((s, u) => s + u.currentRent, 0);
      const ist = allPayments
        .filter((p) => p.type === 'Miete' && p.date.startsWith(monthKey))
        .reduce((s, p) => s + p.amount, 0);
      months.push({ month: monthStr, soll, ist });
    }
    return months;
  }, [allUnits, allPayments]);

  // Cashflow-Bericht — 12 Monate Einnahmen (Zahlungen) vs Ausgaben (Expenses)
  const cashflowData = useMemo(() => {
    const months: { month: string; einnahmen: number; ausgaben: number; saldo: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const einnahmen = allPayments
        .filter((p) => (p.type === 'Miete' || p.type === 'Nachzahlung') && p.date.startsWith(monthKey))
        .reduce((s, p) => s + p.amount, 0);
      const ausgaben = expenses.filter((e) => e.date.startsWith(monthKey)).reduce((s, e) => s + e.amount, 0);
      months.push({
        month: d.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' }),
        einnahmen, ausgaben, saldo: einnahmen - ausgaben,
      });
    }
    return months;
  }, [allPayments, expenses]);

  // Nebenkostenübersicht — BetrKV § 2 Kategorien des gewählten Jahres
  const nebenkostenData = useMemo(() => {
    const filterProp = propertyFilter === '__all__' ? null : propertyFilter;
    const yearCosts = allCosts.filter((c) => c.year === year && (!filterProp || c.propertyId === filterProp));
    // Utility-Kategorien → BetrKV-Kategorien mapping
    const mapped: Record<string, { umlagefaehig: boolean; betrag: number; kategorie: string }> = {};
    const add = (key: string, betrag: number, umlagefaehig: boolean, kategorie: string) => {
      if (!mapped[key]) mapped[key] = { umlagefaehig, betrag: 0, kategorie };
      mapped[key].betrag += betrag;
    };
    yearCosts.forEach((c) => {
      const u = allUtilities.find((x) => x.id === c.utilityId);
      if (!u) return;
      switch (u.type) {
        case 'Grundsteuer': add('Grundsteuer', c.totalCost, true, 'BetrKV § 2 Nr. 1'); break;
        case 'Wasser': add('Wasser (inkl. Entwässerung)', c.totalCost, true, 'BetrKV § 2 Nr. 2 + 3'); break;
        case 'Heizung': add('Heizung + Warmwasser', c.totalCost, true, 'BetrKV § 2 Nr. 4/5 + HeizkV'); break;
        case 'Gas': add('Heizung + Warmwasser', c.totalCost, true, 'BetrKV § 2 Nr. 4/5 + HeizkV'); break;
        case 'Müllabfuhr': add('Müll- und Straßenreinigung', c.totalCost, true, 'BetrKV § 2 Nr. 8'); break;
        case 'Strom': add('Allgemeinstrom (Beleuchtung)', c.totalCost, true, 'BetrKV § 2 Nr. 11'); break;
        case 'Versicherung': add('Sach- und Haftpflichtversicherung', c.totalCost, true, 'BetrKV § 2 Nr. 13'); break;
        case 'Hausverwaltung': add('Hausverwaltung', c.totalCost, false, '§ 1 Abs. 2 Nr. 1 BetrKV — nicht umlagefähig'); break;
        case 'Internet': add('Internet/Kabel', c.totalCost, true, 'BetrKV § 2 Nr. 15 (bis 30.06.2024 als Nk; ab dann § 71a TKG)'); break;
        default: add('Sonstige Betriebskosten', c.totalCost, true, 'BetrKV § 2 Nr. 17');
      }
    });
    // Zusätzlich Ausgaben aus Expenses
    expenses.filter((e) => e.date.startsWith(String(year)) && (!filterProp || e.propertyId === filterProp)).forEach((e) => {
      const cat = e.isUmlagefaehig ? `${e.category} (umlagefähig)` : `${e.category} (Instandhaltung/Eigentümer)`;
      add(cat, e.amount, e.isUmlagefaehig, e.category === 'Hausgeld' ? 'WEG-Hausgeld' : '');
    });
    return Object.entries(mapped).map(([key, v]) => ({ kategorie: key, betrag: v.betrag, umlagefaehig: v.umlagefaehig, note: v.kategorie }));
  }, [allCosts, allUtilities, expenses, year, propertyFilter]);

  // Anlage V — Einnahmen + Werbungskosten + AfA
  const anlageVData = useMemo(() => {
    const filterProp = propertyFilter === '__all__' ? null : propertyFilter;
    const relProps = filterProp ? properties.filter((p) => p.id === filterProp) : properties;
    // Einnahmen: tatsächlich im Jahr eingegangene Zahlungen (Zufluss-Prinzip § 11 EStG)
    const mietEinnahmen = allPayments
      .filter((p) => p.date.startsWith(String(year)) && (p.type === 'Miete' || p.type === 'Nachzahlung') && (!filterProp || p.propertyId === filterProp))
      .reduce((s, p) => s + p.amount, 0);
    const nkUmlagen = allPayments
      .filter((p) => p.date.startsWith(String(year)) && p.type === 'Nachzahlung' && (!filterProp || p.propertyId === filterProp))
      .reduce((s, p) => s + p.amount, 0);
    // Werbungskosten (Ausgaben im Jahr)
    const jahrExpenses = expenses.filter((e) => e.date.startsWith(String(year)) && (!filterProp || e.propertyId === filterProp));
    const byCat = (cat: string) => jahrExpenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
    const grundsteuer = byCat('Grundsteuer');
    const versicherung = byCat('Versicherung');
    const verwaltung = byCat('Verwaltung');
    const instandhaltung = byCat('Instandhaltung');
    const hausgeld = byCat('Hausgeld');
    const sonstiges = byCat('Sonstiges');
    // AfA: für jedes Objekt berechnen
    const afa = relProps.reduce((s, p) => {
      const build = p.purchasePrice * 0.8; // Default 80% Gebäudeanteil (Bodenrichtwert muss individuell geprüft werden)
      const y = p.purchaseDate ? new Date(p.purchaseDate).getFullYear() : 0;
      const rate = y >= 2023 ? 0.03 : y >= 1925 ? 0.02 : 0.025;
      return s + build * rate;
    }, 0);
    const werbungskosten = grundsteuer + versicherung + verwaltung + instandhaltung + hausgeld + sonstiges + afa;
    const einkunefte = mietEinnahmen - werbungskosten;
    return {
      mietEinnahmen, nkUmlagen,
      grundsteuer, versicherung, verwaltung, instandhaltung, hausgeld, sonstiges, afa,
      werbungskosten, einkunefte,
    };
  }, [properties, expenses, allPayments, year, propertyFilter]);

  // AfA-Bericht
  const afaData = useMemo(() => {
    return properties.map((p) => {
      const build = p.purchasePrice * 0.8;
      const land = p.purchasePrice - build;
      const y = p.purchaseDate ? new Date(p.purchaseDate).getFullYear() : 0;
      const rate = y >= 2023 ? 3 : y >= 1925 ? 2 : 2.5;
      const annualAfa = build * (rate / 100);
      return {
        name: p.name, kaufpreis: p.purchasePrice, purchaseYear: y || '—',
        gebaeudeanteil: build, bodenanteil: land, rate, annualAfa,
        afaMonat: annualAfa / 12,
      };
    });
  }, [properties]);

  // Kautionsübersicht
  const kautionData = useMemo(() => {
    return allContracts.map((c) => {
      const tenant = allTenants.find((t) => t.id === c.tenantId);
      const prop = properties.find((p) => p.id === c.propertyId);
      const max = c.rentAmount * 3;
      const overLimit = c.depositAmount > max;
      const daysSinceEnd = c.endDate ? Math.max(0, Math.floor((Date.now() - new Date(c.endDate).getTime()) / 86400000)) : null;
      return {
        mieter: tenant?.name || '—', objekt: prop?.name || '—',
        kaltmiete: c.rentAmount, kaution: c.depositAmount, max,
        gezahlt: c.depositPaid, gezahltAm: fmtDate(c.depositPaidDate),
        overLimit,
        vertragsende: c.endDate ? fmtDate(c.endDate) : '—',
        verjaehrungstage: daysSinceEnd,
      };
    });
  }, [allContracts, allTenants, properties]);

  // DATEV-Export Daten
  const datevInput = useMemo(() => ({
    year,
    payments: allPayments,
    expenses,
    properties,
    tenants: allTenants,
    units: allUnits,
    propertyFilter,
    beraterNr: settings.taxId?.replace(/\D/g, '').padStart(7, '0').slice(-7) || '0000000',
    mandantNr: '00001',
    bezeichnung: `Vermietung ${year}`,
  }), [year, allPayments, expenses, properties, allTenants, allUnits, propertyFilter, settings.taxId]);
  const datevPreview = useMemo(() => buildDatevPreview(datevInput), [datevInput]);
  const datevSummary = useMemo(() => buildDatevSummary(datevInput), [datevInput]);

  // ============ Export helpers ============
  const addHeader = (doc: jsPDF, title: string, legalRef?: string) => {
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(title, 20, 20);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
    doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, 20, 27);
    if (legalRef) doc.text(`Rechtsgrundlage: ${legalRef}`, 20, 32);
    if (settings.companyName) doc.text(`${settings.companyName}${settings.taxId ? ` · St-Nr. ${settings.taxId}` : ''}`, 20, 37);
    doc.setTextColor(30);
    return 46;
  };
  const addRows = (doc: jsPDF, headers: string[], rows: (string | number)[][], colX: number[], startY: number) => {
    let y = startY;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    headers.forEach((h, i) => doc.text(h, colX[i], y));
    y += 5;
    doc.setFont('helvetica', 'normal');
    rows.forEach((row) => {
      if (y > 270) { doc.addPage(); y = 20; }
      row.forEach((v, i) => doc.text(String(v).substring(0, 35), colX[i], y));
      y += 5;
    });
    return y;
  };

  const handlePDFExport = () => {
    if (!activeDef) return;
    const doc = new jsPDF();
    const y0 = addHeader(doc, activeDef.name, activeDef.legalRef);

    if (activeReport === 'mieterliste') {
      addRows(doc, ['Name', 'E-Mail', 'Telefon', 'Objekt', 'Einheit'], mieterlisteData.map((r) => [r.name, r.email, r.phone, r.objekt, r.einheit]), [20, 55, 95, 130, 165], y0);
    } else if (activeReport === 'vertraege') {
      addRows(doc, ['Mieter', 'Objekt', 'Start', 'Ende', 'Kalt', 'Warm', 'Kaution'], vertraegeData.map((r) => [r.mieter, r.objekt, r.startDate, r.endDate, fmt2(r.kaltmiete), fmt2(r.warmmiete), fmt2(r.kaution)]), [20, 55, 90, 115, 140, 160, 180], y0);
    } else if (activeReport === 'rueckstaende') {
      addRows(doc, ['Mieter', 'Objekt', 'Soll', 'Ist', 'Rückstand', 'Mon.'], rueckstaendeData.map((r) => [r.name, r.objekt, fmt2(r.soll), fmt2(r.ist), fmt2(r.rueckstand), r.mietmonate.toFixed(1)]), [20, 60, 95, 120, 145, 180], y0);
    } else if (activeReport === 'objektuebersicht') {
      addRows(doc, ['Objekt', 'Adresse', 'Einheiten', 'Miete/M', 'Rendite'], objektData.map((r) => [r.name, r.address.substring(0, 30), `${r.vermietet}/${r.einheiten}`, `${fmtInt(r.miete)} EUR`, `${r.rendite.toFixed(1)}%`]), [20, 55, 110, 140, 170], y0);
    } else if (activeReport === 'rendite') {
      addRows(doc, ['Objekt', 'Kaufpreis', 'Jahresmiete', 'Brutto %', 'Netto %', 'Mult.'], renditeData.map((r) => [r.name, fmtInt(r.kaufpreis), fmtInt(r.jahresKaltmiete), r.bruttoRendite.toFixed(2), r.nettoRendite.toFixed(2), r.multiplikator.toFixed(1)]), [20, 60, 95, 130, 155, 180], y0);
    } else if (activeReport === 'leerstand') {
      addRows(doc, ['Objekt', 'WE gesamt', 'WE leer', '% WE', '% Fläche', 'Ausfall/M'], leerstandData.map((r) => [r.name, r.totalUnits, r.vacantUnits, r.quoteEinheiten.toFixed(1), r.quoteFlaeche.toFixed(1), fmtInt(r.mietausfall)]), [20, 70, 100, 125, 150, 175], y0);
    } else if (activeReport === 'mieteinnahmen') {
      addRows(doc, ['Monat', 'Soll', 'Ist', 'Differenz'], mieteinnahmenData.map((r) => [r.month, `${fmtInt(r.soll)} EUR`, `${fmtInt(r.ist)} EUR`, `${fmtInt(r.ist - r.soll)} EUR`]), [20, 70, 110, 150], y0);
    } else if (activeReport === 'cashflow') {
      addRows(doc, ['Monat', 'Einnahmen', 'Ausgaben', 'Saldo'], cashflowData.map((r) => [r.month, `${fmtInt(r.einnahmen)}`, `${fmtInt(r.ausgaben)}`, `${fmtInt(r.saldo)}`]), [20, 70, 110, 150], y0);
    } else if (activeReport === 'nebenkosten') {
      addRows(doc, ['Kategorie', 'Betrag', 'Umlagefähig'], nebenkostenData.map((r) => [r.kategorie, `${fmt2(r.betrag)} EUR`, r.umlagefaehig ? 'Ja' : 'Nein']), [20, 110, 160], y0);
    } else if (activeReport === 'anlage-v') {
      const d = anlageVData;
      const rows: [string, string][] = [
        ['Mieteinnahmen (Zufluss § 11 EStG)', `${fmt2(d.mietEinnahmen)} EUR`],
        ['davon Umlagen (Nachzahlung)', `${fmt2(d.nkUmlagen)} EUR`],
        ['Grundsteuer', `${fmt2(d.grundsteuer)} EUR`],
        ['Versicherungen', `${fmt2(d.versicherung)} EUR`],
        ['Verwaltung', `${fmt2(d.verwaltung)} EUR`],
        ['Instandhaltung', `${fmt2(d.instandhaltung)} EUR`],
        ['Hausgeld', `${fmt2(d.hausgeld)} EUR`],
        ['Sonstige Werbungskosten', `${fmt2(d.sonstiges)} EUR`],
        ['AfA (§ 7 Abs. 4 EStG)', `${fmt2(d.afa)} EUR`],
        ['Summe Werbungskosten', `${fmt2(d.werbungskosten)} EUR`],
        ['Einkünfte aus V+V (§ 21 EStG)', `${fmt2(d.einkunefte)} EUR`],
      ];
      addRows(doc, ['Position', 'Betrag'], rows, [20, 130], y0);
    } else if (activeReport === 'afa') {
      addRows(doc, ['Objekt', 'Kaufjahr', 'Kaufpreis', 'Gebäude', 'Rate', 'AfA/J'], afaData.map((r) => [r.name, r.purchaseYear, fmtInt(r.kaufpreis), fmtInt(r.gebaeudeanteil), `${r.rate}%`, fmt2(r.annualAfa)]), [20, 65, 90, 120, 150, 170], y0);
    } else if (activeReport === 'kaution') {
      addRows(doc, ['Mieter', 'Objekt', 'Kaltmiete', 'Kaution', 'Max (3 KM)', 'OK'], kautionData.map((r) => [r.mieter, r.objekt, fmt2(r.kaltmiete), fmt2(r.kaution), fmt2(r.max), r.overLimit ? 'ÜBERSCHREITUNG' : 'OK']), [20, 60, 90, 115, 140, 170], y0);
    } else if (activeReport === 'datev-export') {
      // PDF = Lesbare Summen-/Kontenübersicht; die eigentliche DATEV-Datei ist CSV
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(`Buchungen: ${datevSummary.anzahlBuchungen}`, 20, y0);
      doc.text(`Einnahmen: ${fmt2(datevSummary.einnahmenGesamt)} EUR`, 75, y0);
      doc.text(`Ausgaben: ${fmt2(datevSummary.ausgabenGesamt)} EUR`, 125, y0);
      doc.text(`Saldo: ${fmt2(datevSummary.saldo)} EUR`, 175, y0);
      const y1 = y0 + 10;
      addRows(
        doc,
        ['Konto', 'Bezeichnung', 'Soll', 'Haben', 'Saldo'],
        datevSummary.kontenUebersicht.map((k) => [k.konto, kontoLabel(k.konto).substring(0, 30), fmt2(k.soll), fmt2(k.haben), fmt2(k.saldo)]),
        [20, 45, 110, 140, 170],
        y1
      );
    }

    doc.save(`${activeDef.name}_${year}.pdf`);
  };

  const handleCSVExport = () => {
    if (!activeDef) return;
    // DATEV-Export nutzt sein eigenes Format (EXTF 700) — direkter Download
    if (activeReport === 'datev-export') {
      downloadDatevCsv(datevInput, `EXTF_Buchungsstapel_${year}${propertyFilter !== '__all__' ? '_' + propertyFilter.slice(-6) : ''}.csv`);
      return;
    }
    const rows: string[][] = [];
    if (activeReport === 'mieterliste') {
      rows.push(['Name', 'E-Mail', 'Telefon', 'Objekt', 'Einheit', 'Einzug']);
      mieterlisteData.forEach((r) => rows.push([r.name, r.email, r.phone, r.objekt, r.einheit, r.einzug]));
    } else if (activeReport === 'vertraege') {
      rows.push(['Mieter', 'Objekt', 'Einheit', 'Start', 'Ende', 'Kaltmiete', 'NK', 'Heizung', 'Warmmiete', 'Kaution', 'Kündigungsfrist']);
      vertraegeData.forEach((r) => rows.push([r.mieter, r.objekt, r.einheit, r.startDate, r.endDate, fmt2(r.kaltmiete), fmt2(r.nk), fmt2(r.heiz), fmt2(r.warmmiete), fmt2(r.kaution), r.kuendigungsfrist]));
    } else if (activeReport === 'rueckstaende') {
      rows.push(['Mieter', 'Objekt', 'Warmmiete', 'Soll', 'Ist', 'Rückstand', 'Miet-Monate', 'Kündbar']);
      rueckstaendeData.forEach((r) => rows.push([r.name, r.objekt, fmt2(r.warmmiete), fmt2(r.soll), fmt2(r.ist), fmt2(r.rueckstand), r.mietmonate.toFixed(2), r.kuendbar ? 'Ja' : 'Nein']));
    } else if (activeReport === 'objektuebersicht') {
      rows.push(['Objekt', 'Adresse', 'Einheiten', 'Vermietet', 'Miete/M', 'Rendite %', 'Kaufpreis', 'Marktwert']);
      objektData.forEach((r) => rows.push([r.name, r.address, String(r.einheiten), String(r.vermietet), fmt2(r.miete), r.rendite.toFixed(2), fmt2(r.kaufpreis), fmt2(r.marktwert)]));
    } else if (activeReport === 'rendite') {
      rows.push(['Objekt', 'Kaufpreis', 'Marktwert', 'Jahresmiete', 'Bewirtsch.', 'Netto-JM', 'Brutto %', 'Netto %', 'Multiplikator']);
      renditeData.forEach((r) => rows.push([r.name, fmt2(r.kaufpreis), fmt2(r.marktwert), fmt2(r.jahresKaltmiete), fmt2(r.nichtUmlagefaehig), fmt2(r.nettoJahresMiete), r.bruttoRendite.toFixed(2), r.nettoRendite.toFixed(2), r.multiplikator.toFixed(2)]));
    } else if (activeReport === 'leerstand') {
      rows.push(['Objekt', 'Einheiten', 'Leer', 'Quote % WE', 'Fläche', 'Leere Fläche', 'Quote % Fläche', 'Mietausfall/M']);
      leerstandData.forEach((r) => rows.push([r.name, String(r.totalUnits), String(r.vacantUnits), r.quoteEinheiten.toFixed(2), fmt2(r.totalArea), fmt2(r.vacantArea), r.quoteFlaeche.toFixed(2), fmt2(r.mietausfall)]));
    } else if (activeReport === 'mieteinnahmen') {
      rows.push(['Monat', 'Soll', 'Ist', 'Differenz']);
      mieteinnahmenData.forEach((r) => rows.push([r.month, fmt2(r.soll), fmt2(r.ist), fmt2(r.ist - r.soll)]));
    } else if (activeReport === 'cashflow') {
      rows.push(['Monat', 'Einnahmen', 'Ausgaben', 'Saldo']);
      cashflowData.forEach((r) => rows.push([r.month, fmt2(r.einnahmen), fmt2(r.ausgaben), fmt2(r.saldo)]));
    } else if (activeReport === 'nebenkosten') {
      rows.push(['Kategorie', 'Betrag', 'Umlagefähig', 'Rechtsgrundlage']);
      nebenkostenData.forEach((r) => rows.push([r.kategorie, fmt2(r.betrag), r.umlagefaehig ? 'Ja' : 'Nein', r.note]));
    } else if (activeReport === 'anlage-v') {
      const d = anlageVData;
      rows.push(['Position', 'Betrag']);
      [
        ['Mieteinnahmen (§ 11 EStG Zufluss)', fmt2(d.mietEinnahmen)],
        ['davon Umlagen', fmt2(d.nkUmlagen)],
        ['Grundsteuer', fmt2(d.grundsteuer)],
        ['Versicherung', fmt2(d.versicherung)],
        ['Verwaltung', fmt2(d.verwaltung)],
        ['Instandhaltung', fmt2(d.instandhaltung)],
        ['Hausgeld', fmt2(d.hausgeld)],
        ['Sonstiges', fmt2(d.sonstiges)],
        ['AfA (§ 7 Abs. 4 EStG)', fmt2(d.afa)],
        ['Summe Werbungskosten', fmt2(d.werbungskosten)],
        ['Einkünfte aus V+V', fmt2(d.einkunefte)],
      ].forEach((r) => rows.push(r));
    } else if (activeReport === 'afa') {
      rows.push(['Objekt', 'Kaufjahr', 'Kaufpreis', 'Gebäudeanteil (80%)', 'Bodenanteil', 'AfA-Satz', 'AfA p.a.', 'AfA p.M.']);
      afaData.forEach((r) => rows.push([r.name, String(r.purchaseYear), fmt2(r.kaufpreis), fmt2(r.gebaeudeanteil), fmt2(r.bodenanteil), `${r.rate}%`, fmt2(r.annualAfa), fmt2(r.afaMonat)]));
    } else if (activeReport === 'kaution') {
      rows.push(['Mieter', 'Objekt', 'Kaltmiete', 'Kaution', 'Max (3 KM)', 'Gezahlt', 'Gezahlt am', 'Limit OK', 'Vertragsende', 'Tage seit Ende']);
      kautionData.forEach((r) => rows.push([r.mieter, r.objekt, fmt2(r.kaltmiete), fmt2(r.kaution), fmt2(r.max), r.gezahlt ? 'Ja' : 'Nein', r.gezahltAm, r.overLimit ? 'NEIN (über 3 KM)' : 'Ja', r.vertragsende, r.verjaehrungstage === null ? '—' : String(r.verjaehrungstage)]));
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${activeDef.name}_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ============ Render ============
  const needsYear = ['rendite', 'nebenkosten', 'anlage-v', 'afa', 'datev-export'].includes(activeReport || '');
  const needsProperty = ['nebenkosten', 'anlage-v', 'datev-export'].includes(activeReport || '');

  const renderReportContent = () => {
    if (!activeReport) return null;

    if (activeReport === 'mieterliste') {
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="border-b border-card-divider">
              <th className="th">Name</th><th className="th">E-Mail</th><th className="th">Telefon</th>
              <th className="th">Objekt</th><th className="th">Einheit</th><th className="th">Einzug</th>
            </tr></thead>
            <tbody>
              {mieterlisteData.length === 0 ? <EmptyRow cols={6} /> : mieterlisteData.map((r, i) => (
                <tr key={i} className="border-b border-card-divider hover:bg-layer-hover">
                  <td className="td font-medium text-foreground">{r.name}</td>
                  <td className="td text-muted-foreground-2">{r.email}</td>
                  <td className="td text-muted-foreground-2">{r.phone}</td>
                  <td className="td text-muted-foreground-2">{r.objekt}</td>
                  <td className="td text-muted-foreground-2">{r.einheit}</td>
                  <td className="td text-muted-foreground-2">{r.einzug}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeReport === 'vertraege') {
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead><tr className="border-b border-card-divider">
              <th className="th">Mieter</th><th className="th">Objekt</th><th className="th">Start</th><th className="th">Ende</th>
              <th className="th text-end">Kalt</th><th className="th text-end">Warm</th><th className="th text-end">Kaution</th><th className="th">Kdg.</th>
            </tr></thead>
            <tbody>
              {vertraegeData.length === 0 ? <EmptyRow cols={8} /> : vertraegeData.map((r, i) => (
                <tr key={i} className="border-b border-card-divider hover:bg-layer-hover">
                  <td className="td font-medium text-foreground">{r.mieter}</td>
                  <td className="td text-muted-foreground-2">{r.objekt}</td>
                  <td className="td text-muted-foreground-2">{r.startDate}</td>
                  <td className="td text-muted-foreground-2">{r.endDate}</td>
                  <td className="td text-end tabular-nums">{fmt2(r.kaltmiete)} €</td>
                  <td className="td text-end tabular-nums font-semibold">{fmt2(r.warmmiete)} €</td>
                  <td className="td text-end tabular-nums">
                    {fmt2(r.kaution)} €
                    {!r.depositOk && <span className="ml-1 text-red-400 text-[9px]">⚠ &gt;3 KM</span>}
                  </td>
                  <td className="td text-muted-foreground-2">{r.kuendigungsfrist}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <LegalNote>
            <strong>§ 573c BGB:</strong> Kündigungsfrist Mieter 3 Monate. Vermieter: 3/6/9 Monate je nach Mietdauer (bis 5 J. / bis 8 J. / ab 8 J.).
            <strong className="ml-2">§ 551 BGB:</strong> Kaution max. 3 Netto-Kaltmieten; in drei Raten zahlbar.
          </LegalNote>
        </div>
      );
    }

    if (activeReport === 'rueckstaende') {
      const total = rueckstaendeData.reduce((s, r) => s + r.rueckstand, 0);
      return (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="border-b border-card-divider">
                <th className="th">Mieter</th><th className="th">Objekt</th>
                <th className="th text-end">Soll gesamt</th><th className="th text-end">Ist</th>
                <th className="th text-end">Rückstand</th><th className="th text-end">Miet-Mon.</th><th className="th">Status</th>
              </tr></thead>
              <tbody>
                {rueckstaendeData.length === 0 ? (
                  <tr><td colSpan={7} className="td text-center py-8 text-emerald-400">✓ Keine Mietrückstände</td></tr>
                ) : rueckstaendeData.map((r, i) => (
                  <tr key={i} className="border-b border-card-divider hover:bg-layer-hover">
                    <td className="td font-medium text-foreground">{r.name}</td>
                    <td className="td text-muted-foreground-2">{r.objekt}</td>
                    <td className="td text-end tabular-nums text-muted-foreground-2">{fmt2(r.soll)} €</td>
                    <td className="td text-end tabular-nums">{fmt2(r.ist)} €</td>
                    <td className="td text-end tabular-nums font-semibold text-red-400">{fmt2(r.rueckstand)} €</td>
                    <td className="td text-end tabular-nums">{r.mietmonate.toFixed(1)}</td>
                    <td className="td">
                      {r.kuendbar ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">Fristlose Kdg. möglich</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold">Im Verzug</span>
                      )}
                    </td>
                  </tr>
                ))}
                {rueckstaendeData.length > 0 && (
                  <tr className="font-semibold border-t-2 border-card-line">
                    <td className="td" colSpan={4}>Gesamt offen</td>
                    <td className="td text-end tabular-nums text-red-400">{fmt2(total)} €</td>
                    <td className="td" colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <LegalNote>
            <strong>§ 286 BGB:</strong> Verzug 30 Tage nach Fälligkeit + Zugang Rechnung. <strong>§ 288 BGB:</strong> Verzugszinsen 5 pp über Basiszinssatz.
            <strong className="ml-2">§ 543 Abs. 2 Nr. 3 BGB:</strong> Fristlose Kündigung bei 2 Monaten Rückstand.
          </LegalNote>
        </div>
      );
    }

    if (activeReport === 'objektuebersicht') {
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead><tr className="border-b border-card-divider">
              <th className="th">Objekt</th><th className="th">Adresse</th>
              <th className="th text-center">Einheiten</th><th className="th text-end">Miete/M</th>
              <th className="th text-end">Rendite</th><th className="th text-end">Kaufpreis</th><th className="th text-end">Marktwert</th>
            </tr></thead>
            <tbody>
              {objektData.length === 0 ? <EmptyRow cols={7} /> : objektData.map((r, i) => (
                <tr key={i} className="border-b border-card-divider hover:bg-layer-hover">
                  <td className="td font-medium text-foreground">{r.name}</td>
                  <td className="td text-muted-foreground-2">{r.address}</td>
                  <td className="td text-center text-muted-foreground-2">{r.vermietet}/{r.einheiten}</td>
                  <td className="td text-end tabular-nums">{fmtInt(r.miete)} €</td>
                  <td className="td text-end tabular-nums">{r.rendite.toFixed(1)} %</td>
                  <td className="td text-end tabular-nums text-muted-foreground-2">{fmtInt(r.kaufpreis)} €</td>
                  <td className="td text-end tabular-nums text-muted-foreground-2">{fmtInt(r.marktwert)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeReport === 'rendite') {
      return (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="border-b border-card-divider">
                <th className="th">Objekt</th>
                <th className="th text-end">Kaufpreis</th><th className="th text-end">Jahresmiete</th>
                <th className="th text-end">Bewirtsch.</th><th className="th text-end">Netto-JM</th>
                <th className="th text-end">Brutto %</th><th className="th text-end">Netto %</th><th className="th text-end">Multipl.</th>
              </tr></thead>
              <tbody>
                {renditeData.length === 0 ? <EmptyRow cols={8} /> : renditeData.map((r, i) => (
                  <tr key={i} className="border-b border-card-divider hover:bg-layer-hover">
                    <td className="td font-medium text-foreground">{r.name}</td>
                    <td className="td text-end tabular-nums text-muted-foreground-2">{fmtInt(r.kaufpreis)} €</td>
                    <td className="td text-end tabular-nums">{fmtInt(r.jahresKaltmiete)} €</td>
                    <td className="td text-end tabular-nums text-muted-foreground-2">−{fmtInt(r.nichtUmlagefaehig)} €</td>
                    <td className="td text-end tabular-nums">{fmtInt(r.nettoJahresMiete)} €</td>
                    <td className="td text-end tabular-nums font-semibold">{r.bruttoRendite.toFixed(2)} %</td>
                    <td className="td text-end tabular-nums font-semibold text-emerald-400">{r.nettoRendite.toFixed(2)} %</td>
                    <td className="td text-end tabular-nums">{r.multiplikator.toFixed(1)}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LegalNote>
            <strong>Bruttomietrendite</strong> = Jahreskaltmiete / Kaufpreis. <strong>Nettomietrendite</strong> = (Jahreskaltmiete − nicht-umlagefähige Kosten) / Kaufpreis.
            <strong className="ml-2">Mietmultiplikator (Faktor)</strong> = Kaufpreis / Jahresmiete. Kaufnebenkosten (Grunderwerbsteuer, Notar, Makler) sind <em>nicht</em> berücksichtigt.
          </LegalNote>
        </div>
      );
    }

    if (activeReport === 'leerstand') {
      const gesamtUnits = leerstandData.reduce((s, r) => s + r.totalUnits, 0);
      const gesamtVacant = leerstandData.reduce((s, r) => s + r.vacantUnits, 0);
      const gesamtMietausfall = leerstandData.reduce((s, r) => s + r.mietausfall, 0);
      const gesamtQuote = gesamtUnits > 0 ? (gesamtVacant / gesamtUnits) * 100 : 0;
      return (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <KPI label="Einheiten gesamt" value={String(gesamtUnits)} />
            <KPI label="Leerstandsquote" value={`${gesamtQuote.toFixed(1)} %`} highlight={gesamtQuote > 10} />
            <KPI label="Mietausfall / Monat" value={`${fmtInt(gesamtMietausfall)} €`} highlight={gesamtMietausfall > 0} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="border-b border-card-divider">
                <th className="th">Objekt</th><th className="th text-center">WE gesamt</th><th className="th text-center">WE leer</th>
                <th className="th text-end">Quote %</th><th className="th text-end">Fläche gesamt</th><th className="th text-end">Fläche leer</th>
                <th className="th text-end">Quote Fläche</th><th className="th text-end">Ausfall/M</th>
              </tr></thead>
              <tbody>
                {leerstandData.length === 0 ? <EmptyRow cols={8} /> : leerstandData.map((r, i) => (
                  <tr key={i} className="border-b border-card-divider hover:bg-layer-hover">
                    <td className="td font-medium">{r.name}</td>
                    <td className="td text-center">{r.totalUnits}</td>
                    <td className="td text-center">{r.vacantUnits}</td>
                    <td className="td text-end tabular-nums">{r.quoteEinheiten.toFixed(1)} %</td>
                    <td className="td text-end tabular-nums text-muted-foreground-2">{fmt2(r.totalArea)} m²</td>
                    <td className="td text-end tabular-nums text-muted-foreground-2">{fmt2(r.vacantArea)} m²</td>
                    <td className="td text-end tabular-nums">{r.quoteFlaeche.toFixed(1)} %</td>
                    <td className="td text-end tabular-nums text-red-400">{fmtInt(r.mietausfall)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeReport === 'mieteinnahmen') {
      const totalSoll = mieteinnahmenData.reduce((s, r) => s + r.soll, 0);
      const totalIst = mieteinnahmenData.reduce((s, r) => s + r.ist, 0);
      return (
        <div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="border-b border-card-divider">
                <th className="th">Monat</th><th className="th text-end">Soll</th><th className="th text-end">Ist</th><th className="th text-end">Differenz</th>
              </tr></thead>
              <tbody>
                {mieteinnahmenData.map((r, i) => {
                  const diff = r.ist - r.soll;
                  return (
                    <tr key={i} className="border-b border-card-divider">
                      <td className="td font-medium">{r.month}</td>
                      <td className="td text-end tabular-nums text-muted-foreground-2">{fmtInt(r.soll)} €</td>
                      <td className="td text-end tabular-nums">{fmtInt(r.ist)} €</td>
                      <td className="td text-end tabular-nums">
                        <span className={diff >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmtInt(diff)} €</span>
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-semibold border-t-2 border-card-line">
                  <td className="td">12-Monats-Summe</td>
                  <td className="td text-end tabular-nums">{fmtInt(totalSoll)} €</td>
                  <td className="td text-end tabular-nums">{fmtInt(totalIst)} €</td>
                  <td className="td text-end tabular-nums">
                    <span className={totalIst - totalSoll >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmtInt(totalIst - totalSoll)} €</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeReport === 'cashflow') {
      const tE = cashflowData.reduce((s, r) => s + r.einnahmen, 0);
      const tA = cashflowData.reduce((s, r) => s + r.ausgaben, 0);
      return (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <KPI label="12-Mo. Einnahmen" value={`${fmtInt(tE)} €`} />
            <KPI label="12-Mo. Ausgaben" value={`${fmtInt(tA)} €`} />
            <KPI label="Cashflow" value={`${fmtInt(tE - tA)} €`} highlight={tE - tA < 0} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="border-b border-card-divider">
                <th className="th">Monat</th><th className="th text-end">Einnahmen</th>
                <th className="th text-end">Ausgaben</th><th className="th text-end">Saldo</th>
              </tr></thead>
              <tbody>
                {cashflowData.map((r, i) => (
                  <tr key={i} className="border-b border-card-divider">
                    <td className="td font-medium">{r.month}</td>
                    <td className="td text-end tabular-nums text-emerald-400">+{fmtInt(r.einnahmen)} €</td>
                    <td className="td text-end tabular-nums text-red-400">−{fmtInt(r.ausgaben)} €</td>
                    <td className="td text-end tabular-nums font-semibold"><span className={r.saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmtInt(r.saldo)} €</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LegalNote>
            Cashflow = Ist-Zahlungseingänge Miete/Nachzahlung abzgl. erfasste Ausgaben. Keine Finanzierungskosten und keine AfA berücksichtigt — das ist keine steuerliche Betrachtung (siehe Anlage V).
          </LegalNote>
        </div>
      );
    }

    if (activeReport === 'nebenkosten') {
      const umlagefaehig = nebenkostenData.filter((r) => r.umlagefaehig).reduce((s, r) => s + r.betrag, 0);
      const nichtUmlagefaehig = nebenkostenData.filter((r) => !r.umlagefaehig).reduce((s, r) => s + r.betrag, 0);
      return (
        <div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <KPI label="Umlagefähig" value={`${fmt2(umlagefaehig)} €`} />
            <KPI label="Nicht umlagefähig (Vermieter)" value={`${fmt2(nichtUmlagefaehig)} €`} highlight />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="border-b border-card-divider">
                <th className="th">Kategorie</th><th className="th text-end">Betrag {year}</th>
                <th className="th text-center">Umlagefähig</th><th className="th">Rechtsgrundlage</th>
              </tr></thead>
              <tbody>
                {nebenkostenData.length === 0 ? <EmptyRow cols={4} message={`Keine Nebenkosten für ${year} erfasst.`} /> : nebenkostenData.map((r, i) => (
                  <tr key={i} className="border-b border-card-divider">
                    <td className="td font-medium">{r.kategorie}</td>
                    <td className="td text-end tabular-nums">{fmt2(r.betrag)} €</td>
                    <td className="td text-center">
                      {r.umlagefaehig ? <span className="text-emerald-400">✓</span> : <span className="text-red-400">✗</span>}
                    </td>
                    <td className="td text-[10px] text-muted-foreground-2">{r.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LegalNote>
            <strong>BetrKV § 1 Abs. 2 Nr. 1:</strong> Verwaltungskosten sind <em>nicht</em> umlagefähig. <strong>§ 556 Abs. 3 BGB:</strong> Abrechnung binnen 12 Monaten, <strong>Einwendungsfrist</strong> weitere 12 Monate. <strong>CO2KostAufG (seit 01.01.2023):</strong> Anteilige CO2-Kosten bei Heizungen nach Gebäude-Energiestandard.
          </LegalNote>
        </div>
      );
    }

    if (activeReport === 'anlage-v') {
      const d = anlageVData;
      return (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <KPI label="Einnahmen" value={`${fmt2(d.mietEinnahmen)} €`} />
            <KPI label="Werbungskosten" value={`${fmt2(d.werbungskosten)} €`} />
            <KPI label="Einkünfte V+V" value={`${fmt2(d.einkunefte)} €`} highlight={d.einkunefte < 0} />
          </div>
          <div className="rounded-[10px] border border-card-line overflow-hidden">
            <div className="px-4 py-2 bg-layer-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Zeile 9 — Einnahmen aus Vermietung</div>
            <AnlageRow label="Mieteinnahmen (Zufluss § 11 EStG)" amount={d.mietEinnahmen} />
            <AnlageRow label="darin: Nebenkosten-Nachzahlungen" amount={d.nkUmlagen} muted />
            <div className="px-4 py-2 bg-layer-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-t border-card-divider">Zeilen 33–50 — Werbungskosten</div>
            <AnlageRow label="Grundsteuer" amount={d.grundsteuer} />
            <AnlageRow label="Versicherungen (Gebäude, Haftpflicht)" amount={d.versicherung} />
            <AnlageRow label="Verwaltungskosten" amount={d.verwaltung} />
            <AnlageRow label="Erhaltungsaufwand / Instandhaltung" amount={d.instandhaltung} />
            <AnlageRow label="Hausgeld (anteilig)" amount={d.hausgeld} />
            <AnlageRow label="Sonstige Werbungskosten" amount={d.sonstiges} />
            <AnlageRow label="AfA Gebäude (§ 7 Abs. 4 EStG)" amount={d.afa} accent />
            <AnlageRow label="Summe Werbungskosten" amount={d.werbungskosten} total />
            <div className="px-4 py-2 bg-layer-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-t border-card-divider">Zeile 23 — Einkünfte V+V</div>
            <AnlageRow label="Einkünfte aus Vermietung (§ 21 EStG)" amount={d.einkunefte} final />
          </div>
          <LegalNote>
            <strong>§ 11 EStG (Zu-/Abflussprinzip):</strong> Angesetzt werden tatsächlich zu-/abgeflossene Beträge im Kalenderjahr.
            <strong className="ml-2">Hinweis zur AfA:</strong> Standardmäßig 80 % Gebäudeanteil. Für genaue Steuerwerte bitte Bodenrichtwert (BORIS) prüfen oder steuerberatend validieren.
            Schuldzinsen/Finanzierung derzeit nicht automatisch erfasst.
          </LegalNote>
        </div>
      );
    }

    if (activeReport === 'afa') {
      const totalAfa = afaData.reduce((s, r) => s + r.annualAfa, 0);
      return (
        <div>
          <KPI label="Gesamt-AfA p.a." value={`${fmt2(totalAfa)} €`} />
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full text-xs">
              <thead><tr className="border-b border-card-divider">
                <th className="th">Objekt</th><th className="th text-end">Kaufjahr</th><th className="th text-end">Kaufpreis</th>
                <th className="th text-end">Gebäude (80 %)</th><th className="th text-end">Boden</th>
                <th className="th text-end">AfA-Satz</th><th className="th text-end">AfA p.a.</th><th className="th text-end">AfA p.M.</th>
              </tr></thead>
              <tbody>
                {afaData.length === 0 ? <EmptyRow cols={8} /> : afaData.map((r, i) => (
                  <tr key={i} className="border-b border-card-divider">
                    <td className="td font-medium">{r.name}</td>
                    <td className="td text-end">{r.purchaseYear}</td>
                    <td className="td text-end tabular-nums text-muted-foreground-2">{fmtInt(r.kaufpreis)} €</td>
                    <td className="td text-end tabular-nums">{fmtInt(r.gebaeudeanteil)} €</td>
                    <td className="td text-end tabular-nums text-muted-foreground-2">{fmtInt(r.bodenanteil)} €</td>
                    <td className="td text-end tabular-nums font-semibold">{r.rate} %</td>
                    <td className="td text-end tabular-nums">{fmt2(r.annualAfa)} €</td>
                    <td className="td text-end tabular-nums text-muted-foreground-2">{fmt2(r.afaMonat)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LegalNote>
            <strong>§ 7 Abs. 4 EStG — lineare Gebäude-AfA:</strong><br />
            <span className="block">• Fertigstellung ab 01.01.2023: <strong>3 % p.a.</strong> (Wachstumschancengesetz)</span>
            <span className="block">• Fertigstellung 01.01.1925 bis 31.12.2022: <strong>2 % p.a.</strong> (50 Jahre Nutzungsdauer)</span>
            <span className="block">• Fertigstellung vor 01.01.1925: <strong>2,5 % p.a.</strong></span>
            <span className="block mt-1.5">Nur der Gebäudeanteil ist abschreibbar. Boden wird nicht abgeschrieben. Standardaufteilung hier 80/20 — für exakte Werte Bodenrichtwert (Gutachterausschuss/BORIS) heranziehen oder BMF-Arbeitshilfe verwenden.</span>
          </LegalNote>
        </div>
      );
    }

    if (activeReport === 'kaution') {
      const ueberschreitungen = kautionData.filter((r) => r.overLimit).length;
      return (
        <div>
          {ueberschreitungen > 0 && (
            <div className="mb-3 p-3 rounded-[10px] bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              <strong>Warnung:</strong> {ueberschreitungen} Kaution(en) überschreiten die gesetzliche Obergrenze von 3 Nettokaltmieten (§ 551 Abs. 1 BGB).
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="border-b border-card-divider">
                <th className="th">Mieter</th><th className="th">Objekt</th>
                <th className="th text-end">Kaltmiete</th><th className="th text-end">Kaution</th><th className="th text-end">Max (3 KM)</th>
                <th className="th text-center">Gezahlt</th><th className="th">Vertragsende</th><th className="th">Status</th>
              </tr></thead>
              <tbody>
                {kautionData.length === 0 ? <EmptyRow cols={8} /> : kautionData.map((r, i) => (
                  <tr key={i} className="border-b border-card-divider">
                    <td className="td font-medium">{r.mieter}</td>
                    <td className="td text-muted-foreground-2">{r.objekt}</td>
                    <td className="td text-end tabular-nums">{fmt2(r.kaltmiete)} €</td>
                    <td className="td text-end tabular-nums font-semibold">{fmt2(r.kaution)} €</td>
                    <td className="td text-end tabular-nums text-muted-foreground-2">{fmt2(r.max)} €</td>
                    <td className="td text-center">{r.gezahlt ? <span className="text-emerald-400">✓</span> : <span className="text-red-400">✗</span>}</td>
                    <td className="td text-muted-foreground-2">{r.vertragsende}</td>
                    <td className="td">
                      {r.overLimit ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">Über 3 KM</span>
                      ) : r.verjaehrungstage !== null && r.verjaehrungstage > 180 ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold">Verjährung § 548</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LegalNote>
            <strong>§ 551 BGB:</strong> Kaution max. 3 Nettokaltmieten; Ratenzahlung über 3 Monate zulässig. Anlage insolvenzfest und mit haushaltsüblichen Sparzinsen.
            <strong className="ml-2">§ 548 Abs. 1 BGB:</strong> Vermieter-Ansprüche verjähren 6 Monate nach Rückgabe der Mietsache.
          </LegalNote>
        </div>
      );
    }

    if (activeReport === 'datev-export') {
      return (
        <div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <KPI label="Buchungen" value={String(datevSummary.anzahlBuchungen)} />
            <KPI label="Einnahmen" value={`${fmt2(datevSummary.einnahmenGesamt)} €`} />
            <KPI label="Ausgaben" value={`${fmt2(datevSummary.ausgabenGesamt)} €`} />
            <KPI label="Saldo" value={`${fmt2(datevSummary.saldo)} €`} highlight={datevSummary.saldo < 0} />
          </div>

          <div className="mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground-2 mb-2">Kontenübersicht (SKR03)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead><tr className="border-b border-card-divider">
                  <th className="th">Konto</th><th className="th">Bezeichnung</th>
                  <th className="th text-end">Soll</th><th className="th text-end">Haben</th><th className="th text-end">Saldo</th>
                </tr></thead>
                <tbody>
                  {datevSummary.kontenUebersicht.length === 0 ? (
                    <EmptyRow cols={5} message={`Keine Buchungen für ${year}.`} />
                  ) : datevSummary.kontenUebersicht.map((k, i) => (
                    <tr key={i} className="border-b border-card-divider">
                      <td className="td font-mono font-semibold">{k.konto}</td>
                      <td className="td text-muted-foreground-2">{kontoLabel(k.konto)}</td>
                      <td className="td text-end tabular-nums">{fmt2(k.soll)} €</td>
                      <td className="td text-end tabular-nums">{fmt2(k.haben)} €</td>
                      <td className="td text-end tabular-nums font-semibold">
                        <span className={k.saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt2(k.saldo)} €</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground-2 mb-2">
              Buchungsstapel-Vorschau ({datevPreview.length} Einträge — Auszug)
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead><tr className="border-b border-card-divider">
                  <th className="th">Datum</th><th className="th">Beleg-Nr.</th>
                  <th className="th">Konto</th><th className="th">Gegenkonto</th>
                  <th className="th text-center">S/H</th><th className="th text-end">Umsatz</th>
                  <th className="th">Buchungstext</th>
                </tr></thead>
                <tbody>
                  {datevPreview.length === 0 ? (
                    <EmptyRow cols={7} message={`Keine Buchungen für ${year} gefunden.`} />
                  ) : datevPreview.slice(0, 50).map((b, i) => (
                    <tr key={i} className="border-b border-card-divider">
                      <td className="td font-medium">{b.belegdatum}</td>
                      <td className="td font-mono text-[10px] text-muted-foreground-2">{b.belegNr}</td>
                      <td className="td font-mono font-semibold">{b.konto}</td>
                      <td className="td font-mono text-muted-foreground-2">{b.gegenkonto}</td>
                      <td className="td text-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${b.sollHaben === 'S' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {b.sollHaben}
                        </span>
                      </td>
                      <td className="td text-end tabular-nums font-semibold">
                        <span className={b.isEinnahme ? 'text-emerald-400' : 'text-red-400'}>
                          {b.isEinnahme ? '+' : '−'}{fmt2(b.umsatz)} €
                        </span>
                      </td>
                      <td className="td text-muted-foreground-2 text-[10.5px]">{b.buchungstext}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {datevPreview.length > 50 && (
                <p className="mt-2 text-[10.5px] text-muted-foreground-2 text-center">
                  … {datevPreview.length - 50} weitere Buchungen im vollständigen Export.
                </p>
              )}
            </div>
          </div>

          <LegalNote>
            <strong>DATEV-Format EXTF 700 (Buchungsstapel):</strong> Die Export-Datei entspricht dem offiziellen DATEV-Austauschformat und kann vom Steuerberater via DATEV Unternehmen Online, Kanzlei-Rechnungswesen oder kompatibler Buchhaltungssoftware (Lexware, sevdesk, Buchhaltungsbutler) importiert werden.
            <strong className="block mt-1.5">SKR03-Konten (Standard V+V):</strong>
            <span className="block">• <span className="font-mono">8110</span> Erlöse Wohnraumvermietung (§ 4 Nr. 12a UStG umsatzsteuerfrei)</span>
            <span className="block">• <span className="font-mono">4100</span> Verwaltung · <span className="font-mono">4210</span> Instandhaltung · <span className="font-mono">4220</span> Hausgeld · <span className="font-mono">4360</span> Versicherung · <span className="font-mono">4510</span> Grundsteuer</span>
            <span className="block mt-1.5"><strong>GoBD-Konformität:</strong> Chronologische Erfassung nach Belegdatum, Kostenstellen je Objekt/Einheit, Belegfeld 1 mit eindeutiger Beleg-Nr. Aufbewahrungspflicht 10 Jahre (§ 147 AO). Nicht-festgeschriebener Stapel — Steuerberater kann nachbearbeiten.</span>
            <span className="block mt-1.5 text-amber-400"><strong>Hinweis:</strong> Überprüfen Sie vor dem Import mit Ihrem Steuerberater, ob SKR03 dem Kontenrahmen Ihres Mandats entspricht. Für SKR04 oder private Kontenrahmen müssen die Konten-Nummern angepasst werden.</span>
          </LegalNote>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="page-container">
      <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-card-divider">
          <h1 className="text-[24px] sm:text-[26px] font-bold text-foreground tracking-tight leading-tight mb-1">
            Berichte
          </h1>
          <p className="text-[13px] text-muted-foreground max-w-2xl leading-relaxed">
            Rechtssichere Auswertungen für Steuer, Mieter, Banken und Behörden — gruppiert nach Anwendungsfall.
          </p>
        </div>

        {/* Reports grouped by section */}
        <div className="p-5 sm:p-6 space-y-6">
          {SECTIONS.map((sec) => {
            const items = REPORTS.filter((r) => r.section === sec.key);
            if (items.length === 0) return null;
            return (
              <div key={sec.key}>
                <h2 className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground/70 mb-2.5 px-1">
                  {sec.label}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((r) => {
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setActiveReport(r.id)}
                        className="group bg-card border border-card-line rounded-[12px] p-4 text-left hover:-translate-y-px transition-all hover:shadow-[0_4px_12px_rgba(79,107,255,0.10)] hover:border-[#4F6BFF]/30 cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className="size-10 rounded-[10px] flex items-center justify-center flex-shrink-0 bg-[#4F6BFF]/10 group-hover:bg-[#4F6BFF]/15 transition-colors">
                            <Icon size={17} className="text-[#4F6BFF]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[13.5px] font-semibold text-foreground tracking-tight">{r.name}</h3>
                            <p className="text-[11.5px] mt-1 leading-relaxed text-muted-foreground">{r.description}</p>
                            {r.legalRef && (
                              <p className="text-[10px] mt-2 text-[#4F6BFF] font-semibold tracking-tight">{r.legalRef}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeReport && activeDef && (
        <div className="modal-backdrop">
          <div className="modal-overlay" onClick={() => setActiveReport(null)} />
          <div className="relative rounded-xl w-full max-w-5xl mx-4 max-h-[85vh] overflow-y-auto p-6 bg-background border border-card-line" style={{ backgroundColor: 'var(--bg-raised)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h2 className="page-title">{activeDef.name}</h2>
                <p className="page-subtitle">{activeDef.description}</p>
                {activeDef.legalRef && <p className="text-[11px] mt-1 text-[#4F6BFF] font-medium">{activeDef.legalRef}</p>}
              </div>
              <button onClick={() => setActiveReport(null)} className="btn btn-sm btn-secondary">
                <X size={16} />
              </button>
            </div>

            {(needsYear || needsProperty) && (
              <div className="flex items-center gap-2 mb-4 p-3 rounded-[10px] border border-card-line bg-layer-1">
                {needsYear && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-muted-foreground">Jahr</label>
                    <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input input-xs !w-[90px]">
                      {[0, 1, 2, 3, 4].map((i) => {
                        const y = new Date().getFullYear() - i;
                        return <option key={y} value={y}>{y}</option>;
                      })}
                    </select>
                  </div>
                )}
                {needsProperty && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-muted-foreground">Objekt</label>
                    <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className="input input-xs !w-[200px]">
                      <option value="__all__">Alle Objekte</option>
                      {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
                {selectedProp && <span className="text-[10px] text-muted-foreground-2 ml-auto">{selectedProp.address}</span>}
              </div>
            )}

            <div className="py-2">{renderReportContent()}</div>

            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-card-divider">
              <button onClick={handlePDFExport} className="btn btn-sm btn-secondary"><Download size={14} /> PDF</button>
              <button onClick={handleCSVExport} className="btn btn-sm btn-primary">
                <Download size={14} />
                {activeReport === 'datev-export' ? 'DATEV-Buchungsstapel (CSV)' : 'Excel (CSV)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyRow({ cols, message }: { cols: number; message?: string }) {
  return <tr><td colSpan={cols} className="td text-center py-8 text-muted-foreground-2">{message || 'Keine Daten vorhanden'}</td></tr>;
}

function LegalNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 p-3 rounded-[10px] border border-card-line bg-layer-1 text-[10.5px] leading-relaxed text-muted-foreground-2">
      {children}
    </div>
  );
}

function KPI({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="p-3 rounded-[10px] border border-card-line bg-layer-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-red-400' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function AnlageRow({ label, amount, muted, total, final: isFinal, accent }: { label: string; amount: number; muted?: boolean; total?: boolean; final?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between px-4 py-2 text-xs border-t border-card-divider ${total ? 'font-bold bg-layer-1' : ''} ${isFinal ? 'font-bold text-base bg-[rgba(79,107,255,0.08)]' : ''}`}>
      <span className={`${muted ? 'text-muted-foreground-2 pl-4' : ''} ${accent ? 'text-[#4F6BFF]' : ''}`}>{label}</span>
      <span className={`tabular-nums ${muted ? 'text-muted-foreground-2' : ''} ${accent ? 'text-[#4F6BFF] font-semibold' : ''}`}>{fmt2(amount)} €</span>
    </div>
  );
}

// SKR03-Kontenbezeichnungen für die Konten-Tabelle
function kontoLabel(konto: string): string {
  const map: Record<string, string> = {
    '1000': 'Kasse',
    '1200': 'Bank',
    '1780': 'Erhaltene Kaution',
    '4100': 'Verwaltungskosten',
    '4210': 'Instandhaltung Gebäude',
    '4220': 'Hausgeld (WEG)',
    '4230': 'Allgemeinstrom',
    '4240': 'Heizkosten',
    '4250': 'Wasserkosten',
    '4360': 'Versicherungen',
    '4510': 'Grundsteuer',
    '4980': 'Sonstige Aufwendungen',
    '8110': 'Erlöse Wohnraummiete (§ 4 Nr. 12a UStG)',
    '8120': 'Nebenkosten-Vorauszahlungen',
    '8130': 'Nebenkosten-Nachzahlung',
  };
  return map[konto] || '—';
}
