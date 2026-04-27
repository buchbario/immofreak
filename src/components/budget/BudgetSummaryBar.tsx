import { formatCurrency, getBudgetPercentage } from '../../lib/utils';
import { ProgressBar } from '../ui/ProgressBar';

interface BudgetSummaryBarProps {
  totalBudget: number;
  totalEstimated: number;
  totalActual: number;
}

export function BudgetSummaryBar({ totalBudget, totalEstimated, totalActual }: BudgetSummaryBarProps) {
  const remaining = totalBudget - totalActual;
  const { percentage, color } = getBudgetPercentage(totalActual, totalBudget);

  return (
    <div className="surface p-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-4">
        <div>
          <p className="stat-label">Gesamtbudget</p>
          <p className="stat-value mt-2">{formatCurrency(totalBudget)}</p>
        </div>
        <div>
          <p className="stat-label">Geplant</p>
          <p className="stat-value mt-2">{formatCurrency(totalEstimated)}</p>
        </div>
        <div>
          <p className="stat-label">Ausgegeben</p>
          <p className="stat-value mt-2">{formatCurrency(totalActual)}</p>
        </div>
        <div>
          <p className="stat-label">Verbleibend</p>
          <p className={`text-2xl font-semibold tabular-nums mt-2 ${remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(remaining)}
          </p>
        </div>
      </div>
      <ProgressBar percentage={percentage} color={color} showLabel={false} />
      <p className="text-xs mt-1 text-right text-muted-foreground">{percentage}% des Budgets verbraucht</p>
    </div>
  );
}
