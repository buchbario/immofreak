import { useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useUtilities } from '../../hooks/useUtilities';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useTrash } from '../../hooks/useTrash';
import { cascadeUtilityToTrash } from '../../lib/cascadeDelete';
import { UtilityForm } from './UtilityForm';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function UtilityListPage() {
  const { allUtilities, createUtility } = useUtilities();
  const { properties } = useRentalProperties();
  const { moveToTrash } = useTrash();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; provider: string } | null>(null);

  const filtered = allUtilities.filter(
    (u) => u.provider.toLowerCase().includes(search.toLowerCase()) || u.type.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });

  const grouped = properties.map((p) => ({
    property: p,
    utilities: filtered.filter((u) => u.propertyId === p.id),
  })).filter((g) => g.utilities.length > 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Versorger</h1>
          <p className="page-subtitle">{allUtilities.length} Versorger</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-md btn-primary"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Versorger anlegen</span>
          <span className="sm:hidden">Neu</span>
        </button>
      </div>

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="surface empty-state">
          <p className="text-sm font-semibold mb-1 text-foreground">Keine Versorger</p>
          <p className="text-sm mb-5 text-muted-foreground-2">Lege deinen ersten Versorger an.</p>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-md btn-primary"
          >
            Versorger anlegen
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ property, utilities }) => (
            <div key={property.id}>
              <p className="section-title mb-3">{property.name}</p>
              <div className="surface">
                {utilities.map((u, idx) => (
                  <div
                    key={u.id}
                    className={`px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 transition-colors hover:bg-layer-hover ${idx < utilities.length - 1 ? 'border-b border-card-divider' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{u.provider}</p>
                      <p className="text-xs mt-0.5 text-muted-foreground-2 truncate">{u.type} &middot; Zähler: {u.meterNumber || '--'}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">{fmt(u.monthlyAdvance)} €/M</p>
                        <p className="text-xs mt-0.5 text-muted-foreground-2 hidden sm:block">Vertrag: {u.contractNumber || '--'}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete({ id: u.id, provider: u.provider });
                        }}
                        className="size-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                        aria-label="Löschen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="pt-1">
            <p className="text-xs text-muted-foreground">{filtered.length} von {allUtilities.length} Versorger</p>
          </div>
        </div>
      )}

      {showForm && (
        <UtilityForm
          properties={properties}
          onClose={() => setShowForm(false)}
          onSave={(data) => {
            createUtility(data);
            setShowForm(false);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Versorger in den Papierkorb"
          message={`"${confirmDelete.provider}" mit der gesamten Kosten-Historie in den Papierkorb verschieben? Innerhalb von 30 Tagen wiederherstellbar.`}
          onConfirm={() => {
            cascadeUtilityToTrash(confirmDelete.id, moveToTrash);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
