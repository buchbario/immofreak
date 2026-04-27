import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useBudgetItems } from '../../hooks/useBudgetItems';
import { useContractors } from '../../hooks/useContractors';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { BudgetSummaryBar } from './BudgetSummaryBar';
import { BudgetItemForm } from './BudgetItemForm';
import { formatCurrency, getStatusColor } from '../../lib/utils';
import type { BudgetItem } from '../../types';

interface BudgetTableProps {
  projectId: string;
  totalBudget: number;
}

export function BudgetTable({ projectId, totalBudget }: BudgetTableProps) {
  const { budgetItems, totalEstimated, totalActual, createBudgetItem, updateBudgetItem, deleteBudgetItem } = useBudgetItems(projectId);
  const { getContractor } = useContractors();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<BudgetItem | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleSubmit = (data: Omit<BudgetItem, 'id' | 'createdAt'>) => {
    if (editItem) {
      updateBudgetItem(editItem.id, data);
      setEditItem(undefined);
    } else {
      createBudgetItem(data);
    }
  };

  return (
    <div className="space-y-6">
      <BudgetSummaryBar totalBudget={totalBudget} totalEstimated={totalEstimated} totalActual={totalActual} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="section-title">Budgetpositionen</h3>
        <button onClick={() => setShowForm(true)} className="btn btn-sm btn-primary">
          <Plus size={14} />
          Position hinzufügen
        </button>
      </div>

      {budgetItems.length === 0 ? (
        <EmptyState
          icon={<div className="text-3xl">📋</div>}
          title="Keine Budgetpositionen"
          description="Füge Budgetpositionen hinzu, um deine Sanierungskosten zu tracken."
          action={
            <button onClick={() => setShowForm(true)} className="btn btn-sm btn-primary">
              <Plus size={14} />
              Erste Position hinzufügen
            </button>
          }
        />
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <div className="surface overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-card-divider">
                    <th className="th">Kategorie</th>
                    <th className="th">Beschreibung</th>
                    <th className="th">Handwerker</th>
                    <th className="th text-right">Geschätzt</th>
                    <th className="th text-right">Tatsächlich</th>
                    <th className="th text-center">Status</th>
                    <th className="th w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {budgetItems.map((item, idx) => {
                    const contractor = item.contractorId ? getContractor(item.contractorId) : undefined;
                    const diff = item.actualCost - item.estimatedCost;
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors hover:bg-layer-hover ${idx < budgetItems.length - 1 ? 'border-b border-card-divider' : ''}`}
                      >
                        <td className="td font-medium text-foreground">{item.category}</td>
                        <td className="td text-muted-foreground-2">{item.description}</td>
                        <td className="td text-muted-foreground-2">{contractor ? `${contractor.name}` : '—'}</td>
                        <td className="td text-right text-foreground">{formatCurrency(item.estimatedCost)}</td>
                        <td className="td text-right">
                          <span className={item.actualCost > 0 ? (diff > 0 ? 'text-red-400 font-medium' : 'text-foreground') : 'text-muted-foreground'}>
                            {item.actualCost > 0 ? formatCurrency(item.actualCost) : '—'}
                          </span>
                        </td>
                        <td className="td text-center">
                          <span className={`badge ${getStatusColor(item.status)}`}>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </span>
                        </td>
                        <td className="td">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => { setEditItem(item); setShowForm(true); }} className="btn btn-xs btn-ghost p-1.5">
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteId(item.id)}
                              className="p-1.5 rounded-lg cursor-pointer transition-colors text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="font-medium border-t border-card-divider">
                    <td className="td text-foreground" colSpan={3}>Gesamt</td>
                    <td className="td text-right text-foreground">{formatCurrency(totalEstimated)}</td>
                    <td className="td text-right text-foreground">{formatCurrency(totalActual)}</td>
                    <td className="td" colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: card list */}
          <div className="md:hidden space-y-2.5">
            {budgetItems.map((item) => {
              const contractor = item.contractorId ? getContractor(item.contractorId) : undefined;
              const diff = item.actualCost - item.estimatedCost;
              return (
                <div key={item.id} className="surface p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{item.category}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground-2 mt-0.5 truncate">{item.description}</p>
                      )}
                      {contractor && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">👷 {contractor.name}</p>
                      )}
                    </div>
                    <span className={`badge ${getStatusColor(item.status)} flex-shrink-0`}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-card-divider text-xs">
                    <div>
                      <p className="text-muted-foreground">Geschätzt</p>
                      <p className="font-semibold tabular-nums text-foreground">{formatCurrency(item.estimatedCost)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tatsächlich</p>
                      <p className={`font-semibold tabular-nums ${item.actualCost > 0 ? (diff > 0 ? 'text-red-500' : 'text-foreground') : 'text-muted-foreground'}`}>
                        {item.actualCost > 0 ? formatCurrency(item.actualCost) : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2 pt-2 border-t border-card-divider justify-end">
                    <button onClick={() => { setEditItem(item); setShowForm(true); }} className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-layer-hover cursor-pointer">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {/* Totals */}
            <div className="surface p-3.5 bg-muted/40">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground font-semibold uppercase tracking-wide">Gesamt geschätzt</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(totalEstimated)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold uppercase tracking-wide">Gesamt tatsächlich</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(totalActual)}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showForm && (
        <BudgetItemForm
          projectId={projectId}
          item={editItem}
          onClose={() => { setShowForm(false); setEditItem(undefined); }}
          onSubmit={handleSubmit}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteBudgetItem(deleteId); setDeleteId(null); }}
        title="Position löschen"
        message="Möchtest du diese Budgetposition wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </div>
  );
}
