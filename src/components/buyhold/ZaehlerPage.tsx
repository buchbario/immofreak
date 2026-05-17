import { useState, useMemo } from 'react';
import { Plus, X, Gauge } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMeterReadings } from '../../hooks/useMeterReadings';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import type { MeterReading } from '../../types';
import { NumberInput } from '../ui/NumberInput';
import { PageCard } from '../ui/PageCard';
import { DateInput } from '../ui/DateInput';

export function ZaehlerPage() {
  const { allReadings, createReading } = useMeterReadings();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();

  const [showDialog, setShowDialog] = useState(false);
  const [selectedMeter, setSelectedMeter] = useState<string | null>(null);

  // Form state
  const [formPropertyId, setFormPropertyId] = useState('');
  const [formUnitId, setFormUnitId] = useState('');
  const [formMeterId, setFormMeterId] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formReadBy, setFormReadBy] = useState('');

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Group readings by property
  const readingsByProperty = useMemo(() => {
    const map = new Map<string, MeterReading[]>();
    for (const reading of allReadings) {
      const list = map.get(reading.propertyId) || [];
      list.push(reading);
      map.set(reading.propertyId, list);
    }
    return map;
  }, [allReadings]);

  // Get latest reading per meter within a property group
  const getLatestReadings = (readings: MeterReading[]) => {
    const byMeter = new Map<string, MeterReading>();
    for (const r of readings) {
      const existing = byMeter.get(r.meterId);
      if (!existing || r.date > existing.date) {
        byMeter.set(r.meterId, r);
      }
    }
    return Array.from(byMeter.values()).sort((a, b) => a.meterId.localeCompare(b.meterId));
  };

  // Unique meter IDs for chart selection
  const allMeterIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of allReadings) set.add(r.meterId);
    return Array.from(set).sort();
  }, [allReadings]);

  // Chart data for selected meter
  const chartData = useMemo(() => {
    if (!selectedMeter) return [];
    return allReadings
      .filter((r) => r.meterId === selectedMeter)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ date: formatDate(r.date), value: r.value }));
  }, [selectedMeter, allReadings]);

  const unitsForProperty = formPropertyId ? allUnits.filter((u) => u.propertyId === formPropertyId) : [];

  const resetForm = () => {
    setFormPropertyId('');
    setFormUnitId('');
    setFormMeterId('');
    setFormValue('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormReadBy('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(formValue);
    if (!formPropertyId || !formMeterId || isNaN(parsed) || !formReadBy) return;
    createReading({
      propertyId: formPropertyId,
      unitId: formUnitId || undefined,
      meterId: formMeterId,
      value: parsed,
      date: formDate,
      readBy: formReadBy,
    });
    resetForm();
    setShowDialog(false);
  };

  return (
    <div className="page-container">
      <PageCard
        title="Zählerstände"
        description="Alle Ablesungen im Überblick. Klicke auf eine Zeile, um den Verlauf eines Zählers als Graph zu sehen."
        meta={
          <>
            <Gauge size={11} /> {allReadings.length} {allReadings.length === 1 ? 'Ablesung' : 'Ablesungen'}
            <span className="size-[3px] rounded-full bg-muted-foreground/40 mx-0.5" />
            <span>{allMeterIds.length} {allMeterIds.length === 1 ? 'Zähler' : 'Zähler'}</span>
          </>
        }
        actions={
          <button onClick={() => setShowDialog(true)} className="btn btn-sm btn-primary">
            <Plus size={14} /> Ablesung erfassen
          </button>
        }
      >
        {allReadings.length === 0 ? (
          <div className="text-center py-12 px-5">
            <Gauge size={28} className="mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-[13px] font-medium text-foreground mb-1">Keine Zählerstände vorhanden</p>
            <p className="text-[12px] text-muted-foreground">Erfasse die erste Ablesung um Verbrauchsverläufe zu tracken.</p>
          </div>
        ) : (
          <div className="px-5 sm:px-7 py-4 space-y-5">
            {Array.from(readingsByProperty.entries()).map(([propertyId, readings]) => {
              const property = properties.find((p) => p.id === propertyId);
              const latestReadings = getLatestReadings(readings);
              return (
                <div key={propertyId}>
                  <p className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground/70 mb-2 px-1">
                    {property?.name || 'Unbekanntes Objekt'}
                  </p>
                  <div className="border border-card-line rounded-[10px] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b border-card-divider">
                            <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Zähler</th>
                            <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Einheit</th>
                            <th className="th text-end text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Letzter Stand</th>
                            <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Datum</th>
                            <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Abgelesen von</th>
                          </tr>
                        </thead>
                        <tbody>
                          {latestReadings.map((r, idx) => {
                            const unit = r.unitId ? allUnits.find((u) => u.id === r.unitId) : undefined;
                            const isSelected = r.meterId === selectedMeter;
                            return (
                              <tr
                                key={r.id}
                                className={`cursor-pointer transition-colors hover:bg-layer-hover ${idx < latestReadings.length - 1 ? 'border-b border-card-divider' : ''} ${isSelected ? 'bg-[#4F6BFF]/8' : ''}`}
                                onClick={() => setSelectedMeter(r.meterId)}
                              >
                                <td className="td text-[13px] font-semibold text-foreground tracking-tight">{r.meterId}</td>
                                <td className="td text-[12.5px] text-muted-foreground">{unit?.name || 'Allgemein'}</td>
                                <td className="td text-end text-[13px] font-semibold tabular-nums text-foreground">{r.value.toLocaleString('de-DE')}</td>
                                <td className="td text-[12.5px] text-muted-foreground tabular-nums">{formatDate(r.date)}</td>
                                <td className="td text-[12.5px] text-muted-foreground">{r.readBy}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageCard>

      {/* Chart for selected meter */}
      {selectedMeter && chartData.length > 0 && (
        <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] mt-4 sm:mt-5 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-foreground tracking-tight">Verlauf: {selectedMeter}</h3>
            <button
              onClick={() => setSelectedMeter(null)}
              className="btn btn-sm btn-secondary"
            >
              <X size={14} /> Schließen
            </button>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--card-line)" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)' }} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: '1px solid var(--card-line)', boxShadow: '0 4px 12px rgba(15,23,42,0.08)', backgroundColor: 'var(--card)', color: 'var(--foreground)', fontSize: 12 }}
                />
                <Line type="monotone" dataKey="value" stroke="#4F6BFF" strokeWidth={2} dot={{ r: 4, fill: '#4F6BFF' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Add reading dialog */}
      {showDialog && (
        <div className="modal-backdrop">
          <div className="modal-overlay" onClick={() => { resetForm(); setShowDialog(false); }} />
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Ablesung erfassen</h2>
                <p className="text-xs mt-0.5 text-muted-foreground">Neuen Zahlerstand eintragen.</p>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => { resetForm(); setShowDialog(false); }}>&#10005;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="input-label">Objekt</label>
                  <select
                    value={formPropertyId}
                    onChange={(e) => { setFormPropertyId(e.target.value); setFormUnitId(''); }}
                    className="input"
                  >
                    <option value="">Objekt wählen</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">Einheit (optional)</label>
                  <select
                    value={formUnitId}
                    onChange={(e) => setFormUnitId(e.target.value)}
                    className="input"
                  >
                    <option value="">Allgemein</option>
                    {unitsForProperty.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label">Zahler-ID</label>
                  <input
                    type="text"
                    value={formMeterId}
                    onChange={(e) => setFormMeterId(e.target.value)}
                    placeholder="z.B. STROM-001"
                    required
                    className="input"
                  />
                </div>

                <div>
                  <label className="input-label">Stand</label>
                  <NumberInput
                    value={formValue}
                    onChange={(v) => setFormValue(v === '' ? '' : String(v))}
                    decimals={2}
                    required
                    className="input"
                  />
                </div>

                <div>
                  <label className="input-label">Datum</label>
                  <DateInput value={formDate} onChange={setFormDate} />
                </div>

                <div>
                  <label className="input-label">Abgelesen von</label>
                  <input
                    type="text"
                    value={formReadBy}
                    onChange={(e) => setFormReadBy(e.target.value)}
                    placeholder="Name"
                    required
                    className="input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => { resetForm(); setShowDialog(false); }}
                  className="btn btn-md btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="btn btn-md btn-primary"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
