import { useState, useMemo } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useTrash, entityTypeLabel, entityTypeMode, daysLeftInTrash } from '../../hooks/useTrash';
import { useAppMode } from '../../context/AppModeContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { formatDate } from '../../lib/utils';
import type { TrashItem, TrashEntityType } from '../../types';
import { PageCard, PageCardNoResults } from '../ui/PageCard';

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
      <PageCard
        title="Papierkorb"
        description="Elemente bleiben 30 Tage hier, dann endgültig gelöscht. Wiederherstellen oder sofort löschen."
        meta={
          <>
            <Trash2 size={11} />
            {modeItems.length === 0
              ? 'Leer'
              : `${modeItems.length} ${modeItems.length === 1 ? 'Element' : 'Elemente'}`}
          </>
        }
        actions={
          modeItems.length > 0 ? (
            <button onClick={() => setConfirmEmpty(true)} className="btn btn-sm btn-secondary">
              <Trash2 size={14} /> Papierkorb leeren
            </button>
          ) : undefined
        }
        search={modeItems.length > 0 ? search : undefined}
        onSearchChange={modeItems.length > 0 ? setSearch : undefined}
        searchPlaceholder="Im Papierkorb suchen..."
      >
        {modeItems.length > 0 && (
          <div className="px-5 sm:px-7 pt-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10 p-3">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p className="text-[12.5px] leading-relaxed" style={{ color: '#000' }}>
                Gelöschte Elemente bleiben <strong className="font-semibold" style={{ color: '#000' }}>30 Tage</strong> im Papierkorb und werden dann automatisch endgültig entfernt.
              </p>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          modeItems.length === 0 ? (
            <div className="text-center py-12 px-5">
              <div className="rounded-2xl w-14 h-14 flex items-center justify-center mx-auto mb-3 bg-layer-hover">
                <Trash2 size={22} className="text-muted-foreground/60" />
              </div>
              <p className="text-[13px] font-semibold mb-1 text-foreground">Papierkorb ist leer</p>
              <p className="text-[12px] text-muted-foreground">
                {mode === 'fixflip'
                  ? 'Hier erscheinen gelöschte Projekte und Handwerker.'
                  : 'Hier erscheinen gelöschte Objekte, Mieter, Zahlungen und mehr.'}
              </p>
            </div>
          ) : (
            <PageCardNoResults message="Keine Elemente entsprechen deiner Suche." />
          )
        ) : (
          <div className="divide-y divide-card-divider">
            {filtered.map((item) => {
              const colors = ICON_COLORS[item.entityType] ?? { text: 'text-muted-foreground', bg: 'bg-layer-hover' };
              const daysLeft = daysLeftInTrash(item.deletedAt);
              const urgent = daysLeft <= 3;
              return (
                <div
                  key={item.id}
                  className="px-5 sm:px-7 py-3.5 flex items-center gap-4 transition-colors hover:bg-layer-hover"
                >
                  <div className={`size-9 rounded-[9px] ${colors.bg} flex items-center justify-center shrink-0`}>
                    <Trash2 size={15} className={colors.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13.5px] font-semibold truncate text-foreground tracking-tight">{item.label}</p>
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-layer-hover text-muted-foreground">
                        {entityTypeLabel(item.entityType)}
                      </span>
                    </div>
                    <p className="text-[11.5px] mt-0.5 text-muted-foreground truncate">
                      {item.sublabel ? `${item.sublabel} · ` : ''}Gelöscht am {formatDate(item.deletedAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className={`text-[11.5px] font-semibold ${urgent ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
                      {daysLeft === 0 ? 'Heute' : daysLeft === 1 ? 'Noch 1 Tag' : `Noch ${daysLeft} Tage`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => restore(item.id)}
                      className="size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                      title="Wiederherstellen"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteOne(item)}
                      className="size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/15 dark:hover:text-rose-400 transition-colors cursor-pointer"
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
      </PageCard>

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
