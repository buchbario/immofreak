import { useState, useRef, useMemo } from 'react';
import { ArrowLeft, Download, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useTenants } from '../../../hooks/useTenants';
import { useRentalProperties } from '../../../hooks/useRentalProperties';
import { useRentalUnits } from '../../../hooks/useRentalUnits';
import { useUtilities } from '../../../hooks/useUtilities';
import { useRentalContracts } from '../../../hooks/useRentalContracts';
import { useMeterReadings } from '../../../hooks/useMeterReadings';
import { exportElementToPDF } from '../../../lib/pdfExport';
import { NumberInput } from '../../ui/NumberInput';

interface Props {
  onBack: () => void;
}

type DistributionKey = 'Wohnfläche' | 'Personenzahl' | 'Einheitenzahl' | 'Verbrauch';

interface CostEntry {
  id: string;
  label: string;
  provider: string;
  totalCost: number;
  distributionKey: DistributionKey;
  umlagefaehig: boolean;
  isHeating: boolean;
}

const NON_UMLAGEFAEHIG_HINTS = ['Hausverwaltung', 'Instandhaltung', 'Reparatur', 'Bank'];

function isLikelyNonUmlagefaehig(type: string) {
  return NON_UMLAGEFAEHIG_HINTS.some((h) => type.toLowerCase().includes(h.toLowerCase()));
}

function isHeatingType(type: string) {
  const t = type.toLowerCase();
  return t.includes('heiz') || t.includes('gas') || t.includes('fernwärme') || t.includes('öl');
}

function defaultDistributionKey(type: string): DistributionKey {
  if (isHeatingType(type)) return 'Verbrauch';
  if (type.toLowerCase().includes('wasser')) return 'Verbrauch';
  if (type.toLowerCase().includes('müll')) return 'Personenzahl';
  return 'Wohnfläche';
}

export function UtilityBillLetter({ onBack }: Props) {
  const { allTenants } = useTenants();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allUtilities, allCosts } = useUtilities();
  const { allContracts } = useRentalContracts();
  const { allReadings } = useMeterReadings();
  const letterRef = useRef<HTMLDivElement>(null);

  const [tenantId, setTenantId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [monthlyAdvance, setMonthlyAdvance] = useState(0);
  const [persons, setPersons] = useState(1);
  const [totalPersons, setTotalPersons] = useState(0);
  const [totalUnits, setTotalUnits] = useState(1);
  const [heatingConsumptionShare, setHeatingConsumptionShare] = useState(70);
  const [dueDate, setDueDate] = useState('');

  const tenant = allTenants.find((t) => t.id === tenantId);
  const unit = tenant ? allUnits.find((u) => u.id === tenant.unitId) : undefined;
  const property = tenant ? properties.find((p) => p.id === tenant.propertyId) : undefined;

  const totalArea = property?.totalArea || 1;
  const unitArea = unit?.area || 0;
  const areaShare = totalArea > 0 ? unitArea / totalArea : 0;
  const personShare = totalPersons > 0 ? persons / totalPersons : 0;
  const unitShare = totalUnits > 0 ? 1 / totalUnits : 0;

  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = (n: number) => (n * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  const onSelectTenant = (val: string) => {
    const id = val === '__none__' ? '' : val;
    setTenantId(id);
    const t = allTenants.find((x) => x.id === id);
    if (t) {
      const propUtilities = allUtilities.filter((u) => u.propertyId === t.propertyId);
      setCosts(propUtilities.map((u) => {
        // Echte Jahres-Ist-Kosten aus UtilityCosts, sonst Vorauszahlungs-Schätzung
        const actual = allCosts.find((c) => c.utilityId === u.id && c.year === year);
        const total = actual ? actual.totalCost : u.monthlyAdvance * 12;
        return {
          id: u.id,
          label: u.type,
          provider: u.provider,
          totalCost: total,
          distributionKey: defaultDistributionKey(u.type),
          umlagefaehig: !isLikelyNonUmlagefaehig(u.type),
          isHeating: isHeatingType(u.type),
        };
      }));
      const c = allContracts.find((x) => x.tenantId === id);
      if (c) {
        setMonthlyAdvance(c.operatingCosts + c.heatingCosts);
      } else {
        const totalAdv = propUtilities.reduce((s, u) => s + u.monthlyAdvance, 0);
        const propArea = properties.find((p) => p.id === t.propertyId)?.totalArea || 1;
        const tUnit = allUnits.find((u) => u.id === t.unitId);
        const share = tUnit ? tUnit.area / propArea : 1;
        setMonthlyAdvance(Math.round(totalAdv * share));
      }
      const prop = properties.find((p) => p.id === t.propertyId);
      if (prop) setTotalUnits(prop.units || 1);
      setPeriodStart(`${year}-01-01`);
      setPeriodEnd(`${year}-12-31`);
    }
  };

  const updateCost = <K extends keyof CostEntry>(idx: number, key: K, value: CostEntry[K]) => {
    setCosts((prev) => prev.map((c, i) => i === idx ? { ...c, [key]: value } : c));
  };

  const addCost = () => {
    setCosts((prev) => [...prev, {
      id: Math.random().toString(36).slice(2),
      label: 'Neue Kostenart',
      provider: '',
      totalCost: 0,
      distributionKey: 'Wohnfläche',
      umlagefaehig: true,
      isHeating: false,
    }]);
  };

  const removeCost = (idx: number) => {
    setCosts((prev) => prev.filter((_, i) => i !== idx));
  };

  const allocatableCosts = costs.filter((c) => c.umlagefaehig);
  const nonAllocatableCosts = costs.filter((c) => !c.umlagefaehig);

  // Verbrauchs-Anteil dieser Einheit aus MeterReadings (Delta im Zeitraum / Summe aller Delta-Werte)
  const consumptionShare = useMemo(() => {
    if (!property || !unit || !periodStart || !periodEnd) return 0;
    const fromTs = new Date(periodStart).getTime();
    const toTs = new Date(periodEnd).getTime();
    const propReadings = allReadings.filter((r) => r.propertyId === property.id);
    if (propReadings.length === 0) return 0;
    const propertyUnits = allUnits.filter((u) => u.propertyId === property.id);

    const deltaFor = (unitId: string) => {
      const unitReadings = propReadings.filter((r) => r.unitId === unitId);
      const meterIds = Array.from(new Set(unitReadings.map((r) => r.meterId)));
      let sum = 0;
      meterIds.forEach((mid) => {
        const sorted = unitReadings
          .filter((r) => r.meterId === mid)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const before = [...sorted].reverse().find((r) => new Date(r.date).getTime() <= fromTs) ?? sorted[0];
        const after = [...sorted].reverse().find((r) => new Date(r.date).getTime() <= toTs) ?? sorted[sorted.length - 1];
        if (before && after && after !== before) sum += Math.max(0, after.value - before.value);
      });
      return sum;
    };

    const unitDelta = deltaFor(unit.id);
    const totalDelta = propertyUnits.reduce((s, u) => s + deltaFor(u.id), 0);
    return totalDelta > 0 ? unitDelta / totalDelta : 0;
  }, [property, unit, periodStart, periodEnd, allReadings, allUnits]);

  const hasConsumptionData = consumptionShare > 0;

  const calculated = useMemo(() => {
    return allocatableCosts.map((c) => {
      let tenantAmount = 0;
      let shareDescription = '';
      let shareValue = 0;

      if (c.isHeating) {
        // HeizkostenV § 7: x% nach erfasstem Verbrauch + (100-x)% nach Wohnfläche
        const verbrauchPart = c.totalCost * (heatingConsumptionShare / 100);
        const grundPart = c.totalCost * (1 - heatingConsumptionShare / 100);
        const verbrauchWeight = hasConsumptionData ? consumptionShare : areaShare;
        tenantAmount = verbrauchPart * verbrauchWeight + grundPart * areaShare;
        shareDescription = hasConsumptionData
          ? `${heatingConsumptionShare}% Verbrauch (${(consumptionShare * 100).toFixed(1)}%) + ${100 - heatingConsumptionShare}% Fläche`
          : `${heatingConsumptionShare}% Verbrauch + ${100 - heatingConsumptionShare}% Grundkosten (beides nach m², kein Zähler)`;
        shareValue = verbrauchPart + grundPart > 0 ? tenantAmount / c.totalCost : areaShare;
      } else if (c.distributionKey === 'Wohnfläche') {
        tenantAmount = c.totalCost * areaShare;
        shareDescription = `${unitArea} m² / ${totalArea} m²`;
        shareValue = areaShare;
      } else if (c.distributionKey === 'Personenzahl') {
        tenantAmount = c.totalCost * personShare;
        shareDescription = `${persons} / ${totalPersons || '?'} Personen`;
        shareValue = personShare;
      } else if (c.distributionKey === 'Einheitenzahl') {
        tenantAmount = c.totalCost * unitShare;
        shareDescription = `1 / ${totalUnits} Einheiten`;
        shareValue = unitShare;
      } else if (c.distributionKey === 'Verbrauch') {
        if (hasConsumptionData) {
          tenantAmount = c.totalCost * consumptionShare;
          shareDescription = `Zähler-Delta ${(consumptionShare * 100).toFixed(1)}%`;
          shareValue = consumptionShare;
        } else {
          tenantAmount = c.totalCost * areaShare;
          shareDescription = `Verbrauchsanteil approximiert über ${unitArea} m² / ${totalArea} m²`;
          shareValue = areaShare;
        }
      }

      return { ...c, tenantAmount, shareDescription, shareValue };
    });
  }, [allocatableCosts, areaShare, personShare, unitShare, persons, totalPersons, totalUnits, unitArea, totalArea, heatingConsumptionShare, consumptionShare, hasConsumptionData]);

  const tenantShare = calculated.reduce((s, c) => s + c.tenantAmount, 0);
  const totalAllocatableCosts = allocatableCosts.reduce((s, c) => s + c.totalCost, 0);
  const totalNonAllocatableCosts = nonAllocatableCosts.reduce((s, c) => s + c.totalCost, 0);
  const yearlyAdvance = monthlyAdvance * 12;
  const difference = tenantShare - yearlyAdvance;

  const hasVerbrauchApprox = !hasConsumptionData && calculated.some((c) => (c.distributionKey === 'Verbrauch' && !c.isHeating) || c.isHeating);
  const hasHeating = calculated.some((c) => c.isHeating);
  const missingPersons = calculated.some((c) => c.distributionKey === 'Personenzahl' && totalPersons === 0);

  const handleExportPDF = async () => {
    if (!letterRef.current || !tenant) return;
    await exportElementToPDF(letterRef.current, `NK_Abrechnung_${year}_${tenant.name.replace(/\s/g, '_')}.pdf`);
  };

  const ready = !!tenant && !!property && !!unit && costs.length > 0;
  const objectionDeadline = new Date();
  objectionDeadline.setMonth(objectionDeadline.getMonth() + 12);
  const objectionDeadlineStr = objectionDeadline.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const formatDateStr = (d: string) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '___________';

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 pb-6">
        <button onClick={onBack} className="cursor-pointer transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">Nebenkostenabrechnung</h1>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Settings Panel */}
        <div className="w-full xl:w-[380px] flex-shrink-0">
          <div className="surface">
            <div className="p-5 space-y-4">
              <h2 className="section-title">Einstellungen</h2>

              <div>
                <label className="input-label">Mieter</label>
                <select value={tenantId || '__none__'} onChange={(e) => onSelectTenant(e.target.value)} className="input">
                  <option value="__none__">Wählen...</option>
                  {allTenants.map((t) => {
                    const p = properties.find((x) => x.id === t.propertyId);
                    return <option key={t.id} value={t.id}>{`${t.name} (${p?.name || '-'})`}</option>;
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Jahr</label>
                  <NumberInput value={year} onChange={(v) => setYear(v === '' ? 0 : v)} decimals={0} className="input" />
                </div>
                <div>
                  <label className="input-label">Fällig am</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Zeitraum von</label>
                  <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="input-label">bis</label>
                  <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Personen (Mieter)</label>
                  <NumberInput value={persons} onChange={(v) => setPersons(v === '' ? 0 : v)} decimals={0} className="input" />
                </div>
                <div>
                  <label className="input-label">Personen (gesamt)</label>
                  <NumberInput value={totalPersons || ''} onChange={(v) => setTotalPersons(v === '' ? 0 : v)} decimals={0} placeholder="z.B. 6" className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Einheiten gesamt</label>
                  <NumberInput value={totalUnits} onChange={(v) => setTotalUnits(v === '' ? 0 : v)} decimals={0} className="input" />
                </div>
                <div>
                  <label className="input-label">Heizung: Verbrauch</label>
                  <NumberInput value={heatingConsumptionShare} onChange={(v) => setHeatingConsumptionShare(v === '' ? 50 : v)} suffix="%" decimals={0} className="input" />
                  <p className="text-[10px] text-muted-foreground mt-1">HeizkostenV § 7: 50–70%</p>
                </div>
              </div>

              <div>
                <label className="input-label">Monatl. Vorauszahlung gesamt</label>
                <NumberInput value={monthlyAdvance || ''} onChange={(v) => setMonthlyAdvance(v === '' ? 0 : v)} suffix="€" decimals={2} className="input" />
              </div>

              {/* Cost entries */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="input-label !mb-0">Kostenarten</label>
                  <button onClick={addCost} className="btn btn-xs btn-ghost"><Plus size={12} /> Hinzufügen</button>
                </div>
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {costs.map((c, i) => (
                    <div key={c.id} className="p-2.5 rounded-[10px] surface text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input value={c.label} onChange={(e) => updateCost(i, 'label', e.target.value)} className="input input-xs flex-1" />
                        <button onClick={() => removeCost(i)} className="text-muted-foreground hover:text-[#ef4444] p-1">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <input value={c.provider} onChange={(e) => updateCost(i, 'provider', e.target.value)} placeholder="Versorger" className="input input-xs" />
                      <div className="flex gap-1.5">
                        <NumberInput value={c.totalCost || ''} onChange={(v) => updateCost(i, 'totalCost', v === '' ? 0 : v)} suffix="€" decimals={2} className="input input-xs flex-1" />
                        <select
                          value={c.distributionKey}
                          onChange={(e) => updateCost(i, 'distributionKey', e.target.value as DistributionKey)}
                          className="input input-xs flex-1"
                          disabled={c.isHeating}
                        >
                          <option value="Wohnfläche">Wohnfläche</option>
                          <option value="Personenzahl">Personenzahl</option>
                          <option value="Einheitenzahl">Einheitenzahl</option>
                          <option value="Verbrauch">Verbrauch</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] pt-0.5">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={c.umlagefaehig} onChange={(e) => updateCost(i, 'umlagefaehig', e.target.checked)} />
                          <span className={c.umlagefaehig ? 'text-foreground' : 'text-red-400'}>
                            {c.umlagefaehig ? 'Umlagefähig' : 'Nicht umlagefähig'}
                          </span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={c.isHeating} onChange={(e) => updateCost(i, 'isHeating', e.target.checked)} />
                          <span>Heizkosten</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {tenantId && (
                <div className="p-3 rounded-lg text-sm font-medium" style={{
                  backgroundColor: difference > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: difference > 0 ? '#f87171' : '#34d399',
                }}>
                  {difference > 0 ? `Nachzahlung: ${fmt(difference)} EUR` : `Guthaben: ${fmt(Math.abs(difference))} EUR`}
                </div>
              )}

              {(hasVerbrauchApprox || missingPersons) && (
                <div className="flex items-start gap-2 p-3 rounded-lg text-xs" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    {hasVerbrauchApprox && <p>Verbrauchsabhängige Kosten ohne Zählerdaten werden über Wohnfläche approximiert — das ist rechtlich angreifbar.</p>}
                    {missingPersons && <p>Personenschlüssel benötigt Gesamtpersonenzahl.</p>}
                  </div>
                </div>
              )}

              <button onClick={handleExportPDF} disabled={!ready} className="btn btn-md btn-primary w-full">
                <Download size={16} /> PDF herunterladen
              </button>
            </div>
          </div>
        </div>

        {/* DIN A4 Preview */}
        <div className="flex-1 flex justify-center overflow-auto pb-8">
          <div className="origin-top" style={{ transform: 'scale(var(--a4-scale, 0.75))' }}>
            <div
              ref={letterRef}
              style={{
                width: '794px',
                minHeight: '1123px',
                background: '#ffffff',
                color: '#1a1a1a',
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                padding: '70px 60px 60px 60px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                position: 'relative',
              }}
            >
              {ready ? (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #2563eb, #60a5fa)' }} />

                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a2e' }}>{property!.name}</div>
                      <div style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '2px' }}>{property!.address}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Datum</div>
                      <div style={{ fontSize: '11px', color: '#374151', marginTop: '2px' }}>{today}</div>
                    </div>
                  </div>

                  {/* Recipient */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '4px' }}>An</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a2e' }}>{tenant!.name}</div>
                    <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '1px' }}>{unit!.name}, {property!.address}</div>
                  </div>

                  {/* Subject */}
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px', paddingBottom: '10px', borderBottom: '2px solid #e5e7eb' }}>
                    Betriebs- und Heizkostenabrechnung für das Abrechnungsjahr {year}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '16px' }}>
                    Abrechnungszeitraum: {formatDateStr(periodStart)} – {formatDateStr(periodEnd)}
                  </div>

                  {/* Body */}
                  <div style={{ fontSize: '10.5px', lineHeight: '1.6', color: '#374151' }}>
                    <p style={{ marginBottom: '10px' }}>Sehr geehrte/r {tenant!.name},</p>
                    <p style={{ marginBottom: '14px' }}>
                      gemäß § 556 Abs. 3 BGB erhalten Sie hiermit die Betriebs- und Heizkostenabrechnung für Ihre Wohnung {unit!.name} in {property!.address} für den oben genannten Abrechnungszeitraum.
                    </p>

                    {/* Object data */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px',
                      padding: '10px 12px', background: '#f8f9fb', borderRadius: '6px', border: '1px solid #e5e7eb',
                    }}>
                      <div>
                        <div style={{ fontSize: '8.5px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Gesamtfläche</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '2px' }}>{totalArea} m²</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '8.5px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Ihre Fläche</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '2px' }}>{unitArea} m²</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '8.5px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Flächenanteil</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '2px', color: '#2563eb' }}>{fmtPct(areaShare)} %</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '8.5px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Einheiten</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '2px' }}>{totalUnits}</div>
                      </div>
                    </div>

                    {/* Detailed allocation table */}
                    <div style={{ marginBottom: '14px', borderRadius: '6px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 1.1fr 0.7fr 0.8fr', padding: '8px 12px', background: '#f3f4f6', fontSize: '8.5px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', gap: '6px' }}>
                        <span>Kostenart</span>
                        <span>Gesamt</span>
                        <span>Verteiler</span>
                        <span>Anteil</span>
                        <span style={{ textAlign: 'right' }}>Ihr Anteil</span>
                      </div>
                      {calculated.map((c) => (
                        <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 1.1fr 0.7fr 0.8fr', padding: '7px 12px', borderTop: '1px solid #f3f4f6', fontSize: '10px', gap: '6px' }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{c.label}</span>
                            {c.provider && <span style={{ color: '#9ca3af', fontSize: '9px' }}> · {c.provider}</span>}
                          </div>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(c.totalCost)} €</span>
                          <span style={{ fontSize: '9px', color: '#6b7280' }}>
                            {c.isHeating ? 'Heizkosten (HeizkostenV § 7)' : c.distributionKey}
                          </span>
                          <span style={{ fontSize: '9px', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{c.shareDescription}</span>
                          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{fmt(c.tenantAmount)} €</span>
                        </div>
                      ))}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 1.1fr 0.7fr 0.8fr', padding: '9px 12px', borderTop: '2px solid #e5e7eb', fontSize: '10.5px', fontWeight: 700, background: '#fafbfc', gap: '6px' }}>
                        <span>Summe umlagefähig</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(totalAllocatableCosts)} €</span>
                        <span />
                        <span />
                        <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{fmt(tenantShare)} €</span>
                      </div>
                    </div>

                    {/* Non-allocatable costs */}
                    {nonAllocatableCosts.length > 0 && (
                      <div style={{ marginBottom: '14px', borderRadius: '6px', border: '1px dashed #d1d5db', padding: '8px 12px' }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>
                          Nicht umlagefähig (informativ, nicht in Abrechnung)
                        </div>
                        {nonAllocatableCosts.map((c) => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#9ca3af', padding: '2px 0' }}>
                            <span>{c.label}{c.provider && ` · ${c.provider}`}</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(c.totalCost)} €</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', fontWeight: 600, color: '#6b7280', paddingTop: '4px', marginTop: '4px', borderTop: '1px solid #e5e7eb' }}>
                          <span>Summe</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(totalNonAllocatableCosts)} €</span>
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    <div style={{
                      background: difference > 0 ? '#fef2f2' : '#f0fdf4',
                      borderRadius: '6px', padding: '12px 16px', marginBottom: '14px',
                      border: `1px solid ${difference > 0 ? '#fecaca' : '#bbf7d0'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '10.5px' }}>
                        <span style={{ color: '#6b7280' }}>Ihr Gesamtanteil an den umlagefähigen Kosten</span>
                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(tenantShare)} EUR</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10.5px' }}>
                        <span style={{ color: '#6b7280' }}>abzgl. geleistete Vorauszahlungen ({fmt(monthlyAdvance)} EUR × 12)</span>
                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>−{fmt(yearlyAdvance)} EUR</span>
                      </div>
                      <div style={{ borderTop: `1px solid ${difference > 0 ? '#fecaca' : '#bbf7d0'}`, paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: '11px' }}>{difference > 0 ? 'Nachzahlung' : 'Guthaben zu Ihren Gunsten'}</span>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: difference > 0 ? '#dc2626' : '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(Math.abs(difference))} EUR
                        </span>
                      </div>
                    </div>

                    {/* Payment instructions */}
                    <p style={{ marginBottom: '10px', fontSize: '10px' }}>
                      {difference > 0
                        ? `Bitte überweisen Sie den Betrag von ${fmt(difference)} EUR bis spätestens ${formatDateStr(dueDate)} auf das Ihnen bekannte Konto.`
                        : `Das Guthaben in Höhe von ${fmt(Math.abs(difference))} EUR wird Ihnen mit der nächsten Mietzahlung verrechnet oder auf Wunsch überwiesen.`
                      }
                    </p>

                    {/* Legal notes */}
                    <div style={{ marginTop: '14px', padding: '10px 12px', background: '#f8f9fb', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '9px', lineHeight: '1.5', color: '#4b5563' }}>
                      <div style={{ fontWeight: 700, marginBottom: '4px', color: '#1a1a2e', fontSize: '9.5px' }}>Rechtliche Hinweise</div>
                      <p style={{ marginBottom: '4px' }}>
                        <strong>Einwendungsfrist:</strong> Einwendungen gegen diese Abrechnung können Sie innerhalb von 12 Monaten nach Zugang, d. h. bis spätestens {objectionDeadlineStr}, schriftlich geltend machen (§ 556 Abs. 3 Satz 5 BGB).
                      </p>
                      <p style={{ marginBottom: '4px' }}>
                        <strong>Belegeinsicht:</strong> Die zugrunde liegenden Originalbelege (Rechnungen, Verbrauchswerte) können nach vorheriger Terminvereinbarung eingesehen werden (§ 259 Abs. 1 BGB).
                      </p>
                      {hasHeating && (
                        <p style={{ marginBottom: '4px' }}>
                          <strong>Heizkostenabrechnung:</strong> Die Verteilung erfolgt zu {heatingConsumptionShare}% nach erfasstem Verbrauch und zu {100 - heatingConsumptionShare}% nach Wohnfläche gemäß § 7 HeizkostenV.
                        </p>
                      )}
                      {hasVerbrauchApprox && (
                        <p style={{ marginBottom: '4px', color: '#b45309' }}>
                          <strong>Hinweis:</strong> Für verbrauchsabhängige Positionen ohne Zählerdaten wurde hilfsweise der Flächenschlüssel angesetzt.
                        </p>
                      )}
                      <p>
                        Die Abrechnung wurde nach den Grundsätzen der Betriebskostenverordnung (BetrKV) und der Heizkostenverordnung (HeizkostenV) erstellt. Nicht umlagefähige Kosten (z. B. Verwaltungs- oder Instandhaltungskosten) sind nicht enthalten.
                      </p>
                    </div>

                    <p style={{ marginTop: '14px', marginBottom: '10px', fontSize: '10px' }}>
                      Bei Rückfragen stehe ich Ihnen gerne zur Verfügung.
                    </p>
                    <p style={{ marginBottom: '24px', fontSize: '10px' }}>Mit freundlichen Grüßen</p>

                    <div style={{ borderTop: '1px solid #d1d5db', width: '200px', paddingTop: '6px' }}>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>Vermieter / Hausverwaltung</div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{
                    borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '20px',
                    display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#9ca3af',
                  }}>
                    <span>{property!.name} · {property!.address}</span>
                    <span>Nebenkostenabrechnung {year} · {today}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '1000px', color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '0 40px' }}>
                  Bitte wähle einen Mieter und erfasse Kostenarten, um die Vorschau zu sehen.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
