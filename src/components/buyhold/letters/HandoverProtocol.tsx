import { useState, useRef } from 'react';
import { ArrowLeft, Download, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useTenants } from '../../../hooks/useTenants';
import { useRentalProperties } from '../../../hooks/useRentalProperties';
import { useRentalUnits } from '../../../hooks/useRentalUnits';
import { useRentalContracts } from '../../../hooks/useRentalContracts';
import { exportElementToPDF } from '../../../lib/pdfExport';
import { NumberInput } from '../../ui/NumberInput';

interface Props {
  onBack: () => void;
}

type HandoverType = 'einzug' | 'auszug';

interface MeterReading {
  id: string;
  type: string;
  number: string;
  value: string;
}

interface Defect {
  id: string;
  room: string;
  description: string;
  responsible: 'mieter' | 'vermieter' | 'offen';
}

interface KeyHandover {
  id: string;
  label: string;
  count: number;
}

const DEFAULT_METERS: Omit<MeterReading, 'id'>[] = [
  { type: 'Strom', number: '', value: '' },
  { type: 'Gas', number: '', value: '' },
  { type: 'Warmwasser', number: '', value: '' },
  { type: 'Kaltwasser', number: '', value: '' },
  { type: 'Heizung', number: '', value: '' },
];

export function HandoverProtocol({ onBack }: Props) {
  const { allTenants } = useTenants();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allContracts } = useRentalContracts();
  const letterRef = useRef<HTMLDivElement>(null);

  const [tenantId, setTenantId] = useState('');
  const [type, setType] = useState<HandoverType>('einzug');
  const [handoverDate, setHandoverDate] = useState(new Date().toISOString().slice(0, 10));
  const [meters, setMeters] = useState<MeterReading[]>(DEFAULT_METERS.map((m, i) => ({ ...m, id: `m-${i}` })));
  const [defects, setDefects] = useState<Defect[]>([]);
  const [keys, setKeys] = useState<KeyHandover[]>([
    { id: 'k-1', label: 'Wohnungstür', count: 2 },
    { id: 'k-2', label: 'Haustür', count: 1 },
    { id: 'k-3', label: 'Briefkasten', count: 1 },
  ]);
  const [generalCondition, setGeneralCondition] = useState('');
  const [cleanReceived, setCleanReceived] = useState(true);
  const [photosTaken, setPhotosTaken] = useState(true);

  const tenant = allTenants.find((t) => t.id === tenantId);
  const unit = tenant ? allUnits.find((u) => u.id === tenant.unitId) : undefined;
  const property = tenant ? properties.find((p) => p.id === tenant.propertyId) : undefined;
  const contract = allContracts.find((c) => c.tenantId === tenantId);

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '___________';

  const addMeter = () => setMeters([...meters, { id: `m-${Date.now()}`, type: '', number: '', value: '' }]);
  const updateMeter = (id: string, patch: Partial<MeterReading>) => setMeters(meters.map((m) => m.id === id ? { ...m, ...patch } : m));
  const removeMeter = (id: string) => setMeters(meters.filter((m) => m.id !== id));

  const addDefect = () => setDefects([...defects, { id: `d-${Date.now()}`, room: '', description: '', responsible: 'offen' }]);
  const updateDefect = (id: string, patch: Partial<Defect>) => setDefects(defects.map((d) => d.id === id ? { ...d, ...patch } : d));
  const removeDefect = (id: string) => setDefects(defects.filter((d) => d.id !== id));

  const addKey = () => setKeys([...keys, { id: `k-${Date.now()}`, label: '', count: 1 }]);
  const updateKey = (id: string, patch: Partial<KeyHandover>) => setKeys(keys.map((k) => k.id === id ? { ...k, ...patch } : k));
  const removeKey = (id: string) => setKeys(keys.filter((k) => k.id !== id));

  const ready = !!tenant && !!property && !!unit;

  const handleExport = async () => {
    if (!letterRef.current || !tenant) return;
    await exportElementToPDF(letterRef.current, `Uebergabeprotokoll_${type}_${tenant.name.replace(/\s/g, '_')}.pdf`);
  };

  const title = type === 'einzug' ? 'Wohnungsübergabeprotokoll (Einzug)' : 'Wohnungsübergabeprotokoll (Auszug)';

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 pb-6">
        <button onClick={onBack} className="cursor-pointer transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-title">Übergabeprotokoll</h1>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="w-full xl:w-[400px] flex-shrink-0">
          <div className="surface">
            <div className="p-5 space-y-4">
              <h2 className="section-title">Einstellungen</h2>

              <div>
                <label className="input-label">Mieter</label>
                <select value={tenantId || '__none__'} onChange={(e) => setTenantId(e.target.value === '__none__' ? '' : e.target.value)} className="input">
                  <option value="__none__">Wählen...</option>
                  {allTenants.map((t) => {
                    const p = properties.find((x) => x.id === t.propertyId);
                    return <option key={t.id} value={t.id}>{`${t.name} (${p?.name || '-'})`}</option>;
                  })}
                </select>
              </div>

              <div>
                <label className="input-label">Art</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['einzug', 'auszug'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`btn btn-md ${type === t ? 'btn-primary' : 'btn-ghost'}`}
                    >
                      {t === 'einzug' ? 'Einzug' : 'Auszug'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="input-label">Datum der Übergabe</label>
                <input type="date" value={handoverDate} onChange={(e) => setHandoverDate(e.target.value)} className="input" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="input-label !mb-0">Zählerstände</label>
                  <button onClick={addMeter} className="btn btn-sm btn-ghost text-[11px]"><Plus size={12} /> Hinzufügen</button>
                </div>
                <div className="space-y-2">
                  {meters.map((m) => (
                    <div key={m.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 items-center">
                      <input value={m.type} onChange={(e) => updateMeter(m.id, { type: e.target.value })} placeholder="Art" className="input !text-[11px] !py-1.5" />
                      <input value={m.number} onChange={(e) => updateMeter(m.id, { number: e.target.value })} placeholder="Nr." className="input !text-[11px] !py-1.5" />
                      <input value={m.value} onChange={(e) => updateMeter(m.id, { value: e.target.value })} placeholder="Stand" className="input !text-[11px] !py-1.5" />
                      <button onClick={() => removeMeter(m.id)} className="text-muted-foreground hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="input-label !mb-0">Schlüssel</label>
                  <button onClick={addKey} className="btn btn-sm btn-ghost text-[11px]"><Plus size={12} /> Hinzufügen</button>
                </div>
                <div className="space-y-2">
                  {keys.map((k) => (
                    <div key={k.id} className="grid grid-cols-[1fr_80px_auto] gap-1.5 items-center">
                      <input value={k.label} onChange={(e) => updateKey(k.id, { label: e.target.value })} placeholder="Bezeichnung" className="input !text-[11px] !py-1.5" />
                      <NumberInput value={k.count} onChange={(v) => updateKey(k.id, { count: v === '' ? 0 : v })} decimals={0} className="input !text-[11px] !py-1.5" />
                      <button onClick={() => removeKey(k.id)} className="text-muted-foreground hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="input-label !mb-0">Mängel / Beschädigungen</label>
                  <button onClick={addDefect} className="btn btn-sm btn-ghost text-[11px]"><Plus size={12} /> Hinzufügen</button>
                </div>
                <div className="space-y-2">
                  {defects.map((d) => (
                    <div key={d.id} className="space-y-1 p-2 rounded-[8px] bg-layer-hover">
                      <div className="grid grid-cols-[1fr_auto] gap-1.5">
                        <input value={d.room} onChange={(e) => updateDefect(d.id, { room: e.target.value })} placeholder="Raum" className="input !text-[11px] !py-1.5" />
                        <button onClick={() => removeDefect(d.id)} className="text-muted-foreground hover:text-red-400 px-1"><Trash2 size={12} /></button>
                      </div>
                      <input value={d.description} onChange={(e) => updateDefect(d.id, { description: e.target.value })} placeholder="Beschreibung" className="input !text-[11px] !py-1.5" />
                      <select value={d.responsible} onChange={(e) => updateDefect(d.id, { responsible: e.target.value as Defect['responsible'] })} className="input !text-[11px] !py-1.5">
                        <option value="offen">Verantwortung offen</option>
                        <option value="mieter">Mieter verantwortlich</option>
                        <option value="vermieter">Vermieter verantwortlich</option>
                      </select>
                    </div>
                  ))}
                  {defects.length === 0 && <p className="text-[11px] text-muted-foreground">Keine Mängel erfasst</p>}
                </div>
              </div>

              <div>
                <label className="input-label">Allgemeiner Zustand</label>
                <textarea value={generalCondition} onChange={(e) => setGeneralCondition(e.target.value)} rows={3} className="input" placeholder="z. B. Wohnung sauber übergeben, keine Schäden, Tapeten neu..." />
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={cleanReceived} onChange={(e) => setCleanReceived(e.target.checked)} />
                <span>Wohnung {type === 'einzug' ? 'sauber übergeben' : 'besenrein zurückgegeben'}</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={photosTaken} onChange={(e) => setPhotosTaken(e.target.checked)} />
                <span>Fotodokumentation angefertigt</span>
              </label>

              <div className="flex items-start gap-2 p-3 rounded-[10px] text-xs" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <p>
                  Protokoll muss von Mieter und Vermieter (bzw. Bevollmächtigten) unterschrieben werden. Beweissicherung bei Rückforderung der Kaution nach § 551 BGB.
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
                padding: '60px 55px 50px 55px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                position: 'relative',
              }}
            >
              {ready ? (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #4F6BFF, #6b7280)' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div>
                      <div style={{ fontSize: '17px', fontWeight: 700 }}>{property!.name}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>{property!.address}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '10px' }}>
                      <div style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, fontSize: '9px' }}>Datum</div>
                      <div>{formatDate(handoverDate)}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', paddingBottom: '8px', borderBottom: '2px solid #e5e7eb' }}>{title}</div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '20px' }}>
                    Wohnung: {unit!.name} &nbsp;|&nbsp; {property!.address}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '22px', fontSize: '10.5px' }}>
                    <div style={{ padding: '10px 12px', background: '#f8f9fb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '9px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', marginBottom: '3px' }}>Vermieter</div>
                      <div style={{ fontWeight: 600 }}>Eigentümer / Verwaltung</div>
                      <div style={{ color: '#6b7280' }}>{property!.address}</div>
                    </div>
                    <div style={{ padding: '10px 12px', background: '#f8f9fb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '9px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', marginBottom: '3px' }}>Mieter</div>
                      <div style={{ fontWeight: 600 }}>{tenant!.name}</div>
                      {contract?.startDate && <div style={{ color: '#6b7280' }}>Vertrag seit {formatDate(contract.startDate)}</div>}
                    </div>
                  </div>

                  {/* Zählerstände */}
                  <div style={{ marginBottom: '22px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Zählerstände</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6', fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
                          <th style={{ textAlign: 'left', padding: '6px 8px' }}>Art</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px' }}>Zählernummer</th>
                          <th style={{ textAlign: 'right', padding: '6px 8px' }}>Zählerstand</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meters.filter((m) => m.type).map((m, i) => (
                          <tr key={m.id} style={{ borderBottom: i < meters.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                            <td style={{ padding: '7px 8px' }}>{m.type}</td>
                            <td style={{ padding: '7px 8px', color: '#6b7280' }}>{m.number || '-'}</td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600 }}>{m.value || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Schlüssel */}
                  <div style={{ marginBottom: '22px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Schlüsselübergabe</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6', fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
                          <th style={{ textAlign: 'left', padding: '6px 8px' }}>Bezeichnung</th>
                          <th style={{ textAlign: 'right', padding: '6px 8px' }}>Anzahl</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keys.filter((k) => k.label).map((k, i) => (
                          <tr key={k.id} style={{ borderBottom: i < keys.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                            <td style={{ padding: '7px 8px' }}>{k.label}</td>
                            <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600 }}>{k.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mängel */}
                  <div style={{ marginBottom: '22px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Mängel / Beschädigungen</div>
                    {defects.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                        <thead>
                          <tr style={{ background: '#f3f4f6', fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
                            <th style={{ textAlign: 'left', padding: '6px 8px', width: '25%' }}>Raum</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Beschreibung</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px', width: '25%' }}>Verantwortung</th>
                          </tr>
                        </thead>
                        <tbody>
                          {defects.map((d, i) => (
                            <tr key={d.id} style={{ borderBottom: i < defects.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                              <td style={{ padding: '7px 8px' }}>{d.room || '-'}</td>
                              <td style={{ padding: '7px 8px' }}>{d.description || '-'}</td>
                              <td style={{ padding: '7px 8px', color: d.responsible === 'mieter' ? '#dc2626' : d.responsible === 'vermieter' ? '#2563eb' : '#6b7280' }}>
                                {d.responsible === 'mieter' ? 'Mieter' : d.responsible === 'vermieter' ? 'Vermieter' : 'offen'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic' }}>Keine Mängel festgestellt.</p>
                    )}
                  </div>

                  {/* Zustand */}
                  <div style={{ marginBottom: '22px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Allgemeiner Zustand</div>
                    <p style={{ fontSize: '10.5px', lineHeight: '1.6', whiteSpace: 'pre-wrap', minHeight: '32px' }}>{generalCondition || '—'}</p>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '10px', marginTop: '8px' }}>
                      <span>☐ {cleanReceived ? '☑' : '☐'} Wohnung {type === 'einzug' ? 'sauber übergeben' : 'besenrein zurückgegeben'}</span>
                      <span>{photosTaken ? '☑' : '☐'} Fotodokumentation angefertigt</span>
                    </div>
                  </div>

                  {/* Rechtlicher Hinweis */}
                  <div style={{ marginBottom: '26px', padding: '10px 12px', borderLeft: '3px solid #4F6BFF', background: '#f0f4ff', fontSize: '9.5px', color: '#1e40af' }}>
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>Rechtlicher Hinweis</div>
                    Dieses Protokoll dient gemäß § 546 BGB der Beweissicherung zum Zustand der Mietsache bei Übergabe. Nicht protokollierte Mängel gelten bei Auszug grundsätzlich als nicht vorhanden bzw. vom Mieter verursacht.
                    {type === 'auszug' && ' Zur Kautionsabrechnung (§ 551 BGB) relevant: Ansprüche des Vermieters aus Schadensersatz verjähren nach § 548 BGB in sechs Monaten nach Rückgabe.'}
                  </div>

                  {/* Unterschriften */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '40px' }}>
                    <div>
                      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: '5px', fontSize: '10px', color: '#6b7280' }}>
                        Vermieter / Bevollmächtigter
                      </div>
                    </div>
                    <div>
                      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: '5px', fontSize: '10px', color: '#6b7280' }}>
                        Mieter
                      </div>
                    </div>
                  </div>

                  <div style={{ position: 'absolute', bottom: '30px', left: '55px', right: '55px', fontSize: '8.5px', color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{property!.name}, {property!.address}</span>
                    <span>§ 546 BGB — Rückgabepflicht</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '1000px', color: '#9ca3af', fontSize: '13px' }}>
                  Bitte wähle einen Mieter.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
