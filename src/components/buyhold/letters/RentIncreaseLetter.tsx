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

type Reason = 'mietspiegel' | 'vergleichswohnungen' | 'sachverstaendigengutachten' | 'mietdatenbank';

const REASONS: { id: Reason; label: string; description: string }[] = [
  { id: 'mietspiegel', label: 'Mietspiegel', description: 'Bezug auf einfachen oder qualifizierten Mietspiegel (§ 558c/d BGB)' },
  { id: 'vergleichswohnungen', label: 'Vergleichswohnungen', description: 'Drei vergleichbare Wohnungen (§ 558a Abs. 2 Nr. 4 BGB)' },
  { id: 'sachverstaendigengutachten', label: 'Sachverständigengutachten', description: 'Gutachten eines öffentlich bestellten Sachverständigen' },
  { id: 'mietdatenbank', label: 'Mietdatenbank', description: 'Auszug aus einer Mietdatenbank (§ 558e BGB)' },
];

export function RentIncreaseLetter({ onBack }: Props) {
  const { allTenants } = useTenants();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allContracts } = useRentalContracts();
  const letterRef = useRef<HTMLDivElement>(null);

  const [tenantId, setTenantId] = useState('');
  const [newRent, setNewRent] = useState(0);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [lastIncreaseDate, setLastIncreaseDate] = useState('');
  const [reason, setReason] = useState<Reason>('mietspiegel');
  const [reasonText, setReasonText] = useState('');
  const [kappungsgrenzeStrict, setKappungsgrenzeStrict] = useState(false);

  const tenant = allTenants.find((t) => t.id === tenantId);
  const unit = tenant ? allUnits.find((u) => u.id === tenant.unitId) : undefined;
  const property = tenant ? properties.find((p) => p.id === tenant.propertyId) : undefined;
  const contract = allContracts.find((c) => c.tenantId === tenantId);
  const oldRent = contract?.rentAmount || unit?.currentRent || 0;
  const increase = newRent - oldRent;
  const increasePercent = oldRent > 0 ? (increase / oldRent) * 100 : 0;

  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = new Date();
  const todayStr = today.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const formatDate = (d: string) => {
    if (!d) return '___________';
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  // § 558 BGB: effective date at earliest beginning of 3rd month after request
  const minEffectiveDate = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + 3);
    d.setDate(1);
    return d;
  }, [todayStr]);
  const minEffectiveDateStr = minEffectiveDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  // § 558 Abs. 1 BGB: 15-Monats-Sperrfrist
  const relevantLastDate = lastIncreaseDate || contract?.startDate || '';
  const sperrfristCheck = useMemo(() => {
    if (!relevantLastDate || !effectiveDate) return { ok: true as boolean | null, monthsBetween: 0 };
    const last = new Date(relevantLastDate);
    const effective = new Date(effectiveDate);
    const monthsBetween = (effective.getFullYear() - last.getFullYear()) * 12 + (effective.getMonth() - last.getMonth());
    return { ok: monthsBetween >= 15, monthsBetween };
  }, [relevantLastDate, effectiveDate]);

  // § 558 Abs. 3 BGB: Kappungsgrenze 20% (bzw. 15% in angespannten Wohnungsmärkten)
  const cap = kappungsgrenzeStrict ? 15 : 20;
  const maxRent = oldRent * (1 + cap / 100);
  const kappungsCheck = newRent <= maxRent;

  // § 561 BGB: Sonderkündigungsrecht bis zum Ablauf des zweiten Monats nach Zugang der Erklärung
  const sonderkuendigungsDeadline = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + 2);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return last;
  }, [todayStr]);
  const sonderkuendigungsDeadlineStr = sonderkuendigungsDeadline.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  const zustimmungsfrist = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() + 2);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return last;
  }, [todayStr]);
  const zustimmungsfristStr = zustimmungsfrist.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  const handleTenantChange = (val: string) => {
    const id = val === '__none__' ? '' : val;
    setTenantId(id);
    const t = allTenants.find((x) => x.id === id);
    const c = allContracts.find((x) => x.tenantId === id);
    const u = t ? allUnits.find((x) => x.id === t.unitId) : undefined;
    if (u) setNewRent(u.targetRent || u.currentRent);
    if (c && !lastIncreaseDate) setLastIncreaseDate(c.startDate);
  };

  const handleExportPDF = async () => {
    if (!letterRef.current || !tenant) return;
    await exportElementToPDF(letterRef.current, `Mieterhoehung_${tenant.name.replace(/\s/g, '_')}.pdf`);
  };

  const selectedReason = REASONS.find((r) => r.id === reason)!;
  const hasErrors = !kappungsCheck || (sperrfristCheck.ok === false);
  const ready = !!tenant && !!property && !!unit && newRent > oldRent && !!effectiveDate;

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 pb-6">
        <button onClick={onBack} className="cursor-pointer transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">Mieterhöhung</h1>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Settings Panel */}
        <div className="w-full xl:w-[380px] flex-shrink-0">
          <div className="surface">
            <div className="p-5 space-y-4">
              <h2 className="section-title">Einstellungen</h2>

              <div>
                <label className="input-label">Mieter</label>
                <select value={tenantId || '__none__'} onChange={(e) => handleTenantChange(e.target.value)} className="input">
                  <option value="__none__">Bitte wählen...</option>
                  {allTenants.map((t) => {
                    const p = properties.find((x) => x.id === t.propertyId);
                    return <option key={t.id} value={t.id}>{`${t.name} (${p?.name || '-'})`}</option>;
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Alte Kaltmiete</label>
                  <NumberInput value={oldRent} onChange={() => {}} suffix="€" decimals={2} disabled className="input bg-layer-hover" />
                </div>
                <div>
                  <label className="input-label">Neue Kaltmiete</label>
                  <NumberInput value={newRent || ''} onChange={(v) => setNewRent(v === '' ? 0 : v)} suffix="€" decimals={2} className="input" />
                </div>
              </div>

              <div>
                <label className="input-label">Letzte Erhöhung / Vertragsbeginn</label>
                <input type="date" value={lastIncreaseDate} onChange={(e) => setLastIncreaseDate(e.target.value)} className="input" />
                <p className="text-[10px] text-muted-foreground mt-1">Für Prüfung der 15-Monats-Sperrfrist (§ 558 Abs. 1 BGB)</p>
              </div>

              <div>
                <label className="input-label">Neue Miete gültig ab</label>
                <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="input" />
                <p className="text-[10px] text-muted-foreground mt-1">Frühestens {minEffectiveDateStr} (§ 558b BGB)</p>
              </div>

              <label className="flex items-start gap-2 text-xs cursor-pointer p-2 rounded-[8px] border border-card-line">
                <input
                  type="checkbox"
                  checked={kappungsgrenzeStrict}
                  onChange={(e) => setKappungsgrenzeStrict(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Angespannter Wohnungsmarkt (Kappung 15%)</span>
              </label>

              <div>
                <label className="input-label">Begründungsmittel</label>
                <select value={reason} onChange={(e) => setReason(e.target.value as Reason)} className="input">
                  {REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">{selectedReason.description}</p>
              </div>

              <div>
                <label className="input-label">Begründungstext</label>
                <textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  rows={4}
                  className="input"
                  placeholder={
                    reason === 'mietspiegel'
                      ? 'Gemäß qualifiziertem Mietspiegel 2025 Ihrer Stadt beträgt die ortsübliche Vergleichsmiete für Wohnungen mit den Merkmalen...'
                      : reason === 'vergleichswohnungen'
                      ? 'Zur Begründung benenne ich drei Vergleichswohnungen: 1) ..., 2) ..., 3) ...'
                      : 'Begründungstext eingeben...'
                  }
                />
              </div>

              {/* Legal check panel */}
              <div className="space-y-2">
                <div className="p-3 rounded-[10px] text-xs" style={{ backgroundColor: kappungsCheck ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                  <div className="flex items-start gap-2">
                    {kappungsCheck ? <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />}
                    <div>
                      <p className={`font-medium ${kappungsCheck ? 'text-emerald-400' : 'text-red-400'}`}>
                        Kappungsgrenze {cap}%: {kappungsCheck ? 'Eingehalten' : 'Überschritten!'}
                      </p>
                      <p className="text-muted-foreground-2 mt-0.5">
                        Max. neue Miete: {fmt(maxRent)} € · geplant: {fmt(newRent)} € ({increasePercent.toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-[10px] text-xs" style={{ backgroundColor: sperrfristCheck.ok !== false ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                  <div className="flex items-start gap-2">
                    {sperrfristCheck.ok !== false ? <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />}
                    <div>
                      <p className={`font-medium ${sperrfristCheck.ok !== false ? 'text-emerald-400' : 'text-red-400'}`}>
                        15-Monats-Sperrfrist: {sperrfristCheck.ok === false ? 'Nicht erfüllt!' : 'OK'}
                      </p>
                      <p className="text-muted-foreground-2 mt-0.5">
                        {sperrfristCheck.monthsBetween > 0 ? `${sperrfristCheck.monthsBetween} Monate seit letzter Anpassung` : 'Bitte Datum eintragen'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={handleExportPDF} disabled={!ready || hasErrors} className="btn btn-md btn-primary w-full">
                <Download size={16} /> PDF herunterladen
              </button>
              {hasErrors && <p className="text-[11px] text-red-400">Mindestens eine rechtliche Prüfung fehlgeschlagen — Export blockiert.</p>}
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
                      <div style={{ fontSize: '11px', color: '#374151', marginTop: '2px' }}>{todayStr}</div>
                    </div>
                  </div>

                  {/* Recipient */}
                  <div style={{ marginBottom: '28px' }}>
                    <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '4px' }}>An</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a2e' }}>{tenant!.name}</div>
                    <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '1px' }}>{unit!.name}, {property!.address}</div>
                  </div>

                  {/* Subject */}
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a2e', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #e5e7eb' }}>
                    Mieterhöhungsverlangen nach § 558 BGB zur Anpassung an die ortsübliche Vergleichsmiete
                  </div>

                  {/* Body */}
                  <div style={{ fontSize: '11px', lineHeight: '1.7', color: '#374151' }}>
                    <p style={{ marginBottom: '12px' }}>Sehr geehrte/r {tenant!.name},</p>
                    <p style={{ marginBottom: '12px' }}>
                      nach § 558 BGB bitte ich Sie, der nachfolgend dargelegten Erhöhung der monatlichen Nettokaltmiete für Ihre Wohnung {unit!.name} in {property!.address} zuzustimmen.
                    </p>

                    {/* Rent comparison */}
                    <div style={{
                      background: '#f8f9fb', borderRadius: '6px', padding: '14px 18px', marginBottom: '14px', border: '1px solid #e5e7eb',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10.5px' }}>
                        <span style={{ color: '#6b7280' }}>Bisherige Nettokaltmiete</span>
                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(oldRent)} EUR</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10.5px' }}>
                        <span style={{ color: '#6b7280' }}>Neue Nettokaltmiete</span>
                        <span style={{ fontWeight: 700, fontSize: '12px', color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>{fmt(newRent)} EUR</span>
                      </div>
                      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                        <span style={{ color: '#6b7280' }}>Erhöhungsbetrag</span>
                        <span style={{ fontWeight: 600, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>+{fmt(increase)} EUR ({increasePercent.toFixed(1)}%)</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#6b7280', marginTop: '4px' }}>
                        <span>Kappungsgrenze {cap}% (max.)</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(maxRent)} EUR</span>
                      </div>
                    </div>

                    <p style={{ marginBottom: '12px' }}>
                      Die neue Nettokaltmiete soll gemäß § 558b Abs. 1 BGB ab dem <strong>{formatDate(effectiveDate)}</strong> gelten.
                    </p>

                    {/* Legal checks summary */}
                    <div style={{ marginBottom: '14px', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '10px', background: '#fafbfc' }}>
                      <div style={{ fontWeight: 700, marginBottom: '6px', color: '#1a1a2e', fontSize: '10.5px' }}>Einhaltung der gesetzlichen Voraussetzungen</div>
                      <ul style={{ paddingLeft: '16px', margin: 0, lineHeight: '1.6' }}>
                        <li>Seit der letzten Mietänderung bzw. dem Vertragsbeginn ({formatDate(relevantLastDate)}) sind mehr als 15 Monate vergangen (§ 558 Abs. 1 BGB).</li>
                        <li>Die Kappungsgrenze von {cap}% innerhalb von drei Jahren (§ 558 Abs. 3 BGB) wird eingehalten.</li>
                        <li>Das Erhöhungsverlangen erfolgt in Textform unter Angabe der Begründung (§ 558a Abs. 1 BGB).</li>
                      </ul>
                    </div>

                    {/* Reason */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '6px', fontSize: '11px', color: '#1a1a2e' }}>Begründung: {selectedReason.label}</div>
                      <p style={{ marginBottom: '8px', fontSize: '10.5px' }}>
                        {reasonText || `Die ortsübliche Vergleichsmiete wird mittels ${selectedReason.label} nachgewiesen. Eine detaillierte Begründung ist diesem Schreiben als Anlage beigefügt.`}
                      </p>
                    </div>

                    {/* Zustimmung */}
                    <p style={{ marginBottom: '12px' }}>
                      Ich bitte Sie, der Mieterhöhung bis zum Ablauf des zweiten Kalendermonats nach Zugang dieses Schreibens, spätestens bis zum <strong>{zustimmungsfristStr}</strong>, zuzustimmen (§ 558b Abs. 1 BGB). Die Zustimmung kann schriftlich oder durch vorbehaltlose Zahlung der erhöhten Miete erfolgen.
                    </p>

                    {/* Sonderkündigungsrecht */}
                    <div style={{ marginBottom: '14px', padding: '10px 12px', borderLeft: '3px solid #2563eb', background: '#eff6ff', fontSize: '10px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '4px', color: '#1e40af' }}>Sonderkündigungsrecht nach § 561 BGB</div>
                      <p>
                        Sie können das Mietverhältnis bis zum Ablauf des zweiten Monats nach Zugang dieser Erklärung ({sonderkuendigungsDeadlineStr}) außerordentlich zum Ablauf des übernächsten Monats kündigen. In diesem Fall tritt die Mieterhöhung nicht in Kraft.
                      </p>
                    </div>

                    <p style={{ marginBottom: '12px', fontSize: '10.5px' }}>
                      Sollten Sie der Erhöhung nicht oder nicht vollständig zustimmen, bin ich nach § 558b Abs. 2 BGB berechtigt, auf Erteilung der Zustimmung zu klagen. Bitte setzen Sie sich bei Fragen rechtzeitig mit mir in Verbindung.
                    </p>

                    <p style={{ marginBottom: '24px' }}>Mit freundlichen Grüßen</p>

                    <div style={{ borderTop: '1px solid #d1d5db', width: '220px', paddingTop: '6px' }}>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>Vermieter / Hausverwaltung</div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{
                    borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '20px',
                    display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#9ca3af',
                  }}>
                    <span>{property!.name} · {property!.address}</span>
                    <span>Mieterhöhung · {todayStr}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '1000px', color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '0 40px' }}>
                  Bitte wähle einen Mieter, trage die neue Miete und das Gültigkeitsdatum ein.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
