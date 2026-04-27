import { useState, useRef, useMemo } from 'react';
import { ArrowLeft, Download, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTenants } from '../../../hooks/useTenants';
import { useRentalProperties } from '../../../hooks/useRentalProperties';
import { useRentalUnits } from '../../../hooks/useRentalUnits';
import { useRentalContracts } from '../../../hooks/useRentalContracts';
import { exportElementToPDF } from '../../../lib/pdfExport';
import { isValidIBAN } from '../../../lib/utils';
import { NumberInput } from '../../ui/NumberInput';

interface Props {
  onBack: () => void;
}

interface Deduction {
  id: string;
  description: string;
  amount: number;
  basis: string;
}

export function DepositSettlement({ onBack }: Props) {
  const { allTenants } = useTenants();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allContracts } = useRentalContracts();
  const letterRef = useRef<HTMLDivElement>(null);

  const [tenantId, setTenantId] = useState('');
  const [depositAmount, setDepositAmount] = useState(0);
  const [interestRate, setInterestRate] = useState(2.0);
  const [yearsHeld, setYearsHeld] = useState(0);
  const [moveOutDate, setMoveOutDate] = useState('');
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [payoutIban, setPayoutIban] = useState('');
  const [holdbackAmount, setHoldbackAmount] = useState(0);
  const [holdbackReason, setHoldbackReason] = useState('');

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
      if (c) {
        setDepositAmount(c.depositAmount || 0);
        if (c.startDate) {
          const startY = new Date(c.startDate).getFullYear();
          setYearsHeld(Math.max(0, today.getFullYear() - startY));
        }
      }
    }
  };

  const addDeduction = () => setDeductions([...deductions, { id: `d-${Date.now()}`, description: '', amount: 0, basis: '' }]);
  const updateDeduction = (id: string, patch: Partial<Deduction>) => setDeductions(deductions.map((d) => d.id === id ? { ...d, ...patch } : d));
  const removeDeduction = (id: string) => setDeductions(deductions.filter((d) => d.id !== id));

  // § 551 Abs. 3 BGB: mindestens mit dem für Spareinlagen mit dreimonatiger Kündigungsfrist üblichen Zinssatz
  const accruedInterest = useMemo(() => {
    const rate = interestRate / 100;
    return Math.round(depositAmount * rate * yearsHeld * 100) / 100;
  }, [depositAmount, interestRate, yearsHeld]);

  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  const grossDeposit = depositAmount + accruedInterest;
  const payout = Math.max(0, grossDeposit - totalDeductions - holdbackAmount);

  // § 548 BGB: Ansprüche verjähren in 6 Monaten — übliche Abrechnungsfrist
  const deadlineDate = useMemo(() => {
    if (!moveOutDate) return null;
    const d = new Date(moveOutDate);
    d.setMonth(d.getMonth() + 6);
    return d;
  }, [moveOutDate]);
  const deadlineStr = deadlineDate ? deadlineDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  const hasHoldback = holdbackAmount > 0;
  const ibanValid = isValidIBAN(payoutIban);
  const ibanFilled = payoutIban.trim().length > 0;
  const ready = !!tenant && !!property && !!unit && depositAmount > 0 && !!moveOutDate;

  const handleExport = async () => {
    if (!letterRef.current || !tenant) return;
    await exportElementToPDF(letterRef.current, `Kautionsabrechnung_${tenant.name.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 pb-6">
        <button onClick={onBack} className="cursor-pointer transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">Kautionsabrechnung</h1>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Kaution</label>
                  <NumberInput value={depositAmount} onChange={(v) => setDepositAmount(v === '' ? 0 : v)} suffix="€" decimals={2} className="input" />
                </div>
                <div>
                  <label className="input-label">Auszugsdatum</label>
                  <input type="date" value={moveOutDate} onChange={(e) => setMoveOutDate(e.target.value)} className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Zinssatz</label>
                  <NumberInput value={interestRate} onChange={(v) => setInterestRate(v === '' ? 0 : v)} suffix="%" decimals={2} className="input" />
                </div>
                <div>
                  <label className="input-label">Laufzeit (Jahre)</label>
                  <NumberInput value={yearsHeld} onChange={(v) => setYearsHeld(v === '' ? 0 : v)} decimals={0} className="input" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="input-label !mb-0">Abzüge</label>
                  <button onClick={addDeduction} className="btn btn-sm btn-ghost text-[11px]"><Plus size={12} /> Hinzufügen</button>
                </div>
                <div className="space-y-2">
                  {deductions.map((d) => (
                    <div key={d.id} className="space-y-1 p-2 rounded-[8px] bg-layer-hover">
                      <div className="grid grid-cols-[1fr_110px_auto] gap-1.5">
                        <input value={d.description} onChange={(e) => updateDeduction(d.id, { description: e.target.value })} placeholder="Beschreibung" className="input !text-[11px] !py-1.5" />
                        <NumberInput value={d.amount} onChange={(v) => updateDeduction(d.id, { amount: v === '' ? 0 : v })} suffix="€" decimals={2} placeholder="0" className="input !text-[11px] !py-1.5" />
                        <button onClick={() => removeDeduction(d.id)} className="text-muted-foreground hover:text-red-400 px-1"><Trash2 size={12} /></button>
                      </div>
                      <input value={d.basis} onChange={(e) => updateDeduction(d.id, { basis: e.target.value })} placeholder="Rechtsgrundlage / Nachweis" className="input !text-[11px] !py-1.5" />
                    </div>
                  ))}
                  {deductions.length === 0 && <p className="text-[11px] text-muted-foreground">Keine Abzüge</p>}
                </div>
              </div>

              <div>
                <label className="input-label">Einbehalt (z. B. für NK-Nachzahlung)</label>
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <NumberInput value={holdbackAmount} onChange={(v) => setHoldbackAmount(v === '' ? 0 : v)} suffix="€" decimals={2} className="input" />
                  <input value={holdbackReason} onChange={(e) => setHoldbackReason(e.target.value)} placeholder="Grund" className="input" />
                </div>
              </div>

              <div>
                <label className="input-label">IBAN für Auszahlung</label>
                <input value={payoutIban} onChange={(e) => setPayoutIban(e.target.value)} className="input" placeholder="DE00 0000 0000 0000 0000 00" />
                {ibanFilled && !ibanValid && (
                  <p className="text-[11px] text-amber-400 mt-1">Ungültige IBAN — Prüfziffer falsch oder Format nicht korrekt</p>
                )}
                {ibanFilled && ibanValid && (
                  <p className="text-[11px] text-emerald-400 mt-1">IBAN gültig</p>
                )}
              </div>

              {/* Summary */}
              <div className="space-y-1 p-3 rounded-[10px] bg-layer-hover text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Kaution</span><span>{fmt(depositAmount)} €</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Zinsen</span><span>+ {fmt(accruedInterest)} €</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Abzüge</span><span>− {fmt(totalDeductions)} €</span></div>
                {holdbackAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Einbehalt</span><span>− {fmt(holdbackAmount)} €</span></div>}
                <div className="border-t border-border pt-1 mt-1 flex justify-between font-semibold"><span>Auszahlungsbetrag</span><span className={payout > 0 ? 'text-emerald-400' : 'text-red-400'}>{fmt(payout)} €</span></div>
              </div>

              {hasHoldback && (
                <div className="p-2.5 rounded-[10px] text-xs" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                    <p>Einbehalt nur in angemessener Höhe und für überschaubaren Zeitraum zulässig (BGH VIII ZR 71/05).</p>
                  </div>
                </div>
              )}

              {deadlineDate && (
                <div className="p-2.5 rounded-[10px] text-xs" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" />
                    <p>Verjährung Schadensersatzansprüche: {deadlineStr} (§ 548 BGB)</p>
                  </div>
                </div>
              )}

              <button onClick={handleExport} disabled={!ready} className="btn btn-md btn-primary w-full">
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
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #10b981, #4F6BFF)' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 700 }}>{property!.name}</div>
                      <div style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '2px' }}>{property!.address}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Datum</div>
                      <div style={{ fontSize: '11px', color: '#374151', marginTop: '2px' }}>{todayStr}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '28px' }}>
                    <div style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '4px' }}>An</div>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{tenant!.name}</div>
                    <div style={{ fontSize: '11px', color: '#4b5563' }}>{unit!.name}, {property!.address}</div>
                  </div>

                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px', paddingBottom: '10px', borderBottom: '2px solid #e5e7eb' }}>
                    Kautionsabrechnung
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '18px' }}>
                    Mietverhältnis beendet zum {formatDate(moveOutDate)} &nbsp;|&nbsp; Rechtsgrundlage: § 551 BGB
                  </div>

                  <p style={{ fontSize: '11px', lineHeight: '1.7', marginBottom: '16px' }}>
                    Sehr geehrte/r {tenant!.name},
                  </p>
                  <p style={{ fontSize: '11px', lineHeight: '1.7', marginBottom: '18px' }}>
                    hiermit rechnen wir die von Ihnen hinterlegte Mietsicherheit über das Mietverhältnis <strong>{unit!.name}</strong> wie folgt ab:
                  </p>

                  {/* Kaution + Zinsen */}
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>1. Hinterlegte Kaution</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '7px 0' }}>Kautionssumme</td>
                          <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 600 }}>{fmt(depositAmount)} €</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '7px 0' }}>Zinsen ({fmt(interestRate)} % p.a. × {yearsHeld} Jahre)</td>
                          <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 600 }}>+ {fmt(accruedInterest)} €</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '7px 0', fontWeight: 700 }}>Kaution inkl. Zinsen</td>
                          <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 700 }}>{fmt(grossDeposit)} €</td>
                        </tr>
                      </tbody>
                    </table>
                    <p style={{ fontSize: '9.5px', color: '#6b7280', marginTop: '4px', fontStyle: 'italic' }}>
                      Verzinsung nach § 551 Abs. 3 BGB (übliche Zinssätze für Spareinlagen mit dreimonatiger Kündigungsfrist).
                    </p>
                  </div>

                  {/* Abzüge */}
                  {deductions.length > 0 && (
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>2. Abzüge</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                        <thead>
                          <tr style={{ background: '#f3f4f6', fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Position</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Nachweis / Grundlage</th>
                            <th style={{ textAlign: 'right', padding: '6px 8px' }}>Betrag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deductions.map((d, i) => (
                            <tr key={d.id} style={{ borderBottom: i < deductions.length - 1 ? '1px solid #f3f4f6' : '2px solid #1a1a2e' }}>
                              <td style={{ padding: '7px 8px' }}>{d.description || '-'}</td>
                              <td style={{ padding: '7px 8px', color: '#6b7280' }}>{d.basis || '-'}</td>
                              <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600 }}>− {fmt(d.amount)} €</td>
                            </tr>
                          ))}
                          <tr>
                            <td colSpan={2} style={{ padding: '7px 8px', fontWeight: 700 }}>Summe Abzüge</td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700 }}>− {fmt(totalDeductions)} €</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Einbehalt */}
                  {holdbackAmount > 0 && (
                    <div style={{ marginBottom: '18px', padding: '10px 12px', borderLeft: '3px solid #f59e0b', background: '#fef3c7', fontSize: '10px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '3px', color: '#92400e' }}>Einbehalt: {fmt(holdbackAmount)} €</div>
                      <div style={{ color: '#78350f' }}>{holdbackReason || 'Zur Sicherung noch nicht fälliger bzw. noch nicht abgerechneter Forderungen.'}</div>
                      <div style={{ color: '#78350f', marginTop: '4px', fontStyle: 'italic' }}>
                        Der Einbehalt wird nach endgültiger Klärung unverzüglich ausgezahlt.
                      </div>
                    </div>
                  )}

                  {/* Auszahlungsbetrag */}
                  <div style={{ marginBottom: '20px', padding: '14px 16px', background: payout > 0 ? '#ecfdf5' : '#fef2f2', borderRadius: '8px', border: `2px solid ${payout > 0 ? '#10b981' : '#ef4444'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>AUSZAHLUNGSBETRAG</div>
                        <div style={{ fontSize: '9.5px', color: '#6b7280', marginTop: '2px' }}>
                          {payout > 0 ? 'zu Ihren Gunsten' : 'Nachforderung'}
                        </div>
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: payout > 0 ? '#10b981' : '#ef4444' }}>
                        {fmt(payout)} €
                      </div>
                    </div>
                  </div>

                  {payout > 0 && payoutIban && (
                    <div style={{ marginBottom: '16px', fontSize: '10.5px' }}>
                      <div style={{ fontWeight: 600, marginBottom: '2px' }}>Auszahlung auf IBAN</div>
                      <div style={{ fontFamily: 'monospace', color: '#374151' }}>{payoutIban}</div>
                    </div>
                  )}

                  {/* Rechtlicher Hinweis */}
                  <div style={{ marginBottom: '20px', padding: '10px 12px', borderLeft: '3px solid #4F6BFF', background: '#f0f4ff', fontSize: '9.5px', color: '#1e40af' }}>
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Hinweise zur Kautionsabrechnung</div>
                    • Abrechnung erfolgt nach angemessener Prüfungsfrist (BGH: idR bis zu 6 Monate, BGH VIII ZR 71/05).<br />
                    • Ansprüche des Vermieters auf Ersatz für Veränderungen oder Verschlechterungen der Mietsache verjähren in <strong>sechs Monaten</strong> nach Rückerhalt (§ 548 Abs. 1 BGB) — Frist: <strong>{deadlineStr}</strong>.<br />
                    • Bei Fragen oder Einwendungen wenden Sie sich bitte innerhalb von 30 Tagen schriftlich an uns.
                  </div>

                  <p style={{ fontSize: '11px', lineHeight: '1.7', marginBottom: '10px' }}>Mit freundlichen Grüßen</p>
                  <div style={{ marginTop: '40px', borderTop: '1px solid #1a1a2e', paddingTop: '5px', fontSize: '10px', color: '#6b7280', maxWidth: '220px' }}>
                    Vermieter / Hausverwaltung
                  </div>

                  <div style={{ position: 'absolute', bottom: '30px', left: '60px', right: '60px', fontSize: '8.5px', color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{property!.name}, {property!.address}</span>
                    <span>§ 551 BGB — Mietsicherheit · § 548 BGB — Verjährung</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '1000px', color: '#9ca3af', fontSize: '13px' }}>
                  Bitte wähle einen Mieter und gib Kaution + Auszugsdatum ein.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
