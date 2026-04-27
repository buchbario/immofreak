import { useState, useRef, useMemo } from 'react';
import { ArrowLeft, Download, AlertTriangle } from 'lucide-react';
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

const EUR = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '___________';

export function RentalContractLetter({ onBack }: Props) {
  const { allTenants } = useTenants();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allContracts } = useRentalContracts();
  const { settings } = useLandlordSettings();
  const letterRef = useRef<HTMLDivElement>(null);

  const [contractId, setContractId] = useState('');
  const [place, setPlace] = useState(settings.city || 'Berlin');
  const [signDate, setSignDate] = useState(new Date().toISOString().slice(0, 10));
  const [petsAllowed, setPetsAllowed] = useState<'erlaubt' | 'verboten' | 'ruecksprache'>('ruecksprache');
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [renovationClauseMode, setRenovationClauseMode] = useState<'keine' | 'sanierung-bei-auszug' | 'laufend'>('keine');
  const [houseRulesIncluded, setHouseRulesIncluded] = useState(true);
  const [keysProvided, setKeysProvided] = useState(2);

  const contract = useMemo(() => allContracts.find((c) => c.id === contractId), [allContracts, contractId]);
  const tenant = useMemo(() => (contract ? allTenants.find((t) => t.id === contract.tenantId) : undefined), [contract, allTenants]);
  const unit = useMemo(() => (contract ? allUnits.find((u) => u.id === contract.unitId) : undefined), [contract, allUnits]);
  const property = useMemo(() => (contract ? properties.find((p) => p.id === contract.propertyId) : undefined), [contract, properties]);

  const ready = !!(contract && tenant && unit && property);

  const handleExport = async () => {
    if (!letterRef.current || !tenant) return;
    await exportElementToPDF(
      letterRef.current,
      `Mietvertrag_${tenant.name.replace(/\s+/g, '_')}_${signDate}.pdf`,
    );
  };

  const warmmiete = contract ? contract.rentAmount + contract.operatingCosts + contract.heatingCosts : 0;
  const depositCap = contract ? contract.rentAmount * 3 : 0;
  const depositExceedsCap = !!(contract && contract.depositAmount > depositCap);

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 pb-6">
        <button onClick={onBack} className="cursor-pointer transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">Mietvertrag (Wohnraum)</h1>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Einstellungen */}
        <div className="w-full xl:w-[400px] flex-shrink-0">
          <div className="surface">
            <div className="p-5 space-y-4">
              <h2 className="section-title">Einstellungen</h2>

              <div>
                <label className="input-label">Mietvertrag</label>
                <select
                  value={contractId || '__none__'}
                  onChange={(e) => setContractId(e.target.value === '__none__' ? '' : e.target.value)}
                  className="input"
                >
                  <option value="__none__">Wählen...</option>
                  {allContracts.map((c) => {
                    const t = allTenants.find((x) => x.id === c.tenantId);
                    const p = properties.find((x) => x.id === c.propertyId);
                    const u = allUnits.find((x) => x.id === c.unitId);
                    return (
                      <option key={c.id} value={c.id}>
                        {t?.name} – {p?.name} {u?.name ? `· ${u.name}` : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Basis-Daten (Miete, Kaution, Laufzeit) kommen aus dem Mietvertrag-Datensatz.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Unterzeichnungsort</label>
                  <input value={place} onChange={(e) => setPlace(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="input-label">Unterzeichnungsdatum</label>
                  <input type="date" value={signDate} onChange={(e) => setSignDate(e.target.value)} className="input" />
                </div>
              </div>

              <div>
                <label className="input-label">Tierhaltung</label>
                <select
                  value={petsAllowed}
                  onChange={(e) => setPetsAllowed(e.target.value as typeof petsAllowed)}
                  className="input"
                >
                  <option value="ruecksprache">Nach Rücksprache (BGH-konform)</option>
                  <option value="erlaubt">Erlaubt</option>
                  <option value="verboten">Nicht erlaubt (Kleintiere bleiben frei)</option>
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  BGH VIII ZR 168/12: Pauschales Haltungsverbot unwirksam.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={smokingAllowed} onChange={(e) => setSmokingAllowed(e.target.checked)} />
                <span>Rauchen in der Wohnung erlaubt</span>
              </label>

              <div>
                <label className="input-label">Schönheitsreparaturen</label>
                <select
                  value={renovationClauseMode}
                  onChange={(e) => setRenovationClauseMode(e.target.value as typeof renovationClauseMode)}
                  className="input"
                >
                  <option value="keine">Keine Renovierungspflicht (unrenoviert übernommen)</option>
                  <option value="laufend">Laufende Schönheitsreparaturen</option>
                  <option value="sanierung-bei-auszug">Endrenovierung bei Auszug</option>
                </select>
                <p className="text-[10px] text-amber-500 mt-1">
                  BGH VIII ZR 185/14: Bei unrenoviert übergebener Wohnung ist Renovierungsklausel unwirksam.
                </p>
              </div>

              <div>
                <label className="input-label">Übergebene Schlüssel</label>
                <NumberInput value={keysProvided} onChange={(v) => setKeysProvided(v === '' ? 1 : v)} decimals={0} className="input" />
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={houseRulesIncluded} onChange={(e) => setHouseRulesIncluded(e.target.checked)} />
                <span>Hausordnung als Anlage beifügen</span>
              </label>

              {depositExceedsCap && (
                <div className="flex items-start gap-2 p-3 rounded-[10px] text-xs" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <p>
                    Kaution ({EUR(contract!.depositAmount)} €) übersteigt die gesetzliche Obergrenze von 3 Monatskaltmieten ({EUR(depositCap)} €) nach § 551 Abs. 1 BGB. Bitte im Mietvertrag korrigieren.
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 rounded-[10px] text-xs" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <p>
                  Dieser Mietvertrag basiert auf dem BGB (§§ 535–577a), der BetrKV und der HeizkostenV (Stand 2024). Für Sonderkonstellationen (WG, möbliert, Staffel-/Indexmiete, Mietpreisbremse) rechtsanwaltlich prüfen lassen.
                </p>
              </div>

              <button onClick={handleExport} disabled={!ready} className="btn btn-md btn-primary w-full">
                <Download size={16} /> PDF herunterladen
              </button>
            </div>
          </div>
        </div>

        {/* PDF-Preview */}
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
                padding: '50px 55px 50px 55px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                position: 'relative',
              }}
            >
              {ready ? (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #4F6BFF, #6b7280)' }} />

                  {/* Header */}
                  <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '0.5px' }}>Mietvertrag</div>
                    <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>für Wohnraum gemäß §§ 535 ff. BGB</div>
                  </div>

                  {/* Parteien */}
                  <div style={{ fontSize: '10.5px', lineHeight: 1.55, marginBottom: '18px' }}>
                    <p style={{ margin: 0 }}>zwischen</p>
                    <div style={{ marginTop: '8px', padding: '10px 12px', background: '#f8f9fb', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                      <div style={{ fontWeight: 600 }}>{settings.contactName || settings.companyName || '________________________'}</div>
                      {settings.companyName && settings.contactName && (
                        <div style={{ color: '#6b7280' }}>{settings.companyName}</div>
                      )}
                      <div style={{ color: '#6b7280' }}>{settings.street || property!.address}</div>
                      <div style={{ color: '#6b7280' }}>{[settings.zip, settings.city].filter(Boolean).join(' ')}</div>
                      <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        — nachstehend „Vermieter" —
                      </div>
                    </div>
                    <p style={{ margin: '10px 0 0' }}>und</p>
                    <div style={{ marginTop: '8px', padding: '10px 12px', background: '#f8f9fb', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                      <div style={{ fontWeight: 600 }}>{tenant!.name}</div>
                      {tenant!.email && <div style={{ color: '#6b7280' }}>{tenant!.email}</div>}
                      {tenant!.phone && <div style={{ color: '#6b7280' }}>{tenant!.phone}</div>}
                      <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        — nachstehend „Mieter" —
                      </div>
                    </div>
                  </div>

                  {/* § 1 Mietgegenstand */}
                  <Section title="§ 1 Mietgegenstand">
                    Der Vermieter vermietet dem Mieter die im Objekt <b>{property!.name}</b>, {property!.address}, gelegene Wohnung <b>{unit!.name}</b> mit einer Wohnfläche von ca. <b>{unit!.area} m²</b> und <b>{unit!.rooms} Zimmern</b>. Zur Wohnung gehören sämtliche mitvermieteten Flächen sowie die Mitbenutzung der gemeinschaftlichen Anlagen (Treppenhaus, Flure, Müllplatz, ggf. Keller und Fahrradabstellplätze).
                  </Section>

                  {/* § 2 Mietzeit */}
                  <Section title="§ 2 Mietzeit und Kündigung">
                    <p style={{ margin: 0 }}>
                      Das Mietverhältnis beginnt am <b>{fmtDate(contract!.startDate)}</b>
                      {contract!.contractType === 'unbefristet'
                        ? ' und wird auf unbestimmte Zeit geschlossen.'
                        : ` und endet am ${fmtDate(contract!.endDate)}.`}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#4b5563' }}>
                      Die Kündigung richtet sich nach §§ 573, 573c BGB. Die gesetzliche Kündigungsfrist für den Mieter beträgt drei Monate. Für den Vermieter verlängert sich die Frist nach fünf und acht Jahren Mietdauer auf sechs bzw. neun Monate.
                      {contract!.contractType === 'befristet' && ' Da es sich um einen befristeten Vertrag nach § 575 BGB handelt, ist eine ordentliche Kündigung während der Laufzeit ausgeschlossen; das Recht zur außerordentlichen Kündigung aus wichtigem Grund (§ 543 BGB) bleibt unberührt. Befristungsgrund: siehe Anlage.'}
                    </p>
                  </Section>

                  {/* § 3 Miete */}
                  <Section title="§ 3 Miete und Nebenkosten">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', marginBottom: '8px' }}>
                      <tbody>
                        <Row label="Grundmiete (Kaltmiete)" value={`${EUR(contract!.rentAmount)} €`} />
                        <Row label="Vorauszahlung Betriebskosten" value={`${EUR(contract!.operatingCosts)} €`} />
                        <Row label="Vorauszahlung Heizkosten" value={`${EUR(contract!.heatingCosts)} €`} />
                        <tr style={{ borderTop: '2px solid #1a1a1a' }}>
                          <td style={{ padding: '6px 0', fontWeight: 700 }}>Gesamtmiete monatlich</td>
                          <td style={{ padding: '6px 0', fontWeight: 700, textAlign: 'right' }}>{EUR(warmmiete)} €</td>
                        </tr>
                      </tbody>
                    </table>
                    <p style={{ margin: '0', fontSize: '10px', color: '#4b5563' }}>
                      Die Miete ist monatlich im Voraus, spätestens bis zum {contract!.rentPaymentDay}. Werktag eines Monats, auf das vom Vermieter bezeichnete Konto zu überweisen. Die Betriebs- und Heizkosten werden jährlich nach § 556 BGB, der BetrKV und der HeizkostenV abgerechnet. Eine Anpassung der Vorauszahlungen ist nach § 560 Abs. 4 BGB auf Basis der jeweils letzten Abrechnung möglich.
                    </p>
                  </Section>

                  {/* § 4 Kaution */}
                  <Section title="§ 4 Kaution">
                    Der Mieter leistet eine Mietsicherheit in Höhe von <b>{EUR(contract!.depositAmount)} €</b>.
                    Die Kaution ist gemäß § 551 Abs. 1 BGB auf das Dreifache der Grundmiete ({EUR(depositCap)} €) begrenzt und kann in drei gleichen Monatsraten gezahlt werden. Der Vermieter hat die Kaution getrennt von seinem Vermögen zum üblichen Zinssatz für Spareinlagen mit dreimonatiger Kündigungsfrist anzulegen (§ 551 Abs. 3 BGB). Die Erträge stehen dem Mieter zu und erhöhen die Sicherheit.
                  </Section>

                  {/* § 5 Schönheitsreparaturen */}
                  <Section title="§ 5 Schönheitsreparaturen">
                    {renovationClauseMode === 'keine' && (
                      <>Es wird keine Renovierungspflicht auf den Mieter übertragen. Schönheitsreparaturen verbleiben beim Vermieter (§ 535 Abs. 1 S. 2 BGB). Die Wohnung wird im übergebenen Zustand zurückgegeben, normale Abnutzung ist abgegolten.</>
                    )}
                    {renovationClauseMode === 'laufend' && (
                      <>Der Mieter übernimmt laufende Schönheitsreparaturen bei Bedarf in fachgerechter Ausführung (keine starren Fristenpläne, keine Quotenklauseln). Voraussetzung: Die Wohnung wurde renoviert bzw. mit vergleichbarer Ausgleichsleistung übergeben (BGH VIII ZR 185/14).</>
                    )}
                    {renovationClauseMode === 'sanierung-bei-auszug' && (
                      <>Bei Auszug übergibt der Mieter die Wohnung im Zustand der Übergabe, normale Abnutzung ausgenommen. Starre Fristenpläne oder Quotenabgeltungsklauseln sind unwirksam (BGH VIII ZR 185/14).</>
                    )}
                  </Section>

                  {/* § 6 Tierhaltung */}
                  <Section title="§ 6 Tierhaltung">
                    {petsAllowed === 'erlaubt' && 'Die Tierhaltung ist dem Mieter gestattet, soweit keine Belästigung der Hausgemeinschaft oder Gefährdung des Mietgebrauchs entsteht.'}
                    {petsAllowed === 'ruecksprache' && 'Die Haltung von Hunden und Katzen bedarf der vorherigen Zustimmung des Vermieters. Die Zustimmung darf nur aus sachlichen Gründen verweigert werden (BGH VIII ZR 168/12). Die Haltung von Kleintieren (z. B. Wellensittiche, Zierfische, Hamster) ist ohne Zustimmung zulässig.'}
                    {petsAllowed === 'verboten' && 'Die Haltung von Hunden und Katzen ist untersagt. Kleintiere (Zierfische, Vögel in üblicher Anzahl, Hamster u. ä.) sind erlaubt (BGH VIII ZR 340/06).'}
                  </Section>

                  {/* § 7 Rauchen */}
                  <Section title="§ 7 Rauchen">
                    {smokingAllowed
                      ? 'Das Rauchen in der Wohnung ist gestattet. Im Treppenhaus und in Gemeinschaftsräumen ist das Rauchen untersagt.'
                      : 'Das Rauchen in den Innenräumen der Wohnung sowie in den gemeinschaftlich genutzten Flächen ist untersagt. Das Rauchen auf dem Balkon bleibt zulässig, soweit dadurch die Rechte der Nachbarn nicht unzumutbar beeinträchtigt werden.'}
                  </Section>

                  {/* § 8 Übergabe */}
                  <Section title="§ 8 Übergabe und Schlüssel">
                    Die Wohnung wird dem Mieter am Beginn des Mietverhältnisses in einem zum vertragsgemäßen Gebrauch geeigneten Zustand übergeben. Der Mieter erhält <b>{keysProvided}</b> Schlüssel für die Wohnungstür sowie die zugehörigen Schlüssel für Haustür, Briefkasten, Kellerraum und ggf. Müllplatz. Über die Übergabe wird ein gesondertes Protokoll (§ 546 BGB) geführt, in dem auch die Zählerstände dokumentiert werden.
                  </Section>

                  {/* § 9 Instandhaltung / Kleinreparaturen */}
                  <Section title="§ 9 Instandhaltung und Kleinreparaturen">
                    Der Mieter hat kleinere Schäden an Installationsgegenständen für Elektrizität, Wasser und Gas, an Heiz- und Kocheinrichtungen, Fenster- und Türverschlüssen sowie Verschlussvorrichtungen auf eigene Kosten zu beseitigen, wenn die Aufwendungen im Einzelfall 100 € und insgesamt pro Kalenderjahr 8 % der Jahresnettokaltmiete nicht übersteigen (Kleinreparaturklausel gem. BGH-Rechtsprechung VIII ZR 38/90). Größere Instandhaltungs- und Instandsetzungsmaßnahmen obliegen dem Vermieter (§ 535 Abs. 1 S. 2 BGB).
                  </Section>

                  {/* § 10 Datenschutz */}
                  <Section title="§ 10 Datenschutz">
                    Der Vermieter verarbeitet personenbezogene Daten des Mieters ausschließlich zur Durchführung des Mietverhältnisses sowie zur Erfüllung gesetzlicher Pflichten (Art. 6 Abs. 1 lit. b und lit. c DSGVO). Eine Weitergabe erfolgt nur, soweit dies zur Vertragsdurchführung erforderlich ist (z. B. Hausverwaltung, Versorgungsunternehmen, steuerliche Beratung). Die Rechte nach Art. 13 ff. DSGVO (Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit) bleiben unberührt.
                  </Section>

                  {/* § 11 Sonstiges */}
                  <Section title="§ 11 Schlussbestimmungen">
                    Änderungen und Ergänzungen dieses Vertrags bedürfen der Textform (§ 126b BGB). Das vorgeschriebene Textformerfordernis gilt auch für den Verzicht auf die Textform selbst. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen davon unberührt; an die Stelle der unwirksamen Bestimmung tritt die gesetzliche Regelung. Gerichtsstand ist der Ort der vermieteten Wohnung, soweit zulässig.
                    {houseRulesIncluded && ' Die Hausordnung ist als Anlage Bestandteil dieses Vertrags.'}
                  </Section>

                  {/* Ort, Datum */}
                  <div style={{ fontSize: '10.5px', marginTop: '18px', marginBottom: '30px' }}>
                    {place}, den {fmtDate(signDate)}
                  </div>

                  {/* Unterschriften */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '20px' }}>
                    <div>
                      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: '5px', fontSize: '10px', color: '#6b7280' }}>
                        Vermieter {(settings.contactName || settings.companyName) ? `(${settings.contactName || settings.companyName})` : ''}
                      </div>
                    </div>
                    <div>
                      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: '5px', fontSize: '10px', color: '#6b7280' }}>
                        Mieter ({tenant!.name})
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ position: 'absolute', bottom: '25px', left: '55px', right: '55px', fontSize: '8.5px', color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{property!.name} · {unit!.name}</span>
                    <span>Wohnraummietvertrag §§ 535 ff. BGB</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '1000px', color: '#9ca3af', fontSize: '13px' }}>
                  Bitte wähle einen Mietvertrag aus.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '10.5px', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ padding: '5px 0' }}>{label}</td>
      <td style={{ padding: '5px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</td>
    </tr>
  );
}
