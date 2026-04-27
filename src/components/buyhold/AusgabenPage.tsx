import { useState, useMemo } from 'react';
import { Plus, Check, Minus } from 'lucide-react';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { Modal } from '../ui/Modal';
import { NumberInput } from '../ui/NumberInput';

type ExpenseCategory =
  | 'Instandhaltung'
  | 'Versicherung'
  | 'Verwaltung'
  | 'Grundsteuer'
  | 'Hausgeld'
  | 'Sonstiges';

interface Expense {
  id: string;
  propertyId: string;
  unitId?: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  isUmlagefaehig: boolean;
  createdAt: string;
}

const CATEGORIES: ExpenseCategory[] = [
  'Instandhaltung',
  'Versicherung',
  'Verwaltung',
  'Grundsteuer',
  'Hausgeld',
  'Sonstiges',
];

const categoryDotColor: Record<ExpenseCategory, string> = {
  Instandhaltung: 'dot-red',
  Versicherung: 'dot-gray',
  Verwaltung: 'dot-blue',
  Grundsteuer: 'dot-amber',
  Hausgeld: 'dot-blue',
  Sonstiges: 'dot-gray',
};

const fmt = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

const MOCK_EXPENSES: Expense[] = [
  { id: '1', propertyId: '', category: 'Instandhaltung', description: 'Heizungsreparatur', amount: 850, date: '2026-03-15', isUmlagefaehig: false, createdAt: '2026-03-15' },
  { id: '2', propertyId: '', category: 'Versicherung', description: 'Gebäudeversicherung Q1', amount: 420, date: '2026-03-01', isUmlagefaehig: true, createdAt: '2026-03-01' },
  { id: '3', propertyId: '', category: 'Hausgeld', description: 'Hausgeld März', amount: 380, date: '2026-03-01', isUmlagefaehig: true, createdAt: '2026-03-01' },
  { id: '4', propertyId: '', category: 'Grundsteuer', description: 'Grundsteuer Q1', amount: 290, date: '2026-02-15', isUmlagefaehig: true, createdAt: '2026-02-15' },
  { id: '5', propertyId: '', category: 'Verwaltung', description: 'Hausverwaltung Feb', amount: 180, date: '2026-02-01', isUmlagefaehig: false, createdAt: '2026-02-01' },
  { id: '6', propertyId: '', category: 'Sonstiges', description: 'Schornsteinfeger', amount: 95, date: '2026-01-20', isUmlagefaehig: true, createdAt: '2026-01-20' },
  { id: '7', propertyId: '', category: 'Instandhaltung', description: 'Dachreparatur', amount: 2400, date: '2026-01-10', isUmlagefaehig: false, createdAt: '2026-01-10' },
  { id: '8', propertyId: '', category: 'Hausgeld', description: 'Hausgeld Jan', amount: 380, date: '2026-01-01', isUmlagefaehig: true, createdAt: '2026-01-01' },
];

export function AusgabenPage() {
  const { properties } = useRentalProperties();

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const pid = properties.length > 0 ? properties[0].id : '';
    return MOCK_EXPENSES.map((e) => ({ ...e, propertyId: e.propertyId || pid }));
  });

  const [categoryFilter, setCategoryFilter] = useState<string>('alle');
  const [propertyFilter, setPropertyFilter] = useState<string>('alle');
  const [monthFilter, setMonthFilter] = useState<string>('alle');
  const [dialogOpen, setDialogOpen] = useState(false);

  // New expense form state
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('Sonstiges');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formPropertyId, setFormPropertyId] = useState('');
  const [formUmlagefaehig, setFormUmlagefaehig] = useState(false);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const propertyMap = useMemo(() => {
    const map = new Map<string, (typeof properties)[number]>();
    properties.forEach((p) => map.set(p.id, p));
    return map;
  }, [properties]);

  const filtered = useMemo(() => {
    return expenses
      .filter((e) => {
        if (categoryFilter !== 'alle' && e.category !== categoryFilter) return false;
        if (propertyFilter !== 'alle' && e.propertyId !== propertyFilter) return false;
        if (monthFilter !== 'alle') {
          const d = new Date(e.date);
          const expMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (expMonth !== monthFilter) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, categoryFilter, propertyFilter, monthFilter]);

  // KPIs
  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);
  const umlagefaehig = filtered.filter((e) => e.isUmlagefaehig).reduce((s, e) => s + e.amount, 0);
  const nichtUmlagefaehig = filtered.filter((e) => !e.isUmlagefaehig).reduce((s, e) => s + e.amount, 0);

  const avgPerMonth = useMemo(() => {
    const monthSet = new Set(
      expenses.map((e) => {
        const d = new Date(e.date);
        return `${d.getFullYear()}-${d.getMonth()}`;
      })
    );
    return monthSet.size > 0 ? expenses.reduce((s, e) => s + e.amount, 0) / monthSet.size : 0;
  }, [expenses]);

  const kpis = [
    { label: 'Gesamt Ausgaben', value: `${fmt(totalExpenses)} EUR`, sub: 'Gefiltert' },
    { label: 'Umlagefähig', value: `${fmt(umlagefaehig)} EUR`, sub: 'Auf Mieter umlegbar' },
    { label: 'Nicht umlagefähig', value: `${fmt(nichtUmlagefaehig)} EUR`, sub: 'Eigentumerkosten' },
    { label: 'Durchschn./Monat', value: `${fmt(avgPerMonth)} EUR`, sub: 'Alle Ausgaben' },
  ];

  const handleAddExpense = () => {
    if (!formDescription || !formAmount || !formDate) return;
    const newExpense: Expense = {
      id: crypto.randomUUID(),
      propertyId: formPropertyId || (properties.length > 0 ? properties[0].id : ''),
      category: formCategory,
      description: formDescription,
      amount: parseFloat(formAmount) || 0,
      date: formDate,
      isUmlagefaehig: formUmlagefaehig,
      createdAt: new Date().toISOString(),
    };
    setExpenses((prev) => [newExpense, ...prev]);
    setDialogOpen(false);
    setFormDescription('');
    setFormAmount('');
    setFormDate('');
    setFormCategory('Sonstiges');
    setFormPropertyId('');
    setFormUmlagefaehig(false);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Ausgaben</h1>
          <p className="page-subtitle">Alle Kosten und Aufwendungen verwalten</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="btn btn-md btn-primary"
        >
          <Plus size={15} />
          Ausgabe erfassen
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="surface p-5">
            <p className="stat-label">{kpi.label}</p>
            <p className="stat-value mt-1">{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="alle">Alle Kategorien</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="alle">Alle Objekte</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="alle">Alle Monate</option>
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="surface">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-card-divider">
                <th className="th">Datum</th>
                <th className="th">Beschreibung</th>
                <th className="th">Kategorie</th>
                <th className="th">Objekt</th>
                <th className="th text-end">Betrag</th>
                <th className="th text-center">Umlagefähig</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 px-4">
                    <p className="text-sm text-muted-foreground-2">Keine Ausgaben gefunden</p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      Passe deine Filter an oder erfasse eine neue Ausgabe
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((expense) => {
                  const property = propertyMap.get(expense.propertyId);
                  return (
                    <tr key={expense.id} className="transition-colors hover:bg-layer-hover border-b border-card-divider">
                      <td className="td tabular-nums text-muted-foreground-2">
                        {fmtDate(expense.date)}
                      </td>
                      <td className="td text-foreground">{expense.description}</td>
                      <td className="td">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`dot ${categoryDotColor[expense.category]}`} />
                          <span className="text-muted-foreground-2">{expense.category}</span>
                        </span>
                      </td>
                      <td className="td text-muted-foreground-2">
                        {property?.name || '-'}
                      </td>
                      <td className="td text-end font-semibold tabular-nums text-foreground">
                        {fmt(expense.amount)} EUR
                      </td>
                      <td className="td text-center">
                        {expense.isUmlagefaehig ? (
                          <Check size={15} className="inline-block text-emerald-400" />
                        ) : (
                          <Minus size={15} className="inline-block text-muted-foreground" />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <>
            <div className="border-t border-card-divider" />
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {filtered.length} von {expenses.length} Ausgaben
              </span>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                Summe: {fmt(totalExpenses)} EUR
              </span>
            </div>
          </>
        )}
      </div>

      {/* Add Expense Dialog */}
      <Modal open={dialogOpen} onClose={() => setDialogOpen(false)} title="Ausgabe erfassen">
        <div className="space-y-4">
          <div>
            <label className="input-label">Beschreibung</label>
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="z.B. Heizungsreparatur"
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Betrag</label>
              <NumberInput
                value={formAmount}
                onChange={(v) => setFormAmount(v === '' ? '' : String(v))}
                suffix="€"
                decimals={2}
                placeholder="0,00"
                className="input"
              />
            </div>
            <div>
              <label className="input-label">Datum</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Kategorie</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                className="input"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Objekt</label>
              <select
                value={formPropertyId}
                onChange={(e) => setFormPropertyId(e.target.value)}
                className="input"
              >
                <option value="">Kein Objekt</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="umlagefaehig"
              checked={formUmlagefaehig}
              onChange={(e) => setFormUmlagefaehig(e.target.checked)}
              className="rounded border-card-line"
            />
            <label htmlFor="umlagefaehig" className="text-sm text-muted-foreground-2">
              Umlagefähig
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setDialogOpen(false)}
            className="btn btn-md btn-secondary"
          >
            Abbrechen
          </button>
          <button
            onClick={handleAddExpense}
            className="btn btn-md btn-primary"
          >
            Speichern
          </button>
        </div>
      </Modal>
    </div>
  );
}
