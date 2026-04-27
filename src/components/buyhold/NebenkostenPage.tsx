import { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Check, Download, Save, Plus, Trash2 } from 'lucide-react';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useTenants } from '../../hooks/useTenants';
import { useUtilities } from '../../hooks/useUtilities';
import { useRentalContracts } from '../../hooks/useRentalContracts';
import { useExpenses } from '../../hooks/useExpenses';
import { useMeterReadings } from '../../hooks/useMeterReadings';
import { generateUtilityBillPDF } from '../../lib/pdfExport';
import { NumberInput } from '../ui/NumberInput';

type Verteilerschluessel = 'Wohnfläche' | 'Personenzahl' | 'Einheiten' | 'Verbrauch';

interface Kostenart {
  id: string;
  name: string;
  gesamtbetrag: number;
  schluessel: Verteilerschluessel;
  umlagefaehig: boolean;
}

const DEFAULT_KOSTENARTEN: Omit<Kostenart, 'id'>[] = [
  { name: 'Grundsteuer', gesamtbetrag: 0, schluessel: 'Wohnfläche', umlagefaehig: true },
  { name: 'Versicherung', gesamtbetrag: 0, schluessel: 'Wohnfläche', umlagefaehig: true },
  { name: 'Müllabfuhr', gesamtbetrag: 0, schluessel: 'Personenzahl', umlagefaehig: true },
  { name: 'Wasser', gesamtbetrag: 0, schluessel: 'Verbrauch', umlagefaehig: true },
  { name: 'Heizung', gesamtbetrag: 0, schluessel: 'Verbrauch', umlagefaehig: true },
  { name: 'Hausmeister', gesamtbetrag: 0, schluessel: 'Wohnfläche', umlagefaehig: true },
  { name: 'Gartenpflege', gesamtbetrag: 0, schluessel: 'Wohnfläche', umlagefaehig: true },
  { name: 'Allgemeinstrom', gesamtbetrag: 0, schluessel: 'Einheiten', umlagefaehig: true },
];

const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let nextId = 1;
function makeId() {
  return `k_${nextId++}`;
}

export function NebenkostenPage() {
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allTenants } = useTenants();
  const { allUtilities, allCosts } = useUtilities();
  const { allContracts } = useRentalContracts();
  const { items: allExpenses } = useExpenses();
  const { allReadings } = useMeterReadings();

  const [step, setStep] = useState(1);
  const [propertyId, setPropertyId] = useState('');
  const [von, setVon] = useState(`${new Date().getFullYear() - 1}-01-01`);
  const [bis, setBis] = useState(`${new Date().getFullYear() - 1}-12-31`);
  const [kostenarten, setKostenarten] = useState<Kostenart[]>(() =>
    DEFAULT_KOSTENARTEN.map((k) => ({ ...k, id: makeId() }))
  );
  const [saved, setSaved] = useState(false);

  const property = properties.find((p) => p.id === propertyId);
  const propertyUnits = allUnits.filter((u) => u.propertyId === propertyId);
  const propertyTenants = allTenants.filter((t) => t.propertyId === propertyId);
  const totalArea = property?.totalArea || propertyUnits.reduce((s, u) => s + u.area, 0) || 1;

  const contracts = allContracts;

  // Pre-fill actual costs from UtilityCosts (current year) and property expenses
  // falling back to monthlyAdvance*12 if no actuals recorded.
  const handlePropertyChange = (id: string) => {
    setPropertyId(id);
    setSaved(false);
    if (!id) return;

    const year = new Date(von).getFullYear();
    const propUtilities = allUtilities.filter((u) => u.propertyId === id);
    const costMap: Record<string, number> = {};

    // 1) UtilityCosts (Strom, Gas, Wasser, Heizung, Müllabfuhr, Grundsteuer, Versicherung, Hausverwaltung)
    propUtilities.forEach((u) => {
      const actual = allCosts.find((c) => c.utilityId === u.id && c.year === year);
      const total = actual ? actual.totalCost : u.monthlyAdvance * 12;
      costMap[u.type] = (costMap[u.type] || 0) + total;
    });

    // 2) Expenses im Zeitraum: Grundsteuer, Versicherung, Verwaltung, Hausgeld, Instandhaltung
    const fromTs = new Date(von).getTime();
    const toTs = new Date(bis).getTime();
    const propExpenses = allExpenses.filter(
      (e) => e.propertyId === id && new Date(e.date).getTime() >= fromTs && new Date(e.date).getTime() <= toTs,
    );
    propExpenses.forEach((e) => {
      const key = e.category === 'Instandhaltung' ? 'Hausmeister' : e.category;
      costMap[key] = (costMap[key] || 0) + e.amount;
    });

    setKostenarten((prev) =>
      prev.map((k) => {
        const match = costMap[k.name];
        return match !== undefined ? { ...k, gesamtbetrag: match } : k;
      }),
    );
  };

  // Verbrauchs-Delta pro Einheit aus MeterReadings:
  //   letztem Stand <= bis   –   erstem Stand >= von
  // Fallback auf Wohnflächen-Anteil wenn keine Zähler vorhanden.
  const consumptionSharesByUnit = useMemo<Record<string, number>>(() => {
    if (!propertyId) return {};
    const fromTs = new Date(von).getTime();
    const toTs = new Date(bis).getTime();
    const propReadings = allReadings.filter((r) => r.propertyId === propertyId);
    if (propReadings.length === 0) return {};

    // Pro Einheit: Summe der Deltas über alle Zähler der Einheit
    const unitDelta: Record<string, number> = {};
    propertyUnits.forEach((unit) => {
      const unitReadings = propReadings.filter((r) => r.unitId === unit.id);
      const meterIds = Array.from(new Set(unitReadings.map((r) => r.meterId)));
      let sum = 0;
      meterIds.forEach((mid) => {
        const sorted = unitReadings
          .filter((r) => r.meterId === mid)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const before = [...sorted].reverse().find((r) => new Date(r.date).getTime() <= fromTs) ?? sorted[0];
        const after = [...sorted].reverse().find((r) => new Date(r.date).getTime() <= toTs) ?? sorted[sorted.length - 1];
        if (before && after && after !== before) {
          sum += Math.max(0, after.value - before.value);
        }
      });
      if (sum > 0) unitDelta[unit.id] = sum;
    });

    const totalDelta = Object.values(unitDelta).reduce((s, v) => s + v, 0);
    if (totalDelta <= 0) return {};
    const shares: Record<string, number> = {};
    Object.entries(unitDelta).forEach(([uid, d]) => {
      shares[uid] = d / totalDelta;
    });
    return shares;
  }, [propertyId, allReadings, propertyUnits, von, bis]);

  const updateKostenart = (id: string, field: keyof Kostenart, value: string | number | boolean) => {
    setKostenarten((prev) =>
      prev.map((k) => (k.id === id ? { ...k, [field]: value } : k))
    );
  };

  const addKostenart = () => {
    setKostenarten((prev) => [
      ...prev,
      { id: makeId(), name: '', gesamtbetrag: 0, schluessel: 'Wohnfläche' as Verteilerschluessel, umlagefaehig: true },
    ]);
  };

  const removeKostenart = (id: string) => {
    setKostenarten((prev) => prev.filter((k) => k.id !== id));
  };

  const umlagefaehigeKosten = kostenarten.filter((k) => k.umlagefaehig);
  const gesamtUmlagefaehig = umlagefaehigeKosten.reduce((s, k) => s + k.gesamtbetrag, 0);

  // Compute per-tenant breakdown
  const tenantBreakdowns = useMemo(() => {
    const hasMeterData = Object.keys(consumptionSharesByUnit).length > 0;
    return propertyTenants.map((tenant) => {
      const unit = allUnits.find((u) => u.id === tenant.unitId);
      const unitArea = unit?.area || 0;
      const unitCount = propertyUnits.length || 1;
      const areaShare = totalArea > 0 ? unitArea / totalArea : 0;
      const unitShare = 1 / unitCount;
      const consumptionShare = unit ? consumptionSharesByUnit[unit.id] ?? 0 : 0;

      const items = umlagefaehigeKosten.map((k) => {
        let anteil = 0;
        let anteilLabel = '';
        switch (k.schluessel) {
          case 'Wohnfläche':
            anteil = areaShare;
            anteilLabel = `${(areaShare * 100).toFixed(1)}% (${unitArea}/${totalArea} m²)`;
            break;
          case 'Personenzahl':
            // Pro-Kopf-Verteilung: ohne Personendaten Gleichverteilung pro Einheit
            anteil = unitShare;
            anteilLabel = `${(unitShare * 100).toFixed(1)}% (1/${unitCount} Einheiten, Näherung)`;
            break;
          case 'Einheiten':
            anteil = unitShare;
            anteilLabel = `${(unitShare * 100).toFixed(1)}% (1/${unitCount})`;
            break;
          case 'Verbrauch':
            // HeizkostenV §7: mind. 50% nach Verbrauch, max. 50% nach Fläche.
            // Mit Zählerdaten: 70% Verbrauch + 30% Fläche.
            // Ohne Zählerdaten: Fläche als zulässige Näherung.
            if (hasMeterData && consumptionShare > 0) {
              anteil = 0.7 * consumptionShare + 0.3 * areaShare;
              anteilLabel = `${(anteil * 100).toFixed(1)}% (70% Verbrauch ${(consumptionShare * 100).toFixed(1)}% + 30% Fläche)`;
            } else {
              anteil = areaShare;
              anteilLabel = `${(areaShare * 100).toFixed(1)}% (Fläche, keine Zählerdaten)`;
            }
            break;
        }
        return {
          name: k.name,
          anteilLabel,
          betrag: k.gesamtbetrag * anteil,
        };
      });

      const tenantTotal = items.reduce((s, i) => s + i.betrag, 0);

      // Find contract for operating cost advances
      const contract = contracts.find((c) => c.tenantId === tenant.id && c.unitId === tenant.unitId);
      const monthlyAdvance = contract?.operatingCosts || 0;
      const yearlyAdvance = monthlyAdvance * 12;
      const difference = tenantTotal - yearlyAdvance;

      return {
        tenant,
        unit,
        unitArea,
        items,
        tenantTotal,
        monthlyAdvance,
        yearlyAdvance,
        difference,
      };
    });
  }, [propertyTenants, allUnits, umlagefaehigeKosten, totalArea, propertyUnits.length, contracts, consumptionSharesByUnit]);

  const handleExportPDF = (breakdown: (typeof tenantBreakdowns)[0]) => {
    if (!property || !breakdown.unit) return;
    const year = new Date(von).getFullYear();
    const areaShare = totalArea > 0 ? (breakdown.unitArea / totalArea) : 0;
    generateUtilityBillPDF({
      tenantName: breakdown.tenant.name,
      propertyName: property.name,
      propertyAddress: property.address,
      unitName: breakdown.unit.name,
      year,
      totalArea,
      unitArea: breakdown.unitArea,
      areaShare,
      costs: breakdown.items.map((i) => ({ type: i.name, provider: '', totalCost: i.betrag / (areaShare || 1) })),
      totalCosts: gesamtUmlagefaehig,
      tenantShare: breakdown.tenantTotal,
      monthlyAdvance: breakdown.monthlyAdvance,
      yearlyAdvance: breakdown.yearlyAdvance,
      difference: breakdown.difference,
      date: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }),
    });
  };

  const handleSaveDraft = () => {
    setSaved(true);
  };

  const canNext = (s: number) => {
    if (s === 1) return !!propertyId;
    if (s === 2) return kostenarten.some((k) => k.gesamtbetrag > 0);
    if (s === 3) return propertyTenants.length > 0;
    return false;
  };

  const stepLabels = [
    'Objekt & Zeitraum',
    'Kostenarten',
    'Vorschau je Mieter',
    'Abrechnung erstellen',
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Nebenkostenabrechnung</h1>
          <p className="page-subtitle">Erstelle rechtssichere Betriebskostenabrechnungen</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {stepLabels.map((label, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px" style={{ backgroundColor: isDone ? 'var(--accent)' : 'var(--border)' }} />}
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isActive
                      ? 'text-white'
                      : isDone
                        ? 'text-blue-400'
                        : 'text-muted-foreground'
                  }`}
                  style={{
                    backgroundColor: isActive ? 'var(--accent)' : isDone ? 'var(--accent-dim)' : 'var(--surface-hover)',
                  }}
                >
                  {isDone ? <Check size={14} /> : stepNum}
                </div>
                <span className={`text-xs hidden sm:inline ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 1: Objekt & Zeitraum */}
      {step === 1 && (
        <div className="surface">
          <div className="p-5">
            <h3 className="section-title">Objekt & Zeitraum wählen</h3>
            <p className="text-xs mt-0.5 mb-4 text-muted-foreground-2">Wähle das Objekt und den Abrechnungszeitraum</p>
            <div className="space-y-4">
              <div>
                <label className="input-label">Objekt</label>
                <select
                  value={propertyId || '__none__'}
                  onChange={(e) => handlePropertyChange(e.target.value === '__none__' ? '' : e.target.value)}
                  className="input"
                >
                  <option value="__none__">Bitte wählen...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {p.address}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Abrechnungszeitraum Von</label>
                  <input type="date" value={von} onChange={(e) => setVon(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="input-label">Abrechnungszeitraum Bis</label>
                  <input type="date" value={bis} onChange={(e) => setBis(e.target.value)} className="input" />
                </div>
              </div>

              {property && (
                <div className="rounded-[10px] p-4 text-sm space-y-1 bg-layer-hover">
                  <p><span className="text-muted-foreground-2">Gesamtflache:</span> <span className="text-foreground">{totalArea} m&sup2;</span></p>
                  <p><span className="text-muted-foreground-2">Einheiten:</span> <span className="text-foreground">{propertyUnits.length}</span></p>
                  <p><span className="text-muted-foreground-2">Mieter:</span> <span className="text-foreground">{propertyTenants.length}</span></p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Kostenarten */}
      {step === 2 && (
        <div className="surface">
          <div className="p-5">
            <h3 className="section-title">Kostenarten zuweisen</h3>
            <p className="text-xs mt-0.5 mb-4 text-muted-foreground-2">Gib die Gesamtkosten pro Kostenart ein und wähle den Verteilerschlüssel</p>
            <div className="surface overflow-hidden">
              <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-card-divider">
                    <th className="th min-w-[160px]">Kostenart</th>
                    <th className="th min-w-[120px]">Gesamtbetrag</th>
                    <th className="th min-w-[140px]">Verteilerschlüssel</th>
                    <th className="th text-center min-w-[90px]">Umlagefähig</th>
                    <th className="th w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {kostenarten.map((k) => (
                    <tr key={k.id} className="border-b border-card-divider">
                      <td className="td">
                        <input
                          value={k.name}
                          onChange={(e) => updateKostenart(k.id, 'name', e.target.value)}
                          className="input"
                        />
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-1">
                          <NumberInput
                            value={k.gesamtbetrag || ''}
                            onChange={(v) => updateKostenart(k.id, 'gesamtbetrag', v === '' ? 0 : v)}
                            suffix="€"
                            decimals={2}
                            className="input"
                          />
                        </div>
                      </td>
                      <td className="td">
                        <select
                          value={k.schluessel}
                          onChange={(e) => updateKostenart(k.id, 'schluessel', e.target.value)}
                          className="input"
                        >
                          <option value="Wohnfläche">Wohnfläche</option>
                          <option value="Personenzahl">Personenzahl</option>
                          <option value="Einheiten">Einheiten</option>
                          <option value="Verbrauch">Verbrauch</option>
                        </select>
                      </td>
                      <td className="td text-center">
                        <input
                          type="checkbox"
                          checked={k.umlagefaehig}
                          onChange={(e) => updateKostenart(k.id, 'umlagefaehig', e.target.checked)}
                          className="h-4 w-4 rounded border-card-line"
                        />
                      </td>
                      <td className="td">
                        <button
                          onClick={() => removeKostenart(k.id)}
                          className="text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <button onClick={addKostenart} className="btn btn-sm btn-secondary">
                <Plus size={14} />
                Kostenart hinzufügen
              </button>
              <div className="text-sm text-muted-foreground-2">
                Umlagefähig gesamt: <span className="font-semibold text-foreground">{fmt(gesamtUmlagefaehig)} EUR</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Vorschau je Mieter */}
      {step === 3 && (
        <div className="space-y-4">
          {tenantBreakdowns.length === 0 && (
            <div className="surface">
              <div className="empty-state">
                <p className="text-sm text-muted-foreground-2">Keine Mieter fur dieses Objekt gefunden.</p>
              </div>
            </div>
          )}
          {tenantBreakdowns.map((bd) => (
            <div key={bd.tenant.id} className="surface">
              <div className="p-5 pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="section-title">{bd.tenant.name}</h3>
                    <p className="text-xs mt-0.5 text-muted-foreground-2">
                      {bd.unit?.name || 'Keine Einheit'} &middot; {bd.unitArea} m&sup2;
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${bd.difference > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {bd.difference > 0 ? `Nachzahlung ${fmt(bd.difference)} EUR` : `Guthaben ${fmt(Math.abs(bd.difference))} EUR`}
                  </span>
                </div>
              </div>
              <div className="border-t border-card-divider"></div>
              <div className="p-5">
                <div className="surface overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-card-divider">
                        <th className="th">Kostenart</th>
                        <th className="th">Anteil</th>
                        <th className="th text-end">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bd.items.map((item) => (
                        <tr key={item.name} className="border-b border-card-divider">
                          <td className="td text-foreground">{item.name}</td>
                          <td className="td text-muted-foreground-2">{item.anteilLabel}</td>
                          <td className="td text-end tabular-nums text-foreground">{fmt(item.betrag)} EUR</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>

                <div className="my-3 border-t border-card-divider"></div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground-2">Gesamtanteil Mieter</span>
                    <span className="font-semibold tabular-nums text-foreground">{fmt(bd.tenantTotal)} EUR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground-2">Vorauszahlungen ({fmt(bd.monthlyAdvance)} EUR/M x 12)</span>
                    <span className="font-semibold tabular-nums text-foreground">{fmt(bd.yearlyAdvance)} EUR</span>
                  </div>
                  <div className="my-2 border-t border-card-divider"></div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-foreground">{bd.difference > 0 ? 'Nachzahlung' : 'Guthaben'}</span>
                    <span className={`tabular-nums ${bd.difference > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {fmt(Math.abs(bd.difference))} EUR
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 4: Abrechnung erstellen */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="surface">
            <div className="p-5">
              <h3 className="section-title">Zusammenfassung</h3>
              <p className="text-xs mt-0.5 mb-4 text-muted-foreground-2">Übersicht der Nebenkostenabrechnung</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="stat-label">Objekt</p>
                    <p className="text-sm font-semibold mt-0.5 text-foreground">{property?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="stat-label">Zeitraum</p>
                    <p className="text-sm font-semibold mt-0.5 text-foreground">
                      {new Date(von).toLocaleDateString('de-DE')} - {new Date(bis).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <div>
                    <p className="stat-label">Gesamtkosten</p>
                    <p className="text-sm font-semibold tabular-nums mt-0.5 text-foreground">{fmt(gesamtUmlagefaehig)} EUR</p>
                  </div>
                  <div>
                    <p className="stat-label">Mieter</p>
                    <p className="text-sm font-semibold mt-0.5 text-foreground">{tenantBreakdowns.length}</p>
                  </div>
                </div>

                <div className="border-t border-card-divider"></div>

                <div className="surface overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-card-divider">
                        <th className="th">Mieter</th>
                        <th className="th">Einheit</th>
                        <th className="th text-end">Anteil</th>
                        <th className="th text-end">Vorauszahlung</th>
                        <th className="th text-end">Ergebnis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenantBreakdowns.map((bd) => (
                        <tr key={bd.tenant.id} className="border-b border-card-divider">
                          <td className="td text-foreground">{bd.tenant.name}</td>
                          <td className="td text-muted-foreground-2">{bd.unit?.name || '-'}</td>
                          <td className="td text-end tabular-nums text-foreground">{fmt(bd.tenantTotal)} EUR</td>
                          <td className="td text-end tabular-nums text-foreground">{fmt(bd.yearlyAdvance)} EUR</td>
                          <td className="td text-end">
                            <span className={`text-sm font-semibold tabular-nums ${bd.difference > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                              {bd.difference > 0 ? `+${fmt(bd.difference)}` : `-${fmt(Math.abs(bd.difference))}`} EUR
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>

                <div className="border-t border-card-divider"></div>

                {!saved ? (
                  <div className="flex gap-3 flex-wrap">
                    {tenantBreakdowns.map((bd) => (
                      <button key={bd.tenant.id} onClick={() => handleExportPDF(bd)} className="btn btn-sm btn-secondary">
                        <Download size={14} />
                        PDF {bd.tenant.name}
                      </button>
                    ))}
                    <button onClick={handleSaveDraft} className="btn btn-sm btn-primary">
                      <Save size={14} />
                      Als Entwurf speichern
                    </button>
                  </div>
                ) : (
                  <div className="rounded-[10px] p-4 flex items-center gap-3" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}>
                      <Check size={16} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-400">Abrechnung wurde erstellt</p>
                      <p className="text-xs text-emerald-400/70">Der Entwurf wurde erfolgreich gespeichert.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          className="btn btn-md btn-secondary"
        >
          <ChevronLeft size={14} />
          Zurück
        </button>
        {step < 4 && (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext(step)}
            className="btn btn-md btn-primary"
          >
            Weiter
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
