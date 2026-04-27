import { useState, useRef } from 'react';
import { ArrowLeft, Download, AlertTriangle } from 'lucide-react';
import { useRentalProperties } from '../../../hooks/useRentalProperties';
import { useRentalUnits } from '../../../hooks/useRentalUnits';
import { exportElementToPDF } from '../../../lib/pdfExport';
import { NumberInput } from '../../ui/NumberInput';

interface Props {
  onBack: () => void;
}

// Ausgelagert, damit sie nicht bei jedem Render neu erzeugt werden
// (React würde sie sonst als neue Komponenten-Typen sehen → unnötiges Remount).
const Line = ({ label, width = '100%' }: { label: string; width?: string }) => (
  <div style={{ marginBottom: '10px' }}>
    <div style={{ fontSize: '9.5px', color: '#6b7280', marginBottom: '3px' }}>{label}</div>
    <div style={{ borderBottom: '1px solid #9ca3af', height: '18px', width }}></div>
  </div>
);

const CheckBox = ({ label }: { label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
    <div style={{ width: '10px', height: '10px', border: '1px solid #6b7280' }}></div>
    <span>{label}</span>
  </div>
);

export function TenantSelfDisclosure({ onBack }: Props) {
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const letterRef = useRef<HTMLDivElement>(null);

  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [rentAmount, setRentAmount] = useState(0);
  const [moveInDate, setMoveInDate] = useState('');

  const property = properties.find((p) => p.id === propertyId);
  const unit = allUnits.find((u) => u.id === unitId);
  const unitsForProperty = allUnits.filter((u) => u.propertyId === propertyId);

  const today = new Date();
  const todayStr = today.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '___________';
  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const ready = !!property && !!unit;

  const handleExport = async () => {
    if (!letterRef.current) return;
    await exportElementToPDF(letterRef.current, `Selbstauskunft_${property?.name?.replace(/\s/g, '_') || 'Wohnung'}.pdf`);
  };

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 pb-6">
        <button onClick={onBack} className="cursor-pointer transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">Selbstauskunft</h1>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="w-full xl:w-[380px] flex-shrink-0">
          <div className="surface">
            <div className="p-5 space-y-4">
              <h2 className="section-title">Einstellungen</h2>

              <div>
                <label className="input-label">Objekt</label>
                <select value={propertyId || '__none__'} onChange={(e) => { setPropertyId(e.target.value === '__none__' ? '' : e.target.value); setUnitId(''); }} className="input">
                  <option value="__none__">Wählen...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Einheit</label>
                <select value={unitId || '__none__'} onChange={(e) => setUnitId(e.target.value === '__none__' ? '' : e.target.value)} className="input" disabled={!propertyId}>
                  <option value="__none__">Wählen...</option>
                  {unitsForProperty.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Miete (Warmmiete pro Monat)</label>
                <NumberInput value={rentAmount} onChange={(v) => setRentAmount(v === '' ? 0 : v)} suffix="€" decimals={2} className="input" />
              </div>

              <div>
                <label className="input-label">Frühester Einzug</label>
                <input type="date" value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} className="input" />
              </div>

              <div className="flex items-start gap-2 p-3 rounded-[10px] text-xs" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <p>
                  Nur nach BGH-Rechtsprechung zulässige Fragen: Name, Adresse, Anzahl Personen, Beruf, Nettoeinkommen, Vorvermieter, Räumungstitel, Insolvenz. <strong>Unzulässig</strong>: Religion, Schwangerschaft, Vorstrafen, Parteizugehörigkeit, Kinderwunsch.
                </p>
              </div>

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
                padding: '55px 55px 50px 55px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                position: 'relative',
              }}
            >
              {ready ? (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #4F6BFF, #8b5cf6)' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
                    <div>
                      <div style={{ fontSize: '17px', fontWeight: 700 }}>{property!.name}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>{property!.address}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '10px' }}>
                      <div style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, fontSize: '9px' }}>Stand</div>
                      <div>{todayStr}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>
                    Mieterselbstauskunft
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '16px' }}>
                    Wohnung: {unit!.name} &nbsp;|&nbsp; Warmmiete: {fmt(rentAmount)} €/Monat &nbsp;|&nbsp; Einzug: {formatDate(moveInDate)}
                  </div>

                  <p style={{ fontSize: '9.5px', lineHeight: '1.55', color: '#374151', marginBottom: '16px' }}>
                    Bitte füllen Sie die folgenden Angaben vollständig und wahrheitsgemäß aus. Die Angaben werden vertraulich behandelt und ausschließlich zur Entscheidung über den Abschluss des Mietvertrags verarbeitet (Art. 6 Abs. 1 lit. b DSGVO). Bei Nichtabschluss des Vertrags werden die Daten innerhalb von 3 Monaten gelöscht.
                  </p>

                  {/* 1. Persönliche Daten */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px', color: '#1a1a2e' }}>1. Persönliche Angaben</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <Line label="Nachname" />
                      <Line label="Vorname" />
                      <Line label="Geburtsdatum" />
                      <Line label="Familienstand" />
                      <Line label="Staatsangehörigkeit" />
                      <Line label="Telefon / E-Mail" />
                    </div>
                    <Line label="Aktuelle Anschrift" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <Line label="Ausweis-/Passnummer" />
                      <Line label="Anzahl einziehender Personen" />
                    </div>
                  </div>

                  {/* 2. Beruf & Einkommen */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px', color: '#1a1a2e' }}>2. Beruf &amp; Einkommen</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <Line label="Beruf / ausgeübte Tätigkeit" />
                      <Line label="Arbeitgeber" />
                      <Line label="Beschäftigt seit" />
                      <Line label="Nettoeinkommen / Monat" />
                    </div>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '10px', marginTop: '4px' }}>
                      <CheckBox label="Unbefristet" />
                      <CheckBox label="Befristet bis" />
                      <CheckBox label="Selbstständig" />
                      <CheckBox label="Rentner/in" />
                      <CheckBox label="Student/in" />
                    </div>
                  </div>

                  {/* 3. Vorvermieter */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px', color: '#1a1a2e' }}>3. Bisheriges Mietverhältnis</div>
                    <Line label="Name des Vorvermieters / Hausverwaltung" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <Line label="Telefon Vorvermieter" />
                      <Line label="Mietverhältnis seit / bis" />
                    </div>
                    <div style={{ fontSize: '10px', marginTop: '4px' }}>Bestehen Mietrückstände beim aktuellen oder einem früheren Vermieter?</div>
                    <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}><CheckBox label="Nein" /><CheckBox label="Ja, in Höhe von:" /></div>
                  </div>

                  {/* 4. Rechtliches */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px', color: '#1a1a2e' }}>4. Rechtliche Angaben</div>
                    <div style={{ fontSize: '10px', marginBottom: '4px' }}>Liegt gegen Sie ein Räumungstitel vor?</div>
                    <div style={{ display: 'flex', gap: '14px' }}><CheckBox label="Nein" /><CheckBox label="Ja" /></div>
                    <div style={{ fontSize: '10px', marginBottom: '4px', marginTop: '8px' }}>Wurde in den letzten 5 Jahren ein Insolvenz- oder Privatinsolvenzverfahren eröffnet?</div>
                    <div style={{ display: 'flex', gap: '14px' }}><CheckBox label="Nein" /><CheckBox label="Ja" /></div>
                    <div style={{ fontSize: '10px', marginBottom: '4px', marginTop: '8px' }}>Wurde in den letzten 5 Jahren eine eidesstattliche Versicherung abgegeben?</div>
                    <div style={{ display: 'flex', gap: '14px' }}><CheckBox label="Nein" /><CheckBox label="Ja" /></div>
                  </div>

                  {/* 5. Haustier / Besonderes */}
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px', color: '#1a1a2e' }}>5. Sonstiges</div>
                    <div style={{ fontSize: '10px', marginBottom: '4px' }}>Sollen Haustiere gehalten werden?</div>
                    <div style={{ display: 'flex', gap: '14px', marginBottom: '8px' }}><CheckBox label="Nein" /><CheckBox label="Ja — Art/Anzahl:" /></div>
                    <div style={{ fontSize: '10px', marginBottom: '4px' }}>Soll die Wohnung gewerblich genutzt werden?</div>
                    <div style={{ display: 'flex', gap: '14px' }}><CheckBox label="Nein" /><CheckBox label="Ja" /></div>
                  </div>

                  {/* DSGVO-Belehrung */}
                  <div style={{ marginBottom: '18px', padding: '10px 12px', borderLeft: '3px solid #8b5cf6', background: '#f5f3ff', fontSize: '9px', color: '#5b21b6', lineHeight: '1.5' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>Datenschutz &amp; Einwilligung (Art. 13, Art. 6 DSGVO)</div>
                    Ich versichere die Richtigkeit aller Angaben. Dem Vermieter ist bekannt, dass falsche Angaben zur Anfechtung oder fristlosen Kündigung des Mietvertrages berechtigen können. Der Vermieter darf die Angaben zum Zweck der Entscheidung über den Vertragsschluss prüfen und bei negativer Entscheidung werden die Daten binnen 3 Monaten gelöscht. Ich habe das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17) und Widerspruch (Art. 21 DSGVO).
                  </div>

                  {/* Unterschrift */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '26px' }}>
                    <div>
                      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: '5px', fontSize: '9.5px', color: '#6b7280' }}>Ort, Datum</div>
                    </div>
                    <div>
                      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: '5px', fontSize: '9.5px', color: '#6b7280' }}>Unterschrift Antragsteller/in</div>
                    </div>
                  </div>

                  <div style={{ position: 'absolute', bottom: '24px', left: '55px', right: '55px', fontSize: '8.5px', color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{property!.name}, {property!.address}</span>
                    <span>BGH VIII ZR 126/03 · DSGVO Art. 6 Abs. 1 lit. b</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '1000px', color: '#9ca3af', fontSize: '13px' }}>
                  Bitte wähle Objekt und Einheit.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
