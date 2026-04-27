import { useState, useRef, useMemo } from 'react';
import { ArrowLeft, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTenants } from '../../../hooks/useTenants';
import { useRentalProperties } from '../../../hooks/useRentalProperties';
import { useRentalUnits } from '../../../hooks/useRentalUnits';
import { useRentalContracts } from '../../../hooks/useRentalContracts';
import { exportElementToPDF } from '../../../lib/pdfExport';
import { NumberInput } from '../../ui/NumberInput';

interface Props {
  onBack: () => void;
}

type AdjustmentType = 'index' | 'staffel';

export function IndexRentAdjustment({ onBack }: Props) {
  const { allTenants } = useTenants();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allContracts } = useRentalContracts();
  const letterRef = useRef<HTMLDivElement>(null);

  const [tenantId, setTenantId] = useState('');
  const [type, setType] = useState<AdjustmentType>('index');

  // Index: VPI base + current
  const [vpiBaseMonth, setVpiBaseMonth] = useState('');
  const [vpiBaseValue, setVpiBaseValue] = useState(105.0);
  const [vpiNewMonth, setVpiNewMonth] = useState('');
  const [vpiNewValue, setVpiNewValue] = useState(115.0);
  const [lastAdjustmentDate, setLastAdjustmentDate] = useState('');

  // Staffel: direkt neue Miete + nächste Stufen
  const [currentRent, setCurrentRent] = useState(0);
  const [newRent, setNewRent] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState('');

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
      if (c) setCurrentRent(c.rentAmount || 0);
    }
  };

  // Index-Berechnung: ((new/base) - 1) * currentRent
  const indexChange = vpiBaseValue > 0 ? (vpiNewValue / vpiBaseValue - 1) * 100 : 0;
  const indexNewRent = useMemo(() => {
    if (vpiBaseValue <= 0) return currentRent;
    return Math.round(currentRent * (vpiNewValue / vpiBaseValue) * 100) / 100;
  }, [currentRent, vpiBaseValue, vpiNewValue]);

  // § 557b Abs. 2 BGB: frühestens 1 Jahr nach der letzten Anpassung
  const oneYearSinceLast = useMemo(() => {
    if (!lastAdjustmentDate) return null;
    const d = new Date(lastAdjustmentDate);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }, [lastAdjustmentDate]);

  const waitedLongEnough = !oneYearSinceLast || today >= oneYearSinceLast;

  // § 557b Abs. 3: wirksam frühestens ab übernächstem Monatsersten
  const minEffective = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + 2, 1);
    return d;
  }, [todayStr]);
  const minEffectiveStr = minEffective.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  const effectiveValid = !effectiveFrom || new Date(effectiveFrom) >= minEffective;

  const finalNewRent = type === 'index' ? indexNewRent : newRent;
  const diff = finalNewRent - currentRent;
  const percentChange = currentRent > 0 ? (diff / currentRent) * 100 : 0;

  const hasErrors = type === 'index' && (!waitedLongEnough || !effectiveValid);
  const ready = !!tenant && !!property && !!unit && currentRent > 0 && !!effectiveFrom && finalNewRent > 0;

  const handleExport = async () => {
    if (!letterRef.current || !tenant) return;
    await exportElementToPDF(letterRef.current, `${type === 'index' ? 'Indexmiete' : 'Staffelmiete'}_${tenant.name.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 pb-6">
        <button onClick={onBack} className="cursor-pointer transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">Staffel- / Indexmiete</h1>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="w-full xl:w-[400px] flex-shrink-0">
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
                <label className="input-label">Anpassungsart</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setType('index')} className={`btn btn-md ${type === 'index' ? 'btn-primary' : 'btn-ghost'}`}>Indexmiete</button>
                  <button onClick={() => setType('staffel')} className={`btn btn-md ${type === 'staffel' ? 'btn-primary' : 'btn-ghost'}`}>Staffelmiete</button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {type === 'index' ? '§ 557b BGB — Bindung an VPI' : '§ 557a BGB — feste Staffeln im Vertrag'}
                </p>
              </div>

              <div>
                <label className="input-label">Aktuelle Nettokaltmiete (pro Monat)</label>
                <NumberInput value={currentRent} onChange={(v) => setCurrentRent(v === '' ? 0 : v)} suffix="€" decimals={2} className="input" />
              </div>

              {type === 'index' ? (
                <>
                  <div>
                    <label className="input-label">VPI-Basis (Monat/Jahr)</label>
                    <div className="grid grid-cols-[1fr_110px] gap-2">
                      <input value={vpiBaseMonth} onChange={(e) => setVpiBaseMonth(e.target.value)} placeholder="z. B. Oktober 2022" className="input" />
                      <NumberInput value={vpiBaseValue} onChange={(v) => setVpiBaseValue(v === '' ? 0 : v)} decimals={1} className="input" />
                    </div>
                  </div>

                  <div>
                    <label className="input-label">VPI aktuell (Monat/Jahr)</label>
                    <div className="grid grid-cols-[1fr_110px] gap-2">
                      <input value={vpiNewMonth} onChange={(e) => setVpiNewMonth(e.target.value)} placeholder="z. B. März 2026" className="input" />
                      <NumberInput value={vpiNewValue} onChange={(v) => setVpiNewValue(v === '' ? 0 : v)} decimals={1} className="input" />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Destatis Verbraucherpreisindex (Basis 2020 = 100)</p>
                  </div>

                  <div>
                    <label className="input-label">Letzte Anpassung</label>
                    <input type="date" value={lastAdjustmentDate} onChange={(e) => setLastAdjustmentDate(e.target.value)} className="input" />
                    {lastAdjustmentDate && !waitedLongEnough && (
                      <p className="text-[11px] text-red-400 mt-1">Mindestens 1 Jahr seit letzter Anpassung erforderlich (§ 557b Abs. 2 BGB)</p>
                    )}
                  </div>

                  <div className="p-3 rounded-[10px] bg-layer-hover text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Indexveränderung</span><span className="font-medium">{fmt(indexChange)} %</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Neue Miete</span><span className="font-medium text-blue-400">{fmt(indexNewRent)} €</span></div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="input-label">Neue Miete lt. Staffel (pro Monat)</label>
                  <NumberInput value={newRent} onChange={(v) => setNewRent(v === '' ? 0 : v)} suffix="€" decimals={2} className="input" />
                  <p className="text-[10px] text-muted-foreground mt-1">Staffelbetrag muss bereits im Ursprungsvertrag vereinbart sein (§ 557a Abs. 1 BGB)</p>
                </div>
              )}

              <div>
                <label className="input-label">Wirksam ab</label>
                <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="input" />
                {!effectiveValid && (
                  <p className="text-[11px] text-red-400 mt-1">
                    {type === 'index'
                      ? `Frühestens ${minEffectiveStr} (§ 557b Abs. 3 BGB — übernächster Monatserster)`
                      : `Frühestens ${minEffectiveStr}`}
                  </p>
                )}
              </div>

              {/* Validation badges */}
              <div className="space-y-2">
                {type === 'index' && (
                  <div className="p-2.5 rounded-[10px] text-xs" style={{ backgroundColor: waitedLongEnough ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                    <div className="flex items-start gap-2">
                      {waitedLongEnough ? <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />}
                      <p className={waitedLongEnough ? 'text-emerald-400' : 'text-red-400'}>
                        Jahresfrist § 557b Abs. 2: {waitedLongEnough ? 'Eingehalten' : 'Nicht erreicht'}
                      </p>
                    </div>
                  </div>
                )}
                {effectiveFrom && (
                  <div className="p-2.5 rounded-[10px] text-xs" style={{ backgroundColor: effectiveValid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                    <div className="flex items-start gap-2">
                      {effectiveValid ? <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />}
                      <p className={effectiveValid ? 'text-emerald-400' : 'text-red-400'}>
                        Wirksamkeitstermin: {effectiveValid ? 'Zulässig' : 'Zu früh'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={handleExport} disabled={!ready || hasErrors} className="btn btn-md btn-primary w-full">
                <Download size={16} /> PDF herunterladen
              </button>
            </div>
          </div>
        </div>

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
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #4F6BFF, #f59e0b)' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 700 }}>{property!.name}</div>
                      <div style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '2px' }}>{property!.address}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Datum</div>
                      <div style={{ fontSize: '11px', marginTop: '2px' }}>{todayStr}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '28px' }}>
                    <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '4px' }}>An</div>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{tenant!.name}</div>
                    <div style={{ fontSize: '11px', color: '#4b5563' }}>{unit!.name}, {property!.address}</div>
                  </div>

                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px', paddingBottom: '10px', borderBottom: '2px solid #e5e7eb' }}>
                    {type === 'index' ? 'Mitteilung der Indexmietanpassung' : 'Mitteilung der Staffelmietanpassung'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '18px' }}>
                    Rechtsgrundlage: {type === 'index' ? '§ 557b BGB' : '§ 557a BGB'} &nbsp;|&nbsp; Wirksam ab {formatDate(effectiveFrom)}
                  </div>

                  <p style={{ fontSize: '11px', lineHeight: '1.7', marginBottom: '14px' }}>
                    Sehr geehrte/r {tenant!.name},
                  </p>
                  <p style={{ fontSize: '11px', lineHeight: '1.7', marginBottom: '18px' }}>
                    {type === 'index'
                      ? <>
                          gemäß der in Ihrem Mietvertrag über die Wohnung <strong>{unit!.name}</strong> vereinbarten Indexmiete (§ 557b BGB) passen wir die monatliche Nettokaltmiete auf Grundlage der Entwicklung des Verbraucherpreisindex (VPI) für Deutschland (Statistisches Bundesamt) wie folgt an:
                        </>
                      : <>
                          gemäß der in Ihrem Mietvertrag über die Wohnung <strong>{unit!.name}</strong> vereinbarten Staffelmiete (§ 557a BGB) weisen wir Sie auf die kommende Staffelstufe hin:
                        </>
                    }
                  </p>

                  {/* Berechnung */}
                  {type === 'index' && (
                    <div style={{ marginBottom: '20px', padding: '14px 16px', background: '#f8f9fb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>Indexberechnung</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '6px 0' }}>VPI {vpiBaseMonth || 'Basis'}</td>
                            <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(vpiBaseValue)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '6px 0' }}>VPI {vpiNewMonth || 'aktuell'}</td>
                            <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(vpiNewValue)}</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '6px 0' }}>Indexveränderung</td>
                            <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: indexChange >= 0 ? '#dc2626' : '#10b981' }}>{indexChange >= 0 ? '+' : ''}{fmt(indexChange)} %</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '6px 0' }}>Berechnung</td>
                            <td style={{ padding: '6px 0', textAlign: 'right', fontSize: '9.5px', color: '#6b7280' }}>
                              {fmt(currentRent)} € × {fmt(vpiNewValue)} / {fmt(vpiBaseValue)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <p style={{ fontSize: '9px', color: '#6b7280', marginTop: '6px', fontStyle: 'italic' }}>
                        Quelle: Statistisches Bundesamt, VPI Deutschland (Basis 2020 = 100)
                      </p>
                    </div>
                  )}

                  {/* Vergleich */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                    <div style={{ padding: '14px 16px', background: '#f3f4f6', borderRadius: '8px' }}>
                      <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>Bisherige Nettokaltmiete</div>
                      <div style={{ fontSize: '18px', fontWeight: 700 }}>{fmt(currentRent)} €</div>
                    </div>
                    <div style={{ padding: '14px 16px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #ef4444' }}>
                      <div style={{ fontSize: '9px', color: '#b91c1c', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>Neue Nettokaltmiete ab {formatDate(effectiveFrom)}</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>{fmt(finalNewRent)} €</div>
                      <div style={{ fontSize: '9.5px', color: '#b91c1c' }}>+ {fmt(diff)} € ({diff >= 0 ? '+' : ''}{fmt(percentChange)} %)</div>
                    </div>
                  </div>

                  <p style={{ fontSize: '11px', lineHeight: '1.7', marginBottom: '14px' }}>
                    Die Anpassung erfolgt automatisch zum genannten Zeitpunkt; eine Zustimmung Ihrerseits ist nicht erforderlich. Bitte passen Sie gegebenenfalls Ihren Dauerauftrag zum <strong>{formatDate(effectiveFrom)}</strong> an.
                  </p>

                  {/* Rechtlicher Hinweis */}
                  <div style={{ marginBottom: '20px', padding: '10px 12px', borderLeft: '3px solid #4F6BFF', background: '#f0f4ff', fontSize: '9.5px', color: '#1e40af', lineHeight: '1.55' }}>
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>{type === 'index' ? 'Voraussetzungen einer Indexmietanpassung' : 'Voraussetzungen der Staffelmiete'}</div>
                    {type === 'index'
                      ? <>• Die Miete muss zum Zeitpunkt der Änderung mindestens ein Jahr unverändert gewesen sein (§ 557b Abs. 2 BGB).<br />• Die geänderte Miete muss schriftlich mitgeteilt werden (§ 557b Abs. 3 BGB), frühestens ab dem übernächsten Monatsersten wirksam.<br />• Ausgeschlossen ist eine zusätzliche Mieterhöhung nach § 558 BGB (Vergleichsmiete) oder § 559 BGB (Modernisierung mit Ausnahmen).</>
                      : <>• Staffelbeträge müssen im Mietvertrag exakt beziffert sein (§ 557a Abs. 1 BGB).<br />• Zwischen zwei Staffelstufen müssen mindestens 12 Monate liegen (§ 557a Abs. 2 BGB).<br />• Während der Staffelmiete ausgeschlossen: Mieterhöhung nach § 558 BGB. § 559 BGB (Modernisierung) nur bei Anordnung durch Behörde.</>
                    }
                  </div>

                  <p style={{ fontSize: '11px', lineHeight: '1.7', marginBottom: '10px' }}>Mit freundlichen Grüßen</p>
                  <div style={{ marginTop: '30px', borderTop: '1px solid #1a1a2e', paddingTop: '5px', fontSize: '10px', color: '#6b7280', maxWidth: '220px' }}>
                    Vermieter / Hausverwaltung
                  </div>

                  <div style={{ position: 'absolute', bottom: '30px', left: '60px', right: '60px', fontSize: '8.5px', color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{property!.name}, {property!.address}</span>
                    <span>{type === 'index' ? '§ 557b BGB — Indexmiete' : '§ 557a BGB — Staffelmiete'}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '1000px', color: '#9ca3af', fontSize: '13px' }}>
                  Bitte wähle einen Mieter und gib die Anpassung ein.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
