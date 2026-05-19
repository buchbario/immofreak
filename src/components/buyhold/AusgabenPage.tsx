import { useState, useMemo } from 'react';
import { Plus, Check, Minus, Wallet } from 'lucide-react';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useExpenses } from '../../hooks/useExpenses';
import { Modal } from '../ui/Modal';
import { NumberInput } from '../ui/NumberInput';
import { PageCard, PageCardNoResults } from '../ui/PageCard';
import { DateInput } from '../ui/DateInput';
import type { Expense } from '../../types';

type ExpenseCategory = Expense['category'];

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

export function AusgabenPage() {
  const { properties } = useRentalProperties();
  const { items: expenses, create: createExpense } = useExpenses();

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

  const handleAddExpense = () => {
    if (!formDescription || !formAmount || !formDate) return;
    createExpense({
      propertyId: formPropertyId || (properties.length > 0 ? properties[0].id : ''),
      category: formCategory,
      description: formDescription,
      amount: parseFloat(formAmount) || 0,
      date: formDate,
      isUmlagefaehig: formUmlagefaehig,
    });
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
      <PageCard
        title="Ausgaben"
        description="Alle Kosten und Aufwendungen — gefiltert, gruppiert und kategorisiert nach umlagefähig."
        meta={
          <>
            <Wallet size={11} /> {expenses.length} {expenses.length === 1 ? 'Ausgabe' : 'Ausgaben'}
            <span className="size-[3px] rounded-full bg-muted-foreground/40 mx-0.5" />
            <span className="tabular-nums">{fmt(totalExpenses)} € gesamt</span>
            <span className="size-[3px] rounded-full bg-muted-foreground/40 mx-0.5" />
            <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(umlagefaehig)} € umlagefähig</span>
          </>
        }
        actions={
          <button onClick={() => setDialogOpen(true)} className="btn btn-sm btn-primary">
            <Plus size={14} /> Ausgabe erfassen
          </button>
        }
        tabExtras={
          <div className="flex items-center gap-1.5">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 px-2 rounded-md bg-layer-hover hover:bg-layer-active text-[12px] border-0 cursor-pointer"
            >
              <option value="alle">Alle Kategorien</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="h-8 px-2 rounded-md bg-layer-hover hover:bg-layer-active text-[12px] border-0 cursor-pointer"
            >
              <option value="alle">Alle Objekte</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="h-8 px-2 rounded-md bg-layer-hover hover:bg-layer-active text-[12px] border-0 cursor-pointer"
            >
              <option value="alle">Alle Monate</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        }
        footer={
          <span className="flex items-center justify-between">
            <span>{filtered.length} von {expenses.length} {expenses.length === 1 ? 'Ausgabe' : 'Ausgaben'}</span>
            {filtered.length > 0 && (
              <span className="font-semibold text-foreground tabular-nums">Summe: {fmt(totalExpenses)} €</span>
            )}
          </span>
        }
      >
        {filtered.length === 0 ? (
          <PageCardNoResults message="Keine Ausgaben gefunden — passe deine Filter an oder erfasse eine neue Ausgabe." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-card-divider">
                  <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Datum</th>
                  <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Beschreibung</th>
                  <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Kategorie</th>
                  <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Objekt</th>
                  <th className="th text-end text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Betrag</th>
                  <th className="th text-center text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Umlagefähig</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((expense) => {
                  const property = propertyMap.get(expense.propertyId);
                  return (
                    <tr key={expense.id} className="transition-colors hover:bg-layer-hover border-b border-card-divider">
                      <td className="td tabular-nums text-muted-foreground text-[12.5px]">{fmtDate(expense.date)}</td>
                      <td className="td text-foreground text-[13px] font-medium">{expense.description}</td>
                      <td className="td text-[12.5px]">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`dot ${categoryDotColor[expense.category]}`} />
                          <span className="text-muted-foreground">{expense.category}</span>
                        </span>
                      </td>
                      <td className="td text-muted-foreground text-[12.5px]">{property?.name || '—'}</td>
                      <td className="td text-end font-semibold tabular-nums text-foreground text-[13px]">{fmt(expense.amount)} €</td>
                      <td className="td text-center">
                        {expense.isUmlagefaehig ? (
                          <Check size={15} className="inline-block text-emerald-500" />
                        ) : (
                          <Minus size={15} className="inline-block text-muted-foreground/60" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PageCard>

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
              <DateInput value={formDate} onChange={setFormDate} />
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
