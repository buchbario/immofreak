import { useState } from 'react';
import { Plus, Trash2, Plug } from 'lucide-react';
import { useUtilities } from '../../hooks/useUtilities';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useTrash } from '../../hooks/useTrash';
import { cascadeUtilityToTrash } from '../../lib/cascadeDelete';
import { UtilityForm } from './UtilityForm';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PageCard, PageCardNoResults } from '../ui/PageCard';

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

  const totalMonthly = allUtilities.reduce((s, u) => s + u.monthlyAdvance, 0);

  if (allUtilities.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Versorger</h1>
            <p className="page-subtitle">Lege deinen ersten Versorger an.</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn btn-md btn-primary">
            <Plus size={15} /> Versorger anlegen
          </button>
        </div>
        <div className="surface empty-state">
          <div className="size-12 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center mb-4">
            <Plug size={22} className="text-[#4F6BFF]" />
          </div>
          <p className="text-sm font-semibold mb-1 text-foreground">Keine Versorger</p>
          <p className="text-sm mb-5 text-muted-foreground-2">Erfasse Strom, Gas, Wasser & Co. mit Vertrags- und Zählernummer.</p>
          <button onClick={() => setShowForm(true)} className="btn btn-md btn-primary">
            <Plus size={15} /> Versorger anlegen
          </button>
        </div>
        {showForm && (
          <UtilityForm
            properties={properties}
            onClose={() => setShowForm(false)}
            onSave={(data) => { createUtility(data); setShowForm(false); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageCard
        title="Versorger"
        description="Strom, Gas, Wasser, Müll und weitere Vorauszahlungen — gruppiert nach Objekt."
        meta={
          <>
            <Plug size={11} /> {allUtilities.length} {allUtilities.length === 1 ? 'Versorger' : 'Versorger'}
            <span className="size-[3px] rounded-full bg-muted-foreground/40 mx-0.5" />
            <span className="tabular-nums">{fmt(totalMonthly)} € Vorauszahlung / Monat</span>
          </>
        }
        actions={
          <button onClick={() => setShowForm(true)} className="btn btn-sm btn-primary">
            <Plus size={14} /> Neuer Versorger
          </button>
        }
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Versorger oder Typ..."
        footer={`${filtered.length} von ${allUtilities.length} Versorger`}
      >
        {filtered.length === 0 ? (
          <PageCardNoResults message="Keine Versorger gefunden." />
        ) : (
          <div className="px-5 sm:px-7 py-4 space-y-5">
            {grouped.map(({ property, utilities }) => (
              <div key={property.id}>
                <p className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground/70 mb-2 px-1">
                  {property.name}
                </p>
                <div className="border border-card-line rounded-[10px] overflow-hidden">
                  {utilities.map((u, idx) => (
                    <div
                      key={u.id}
                      className={`px-4 sm:px-4 py-3 flex items-center justify-between gap-3 transition-colors hover:bg-layer-hover ${idx < utilities.length - 1 ? 'border-b border-card-divider' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold text-foreground truncate tracking-tight">{u.provider}</p>
                        <p className="text-[11.5px] mt-0.5 text-muted-foreground truncate">
                          {u.type} · Zähler {u.meterNumber || '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-[13px] font-semibold tabular-nums text-foreground whitespace-nowrap">{fmt(u.monthlyAdvance)} €/M</p>
                          <p className="text-[11px] mt-0.5 text-muted-foreground hidden sm:block">Vertrag {u.contractNumber || '—'}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete({ id: u.id, provider: u.provider });
                          }}
                          className="size-7 rounded-md flex items-center justify-center cursor-pointer transition-colors text-muted-foreground/70 hover:bg-rose-500/10 hover:text-rose-500"
                          aria-label="Löschen"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageCard>

      {showForm && (
        <UtilityForm
          properties={properties}
          onClose={() => setShowForm(false)}
          onSave={(data) => { createUtility(data); setShowForm(false); }}
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
