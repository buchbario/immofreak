import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SearchCheck, Plus, Bookmark, ChevronDown, ChevronRight,
  Trash2, TrendingUp, AlertTriangle, ArrowRight, Building2,
  Info,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from 'recharts';
import { useDealAnalyses } from '../../hooks/useDealAnalyses';
import { useProjects } from '../../hooks/useProjects';
import { useTrash } from '../../hooks/useTrash';
import { dealAnalysisToTrash } from '../../lib/cascadeDelete';
import { formatCurrency, cn } from '../../lib/utils';
import type { DealGrade } from '../../types';
import { NumberInput } from '../ui/NumberInput';

/* ─────────────── helpers ─────────────── */

function CurrencyInput({
  value, onChange, placeholder = '0', suffix = '\u20ac', label, hint,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; suffix?: string; label: string; hint?: string; disabled?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-xs font-medium text-muted-foreground-2">{label}</label>
        {hint && (
          <div className="relative group/hint">
            <Info size={12} className="text-muted-foreground cursor-help" />
            <div className="absolute z-50 bottom-full mb-1 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-dropdown border border-dropdown-line rounded-lg text-xs whitespace-nowrap opacity-0 group-hover/hint:opacity-100 pointer-events-none transition-opacity shadow-lg text-foreground">
              {hint}
            </div>
          </div>
        )}
      </div>
      <NumberInput
        value={value}
        onChange={(v) => onChange(v === '' ? '' : String(v))}
        placeholder={placeholder}
        suffix={suffix}
        decimals={2}
        className="input tabular-nums"
      />
    </div>
  );
}

function PercentInput({
  value, onChange, label, hint,
}: {
  value: string; onChange: (v: string) => void; label: string; hint?: string;
}) {
  return <CurrencyInput value={value} onChange={onChange} label={label} hint={hint} suffix="%" />;
}

function TextInput({
  value, onChange, label, placeholder,
}: {
  value: string; onChange: (v: string) => void; label: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground-2 mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
      />
    </div>
  );
}

/* ─── section accordion ─── */

function Section({
  title, defaultOpen = true, children, badge,
}: {
  title: string; defaultOpen?: boolean; children: React.ReactNode; badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-card-line rounded-xl shadow-2xs overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 text-left cursor-pointer hover:bg-layer-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronRight size={14} className={cn('text-muted-foreground transition-transform', open && 'rotate-90')} />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge}
        </div>
      </button>
      {open && <div className="px-4 pb-4 grid gap-3 border-t border-card-divider pt-3">{children}</div>}
    </div>
  );
}

/* ─── grade config ─── */

const GRADE_CFG: Record<DealGrade, { bg: string; text: string; ring: string; desc: string }> = {
  'A+': { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-emerald-500/30', desc: 'Exzellenter Deal' },
  'A': { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/20', desc: 'Sehr guter Deal' },
  'B': { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/20', desc: 'Guter Deal' },
  'C': { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/20', desc: 'Akzeptabler Deal' },
  'D': { bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', ring: 'ring-orange-500/20', desc: 'Riskanter Deal' },
  'F': { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', ring: 'ring-red-500/20', desc: 'Nicht empfohlen' },
};

const WATERFALL_COLORS = ['#4F6BFF', '#6B7FFF', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899'];

/* ─── chart tooltip ─── */

function ChartTooltip({ active, payload }: any) {
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-card border border-card-line rounded-lg px-3 py-2 shadow-md text-sm">
        <p className="font-medium text-foreground">{d.name}</p>
        <p className="text-muted-foreground tabular-nums">{formatCurrency(d.value)}</p>
      </div>
    );
  }
  return null;
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */

export function DealAnalyzerPage() {
  const navigate = useNavigate();
  const { analyses, createAnalysis, updateAnalysis } = useDealAnalyses();
  const { createProject } = useProjects();
  const { moveToTrash } = useTrash();
  const [savedOpen, setSavedOpen] = useState(false);
  const savedRef = useRef<HTMLDivElement>(null);

  // ── form state ──
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [arv, setArv] = useState('');
  const [sqm, setSqm] = useState('');
  const [renovationCost, setRenovationCost] = useState('');
  const [renovationMonths, setRenovationMonths] = useState('6');
  const [notarPercent, setNotarPercent] = useState('1.5');
  const [grunderwerbsteuer, setGrunderwerbsteuer] = useState('6.5');
  const [maklerPercent, setMaklerPercent] = useState('3.57');
  const [verkaufsmakler, setVerkaufsmakler] = useState('3.57');
  const [eigenkapital, setEigenkapital] = useState('');
  const [zinssatz, setZinssatz] = useState('4.5');
  const [tilgung, setTilgung] = useState('2.0');
  const [holdingCosts, setHoldingCosts] = useState('');
  const [notes, setNotes] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (savedRef.current && !savedRef.current.contains(e.target as Node)) setSavedOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── parse helpers ──
  const n = (s: string) => { const v = parseFloat(s); return isNaN(v) ? 0 : v; };

  // ── calculations ──
  const calc = useMemo(() => {
    const pp = n(purchasePrice);
    const arvVal = n(arv);
    const renoCost = n(renovationCost);
    const renoMonths = n(renovationMonths);
    const notar = n(notarPercent);
    const grest = n(grunderwerbsteuer);
    const makler = n(maklerPercent);
    const vmakler = n(verkaufsmakler);
    const ek = n(eigenkapital);
    const zins = n(zinssatz);
    const tilg = n(tilgung);
    const holdMonthly = n(holdingCosts);

    const kaufnebenkosten = pp * (notar + grest + makler) / 100;
    const gesamtInvestition = pp + kaufnebenkosten + renoCost;

    // Finanzierung nur wenn Eigenkapital explizit gesetzt wurde (sonst Cash-Deal).
    const hatFinanzierung = eigenkapital.trim() !== '' && ek < pp;
    const fremdkapital = hatFinanzierung ? Math.max(0, pp - ek) : 0;
    // Annuitätenrate (exakt): A = K × (i × (1+i)^n) / ((1+i)^n - 1)
    // i = Monatszins, n = Gesamt-Monate der Zinsbindung (Standard 10 Jahre bei DE-Immobilienkrediten).
    // Für kurze Flip-Haltezeiten liegt die Rate nahe an der Näherung (Zins + Tilgung) / 12.
    const monatsZins = zins / 100 / 12;
    const laufzeitMonate = 120; // 10 Jahre Zinsbindung (DE-Standard)
    const annuitaetsFaktor = monatsZins > 0
      ? (monatsZins * Math.pow(1 + monatsZins, laufzeitMonate)) / (Math.pow(1 + monatsZins, laufzeitMonate) - 1)
      : 1 / laufzeitMonate;
    const monatlicheRateAnnuitaet = fremdkapital * annuitaetsFaktor;
    const monatlicheRateNaehrung = fremdkapital * (zins + tilg) / 100 / 12;
    const monatlicheRate = hatFinanzierung ? Math.max(monatlicheRateAnnuitaet, monatlicheRateNaehrung) : 0;
    const finanzierungskosten = monatlicheRate * renoMonths;

    // Haltekosten nur wenn explizit eingetragen
    const hatHaltekosten = holdingCosts.trim() !== '' && holdMonthly > 0;
    const haltekostenGesamt = hatHaltekosten ? holdMonthly * renoMonths : 0;
    const verkaufskosten = arvVal * vmakler / 100;

    const gesamtKosten = gesamtInvestition + finanzierungskosten + haltekostenGesamt + verkaufskosten;
    const gewinn = arvVal - gesamtKosten;
    const roi = gesamtInvestition > 0 ? (gewinn / gesamtInvestition) * 100 : 0;
    const roiEK = ek > 0 ? (gewinn / ek) * 100 : 0;
    // Annualisierter ROI (wichtig beim Flip — 15 % in 6 Monaten ≠ 15 % p.a.)
    const roiAnnualisiert = renoMonths > 0 ? roi * (12 / renoMonths) : roi;

    // MAO (70 %-Regel, DE-angepasst): ARV × 0.7 - Sanierung
    // Deutsche Variante berücksichtigt Kaufnebenkosten zusätzlich:
    const maoUS = arvVal * 0.7 - renoCost;
    const nkQuote = (notar + grest + makler) / 100;
    const maoDE = nkQuote < 1 ? (arvVal * 0.7 - renoCost) / (1 + nkQuote) : maoUS;
    const mao = maoDE;
    const maoAbweichung = mao - pp;

    let grade: DealGrade = 'F';
    if (roi >= 25) grade = 'A+';
    else if (roi >= 20) grade = 'A';
    else if (roi >= 15) grade = 'B';
    else if (roi >= 10) grade = 'C';
    else if (roi >= 5) grade = 'D';

    return {
      kaufnebenkosten, gesamtInvestition, fremdkapital, monatlicheRate,
      finanzierungskosten, haltekostenGesamt, verkaufskosten, gesamtKosten,
      gewinn, roi, roiEK, roiAnnualisiert, mao, maoAbweichung, grade,
      pp, arvVal, renoCost, hatFinanzierung, hatHaltekosten,
    };
  }, [purchasePrice, arv, renovationCost, renovationMonths, notarPercent,
      grunderwerbsteuer, maklerPercent, verkaufsmakler, eigenkapital,
      zinssatz, tilgung, holdingCosts]);

  // ── waterfall data ──
  const waterfallData = useMemo(() => [
    { name: 'Kaufpreis', value: calc.pp },
    { name: 'Nebenkosten', value: calc.kaufnebenkosten },
    { name: 'Sanierung', value: calc.renoCost },
    { name: 'Finanzierung', value: calc.finanzierungskosten },
    { name: 'Haltekosten', value: calc.haltekostenGesamt },
    { name: 'Verkauf', value: calc.verkaufskosten },
  ], [calc]);

  // ── profit table ──
  const profitRows = useMemo(() => [
    { label: 'Verkaufspreis (ARV)', value: calc.arvVal, positive: true },
    { label: 'Kaufpreis', value: calc.pp, positive: false },
    { label: 'Kaufnebenkosten', value: calc.kaufnebenkosten, positive: false },
    { label: 'Sanierung', value: calc.renoCost, positive: false },
    { label: 'Finanzierung', value: calc.finanzierungskosten, positive: false },
    { label: 'Haltekosten', value: calc.haltekostenGesamt, positive: false },
    { label: 'Verkaufskosten', value: calc.verkaufskosten, positive: false },
  ], [calc]);

  // ── save / load ──
  const getFormData = () => ({
    name: name || 'Unbenannte Analyse',
    address,
    askingPrice: n(askingPrice),
    arv: n(arv),
    squareMeters: n(sqm),
    renovationCost: n(renovationCost),
    renovationMonths: n(renovationMonths),
    notarPercent: n(notarPercent),
    grunderwerbsteuerPercent: n(grunderwerbsteuer),
    maklerPercent: n(maklerPercent),
    purchasePrice: n(purchasePrice),
    eigenkapital: n(eigenkapital),
    zinssatz: n(zinssatz),
    tilgung: n(tilgung),
    holdingCostsMonthly: n(holdingCosts),
    verkaufsmaklerPercent: n(verkaufsmakler),
    notes,
  });

  const handleSave = () => {
    if (activeId) {
      updateAnalysis(activeId, getFormData());
    } else {
      const created = createAnalysis(getFormData());
      setActiveId(created.id);
    }
  };

  const handleLoad = (id: string) => {
    const a = analyses.find(x => x.id === id);
    if (!a) return;
    setActiveId(a.id);
    setName(a.name);
    setAddress(a.address);
    setAskingPrice(a.askingPrice ? String(a.askingPrice) : '');
    setPurchasePrice(a.purchasePrice ? String(a.purchasePrice) : '');
    setArv(a.arv ? String(a.arv) : '');
    setSqm(a.squareMeters ? String(a.squareMeters) : '');
    setRenovationCost(a.renovationCost ? String(a.renovationCost) : '');
    setRenovationMonths(String(a.renovationMonths));
    setNotarPercent(String(a.notarPercent));
    setGrunderwerbsteuer(String(a.grunderwerbsteuerPercent));
    setMaklerPercent(String(a.maklerPercent));
    setVerkaufsmakler(String(a.verkaufsmaklerPercent));
    setEigenkapital(a.eigenkapital ? String(a.eigenkapital) : '');
    setZinssatz(String(a.zinssatz));
    setTilgung(String(a.tilgung));
    setHoldingCosts(a.holdingCostsMonthly ? String(a.holdingCostsMonthly) : '');
    setNotes(a.notes);
    setSavedOpen(false);
  };

  const handleNew = () => {
    setActiveId(null);
    setName(''); setAddress(''); setAskingPrice(''); setPurchasePrice('');
    setArv(''); setSqm(''); setRenovationCost(''); setRenovationMonths('6');
    setNotarPercent('1.5'); setGrunderwerbsteuer('6.5'); setMaklerPercent('3.57');
    setVerkaufsmakler('3.57'); setEigenkapital(''); setZinssatz('4.5');
    setTilgung('2.0'); setHoldingCosts(''); setNotes('');
  };

  const handleDelete = (id: string) => {
    dealAnalysisToTrash(id, moveToTrash);
    if (activeId === id) handleNew();
  };

  const handleCreateProject = () => {
    const project = createProject({
      name: name || 'Neues Projekt',
      address,
      purchasePrice: n(purchasePrice),
      targetSellPrice: n(arv),
      arv: n(arv),
      renovationBudget: n(renovationCost),
      status: 'Akquise',
      notes: `Erstellt aus Deal Analyse.\nMAO: ${formatCurrency(calc.mao)}\nProj. Gewinn: ${formatCurrency(calc.gewinn)}\nROI: ${calc.roi.toFixed(1)}%`,
    });
    if (activeId) {
      updateAnalysis(activeId, { projectId: project.id });
    }
    navigate(`/projekte/${project.id}`);
  };

  const gradeCfg = GRADE_CFG[calc.grade];
  const hasInput = n(purchasePrice) > 0 || n(arv) > 0;

  return (
    <div className="page-container">
      {/* Flat header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5 sm:mb-6 px-1" data-tour="deal-analyzer">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] sm:text-[30px] font-bold text-foreground tracking-tight leading-[1.15] mb-1.5">
            Deal Analyzer
          </h1>
          <p className="text-[14px] text-muted-foreground max-w-2xl leading-relaxed">
            Analysiere Deals bevor du kaufst — GIK, Sanierungskosten, ARV und Cashflow-Projektion in einem Tool.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {/* Saved analyses dropdown */}
          <div className="relative" ref={savedRef}>
            <button
              onClick={() => setSavedOpen(!savedOpen)}
              className="btn btn-md btn-ghost"
            >
              <Bookmark size={16} />
              <span className="hidden sm:inline">Gespeichert</span>
              {analyses.length > 0 && (
                <span className="ml-1 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5 tabular-nums">{analyses.length}</span>
              )}
              <ChevronDown size={14} />
            </button>
            {savedOpen && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-dropdown border border-dropdown-line rounded-lg shadow-lg z-50 py-1 max-h-80 overflow-y-auto">
                {analyses.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground text-center">Keine gespeicherten Analysen</p>
                ) : (
                  analyses.map(a => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2 hover:bg-dropdown-item-hover transition-colors group">
                      <button
                        onClick={() => handleLoad(a.id)}
                        className="flex-1 text-left min-w-0 cursor-pointer"
                      >
                        <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.address || 'Keine Adresse'}</p>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                        className="shrink-0 p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button onClick={handleNew} className="btn btn-sm btn-primary">
            <Plus size={14} /> Neue Analyse
          </button>
        </div>
      </div>

      {/* ── Two-Column Layout ── */}
      <div className="grid lg:grid-cols-[1fr_420px] gap-6">

        {/* ═══ LEFT: Inputs ═══ */}
        <div className="flex flex-col gap-4">
          {/* Objekt */}
          <Section title="Objekt">
            <div className="grid sm:grid-cols-2 gap-3">
              <TextInput label="Bezeichnung" value={name} onChange={setName} placeholder="z.B. MFH Berliner Str. 5" />
              <TextInput label="Adresse" value={address} onChange={setAddress} placeholder="Straße, PLZ Ort" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <CurrencyInput label="Angebotspreis" value={askingPrice} onChange={setAskingPrice} />
              <CurrencyInput label="Dein Gebot / Kaufpreis" value={purchasePrice} onChange={setPurchasePrice} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <CurrencyInput label="ARV (After Repair Value)" value={arv} onChange={setArv} hint="Geschätzter Verkaufswert nach Sanierung" />
              <CurrencyInput label="Wohnfläche" value={sqm} onChange={setSqm} suffix="m²" />
            </div>
          </Section>

          {/* Sanierung */}
          <Section title="Sanierung">
            <div className="grid sm:grid-cols-2 gap-3">
              <CurrencyInput label="Sanierungskosten" value={renovationCost} onChange={setRenovationCost} />
              <CurrencyInput label="Sanierungsdauer" value={renovationMonths} onChange={setRenovationMonths} suffix="Monate" />
            </div>
          </Section>

          {/* Kaufnebenkosten */}
          <Section title="Kaufnebenkosten" defaultOpen={false} badge={
            <span className="text-xs text-muted-foreground tabular-nums">{(n(notarPercent) + n(grunderwerbsteuer) + n(maklerPercent)).toFixed(2)}%</span>
          }>
            <div className="grid sm:grid-cols-2 gap-3">
              <PercentInput label="Notar & Grundbuch" value={notarPercent} onChange={setNotarPercent} />
              <PercentInput label="Grunderwerbsteuer" value={grunderwerbsteuer} onChange={setGrunderwerbsteuer} hint="Berlin: 6%, Bayern: 3.5%, NRW: 6.5%" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <PercentInput label="Makler (Kauf)" value={maklerPercent} onChange={setMaklerPercent} />
              <PercentInput label="Makler (Verkauf)" value={verkaufsmakler} onChange={setVerkaufsmakler} />
            </div>
          </Section>

          {/* Finanzierung */}
          <Section title="Finanzierung & Haltekosten (optional)" defaultOpen={false}>
            <p className="text-xs text-muted-foreground mb-3">
              Nur ausgefüllte Felder werden in die Kalkulation einbezogen. Leer lassen für Cash-Deal ohne Finanzierung.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <CurrencyInput
                label="Eigenkapital"
                value={eigenkapital}
                onChange={(v) => setEigenkapital(v)}
                hint="Leer = kein Kredit"
              />
              <CurrencyInput
                label="Fremdkapital"
                value={eigenkapital.trim() === '' ? '' : String(Math.max(0, n(purchasePrice) - n(eigenkapital)))}
                onChange={(v) => {
                  // Fremdkapital editierbar: Eigenkapital wird daraus abgeleitet
                  const fk = parseFloat(v);
                  const pp = n(purchasePrice);
                  if (!isNaN(fk) && pp > 0) {
                    setEigenkapital(String(Math.max(0, pp - fk)));
                  } else if (v.trim() === '') {
                    setEigenkapital('');
                  }
                }}
                suffix="€"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <PercentInput label="Zinssatz p.a." value={zinssatz} onChange={setZinssatz} />
              <PercentInput label="Tilgung p.a." value={tilgung} onChange={setTilgung} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <CurrencyInput label="Haltekosten / Monat" value={holdingCosts} onChange={setHoldingCosts} hint="Versicherung, Grundsteuer, etc." />
              <CurrencyInput label="Mtl. Rate" value={calc.monatlicheRate ? calc.monatlicheRate.toFixed(0) : '0'} onChange={() => {}} suffix="€/M" />
            </div>
          </Section>

          {/* Notes */}
          <div className="bg-card border border-card-line rounded-xl shadow-2xs p-4">
            <label className="text-xs font-medium text-muted-foreground-2 mb-1 block">Notizen</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Freitext-Notizen zur Analyse..."
              rows={3}
              className="input resize-none"
            />
          </div>
        </div>

        {/* ═══ RIGHT: Results ═══ */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">

          {!hasInput ? (
            <div className="bg-card border border-card-line rounded-xl shadow-2xs p-8 flex flex-col items-center text-center">
              <SearchCheck size={32} className="text-muted-foreground mb-3" />
              <p className="text-sm font-semibold text-muted-foreground-2 mb-1">Gib Daten ein</p>
              <p className="text-xs text-muted-foreground">Kaufpreis und ARV eintragen um die Analyse zu starten.</p>
            </div>
          ) : (
            <>
              {/* Deal Score */}
              <div className={cn('rounded-xl border shadow-2xs p-5', gradeCfg.bg, `border-transparent ring-1 ${gradeCfg.ring}`)}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground-2 uppercase tracking-wide mb-1">Deal Score</p>
                    <p className={cn('text-4xl font-black tabular-nums', gradeCfg.text)}>{calc.grade}</p>
                    <p className={cn('text-sm font-medium mt-0.5', gradeCfg.text)}>{gradeCfg.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-2xl font-bold tabular-nums', calc.gewinn >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                      {formatCurrency(calc.gewinn)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Proj. Gewinn</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-black/5 dark:border-white/10">
                  <div>
                    <p className="text-xs text-muted-foreground">ROI</p>
                    <p className={cn('text-lg font-bold tabular-nums', gradeCfg.text)}>{calc.roi.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">p.a.</p>
                    <p className={cn('text-lg font-bold tabular-nums', gradeCfg.text)}>{calc.roiAnnualisiert.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">auf EK</p>
                    <p className={cn('text-lg font-bold tabular-nums', gradeCfg.text)}>
                      {n(eigenkapital) > 0 ? `${calc.roiEK.toFixed(1)}%` : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* MAO */}
              <div className="bg-card border border-card-line rounded-xl shadow-2xs p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-amber-500" />
                  <p className="text-xs font-semibold text-muted-foreground-2 uppercase tracking-wide">70%-Regel (MAO)</p>
                </div>
                <p className="text-xl font-bold tabular-nums text-foreground">{formatCurrency(calc.mao)}</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">Maximum Allowable Offer</p>
                {n(purchasePrice) > 0 && (
                  <div className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                    calc.maoAbweichung >= 0
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                  )}>
                    {calc.maoAbweichung >= 0
                      ? <TrendingUp size={12} />
                      : <AlertTriangle size={12} />
                    }
                    {calc.maoAbweichung >= 0
                      ? `${formatCurrency(calc.maoAbweichung)} unter MAO`
                      : `${formatCurrency(Math.abs(calc.maoAbweichung))} über MAO`
                    }
                  </div>
                )}
              </div>

              {/* Waterfall Chart */}
              <div className="bg-card border border-card-line rounded-xl shadow-2xs p-4">
                <p className="text-xs font-semibold text-muted-foreground-2 uppercase tracking-wide mb-3">Kostenaufstellung</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={waterfallData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip content={<ChartTooltip />} cursor={false} />
                      {calc.arvVal > 0 && (
                        <ReferenceLine y={calc.arvVal} stroke="#10b981" strokeDasharray="4 4" strokeWidth={2} />
                      )}
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {waterfallData.map((_, i) => (
                          <Cell key={i} fill={WATERFALL_COLORS[i % WATERFALL_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {calc.arvVal > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-4 h-0.5 bg-emerald-500 rounded" style={{ borderTop: '2px dashed #10b981' }} />
                    <span className="text-xs text-muted-foreground">ARV ({formatCurrency(calc.arvVal)})</span>
                  </div>
                )}
              </div>

              {/* Profit Table */}
              <div className="bg-card border border-card-line rounded-xl shadow-2xs overflow-hidden">
                <div className="px-4 py-3 border-b border-card-divider">
                  <p className="text-xs font-semibold text-muted-foreground-2 uppercase tracking-wide">Gewinn-Rechnung</p>
                </div>
                <div className="divide-y divide-card-divider">
                  {profitRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm text-muted-foreground-2">
                        {!row.positive && '- '}{row.label}
                      </span>
                      <span className={cn(
                        'text-sm font-medium tabular-nums',
                        row.positive ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {formatCurrency(row.value)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
                    <span className="text-sm font-bold text-foreground">= Gewinn</span>
                    <span className={cn(
                      'text-sm font-bold tabular-nums',
                      calc.gewinn >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {formatCurrency(calc.gewinn)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button onClick={handleSave} className="btn btn-md btn-primary w-full">
                  <Bookmark size={16} />
                  {activeId ? 'Analyse aktualisieren' : 'Analyse speichern'}
                </button>
                <button onClick={handleCreateProject} className="btn btn-md btn-ghost w-full">
                  <Building2 size={16} />
                  Als Projekt anlegen
                  <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
