import { useState, useMemo } from 'react';
import { Trash2, RotateCcw, Search, AlertTriangle } from 'lucide-react';
import { useTrash, entityTypeLabel, entityTypeMode, daysLeftInTrash } from '../../hooks/useTrash';
import { useAppMode } from '../../context/AppModeContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { formatDate } from '../../lib/utils';
import type { TrashItem, TrashEntityType } from '../../types';

const ICON_COLORS: Partial<Record<TrashEntityType, { text: string; bg: string }>> = {
  tenant: { text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/15' },
  tenantPayment: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/15' },
  rentalUnit: { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/15' },
  meterReading: { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/15' },
  utility: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/15' },
  bankAccount: { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/15' },
  bankTransaction: { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/15' },
  rentalContract: { text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-500/15' },
  rentalProperty: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/15' },
  expense: { text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/15' },
  contractor: { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/15' },
  project: { text: 'text-[#4F6BFF]', bg: 'bg-[#4F6BFF]/10' },
  propertyPhoto: { text: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-500/15' },
  propertyDocument: { text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-500/15' },
  contractDocument: { text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-500/15' },
};

export function TrashPage() {
  const { trashItems, restore, permanentlyDelete } = useTrash();
  const { mode } = useAppMode();
  const [search, setSearch] = useState('');
  const [confirmDeleteOne, setConfirmDeleteOne] = useState<TrashItem | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const modeItems = useMemo(
    () => trashItems.filter((i) => entityTypeMode(i.entityType) === mode),
    [trashItems, mode],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modeItems;
    return modeItems.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.sublabel?.toLowerCase().includes(q) ||
        entityTypeLabel(i.entityType).toLowerCase().includes(q),
    );
  }, [modeItems, search]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Papierkorb</h1>
          <p className="page-subtitle">
            {modeItems.length === 0
              ? 'Leer'
              : `${modeItems.length} ${modeItems.length === 1 ? 'Element' : 'Elemente'} · Nach 30 Tagen endgültig gelöscht`}
          </p>
        </div>
        {modeItems.length > 0 && (
          <button onClick={() => setConfirmEmpty(true)} className="btn btn-md btn-secondary">
            <Trash2 size={15} /> Papierkorb leeren
          </button>
        )}
      </div>

      {modeItems.length > 0 && (
        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Im Papierkorb suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
        </div>
      )}

      {modeItems.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-700" />
          <p className="text-[13px] leading-relaxed text-amber-900">
            Gelöschte Elemente bleiben <strong className="font-semibold">30 Tage</strong> im Papierkorb und werden dann automatisch endgültig entfernt. Du kannst sie jederzeit wiederherstellen oder sofort endgültig löschen.
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="surface empty-state">
          <div className="rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-3 bg-layer-hover">
            <Trash2 size={24} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold mb-1 text-foreground">
            {modeItems.length === 0 ? 'Papierkorb ist leer' : 'Keine Treffer'}
          </p>
          <p className="text-sm text-muted-foreground-2">
            {modeItems.length === 0
              ? (mode === 'fixflip'
                  ? 'Hier erscheinen gelöschte Projekte und Handwerker.'
                  : 'Hier erscheinen gelöschte Objekte, Mieter, Zahlungen und mehr.')
              : 'Keine Elemente entsprechen deiner Suche.'}
          </p>
        </div>
      ) : (
        <div className="surface">
          {filtered.map((item, idx) => {
            const colors = ICON_COLORS[item.entityType] ?? { text: 'text-muted-foreground', bg: 'bg-layer-hover' };
            const daysLeft = daysLeftInTrash(item.deletedAt);
            const urgent = daysLeft <= 3;
            return (
              <div
                key={item.id}
                className={`px-5 py-3.5 flex items-center gap-4 transition-colors hover:bg-layer-hover ${idx < filtered.length - 1 ? 'border-b border-card-divider' : ''}`}
              >
                <div className={`size-10 rounded-xl ${colors.bg} flex items-center justify-center shrink-0`}>
                  <Trash2 size={16} className={colors.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate text-foreground">{item.label}</p>
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                      {entityTypeLabel(item.entityType)}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 text-muted-foreground-2 truncate">
                    {item.sublabel ? `${item.sublabel} · ` : ''}Gelöscht am {formatDate(item.deletedAt)}
                  </p>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className={`text-xs font-semibold ${urgent ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground-2'}`}>
                    {daysLeft === 0 ? 'Heute' : daysLeft === 1 ? 'Noch 1 Tag' : `Noch ${daysLeft} Tage`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => restore(item.id)}
                    className="size-8 rounded-lg border border-card-line flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    title="Wiederherstellen"
                  >
                    <RotateCcw size={13} />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteOne(item)}
                    className="size-8 rounded-lg border border-card-line flex items-center justify-center text-muted-foreground hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Endgültig löschen"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmDeleteOne && (
        <ConfirmDialog
          title="Endgültig löschen"
          message={`Möchtest du "${confirmDeleteOne.label}" endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
          onConfirm={() => {
            permanentlyDelete(confirmDeleteOne.id);
            setConfirmDeleteOne(null);
          }}
          onCancel={() => setConfirmDeleteOne(null)}
        />
      )}

      {confirmEmpty && (
        <ConfirmDialog
          title="Papierkorb leeren"
          message={`Möchtest du alle ${modeItems.length} Elemente im Papierkorb endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
          onConfirm={() => {
            modeItems.forEach((i) => permanentlyDelete(i.id));
            setConfirmEmpty(false);
          }}
          onCancel={() => setConfirmEmpty(false)}
        />
      )}
    </div>
  );
}
