import { useState, useRef, useMemo, useEffect } from 'react';
import { ArrowLeft, Download, Plus, Trash2, AlertTriangle, Mail, Bell, Gavel } from 'lucide-react';
import { useTenants } from '../../../hooks/useTenants';
import { useRentalProperties } from '../../../hooks/useRentalProperties';
import { useRentalUnits } from '../../../hooks/useRentalUnits';
import { useRentalContracts } from '../../../hooks/useRentalContracts';
import { useLandlordSettings } from '../../../hooks/useLandlordSettings';
import { exportElementToPDF } from '../../../lib/pdfExport';
import { NumberInput } from '../../ui/NumberInput';

interface Props {
  onBack: () => void;
}

type Stage = 1 | 2 | 3;

interface OpenItem {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
}

const STAGE_CONFIG: Record<Stage, {
  title: string;
  shortLabel: string;
  description: string;
  icon: typeof Mail;
  color: string;
  bg: string;
  accent: string;
  intro: string;
  deadlineDays: number;
  fee: number;
}> = {
  1: {
    title: '1. Zahlungserinnerung',
    shortLabel: 'Erinnerung',
    description: 'Freundlicher Hinweis',
    icon: Mail,
    color: '#2563eb',
    bg: 'rgba(37, 99, 235, 0.12)',
    accent: '#60a5fa',
    intro: 'bei der Durchsicht unserer Unterlagen haben wir festgestellt, dass die nachfolgend aufgeführte(n) Forderung(en) noch nicht auf unserem Konto eingegangen sind. Wir gehen davon aus, dass es sich um ein Versehen handelt und bitten Sie, den offenen Betrag zeitnah zu begleichen.',
    deadlineDays: 14,
    fee: 0,
  },
  2: {
    title: '2. Mahnung',
    shortLabel: 'Mahnung',
    description: 'Verzug nach § 286 BGB',
    icon: Bell,
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.14)',
    accent: '#fbbf24',
    intro: 'trotz unserer Zahlungserinnerung konnten wir bisher keinen Zahlungseingang feststellen. Wir fordern Sie hiermit erneut auf, die offenen Beträge zu begleichen. Sie befinden sich gemäß § 286 BGB mit der Zahlung im Verzug.',
    deadlineDays: 10,
    fee: 5,
  },
  3: {
    title: '3. und letzte Mahnung',
    shortLabel: 'Letzte Mahnung',
    description: 'Vor gerichtlichen Schritten',
    icon: Gavel,
    color: '#dc2626',
    bg: 'rgba(220, 38, 38, 0.14)',
    accent: '#ef4444',
    intro: 'unsere bisherigen Mahnschreiben sind unbeantwortet geblieben. Wir setzen Ihnen hiermit eine letzte Frist zur Zahlung der unten aufgeführten Beträge. Nach fruchtlosem Ablauf dieser Frist werden wir ohne weitere Ankündigung gerichtliche Schritte einleiten bzw. ein Inkassobüro beauftragen. Die hierdurch entstehenden Kosten sowie Verzugszinsen in Höhe von 5 Prozentpunkten über dem Basiszinssatz werden Ihnen zusätzlich in Rechnung gestellt.',
    deadlineDays: 7,
    fee: 10,
  },
};

export function DunningLetter({ onBack }: Props) {
  const { allTenants } = useTenants();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allContracts } = useRentalContracts();
  const { bankInfoBlock, senderBlock, settings, isComplete } = useLandlordSettings();
  const letterRef = useRef<HTMLDivElement>(null);

  const [tenantId, setTenantId] = useState('');
  const [stage, setStage] = useState<Stage>(1);
  const [items, setItems] = useState<OpenItem[]>([]);
  const [includeFee, setIncludeFee] = useState(false);
  const [bankInfoOverride, setBankInfoOverride] = useState<string | null>(null);
  const bankInfo = bankInfoOverride ?? (bankInfoBlock || 'IBAN: DE00 0000 0000 0000 0000 00\nBIC: XXXXXXXX\nVerwendungszweck: Miete bitte angeben');

  useEffect(() => {
    setBankInfoOverride(null);
  }, [bankInfoBlock]);

  const tenant = allTenants.find((t) => t.id === tenantId);
  const unit = tenant ? allUnits.find((u) => u.id === tenant.unitId) : undefined;
  const property = tenant ? properties.find((p) => p.id === tenant.propertyId) : undefined;

  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = new Date();
  const todayStr = today.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '___________';

  const config = STAGE_CONFIG[stage];
  const deadline = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + config.deadlineDays);
    return d;
  }, [config.deadlineDays, todayStr]);
  const deadlineStr = deadline.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  const totalOpen = items.reduce((s, i) => s + i.amount, 0);
  const fee = includeFee ? config.fee : 0;
  const grandTotal = totalOpen + fee;

  // § 288 BGB: Verzugszinsen 5%-Punkte über Basiszinssatz (derzeit 3,37% → 8,37% p.a. bei Privatpersonen)
  const zinssatz = 5; // pp above base rate; just informational text

  const onSelectTenant = (val: string) => {
    const id = val === '__none__' ? '' : val;
    setTenantId(id);
    const c = allContracts.find((x) => x.tenantId === id);
    if (c && items.length === 0) {
      const warmmiete = c.rentAmount + c.operatingCosts + c.heatingCosts;
      setItems([{
        id: Math.random().toString(36).slice(2),
        description: `Warmmiete ${today.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`,
        amount: warmmiete,
        dueDate: '',
      }]);
    }
  };

  const addItem = () => {
    setItems((prev) => [...prev, {
      id: Math.random().toString(36).slice(2),
      description: '',
      amount: 0,
      dueDate: '',
    }]);
  };

  const updateItem = <K extends keyof OpenItem>(idx: number, key: K, value: OpenItem[K]) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [key]: value } : it));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleExportPDF = async () => {
    if (!letterRef.current || !tenant) return;
    await exportElementToPDF(letterRef.current, `Mahnung_Stufe${stage}_${tenant.name.replace(/\s/g, '_')}.pdf`);
  };

  const ready = !!tenant && !!property && !!unit && items.length > 0 && items.every((i) => i.amount > 0);

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 pb-6">
        <button onClick={onBack} className="cursor-pointer transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">Mahnung</h1>
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
                <label className="input-label">Mahnstufe</label>
                <div className="space-y-2">
                  {([1, 2, 3] as Stage[]).map((s) => {
                    const cfg = STAGE_CONFIG[s];
                    const Icon = cfg.icon;
                    const active = stage === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setStage(s)}
                        className="w-full text-left rounded-[12px] transition-all"
                        style={{
                          padding: '10px 12px',
                          background: active ? cfg.bg : 'transparent',
                          border: `1px solid ${active ? cfg.color : 'var(--card-line)'}`,
                          boxShadow: active ? `0 0 0 3px ${cfg.bg}` : 'none',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                            style={{
                              background: active ? cfg.color : cfg.bg,
                              color: active ? '#ffffff' : cfg.color,
                            }}
                          >
                            <Icon size={15} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{
                                  background: active ? cfg.color : cfg.bg,
                                  color: active ? '#ffffff' : cfg.color,
                                }}
                              >
                                Stufe {s}
                              </span>
                              <span className="text-sm font-semibold" style={{ color: active ? cfg.color : undefined }}>
                                {cfg.shortLabel}
                              </span>
                            </div>
                            <div className="text-[10.5px] text-muted-foreground-2 mt-0.5">
                              {cfg.description} · Frist {cfg.deadlineDays} Tage
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="input-label !mb-0">Offene Forderungen</label>
                  <button onClick={addItem} className="btn btn-xs btn-ghost"><Plus size={12} /> Hinzufügen</button>
                </div>
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {items.map((it, i) => (
                    <div key={it.id} className="p-2.5 rounded-[10px] surface text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          value={it.description}
                          onChange={(e) => updateItem(i, 'description', e.target.value)}
                          placeholder="z.B. Miete März 2026"
                          className="input input-xs flex-1"
                        />
                        <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-[#ef4444] p-1">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="flex gap-1.5">
                        <NumberInput
                          value={it.amount || ''}
                          onChange={(v) => updateItem(i, 'amount', v === '' ? 0 : v)}
                          suffix="€"
                          decimals={2}
                          className="input input-xs flex-1"
                        />
                        <input
                          type="date"
                          value={it.dueDate}
                          onChange={(e) => updateItem(i, 'dueDate', e.target.value)}
                          className="input input-xs flex-1"
                        />
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Keine Forderungen</p>
                  )}
                </div>
              </div>

              {stage >= 2 && (
                <label className="flex items-start gap-2 text-xs cursor-pointer p-2.5 rounded-[10px] border border-card-line">
                  <input
                    type="checkbox"
                    checked={includeFee}
                    onChange={(e) => setIncludeFee(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium">Mahngebühr {fmt(config.fee)} EUR berechnen</p>
                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                      § 288 Abs. 4 BGB — nur im Verzug. Höhe muss verhältnismäßig sein (max. 2,50–10 €).
                    </p>
                  </div>
                </label>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="input-label !mb-0">Bankverbindung (für Zahlung)</label>
                  {isComplete && bankInfoOverride === null && (
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-[#4F6BFF]">aus Einstellungen</span>
                  )}
                </div>
                <textarea
                  value={bankInfo}
                  onChange={(e) => setBankInfoOverride(e.target.value)}
                  rows={4}
                  className="input text-xs"
                />
                {!bankInfoBlock && (
                  <p className="text-[10px] text-amber-500 mt-1.5">
                    Hinweis: Unter <strong>Einstellungen → Buy & Hold</strong> kannst du deine IBAN hinterlegen, damit sie automatisch übernommen wird.
                  </p>
                )}
              </div>

              {items.length > 0 && (
                <div className="p-3 rounded-[10px] text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
                  <p className="font-medium">Offener Gesamtbetrag: {fmt(grandTotal)} EUR</p>
                  <p className="text-[11px] text-muted-foreground-2 mt-0.5">Zahlungsfrist: {deadlineStr}</p>
                </div>
              )}

              {stage === 3 && (
                <div className="flex items-start gap-2 p-3 rounded-[10px] text-xs" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <p>
                    Bei zwei aufeinanderfolgenden Mieten im Rückstand ist zusätzlich eine fristlose Kündigung nach § 543 Abs. 2 Nr. 3 BGB möglich.
                  </p>
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
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '6px',
                    background: `linear-gradient(90deg, ${config.color}, ${config.accent})`,
                  }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '26px' }}>
                    <div>
                      {senderBlock ? (
                        <>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a2e' }}>{settings.companyName || settings.contactName}</div>
                          <div style={{ fontSize: '9.5px', color: '#6b7280', marginTop: '1px' }}>
                            {[settings.street, [settings.zip, settings.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginTop: '6px' }}>{property!.name}</div>
                          <div style={{ fontSize: '10px', color: '#6b7280' }}>{property!.address}</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a2e' }}>{property!.name}</div>
                          <div style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '2px' }}>{property!.address}</div>
                        </>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Datum</div>
                      <div style={{ fontSize: '11px', color: '#374151', marginTop: '2px' }}>{todayStr}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '4px' }}>An</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a2e' }}>{tenant!.name}</div>
                    <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '1px' }}>{unit!.name}, {property!.address}</div>
                  </div>

                  {/* Stage badge */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: config.color,
                    color: '#ffffff',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    marginBottom: '10px',
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.25)',
                      fontSize: '10px',
                      fontWeight: 800,
                    }}>{stage}</span>
                    Stufe {stage} von 3
                  </div>

                  <div style={{ fontSize: '18px', fontWeight: 700, color: config.color, marginBottom: '16px', paddingBottom: '10px', borderBottom: `2px solid ${config.color}` }}>
                    {config.title}
                  </div>

                  <div style={{ fontSize: '11px', lineHeight: '1.7', color: '#374151' }}>
                    <p style={{ marginBottom: '12px' }}>Sehr geehrte/r {tenant!.name},</p>
                    <p style={{ marginBottom: '14px' }}>{config.intro}</p>

                    {/* Open items table */}
                    <div style={{ marginBottom: '16px', borderRadius: '6px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', padding: '8px 12px', background: '#f3f4f6', fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        <span>Forderung</span>
                        <span>Fällig seit</span>
                        <span style={{ textAlign: 'right' }}>Betrag</span>
                      </div>
                      {items.map((it) => (
                        <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', padding: '8px 12px', borderTop: '1px solid #f3f4f6', fontSize: '10.5px' }}>
                          <span>{it.description}</span>
                          <span style={{ fontSize: '10px', color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>{formatDate(it.dueDate)}</span>
                          <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{fmt(it.amount)} EUR</span>
                        </div>
                      ))}
                      {fee > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', padding: '8px 12px', borderTop: '1px solid #f3f4f6', fontSize: '10.5px', color: '#6b7280' }}>
                          <span>Mahngebühr</span>
                          <span />
                          <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{fmt(fee)} EUR</span>
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', padding: '10px 12px', borderTop: '2px solid #e5e7eb', fontSize: '11.5px', fontWeight: 700, background: '#fafbfc' }}>
                        <span>Gesamtbetrag</span>
                        <span />
                        <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: stage === 3 ? '#dc2626' : '#1a1a2e' }}>{fmt(grandTotal)} EUR</span>
                      </div>
                    </div>

                    {/* Deadline */}
                    <div style={{
                      background: stage === 3 ? '#fef2f2' : '#fff7ed',
                      border: `1px solid ${stage === 3 ? '#fecaca' : '#fed7aa'}`,
                      borderRadius: '6px', padding: '12px 16px', marginBottom: '14px',
                    }}>
                      <div style={{ fontSize: '10px', color: '#9a3412', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Zahlungsfrist</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: stage === 3 ? '#991b1b' : '#9a3412' }}>
                        bis spätestens {deadlineStr}
                      </div>
                    </div>

                    {/* Bank info */}
                    <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#f8f9fb', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '10px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                      <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '10.5px' }}>Zahlung bitte auf folgendes Konto:</div>
                      {bankInfo}
                    </div>

                    {/* Legal notes */}
                    {stage >= 2 && (
                      <div style={{ marginBottom: '14px', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '9.5px', lineHeight: '1.5', color: '#4b5563', background: '#fafbfc' }}>
                        <div style={{ fontWeight: 700, marginBottom: '4px', color: '#1a1a2e', fontSize: '10px' }}>Rechtliche Hinweise</div>
                        <p style={{ marginBottom: '4px' }}>
                          Gemäß § 286 Abs. 3 BGB befinden Sie sich spätestens 30 Tage nach Fälligkeit und Zugang einer Rechnung oder gleichwertigen Zahlungsaufstellung in Verzug.
                        </p>
                        <p style={{ marginBottom: '4px' }}>
                          Ab Verzugseintritt berechnen wir Verzugszinsen in Höhe von {zinssatz} Prozentpunkten über dem Basiszinssatz p. a. gemäß § 288 Abs. 1 BGB.
                        </p>
                        {stage === 3 && (
                          <p style={{ color: '#991b1b', fontWeight: 600 }}>
                            Bitte beachten Sie: Bei Verzug mit der Miete für zwei aufeinanderfolgende Termine in nicht unerheblicher Höhe oder in einer Höhe, die die Miete für zwei Monate erreicht, sind wir gemäß § 543 Abs. 2 Nr. 3 BGB zur fristlosen Kündigung des Mietverhältnisses berechtigt.
                          </p>
                        )}
                      </div>
                    )}

                    <p style={{ marginBottom: '12px' }}>
                      Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.
                    </p>
                    <p style={{ marginBottom: '20px' }}>Mit freundlichen Grüßen</p>

                    <div style={{ borderTop: '1px solid #d1d5db', width: '240px', paddingTop: '6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a2e' }}>
                        {settings.signatureName || settings.contactName || settings.companyName || 'Vermieter / Hausverwaltung'}
                      </div>
                      <div style={{ fontSize: '9.5px', color: '#6b7280', marginTop: '1px' }}>Vermieter / Hausverwaltung</div>
                    </div>
                  </div>

                  <div style={{
                    borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '20px',
                    display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#9ca3af',
                  }}>
                    <span>{property!.name} · {property!.address}</span>
                    <span>{config.title} · {todayStr}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '1000px', color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '0 40px' }}>
                  Bitte wähle einen Mieter und erfasse mindestens eine offene Forderung.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
