import { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMeterReadings } from '../../hooks/useMeterReadings';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import type { MeterReading } from '../../types';
import { NumberInput } from '../ui/NumberInput';

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
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Zählerstände</h1>
          <p className="page-subtitle">Alle Ablesungen im Überblick</p>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="btn btn-md btn-primary"
        >
          <Plus size={14} />
          Ablesung erfassen
        </button>
      </div>

      {/* Readings grouped by property */}
      {allReadings.length === 0 ? (
        <div className="surface empty-state">
          <p className="text-sm text-muted-foreground-2">Keine Zählerstände vorhanden.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(readingsByProperty.entries()).map(([propertyId, readings]) => {
            const property = properties.find((p) => p.id === propertyId);
            const latestReadings = getLatestReadings(readings);
            return (
              <div key={propertyId} className="surface overflow-hidden">
                <div className="px-4 py-3 border-b border-card-divider">
                  <h3 className="section-title">{property?.name || 'Unbekanntes Objekt'}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-card-divider">
                        <th className="th">Zahler</th>
                        <th className="th">Einheit</th>
                        <th className="th text-end">Letzter Stand</th>
                        <th className="th">Datum</th>
                        <th className="th">Abgelesen von</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestReadings.map((r) => {
                        const unit = r.unitId ? allUnits.find((u) => u.id === r.unitId) : undefined;
                        return (
                          <tr
                            key={r.id}
                            className="cursor-pointer transition-colors hover:bg-layer-hover border-b border-card-divider"
                            onClick={() => setSelectedMeter(r.meterId)}
                          >
                            <td className="td font-medium text-foreground">{r.meterId}</td>
                            <td className="td text-muted-foreground-2">{unit?.name || 'Allgemein'}</td>
                            <td className="td text-end font-semibold tabular-nums text-foreground">{r.value.toLocaleString('de-DE')}</td>
                            <td className="td text-muted-foreground-2">{formatDate(r.date)}</td>
                            <td className="td text-muted-foreground-2">{r.readBy}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Chart for selected meter */}
      {selectedMeter && chartData.length > 0 && (
        <div className="surface mt-6">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Verlauf: {selectedMeter}</h3>
              <button
                onClick={() => setSelectedMeter(null)}
                className="btn btn-sm btn-secondary"
              >
                <X size={14} />
                Schliessen
              </button>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)' }} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', backgroundColor: 'var(--surface)', color: 'var(--text)' }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Meter selection hint */}
      {allMeterIds.length > 0 && !selectedMeter && (
        <p className="text-xs mt-4 text-muted-foreground">
          Klicke auf eine Zeile, um den Verlauf des Zahlers anzuzeigen.
        </p>
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
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="input"
                  />
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
