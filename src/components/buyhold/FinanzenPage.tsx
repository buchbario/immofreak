import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';


import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useExpenses } from '../../hooks/useExpenses';
import { useTenantPayments } from '../../hooks/useTenantPayments';

const fmt = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getLast6Months(): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
    months.push({ key, label });
  }
  return months;
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function FinanzenPage() {
  const { totalMonthlyRent } = useRentalUnits();
  const { properties } = useRentalProperties();
  const { items: expenses } = useExpenses();
  const { allPayments } = useTenantPayments();

  const totalPurchasePrice = properties.reduce((s, p) => s + p.purchasePrice, 0);

  const months = useMemo(() => getLast6Months(), []);

  // Echte Ausgaben pro Monat (aus Expenses-Store)
  const expensesByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    months.forEach((m) => (map[m.key] = 0));
    expenses.forEach((e) => {
      const k = monthKey(e.date);
      if (k in map) map[k] += e.amount;
    });
    return map;
  }, [months, expenses]);

  // Echte Einnahmen pro Monat (aus TenantPayments — eingegangene Mieten + Nachzahlungen)
  const incomeByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    months.forEach((m) => (map[m.key] = 0));
    allPayments.forEach((p) => {
      if (p.status !== 'eingegangen') return;
      const k = monthKey(p.date);
      if (!(k in map)) return;
      if (p.type === 'Miete' || p.type === 'Nachzahlung') map[k] += p.amount;
      else if (p.type === 'Gutschrift') map[k] -= p.amount;
    });
    // Fallback: wenn noch keine Zahlungen erfasst, nimm die Zielmiete als Referenz
    return map;
  }, [months, allPayments]);

  const currentMonthKey = months[months.length - 1].key;
  const monthlyExpenses = expensesByMonth[currentMonthKey] ?? 0;
  const monthlyIncomeActual = incomeByMonth[currentMonthKey] ?? 0;
  const monthlyIncome = monthlyIncomeActual > 0 ? monthlyIncomeActual : totalMonthlyRent;
  const monthlyCashflow = monthlyIncome - monthlyExpenses;

  // Jahres-Hochrechnung: 6-Monats-Summe × 2
  const halfYearExpenses = Object.values(expensesByMonth).reduce((s, v) => s + v, 0);
  const halfYearIncome = Object.values(incomeByMonth).reduce((s, v) => s + v, 0);
  const yearlyExpenses = halfYearExpenses * 2;
  const yearlyIncome = halfYearIncome > 0 ? halfYearIncome * 2 : totalMonthlyRent * 12;
  const yearlyCashflow = yearlyIncome - yearlyExpenses;

  // Bruttomietrendite: Jahreskaltmiete / Kaufpreis (Marktstandard DE)
  const bruttoRendite = totalPurchasePrice > 0 ? (yearlyIncome / totalPurchasePrice) * 100 : 0;
  // Nettomietrendite: Cashflow / (Kaufpreis + 12 % Kaufnebenkosten)
  const kaufpreisMitNK = totalPurchasePrice * 1.12;
  const nettoRendite = kaufpreisMitNK > 0 ? (yearlyCashflow / kaufpreisMitNK) * 100 : 0;

  const kpis = [
    {
      label: 'Mieteinnahmen',
      value: `${fmt(totalMonthlyRent)} EUR`,
      sub: '/Monat',
    },
    {
      label: 'Ausgaben',
      value: `${fmt(monthlyExpenses)} EUR`,
      sub: '/Monat',
    },
    {
      label: 'Cashflow',
      value: `${fmt(monthlyCashflow)} EUR`,
      sub: '/Monat',
    },
    {
      label: 'Jahres-Cashflow',
      value: `${fmt(yearlyCashflow)} EUR`,
      sub: '/Jahr',
    },
    {
      label: 'Brutto-Rendite',
      value: `${bruttoRendite.toFixed(1)} %`,
      sub: 'p.a.',
    },
    {
      label: 'Netto-Rendite',
      value: `${nettoRendite.toFixed(1)} %`,
      sub: 'p.a.',
    },
  ];

  const chartData = useMemo(
    () =>
      months.map((m) => {
        const realIncome = incomeByMonth[m.key] ?? 0;
        return {
          month: m.label,
          einnahmen: realIncome > 0 ? realIncome : totalMonthlyRent,
          ausgaben: expensesByMonth[m.key] ?? 0,
        };
      }),
    [months, totalMonthlyRent, expensesByMonth, incomeByMonth]
  );

  const tableData = useMemo(
    () =>
      months.map((m) => {
        const realIncome = incomeByMonth[m.key] ?? 0;
        const income = realIncome > 0 ? realIncome : totalMonthlyRent;
        const expensesMonth = expensesByMonth[m.key] ?? 0;
        return { month: m.label, income, expenses: expensesMonth, cashflow: income - expensesMonth };
      }),
    [months, totalMonthlyRent, expensesByMonth, incomeByMonth]
  );

  return (
    <div className="page-container">
      {/* Flat header */}
      <div className="mb-5 sm:mb-6 px-1">
        <h1 className="text-[26px] sm:text-[30px] font-bold text-foreground tracking-tight leading-[1.15] mb-1.5">Finanzen</h1>
        <p className="text-[14px] text-muted-foreground max-w-2xl leading-relaxed">
          Einnahmen, Ausgaben und Rendite im Überblick — Cashflow & Renditeanalyse über die letzten 6 Monate.
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-5 sm:mb-6">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 sm:p-5 hover:-translate-y-px transition-all"
          >
            <p className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground/70 truncate">{kpi.label}</p>
            <p className="text-[18px] sm:text-[22px] font-bold tabular-nums tracking-tight text-foreground mt-1.5 truncate">{kpi.value}</p>
            <p className="text-[11px] mt-0.5 text-muted-foreground">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] mb-4 sm:mb-5 overflow-hidden">
        <div className="px-5 sm:px-7 pt-5 pb-3 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Einnahmen vs. Ausgaben</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Letzte 6 Monate als Säulendiagramm</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4F6BFF]" />
              <span className="text-[12px] text-muted-foreground">Einnahmen</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-[12px] text-muted-foreground">Ausgaben</span>
            </div>
          </div>
        </div>
        <div className="px-2 sm:px-5 pb-5">
          <div className="h-56 sm:h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--card-line)" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
                  width={45}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `${Number(value).toLocaleString('de-DE')} €`,
                    name === 'einnahmen' ? 'Einnahmen' : 'Ausgaben',
                  ]}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid var(--card-line)',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                    padding: '8px 12px',
                    backgroundColor: 'var(--card)',
                    color: 'var(--foreground)',
                  }}
                />
                <Bar dataKey="einnahmen" fill="#4F6BFF" radius={[6, 6, 0, 0]} />
                <Bar dataKey="ausgaben" fill="#94a3b8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-5 sm:px-7 pt-5 pb-3 border-b border-card-divider">
          <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Monatsübersicht</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">Detail-Aufschlüsselung der letzten 6 Monate</p>
        </div>
        <div className="overflow-x-auto scroll-x">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-card-divider">
                <th className="th text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Monat</th>
                <th className="th text-end text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Mieteinnahmen</th>
                <th className="th text-end text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Ausgaben</th>
                <th className="th text-end text-[10.5px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Cashflow</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row) => (
                <tr key={row.month} className="transition-colors hover:bg-layer-hover border-b border-card-divider last:border-0">
                  <td className="td text-foreground text-[13px] font-medium">{row.month}</td>
                  <td className="td text-end tabular-nums text-foreground text-[13px]">
                    {fmt(row.income)} €
                  </td>
                  <td className="td text-end tabular-nums text-foreground text-[13px]">
                    {fmt(row.expenses)} €
                  </td>
                  <td
                    className={`td text-end tabular-nums font-semibold text-[13px] ${
                      row.cashflow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {row.cashflow >= 0 ? '+' : ''}{fmt(row.cashflow)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 sm:px-7 py-3 border-t border-card-divider flex items-center justify-end">
          <span className="text-[11.5px] text-muted-foreground">Letzte 6 Monate</span>
        </div>
      </div>
    </div>
  );
}
