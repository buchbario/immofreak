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
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Finanzen</h1>
          <p className="page-subtitle">Einnahmen, Ausgaben und Rendite im Überblick</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="surface p-3 sm:p-4 md:p-5">
            <p className="stat-label text-[11px] sm:text-xs">{kpi.label}</p>
            <p className="stat-value mt-1.5 sm:mt-2 text-base sm:text-lg truncate">{kpi.value}</p>
            <p className="text-[11px] sm:text-xs mt-0.5 text-muted-foreground">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="surface mb-6 sm:mb-8">
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-2">
          <h2 className="section-title">Einnahmen vs. Ausgaben</h2>
        </div>
        <div className="px-2 sm:px-5 pb-5">
          <div className="h-56 sm:h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
                  width={45}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `${Number(value).toLocaleString('de-DE')} EUR`,
                    name === 'einnahmen' ? 'Einnahmen' : 'Ausgaben',
                  ]}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text)',
                  }}
                />
                <Bar dataKey="einnahmen" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ausgaben" fill="#5a5a6e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-5 mt-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
              <span className="text-sm text-muted-foreground-2">Einnahmen</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#5a5a6e' }} />
              <span className="text-sm text-muted-foreground-2">Ausgaben</span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="surface">
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4">
          <h2 className="section-title">Monatsübersicht</h2>
        </div>
        <div className="overflow-x-auto scroll-x">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="th">Monat</th>
                <th className="th text-end">Mieteinnahmen</th>
                <th className="th text-end">Ausgaben</th>
                <th className="th text-end">Cashflow</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row) => (
                <tr key={row.month} className="transition-colors hover:bg-layer-hover border-b border-card-divider">
                  <td className="td text-foreground">{row.month}</td>
                  <td className="td text-end tabular-nums text-foreground">
                    {fmt(row.income)} EUR
                  </td>
                  <td className="td text-end tabular-nums text-foreground">
                    {fmt(row.expenses)} EUR
                  </td>
                  <td
                    className={`td text-end tabular-nums font-medium ${
                      row.cashflow >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {fmt(row.cashflow)} EUR
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-card-divider" />
        <div className="px-4 py-3.5 flex items-center justify-end">
          <span className="text-xs text-muted-foreground">Letzte 6 Monate</span>
        </div>
      </div>
    </div>
  );
}
