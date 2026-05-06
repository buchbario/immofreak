import { useState, useRef, useMemo } from 'react';
import { ArrowLeft, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { useTenants } from '../../../hooks/useTenants';
import { useRentalProperties } from '../../../hooks/useRentalProperties';
import { useRentalUnits } from '../../../hooks/useRentalUnits';
import { useRentalContracts } from '../../../hooks/useRentalContracts';
import { useLandlordSettings } from '../../../hooks/useLandlordSettings';
import { exportElementToPDF } from '../../../lib/pdfExport';
import { NumberInput } from '../../ui/NumberInput';
import { BriefLayout } from './BriefLayout';

interface Props {
  onBack: () => void;
}

export function AdvancePaymentAdjustment({ onBack }: Props) {
  const { allTenants } = useTenants();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allContracts } = useRentalContracts();
  const { settings: landlord } = useLandlordSettings();
  const letterRef = useRef<HTMLDivElement>(null);

  const [tenantId, setTenantId] = useState('');
  const [billingYear, setBillingYear] = useState(new Date().getFullYear() - 1);
  const [actualCosts, setActualCosts] = useState(0);
  const [currentAdvance, setCurrentAdvance] = useState(0);
  const [newAdvance, setNewAdvance] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [bufferPercent, setBufferPercent] = useState(0);

  const tenant = allTenants.find((t) => t.id === tenantId);
  const unit = tenant ? allUnits.find((u) => u.id === tenant.unitId) : undefined;
  const property = tenant ? properties.find((p) => p.id === tenant.propertyId) : undefined;

  const today = new Date();
  const todayStr = today.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '___________';
  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const onSelectTenant = (val: string) => {
    const id = val === '__none__' ? '' : val;
    setTenantId(id);
    if (id) {
      const c = allContracts.find((x) => x.tenantId === id);
      if (c) setCurrentAdvance((c.operatingCosts || 0) + (c.heatingCosts || 0));
    }
  };

  // § 560 Abs. 4 BGB: Anpassung nach Abrechnung auf "angemessene Höhe"
  // idR: tatsächliche Kosten / 12 + optional kleiner Puffer
  const monthlyActual = actualCosts / 12;
  const suggestedAdvance = useMemo(() => {
    const base = monthlyActual;
    const withBuffer = base * (1 + bufferPercent / 100);
    return Math.round(withBuffer * 100) / 100;
  }, [monthlyActual, bufferPercent]);

  const diff = newAdvance - currentAdvance;
  const percentChange = currentAdvance > 0 ? (diff / currentAdvance) * 100 : 0;

  // § 560 Abs. 5 BGB: Sonderkündigungsrecht bei Anpassung (hier Monatsfrist gesetzlich nicht, aber gute Praxis: 1 Monat Vorlauf)
  const minEffectiveDate = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + 2, 1);
    return d;
  }, [todayStr]);
  const minEffectiveStr = minEffectiveDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  const effectiveValid = !effectiveFrom || new Date(effectiveFrom) >= minEffectiveDate;

  const ready = !!tenant && !!property && !!unit && actualCosts > 0 && newAdvance > 0 && !!effectiveFrom;

  const handleExport = async () => {
    if (!letterRef.current || !tenant) return;
    await exportElementToPDF(letterRef.current, `Vorauszahlungsanpassung_${tenant.name.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 pb-6">
        <button onClick={onBack} className="cursor-pointer transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">Vorauszahlungsanpassung</h1>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
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

              <div>
                <label className="input-label">Abrechnungsjahr</label>
                <NumberInput value={billingYear} onChange={(v) => setBillingYear(v === '' ? 0 : v)} decimals={0} className="input" />
              </div>

              <div>
                <label className="input-label">Tatsächliche Kosten lt. Abrechnung (pro Jahr)</label>
                <NumberInput value={actualCosts} onChange={(v) => setActualCosts(v === '' ? 0 : v)} suffix="€" decimals={2} placeholder="z. B. 2400" className="input" />
              </div>

              <div>
                <label className="input-label">Aktuelle Vorauszahlung (pro Monat)</label>
                <NumberInput value={currentAdvance} onChange={(v) => setCurrentAdvance(v === '' ? 0 : v)} suffix="€" decimals={2} className="input" />
              </div>

              <div>
                <label className="input-label">Sicherheitszuschlag</label>
                <NumberInput value={bufferPercent} onChange={(v) => setBufferPercent(v === '' ? 0 : v)} suffix="%" decimals={0} placeholder="0" className="input" />
                <p className="text-[10px] text-muted-foreground mt-1">BGH: max. ca. 10 % Zuschlag zulässig</p>
              </div>

              <div className="p-2.5 rounded-[10px] bg-layer-hover text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Tatsächl. Monatsschnitt</span><span className="font-medium">{fmt(monthlyActual)} €</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Empfohlene Anpassung</span><span className="font-medium text-blue-400">{fmt(suggestedAdvance)} €</span></div>
                <button onClick={() => setNewAdvance(suggestedAdvance)} className="btn btn-sm btn-ghost w-full mt-1 text-[11px]">Empfehlung übernehmen</button>
              </div>

              <div>
                <label className="input-label">Neue Vorauszahlung (pro Monat)</label>
                <NumberInput value={newAdvance} onChange={(v) => setNewAdvance(v === '' ? 0 : v)} suffix="€" decimals={2} className="input" />
                {newAdvance > 0 && currentAdvance > 0 && (
                  <div className={`text-[11px] mt-1 flex items-center gap-1 ${diff >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {diff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {diff >= 0 ? '+' : ''}{fmt(diff)} € ({diff >= 0 ? '+' : ''}{fmt(percentChange)} %)
                  </div>
                )}
              </div>

              <div>
                <label className="input-label">Wirksam ab</label>
                <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="input" />
                {!effectiveValid && (
                  <p className="text-[11px] text-red-400 mt-1">Mindestens 1 Monat Vorlauf empfohlen (frühestens {minEffectiveStr})</p>
                )}
              </div>

              <button onClick={handleExport} disabled={!ready} className="btn btn-md btn-primary w-full">
                <Download size={16} /> PDF herunterladen
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex justify-center overflow-auto pb-8">
          <div className="origin-top" style={{ transform: 'scale(var(--a4-scale, 0.75))' }}>
            {ready ? (
              <BriefLayout
                ref={letterRef}
                landlord={landlord}
                recipient={{
                  name: tenant!.name,
                  street: property!.address,
                  cityLine: unit!.name,
                }}
                subject={{
                  lines: [
                    property!.name,
                    `${property!.address}${unit ? `, ${unit.name}` : ''}`,
                    `Anpassung der Betriebskostenvorauszahlung — Abrechnungsjahr ${billingYear}`,
                  ],
                }}
                salutation={`Sehr geehrte/r ${tenant!.name},`}
              >
                <p style={{ marginBottom: '14px' }}>
                  nach der Betriebs- und Heizkostenabrechnung für das Kalenderjahr <strong>{billingYear}</strong> passen wir die monatliche Vorauszahlung gemäß § 560 Abs. 4 BGB auf eine angemessene Höhe an.
                </p>

                {/* Berechnung */}
                <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#f8f9fb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>Berechnung</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '3px 0' }}>Tatsächliche Kosten {billingYear}</td>
                        <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(actualCosts)} € / Jahr</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0' }}>Monatlicher Schnitt (÷ 12)</td>
                        <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(monthlyActual)} € / Monat</td>
                      </tr>
                      {bufferPercent > 0 && (
                        <tr>
                          <td style={{ padding: '3px 0' }}>Sicherheitszuschlag ({bufferPercent} %)</td>
                          <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600 }}>+ {fmt(monthlyActual * bufferPercent / 100)} €</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Vergleich */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div style={{ padding: '12px 14px', background: '#f3f4f6', borderRadius: '8px' }}>
                    <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Bisher</div>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>{fmt(currentAdvance)} €</div>
                    <div style={{ fontSize: '9.5px', color: '#6b7280' }}>monatlich</div>
                  </div>
                  <div style={{ padding: '12px 14px', background: diff >= 0 ? '#fef2f2' : '#ecfdf5', borderRadius: '8px', border: `1px solid ${diff >= 0 ? '#ef4444' : '#10b981'}` }}>
                    <div style={{ fontSize: '9px', color: diff >= 0 ? '#b91c1c' : '#065f46', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Neu ab {formatDate(effectiveFrom)}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: diff >= 0 ? '#dc2626' : '#10b981' }}>{fmt(newAdvance)} €</div>
                    <div style={{ fontSize: '9.5px', color: diff >= 0 ? '#b91c1c' : '#065f46' }}>{diff >= 0 ? '+' : ''}{fmt(diff)} € ({diff >= 0 ? '+' : ''}{fmt(percentChange)} %)</div>
                  </div>
                </div>

                <p style={{ marginBottom: '12px' }}>
                  Bitte passen Sie Ihren Dauerauftrag entsprechend zum <strong>{formatDate(effectiveFrom)}</strong> an. Bei bestehender Einzugsermächtigung erfolgt die Umstellung automatisch.
                </p>

                <div style={{ marginBottom: '14px', padding: '10px 12px', borderLeft: '3px solid #4F6BFF', background: '#f0f4ff', fontSize: '10.5px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '3px' }}>Rechtliche Grundlage</div>
                  Gemäß § 560 Abs. 4 BGB kann jede Vertragspartei nach einer Abrechnung die Vorauszahlungen auf eine angemessene Höhe anpassen.
                </div>
              </BriefLayout>
            ) : (
              <div
                style={{
                  width: '794px', minHeight: '1123px', background: '#ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '0 40px',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                }}
              >
                Bitte wähle einen Mieter und fülle Abrechnung + neue VZ aus.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
