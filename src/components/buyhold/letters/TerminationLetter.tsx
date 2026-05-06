import { useState, useRef, useMemo } from 'react';
import { ArrowLeft, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTenants } from '../../../hooks/useTenants';
import { useRentalProperties } from '../../../hooks/useRentalProperties';
import { useRentalUnits } from '../../../hooks/useRentalUnits';
import { useRentalContracts } from '../../../hooks/useRentalContracts';
import { useLandlordSettings } from '../../../hooks/useLandlordSettings';
import { exportElementToPDF } from '../../../lib/pdfExport';
import { BriefLayout } from './BriefLayout';

interface Props {
  onBack: () => void;
}

type TerminationType = 'ordentlich-eigenbedarf' | 'ordentlich-verwertung' | 'ordentlich-pflichtverletzung' | 'ausserordentlich-fristlos';

const TERMINATION_CONFIGS: Record<TerminationType, { label: string; basis: string; description: string; isExtraordinary: boolean; }> = {
  'ordentlich-eigenbedarf': {
    label: 'Ordentliche Kündigung — Eigenbedarf',
    basis: '§ 573 Abs. 2 Nr. 2 BGB',
    description: 'Vermieter benötigt Wohnung für sich, Familienangehörige oder Angehörige seines Haushalts.',
    isExtraordinary: false,
  },
  'ordentlich-verwertung': {
    label: 'Ordentliche Kündigung — Hinderung angemessener wirtschaftlicher Verwertung',
    basis: '§ 573 Abs. 2 Nr. 3 BGB',
    description: 'Fortsetzung des Mietverhältnisses würde angemessene wirtschaftliche Verwertung verhindern.',
    isExtraordinary: false,
  },
  'ordentlich-pflichtverletzung': {
    label: 'Ordentliche Kündigung — Schuldhafte Pflichtverletzung',
    basis: '§ 573 Abs. 2 Nr. 1 BGB',
    description: 'Mieter hat seine vertraglichen Pflichten schuldhaft nicht unerheblich verletzt.',
    isExtraordinary: false,
  },
  'ausserordentlich-fristlos': {
    label: 'Außerordentliche fristlose Kündigung',
    basis: '§ 543 BGB (i.V.m. § 569 BGB)',
    description: 'Wichtiger Grund — z. B. Zahlungsverzug mit zwei Monatsmieten nach § 543 Abs. 2 Nr. 3 BGB.',
    isExtraordinary: true,
  },
};

export function TerminationLetter({ onBack }: Props) {
  const { allTenants } = useTenants();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allContracts } = useRentalContracts();
  const { settings: landlord } = useLandlordSettings();
  const letterRef = useRef<HTMLDivElement>(null);

  const [tenantId, setTenantId] = useState('');
  const [type, setType] = useState<TerminationType>('ordentlich-eigenbedarf');
  const [reason, setReason] = useState('');
  const [terminationDate, setTerminationDate] = useState('');

  const tenant = allTenants.find((t) => t.id === tenantId);
  const unit = tenant ? allUnits.find((u) => u.id === tenant.unitId) : undefined;
  const property = tenant ? properties.find((p) => p.id === tenant.propertyId) : undefined;
  const contract = allContracts.find((c) => c.tenantId === tenantId);

  const today = new Date();
  const todayStr = today.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '___________';

  const config = TERMINATION_CONFIGS[type];

  // § 573c BGB: gesetzliche Kündigungsfristen
  const tenancyYears = useMemo(() => {
    if (!contract?.startDate) return 0;
    const start = new Date(contract.startDate);
    const years = (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.floor(years);
  }, [contract?.startDate, todayStr]);

  const noticePeriodMonths = useMemo(() => {
    if (config.isExtraordinary) return 0;
    if (tenancyYears >= 8) return 9;
    if (tenancyYears >= 5) return 6;
    return 3;
  }, [tenancyYears, config.isExtraordinary]);

  // Minimum termination date: current month + noticePeriodMonths, at month end
  const earliestTerminationDate = useMemo(() => {
    if (config.isExtraordinary) return today;
    const d = new Date(today.getFullYear(), today.getMonth() + noticePeriodMonths + 1, 0);
    // § 573c: "bis zum dritten Werktag eines Kalendermonats zum Ablauf des übernächsten Monats"
    // simplified: end of month X months later
    return d;
  }, [noticePeriodMonths, config.isExtraordinary, todayStr]);
  const earliestDateStr = earliestTerminationDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  // Widerspruchsrecht § 574 BGB: min. 2 Monate vor Kündigungstermin schriftlich
  const widerspruchDeadline = useMemo(() => {
    if (!terminationDate) return null;
    const d = new Date(terminationDate);
    d.setMonth(d.getMonth() - 2);
    return d;
  }, [terminationDate]);

  // Legal validation
  const dateValid = useMemo(() => {
    if (config.isExtraordinary) return true;
    if (!terminationDate) return null;
    return new Date(terminationDate) >= earliestTerminationDate;
  }, [terminationDate, earliestTerminationDate, config.isExtraordinary]);

  const reasonProvided = reason.trim().length > 20;

  const onSelectTenant = (val: string) => {
    const id = val === '__none__' ? '' : val;
    setTenantId(id);
  };

  const handleExportPDF = async () => {
    if (!letterRef.current || !tenant) return;
    await exportElementToPDF(letterRef.current, `Kuendigung_${tenant.name.replace(/\s/g, '_')}.pdf`);
  };

  const hasErrors = dateValid === false || !reasonProvided;
  const ready = !!tenant && !!property && !!unit && !!terminationDate;

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 pb-6">
        <button onClick={onBack} className="cursor-pointer transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">Kündigung</h1>
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

              <div>
                <label className="input-label">Kündigungsart</label>
                <select value={type} onChange={(e) => setType(e.target.value as TerminationType)} className="input">
                  {Object.entries(TERMINATION_CONFIGS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">{config.basis}</p>
              </div>

              {contract && !config.isExtraordinary && (
                <div className="p-3 rounded-[10px] bg-layer-hover text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mietdauer</span>
                    <span className="font-medium">{tenancyYears} Jahre</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kündigungsfrist</span>
                    <span className="font-medium">{noticePeriodMonths} Monate (§ 573c BGB)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frühest. Beendigung</span>
                    <span className="font-medium">{earliestDateStr}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="input-label">Beendigungstermin</label>
                <input
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  className="input"
                />
                {dateValid === false && (
                  <p className="text-[11px] text-red-400 mt-1">Vor frühestmöglichem Termin — Frist nicht eingehalten</p>
                )}
              </div>

              <div>
                <label className="input-label">Begründung <span className="text-red-400">*</span></label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={5}
                  className="input"
                  placeholder={
                    type === 'ordentlich-eigenbedarf'
                      ? 'Detaillierte Schilderung: Wer benötigt die Wohnung (Name, Verwandtschaftsgrad), warum und ab wann?'
                      : type === 'ausserordentlich-fristlos'
                      ? 'Wichtiger Grund — z. B. Zahlungsverzug: Monate, Höhe, Datum der letzten Mahnung...'
                      : 'Kündigungsgrund ausführlich darlegen (Pflicht nach § 573 Abs. 3 BGB)...'
                  }
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Ohne konkrete Begründung ist die Kündigung unwirksam (§ 573 Abs. 3 BGB).
                </p>
              </div>

              {/* Validation */}
              <div className="space-y-2">
                <div className="p-2.5 rounded-[10px] text-xs" style={{ backgroundColor: reasonProvided ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                  <div className="flex items-start gap-2">
                    {reasonProvided ? <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />}
                    <p className={reasonProvided ? 'text-emerald-400' : 'text-red-400'}>
                      {reasonProvided ? 'Begründung ausreichend' : 'Begründung zu kurz (min. 20 Zeichen)'}
                    </p>
                  </div>
                </div>

                {!config.isExtraordinary && dateValid !== null && (
                  <div className="p-2.5 rounded-[10px] text-xs" style={{ backgroundColor: dateValid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                    <div className="flex items-start gap-2">
                      {dateValid ? <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />}
                      <p className={dateValid ? 'text-emerald-400' : 'text-red-400'}>
                        Kündigungsfrist: {dateValid ? 'Eingehalten' : 'Nicht eingehalten'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 p-3 rounded-[10px] text-xs" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <p>
                  Wichtig: Kündigungen müssen im Original vom Vermieter unterschrieben und dem Mieter zugehen (§ 568 BGB). Bei mehreren Mietern muss allen und von allen Vermietern gekündigt werden.
                </p>
              </div>

              <button onClick={handleExportPDF} disabled={!ready || hasErrors} className="btn btn-md btn-primary w-full">
                <Download size={16} /> PDF herunterladen
              </button>
            </div>
          </div>
        </div>

        {/* DIN A4 Preview — einheitliches BriefLayout */}
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
                    'Einschreiben — Rückschein',
                    property!.name,
                    `${property!.address}${unit ? `, ${unit.name}` : ''}`,
                    config.isExtraordinary ? 'Außerordentliche fristlose Kündigung' : 'Kündigung des Mietverhältnisses',
                  ],
                }}
                salutation={`Sehr geehrte/r ${tenant!.name},`}
              >
                <p style={{ marginBottom: '8px', fontSize: '10.5px', color: '#6b7280' }}>
                  Rechtsgrundlage: {config.basis}
                </p>

                <p style={{ marginBottom: '14px' }}>
                  hiermit kündige(n) ich/wir das zwischen uns bestehende Mietverhältnis über die Wohnung <strong>{unit!.name}</strong> in <strong>{property!.address}</strong>
                  {contract?.startDate && <> (Mietvertrag vom {formatDate(contract.startDate)})</>}
                  {' '}
                  {config.isExtraordinary
                    ? <strong>außerordentlich fristlos mit sofortiger Wirkung</strong>
                    : <>ordentlich zum <strong>{formatDate(terminationDate)}</strong></>
                  }.
                </p>

                {!config.isExtraordinary && (
                  <div style={{ background: '#f8f9fb', borderRadius: '6px', padding: '12px 16px', marginBottom: '14px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '10.5px' }}>
                      <div>
                        <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Mietdauer</div>
                        <div style={{ fontWeight: 600, marginTop: '2px' }}>{tenancyYears} Jahre</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Gesetzliche Frist</div>
                        <div style={{ fontWeight: 600, marginTop: '2px' }}>{noticePeriodMonths} Monate (§ 573c BGB)</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reason — mandatory */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px', fontSize: '11.5px' }}>Begründung</div>
                  <p style={{ marginBottom: '8px', whiteSpace: 'pre-wrap' }}>{reason}</p>
                </div>

                {/* Widerspruchsrecht */}
                {!config.isExtraordinary && (
                  <div style={{ marginBottom: '14px', padding: '10px 12px', borderLeft: '3px solid #2563eb', background: '#eff6ff', fontSize: '10.5px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>Widerspruchsrecht nach § 574 BGB (Sozialklausel)</div>
                    <p style={{ marginBottom: '4px' }}>
                      Sie können der Kündigung widersprechen, wenn die vertragsmäßige Beendigung für Sie, Ihre Familie oder einen anderen Angehörigen Ihres Haushalts eine Härte bedeuten würde.
                    </p>
                    <p style={{ margin: 0 }}>
                      Widerspruch schriftlich spätestens zwei Monate vor dem Beendigungstermin ({widerspruchDeadline ? widerspruchDeadline.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '___________'}) bei uns einzureichen (§ 574b Abs. 2 BGB).
                    </p>
                  </div>
                )}

                {/* Fristlose Hinweise */}
                {config.isExtraordinary && (
                  <div style={{ marginBottom: '14px', padding: '10px 12px', borderLeft: '3px solid #dc2626', background: '#fef2f2', fontSize: '10.5px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>Hinweis zur Schonfrist (§ 569 Abs. 3 Nr. 2 BGB)</div>
                    <p style={{ margin: 0 }}>
                      Sofern diese Kündigung auf Zahlungsverzug gestützt wird, wird sie unwirksam, wenn Sie innerhalb von zwei Monaten nach Rechtshängigkeit einer Räumungsklage die Mietrückstände vollständig ausgleichen oder eine öffentliche Stelle die Zahlung übernimmt.
                    </p>
                  </div>
                )}

                <p style={{ marginBottom: '12px' }}>
                  Wir bitten Sie, die Wohnung bis spätestens zum <strong>{config.isExtraordinary ? `${todayStr} (unverzüglich)` : formatDate(terminationDate)}</strong> vollständig geräumt und besenrein an uns zu übergeben.
                </p>

                <p style={{ marginBottom: '12px' }}>
                  Die Kaution wird Ihnen nach ordnungsgemäßer Rückgabe der Wohnung und Abrechnung der Betriebskosten innerhalb der gesetzlichen Frist ausgezahlt; etwaige berechtigte Ansprüche werden verrechnet.
                </p>
              </BriefLayout>
            ) : (
              <div
                style={{
                  width: '794px', minHeight: '1123px', background: '#ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '0 40px',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                }}
              >
                Bitte wähle einen Mieter und setze das Beendigungsdatum.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
