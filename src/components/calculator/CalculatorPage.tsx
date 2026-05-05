import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, TrendingUp, X, Sparkles, MapPin } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  BUNDESLAENDER,
  DEFAULT_BUNDESLAND_CODE,
  DEFAULT_NOTAR_PCT,
  DEFAULT_MAKLER_PCT,
  getBundeslandByCode,
} from '../../lib/bundesland';
import { NumberInput } from '../ui/NumberInput';

const COLORS = {
  primary: '#3b82f6',
  amber: '#f59e0b',
  emerald: '#10b981',
  coral: '#ef4444',
};

/**
 * Dünner Wrapper um den shared `NumberInput`, damit die Call-Sites in dieser
 * Datei sich nicht ändern müssen. Speichert weiterhin als String im Form-State
 * (`Number(form.x) || 0` beim Lesen). `''` kommt als leere Eingabe durch.
 */
function CurrencyInput({
  value,
  onChange,
  placeholder = '0',
  suffix = '\u20ac',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <NumberInput
      value={value}
      onChange={(v) => onChange(v === '' ? '' : String(v))}
      placeholder={placeholder}
      suffix={suffix}
      decimals={2}
      className="input"
    />
  );
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="surface px-3 py-2 text-sm shadow-sm">
        <p className="font-medium text-foreground">{data.name}</p>
        <p className="text-muted-foreground-2">{formatCurrency(data.value)}</p>
      </div>
    );
  }
  return null;
}

function WaterfallTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="surface px-3 py-2 text-sm shadow-sm">
        <p className="font-medium text-foreground">{data.name}</p>
        <p className="text-muted-foreground-2">{formatCurrency(data.displayValue)}</p>
      </div>
    );
  }
  return null;
}

export function CalculatorPage() {
  const navigate = useNavigate();

  // Defaults aus Settings (Einstellungen → Fix & Flip → Bundesland). Fallback auf
  // das Default-Bundesland, falls der Nutzer nie in den Settings war.
  const initialBundeslandCode = localStorage.getItem('immofreak_ff_bundesland') || DEFAULT_BUNDESLAND_CODE;
  const initialBundesland = getBundeslandByCode(initialBundeslandCode) ?? BUNDESLAENDER[0];
  const initialGrESt = localStorage.getItem('immofreak_ff_purchase_tax')
    ?? String(initialBundesland.grunderwerbsteuer);
  const initialNotar = localStorage.getItem('immofreak_ff_notar_fee') ?? String(DEFAULT_NOTAR_PCT);
  const initialMakler = localStorage.getItem('immofreak_ff_broker_fee') ?? String(DEFAULT_MAKLER_PCT);

  const [bundeslandCode, setBundeslandCode] = useState<string>(initialBundeslandCode);

  const [form, setForm] = useState({
    kaufsumme: '',
    grunderwerbsteuerPct: initialGrESt,
    notarPct: initialNotar,
    maklerPct: initialMakler,
    sonstigeKosten: '',
    wohnflaeche: '',
    sanierungskosten: '',
    verkaufspreis: '',
    projektName: '',
    adresse: '',
  });

  // Modal für Projektanlage — wird über den Sticky-CTA unten geöffnet. So geht der
  // primäre Call-to-Action nicht mehr am unteren Page-Ende verloren.
  const [createOpen, setCreateOpen] = useState(false);

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  // Bundesland-Wechsel zieht GrESt automatisch nach (konsistent zum
  // Settings-Verhalten). Der Nutzer kann den Satz danach manuell überschreiben.
  const handleBundeslandChange = (code: string) => {
    const bl = getBundeslandByCode(code);
    if (!bl) return;
    setBundeslandCode(code);
    setForm((f) => ({ ...f, grunderwerbsteuerPct: String(bl.grunderwerbsteuer) }));
  };

  // ESC schließt das Modal
  useEffect(() => {
    if (!createOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCreateOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [createOpen]);

  // Parsed numbers
  const kaufsumme = Number(form.kaufsumme) || 0;
  const grunderwerbsteuerPct = Number(form.grunderwerbsteuerPct) || 0;
  const notarPct = Number(form.notarPct) || 0;
  const maklerPct = Number(form.maklerPct) || 0;
  const sonstigeKosten = Number(form.sonstigeKosten) || 0;
  const wohnflaeche = Number(form.wohnflaeche) || 0;
  const sanierungskosten = Number(form.sanierungskosten) || 0;
  const verkaufspreis = Number(form.verkaufspreis) || 0;
  // Nebenkosten breakdown
  const grunderwerbsteuer = Math.round(kaufsumme * grunderwerbsteuerPct / 100);
  const notarKosten = Math.round(kaufsumme * notarPct / 100);
  const maklerKosten = Math.round(kaufsumme * maklerPct / 100);
  const nebenkosten = grunderwerbsteuer + notarKosten + maklerKosten;

  // Calculations
  const gik = kaufsumme + nebenkosten + sonstigeKosten + sanierungskosten;
  const preisProQm = wohnflaeche > 0 ? Math.round(kaufsumme / wohnflaeche) : 0;
  const gikProQm = wohnflaeche > 0 ? Math.round(gik / wohnflaeche) : 0;
  const gewinnEuro = verkaufspreis - gik;
  const roiPercent = gik > 0 ? (gewinnEuro / gik) * 100 : 0;
  const hasInput = kaufsumme > 0;
  const hasResult = kaufsumme > 0 && verkaufspreis > 0;

  // Chart data
  const pieData = useMemo(() => {
    if (!hasInput) return [];
    const items = [
      { name: 'Kaufsumme', value: kaufsumme, color: COLORS.primary },
      { name: 'Nebenkosten', value: nebenkosten, color: COLORS.amber },
      { name: 'Sanierung', value: sanierungskosten, color: COLORS.emerald },
      { name: 'Sonstige', value: sonstigeKosten, color: COLORS.coral },
    ];
    return items.filter((i) => i.value > 0);
  }, [hasInput, kaufsumme, nebenkosten, sanierungskosten, sonstigeKosten]);

  const waterfallData = useMemo(() => {
    if (!hasResult) return [];
    const cumKauf = kaufsumme;
    const cumNK = cumKauf + nebenkosten;
    const cumSan = cumNK + sanierungskosten;
    void (cumSan + sonstigeKosten);

    return [
      { name: 'Kaufsumme', base: 0, value: kaufsumme, displayValue: kaufsumme, fill: COLORS.primary },
      { name: 'NK', base: cumKauf, value: nebenkosten, displayValue: nebenkosten, fill: COLORS.amber },
      { name: 'Sanierung', base: cumNK, value: sanierungskosten, displayValue: sanierungskosten, fill: COLORS.emerald },
      { name: 'Sonstige', base: cumSan, value: sonstigeKosten, displayValue: sonstigeKosten, fill: COLORS.coral },
      { name: 'GIK', base: 0, value: gik, displayValue: gik, fill: '#64748b' },
      { name: 'Verkauf', base: 0, value: verkaufspreis, displayValue: verkaufspreis, fill: gewinnEuro >= 0 ? COLORS.emerald : COLORS.coral },
      { name: 'Gewinn', base: gewinnEuro >= 0 ? gik : verkaufspreis, value: Math.abs(gewinnEuro), displayValue: gewinnEuro, fill: gewinnEuro >= 0 ? COLORS.emerald : COLORS.coral },
    ];
  }, [hasResult, kaufsumme, nebenkosten, sanierungskosten, sonstigeKosten, gik, verkaufspreis, gewinnEuro]);

  const handleCreateProject = () => {
    const params = new URLSearchParams({
      name: form.projektName || 'Neues Projekt',
      address: form.adresse,
      purchasePrice: (kaufsumme + nebenkosten + sonstigeKosten).toString(),
      targetSellPrice: verkaufspreis.toString(),
      arv: verkaufspreis.toString(),
      renovationBudget: sanierungskosten.toString(),
    });
    navigate(`/projekte?fromCalc=true&${params.toString()}`);
  };

  const nkPercent = kaufsumme > 0 ? ((nebenkosten / kaufsumme) * 100).toFixed(2) : '0';

  return (
    <div className="page-container">
      {/* Flat header */}
      <div className="mb-5 sm:mb-6 px-1">
        <h1 className="text-[26px] sm:text-[30px] font-bold text-foreground tracking-tight leading-[1.15] mb-1.5">
          Kalkulator
        </h1>
        <p className="text-[14px] text-muted-foreground max-w-2xl leading-relaxed">
          Berechne GIK, Marge und Rendite für dein nächstes Projekt — inklusive Kaufnebenkosten, Sanierungs-Budget und Verkaufsprognose.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left: Input form (60%) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Kaufdaten + NK Breakdown */}
          <div className="surface">
            <div className="p-5">
              <h3 className="section-title mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold bg-primary">
                  1
                </div>
                Kaufdaten
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Kaufsumme</label>
                    <CurrencyInput value={form.kaufsumme} onChange={(v) => update('kaufsumme', v)} />
                  </div>
                  <div>
                    <label className="input-label">Wohnfläche</label>
                    <CurrencyInput
                      value={form.wohnflaeche}
                      onChange={(v) => update('wohnflaeche', v)}
                      suffix="m²"
                    />
                  </div>
                </div>

                {/* Bundesland-Auswahl: steuert GrESt automatisch */}
                <div className="pt-4 border-t border-card-divider">
                  <label className="input-label flex items-center gap-1.5">
                    <MapPin size={12} className="text-muted-foreground" />
                    Bundesland
                  </label>
                  <select
                    value={bundeslandCode}
                    onChange={(e) => handleBundeslandChange(e.target.value)}
                    className="input"
                  >
                    {BUNDESLAENDER.map((bl) => (
                      <option key={bl.code} value={bl.code}>
                        {bl.name} — {bl.grunderwerbsteuer.toLocaleString('de-DE', { minimumFractionDigits: 1 })} % GrESt
                      </option>
                    ))}
                  </select>
                </div>

                {/* NK Breakdown */}
                <div className="pt-4 border-t border-card-divider">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-foreground">Nebenkosten-Aufschlüsselung</p>
                    {kaufsumme > 0 && (
                      <span className="text-xs text-muted-foreground-2">
                        Gesamt: {formatCurrency(nebenkosten)} ({nkPercent}%)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="input-label">Grunderwerbsteuer</label>
                      <CurrencyInput
                        value={form.grunderwerbsteuerPct}
                        onChange={(v) => update('grunderwerbsteuerPct', v)}
                        suffix="%"
                      />
                      {kaufsumme > 0 && (
                        <p className="text-xs mt-1 text-muted-foreground-2">{formatCurrency(grunderwerbsteuer)}</p>
                      )}
                    </div>
                    <div>
                      <label className="input-label">Notar + Grundbuch</label>
                      <CurrencyInput
                        value={form.notarPct}
                        onChange={(v) => update('notarPct', v)}
                        suffix="%"
                      />
                      {kaufsumme > 0 && (
                        <p className="text-xs mt-1 text-muted-foreground-2">{formatCurrency(notarKosten)}</p>
                      )}
                    </div>
                    <div>
                      <label className="input-label">Makler</label>
                      <CurrencyInput
                        value={form.maklerPct}
                        onChange={(v) => update('maklerPct', v)}
                        suffix="%"
                      />
                      {kaufsumme > 0 && (
                        <p className="text-xs mt-1 text-muted-foreground-2">{formatCurrency(maklerKosten)}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="input-label">Sonstige Kosten</label>
                  <CurrencyInput
                    value={form.sonstigeKosten}
                    onChange={(v) => update('sonstigeKosten', v)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sanierung */}
          <div className="surface">
            <div className="p-5">
              <h3 className="section-title mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold bg-primary">
                  2
                </div>
                Sanierung
              </h3>
              <div>
                <label className="input-label">Sanierungskosten (geplant)</label>
                <CurrencyInput
                  value={form.sanierungskosten}
                  onChange={(v) => update('sanierungskosten', v)}
                />
                {wohnflaeche > 0 && sanierungskosten > 0 && (
                  <p className="text-xs mt-1 text-muted-foreground-2">
                    {formatCurrency(Math.round(sanierungskosten / wohnflaeche))} / m²
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Verkauf */}
          <div className="surface">
            <div className="p-5">
              <h3 className="section-title mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold bg-primary">
                  3
                </div>
                Verkauf
              </h3>
              <div>
                <label className="input-label">
                  Voraussichtlicher Verkaufspreis
                </label>
                <CurrencyInput
                  value={form.verkaufspreis}
                  onChange={(v) => update('verkaufspreis', v)}
                />
                {wohnflaeche > 0 && verkaufspreis > 0 && (
                  <p className="text-xs mt-1 text-muted-foreground-2">
                    {formatCurrency(Math.round(verkaufspreis / wohnflaeche))} / m²
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Right: Results (40%) */}
        <div className="lg:col-span-2 space-y-4">
          {/* GIK Card */}
          <div className="surface">
            <div className="p-5">
              <p className="stat-label">
                Gesamtinvestitionskosten (GIK)
              </p>
              <p className="stat-value mt-2">{formatCurrency(gik)}</p>
              <div className="flex items-center gap-4 mt-2">
                {wohnflaeche > 0 && (
                  <span className="text-xs text-muted-foreground">{formatCurrency(gikProQm)} / m²</span>
                )}
                {wohnflaeche > 0 && preisProQm > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Kaufpreis: {formatCurrency(preisProQm)} / m²
                  </span>
                )}
              </div>

              {/* Cost line items */}
              {hasInput && (
                <div className="mt-4 pt-4 space-y-2 border-t border-card-divider">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground-2">Kaufsumme</span>
                    <span className="font-medium text-foreground">{formatCurrency(kaufsumme)}</span>
                  </div>
                  {nebenkosten > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground-2">Nebenkosten</span>
                      <span className="font-medium text-foreground">{formatCurrency(nebenkosten)}</span>
                    </div>
                  )}
                  {sanierungskosten > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground-2">Sanierungskosten</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(sanierungskosten)}
                      </span>
                    </div>
                  )}
                  {sonstigeKosten > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground-2">Sonstige Kosten</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(sonstigeKosten)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Pie Chart */}
          {pieData.length > 0 && (
            <div className="surface">
              <div className="p-5">
                <p className="stat-label mb-4">
                  Kostenverteilung
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-[160px] h-[160px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={72}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    {pieData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="truncate text-muted-foreground-2">{item.name}</span>
                        </div>
                        <span className="font-medium flex-shrink-0 ml-2 text-foreground">
                          {gik > 0 ? ((item.value / gik) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Margin / ROI */}
          {hasResult && (
            <div className="surface p-5">
              <p className="stat-label mb-3">
                Marge &amp; Rendite
              </p>
              <div className="flex items-end gap-3 mb-3">
                <p
                  className={`text-3xl font-bold ${
                    gewinnEuro >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {gewinnEuro >= 0 ? '+' : ''}
                  {formatCurrency(gewinnEuro)}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`badge ${
                    gewinnEuro >= 0
                      ? 'badge-green'
                      : 'badge-red'
                  }`}
                >
                  ROI: {roiPercent >= 0 ? '+' : ''}
                  {roiPercent.toFixed(1)}%
                </span>
              </div>

              <div className="mt-4 pt-3 space-y-1.5 border-t border-card-divider">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground-2">Verkaufspreis</span>
                  <span className="font-medium text-foreground">{formatCurrency(verkaufspreis)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground-2">- GIK</span>
                  <span className="font-medium text-foreground">{formatCurrency(gik)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-card-divider">
                  <span className="text-foreground">= Gewinn</span>
                  <span className={gewinnEuro >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {gewinnEuro >= 0 ? '+' : ''}{formatCurrency(gewinnEuro)}
                  </span>
                </div>
              </div>

            </div>
          )}

          {/* Waterfall Chart */}
          {hasResult && waterfallData.length > 0 && (
            <div className="surface">
              <div className="p-5">
                <p className="stat-label mb-4">
                  Investitions-Wasserfall
                </p>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={waterfallData} barCategoryGap="20%">
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#5a5a6e' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#5a5a6e' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) =>
                          v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                        }
                      />
                      <Tooltip content={<WaterfallTooltip />} />
                      {/* Invisible base bar */}
                      <Bar dataKey="base" stackId="stack" fill="transparent" radius={0} />
                      {/* Visible value bar */}
                      <Bar dataKey="value" stackId="stack" radius={[4, 4, 0, 0]}>
                        {waterfallData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-3 justify-center flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.primary }} />
                    Kaufsumme
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.amber }} />
                    NK
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.emerald }} />
                    Sanierung
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.coral }} />
                    Sonstige
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Sticky Action Bar — sobald die Kalkulation ein Ergebnis hat, klebt diese
          Bar am unteren Rand des Scroll-Containers. Zeigt Gewinn + ROI als
          KPI-Summary und einen primären CTA, der ein Modal zum Projekt-Anlegen
          öffnet. Löst das Problem, dass der alte „Projekt anlegen"-Block unten
          außerhalb des Folds lag. */}
      {hasResult && (
        <div
          className="sticky bottom-0 left-0 right-0 z-30 -mx-4 sm:-mx-5 lg:-mx-8 mt-6"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="bg-card/95 backdrop-blur-md border-t border-card-line shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.08)]">
            <div className="px-4 sm:px-5 lg:px-8 py-3 flex items-center gap-3 sm:gap-6">
              {/* KPI-Summary */}
              <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Gewinn</p>
                  <p className={cn(
                    'text-base sm:text-lg font-bold tabular-nums leading-tight',
                    gewinnEuro >= 0 ? 'text-emerald-600' : 'text-red-500'
                  )}>
                    {gewinnEuro >= 0 ? '+' : ''}{formatCurrency(gewinnEuro)}
                  </p>
                </div>
                <div className="h-8 w-px bg-card-divider flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">ROI</p>
                  <p className={cn(
                    'text-base sm:text-lg font-bold tabular-nums leading-tight',
                    roiPercent >= 0 ? 'text-emerald-600' : 'text-red-500'
                  )}>
                    {roiPercent >= 0 ? '+' : ''}{roiPercent.toFixed(1)}%
                  </p>
                </div>
                <div className="hidden md:block h-8 w-px bg-card-divider flex-shrink-0" />
                <div className="hidden md:block min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">GIK</p>
                  <p className="text-base sm:text-lg font-bold tabular-nums leading-tight text-foreground">
                    {formatCurrency(gik)}
                  </p>
                </div>
              </div>
              {/* CTA */}
              <button
                onClick={() => setCreateOpen(true)}
                className="btn btn-md btn-primary flex-shrink-0 shadow-md"
              >
                <Sparkles size={14} className="hidden sm:inline" />
                <span className="hidden sm:inline">Projekt anlegen</span>
                <span className="sm:hidden">Anlegen</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Projekt-Anlage */}
      {createOpen && (
        <div className="modal-backdrop">
          <div className="modal-overlay" onClick={() => setCreateOpen(false)} />
          <div className="modal-content max-w-md">
            <div className="modal-header">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-dim)' }}>
                  <Building2 size={15} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">Projekt anlegen</h3>
                  <p className="text-xs text-muted-foreground-2 truncate">
                    Übernimmt die Kalkulationsdaten ins neue Projekt
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                aria-label="Schließen"
                className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-layer-hover cursor-pointer flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {/* Vorschau der übernommenen Werte */}
              <div className="mb-4 p-3 rounded-lg bg-muted/40 border border-card-divider">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-2">Wird übernommen</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div className="text-muted-foreground-2">Kaufpreis inkl. NK</div>
                  <div className="text-right font-medium tabular-nums text-foreground">{formatCurrency(kaufsumme + nebenkosten + sonstigeKosten)}</div>
                  <div className="text-muted-foreground-2">Sanierungsbudget</div>
                  <div className="text-right font-medium tabular-nums text-foreground">{formatCurrency(sanierungskosten)}</div>
                  <div className="text-muted-foreground-2">Ziel-Verkaufspreis</div>
                  <div className="text-right font-medium tabular-nums text-foreground">{formatCurrency(verkaufspreis)}</div>
                  <div className="text-muted-foreground-2">Erwarteter Gewinn</div>
                  <div className={cn('text-right font-semibold tabular-nums', gewinnEuro >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {gewinnEuro >= 0 ? '+' : ''}{formatCurrency(gewinnEuro)}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="input-label">Projektname</label>
                  <input
                    type="text"
                    value={form.projektName}
                    onChange={(e) => update('projektName', e.target.value)}
                    placeholder="z. B. Altbau Berlin Mitte"
                    className="input"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="input-label">Adresse</label>
                  <input
                    type="text"
                    value={form.adresse}
                    onChange={(e) => update('adresse', e.target.value)}
                    placeholder="z. B. Invalidenstr. 12, 10115 Berlin"
                    className="input"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setCreateOpen(false)} className="btn btn-md btn-secondary">
                Abbrechen
              </button>
              <button onClick={handleCreateProject} className="btn btn-md btn-primary">
                <TrendingUp size={14} />
                Projekt erstellen
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
