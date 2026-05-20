import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Edit2, Building2, Share2, Check,
  Gauge, Home, Users, Plug, TrendingUp, Wallet,
  ImageIcon, FileText, MapPin,
} from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PhotoGallery } from '../shared/PhotoGallery';
import { DocumentList } from '../shared/DocumentList';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useTenants } from '../../hooks/useTenants';
import { useUtilities } from '../../hooks/useUtilities';
import { useMeterReadings } from '../../hooks/useMeterReadings';
import { usePropertyPhotos } from '../../hooks/usePropertyPhotos';
import { usePropertyDocuments } from '../../hooks/usePropertyDocuments';
import { useTrash } from '../../hooks/useTrash';
import { cascadePropertyToTrash } from '../../lib/cascadeDelete';
import { UnitForm } from './UnitForm';
import { PropertyForm } from './PropertyForm';
import { MeterReadingForm } from './MeterReadingForm';
import { cn, formatDate } from '../../lib/utils';

type Tab = 'einheiten' | 'mieter' | 'versorger' | 'zaehler' | 'fotos' | 'dokumente';

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProperty, updateProperty } = useRentalProperties();
  const { units, createUnit, updateUnit, deleteUnit, totalMonthlyRent } = useRentalUnits(id);
  const { tenants } = useTenants(id);
  const { utilities } = useUtilities(id);
  const { readings, createReading, deleteReading } = useMeterReadings(id);
  const { photos, addPhoto, deletePhoto } = usePropertyPhotos(id);
  const { documents, addDocument, deleteDocument } = usePropertyDocuments(id);
  const { moveToTrash } = useTrash();
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<import('../../types').RentalUnit | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showMeterForm, setShowMeterForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteUnit, setConfirmDeleteUnit] = useState<{ id: string; name: string } | null>(null);
  const [confirmDeleteReading, setConfirmDeleteReading] = useState<{ id: string; meterId: string; date: string } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('einheiten');
  const [linkCopied, setLinkCopied] = useState(false);

  const property = id ? getProperty(id) : undefined;
  if (!property) {
    return (
      <div className="page-container">
        <p className="text-sm text-muted-foreground-2">Objekt nicht gefunden.</p>
        <button onClick={() => navigate('/bh/objekte')} className="btn btn-md btn-secondary mt-4">Zurück</button>
      </div>
    );
  }

  const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
  const yearlyRent = totalMonthlyRent * 12;
  const rendite = property.purchasePrice > 0 ? (yearlyRent / property.purchasePrice) * 100 : 0;
  // Belegung aus tenants ableiten — `unit.tenantId` ist denormalisiert und kann durch
  // FK-Races zwischen Tenant-Insert und Unit-Update temporär NULL bleiben.
  const occupiedUnitIds = new Set(tenants.map((t) => t.unitId).filter((x): x is string => !!x));
  const occupied = units.filter((u) => occupiedUnitIds.has(u.id)).length;
  const occupancyRate = units.length > 0 ? (occupied / units.length) * 100 : 0;
  const valueDiff = property.currentValue - property.purchasePrice;
  const valueGrowth = property.purchasePrice > 0 ? (valueDiff / property.purchasePrice) * 100 : 0;

  const shareUrl = `${window.location.origin}/share/${property.id}`;
  const cover = photos.length > 0 ? photos[0].dataUrl : null;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const tabs: { key: Tab; label: string; icon: typeof Home; count: number }[] = [
    { key: 'einheiten', label: 'Einheiten', icon: Home, count: units.length },
    { key: 'mieter', label: 'Mieter', icon: Users, count: tenants.length },
    { key: 'versorger', label: 'Versorger', icon: Plug, count: utilities.length },
    { key: 'zaehler', label: 'Zähler', icon: Gauge, count: readings.length },
    { key: 'fotos', label: 'Fotos', icon: ImageIcon, count: photos.length },
    { key: 'dokumente', label: 'Dokumente', icon: FileText, count: documents.length },
  ];

  return (
    <div className="page-container">
      {/* Flat header — Back + Cover-Thumb + Title/Address + Actions */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5 sm:mb-6 px-1">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button
            onClick={() => navigate('/bh/objekte')}
            className="size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-layer-hover transition-colors cursor-pointer shrink-0 mt-1"
            aria-label="Zurück"
          >
            <ArrowLeft size={18} />
          </button>
          {/* Cover thumbnail */}
          <div className="size-14 sm:size-16 rounded-xl overflow-hidden shrink-0 ring-1 ring-card-line">
            {cover ? (
              <img src={cover} alt={property.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#4F6BFF] to-[#6B7FFF] flex items-center justify-center">
                <Building2 size={22} className="text-white/85" strokeWidth={1.6} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-[24px] sm:text-[28px] font-bold text-foreground tracking-tight leading-[1.15] truncate">
              {property.name}
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin size={13} className="text-muted-foreground shrink-0" />
              <span className="text-[13px] text-muted-foreground truncate">{property.address}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 mt-1">
          <button
            onClick={handleCopyLink}
            aria-label={linkCopied ? 'Kopiert' : 'Teilen'}
            className={cn(
              'btn btn-sm transition-colors',
              linkCopied ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600' : 'btn-secondary'
            )}
          >
            {linkCopied ? <Check size={13} /> : <Share2 size={13} />}
            <span className="hidden sm:inline">{linkCopied ? 'Kopiert!' : 'Teilen'}</span>
          </button>
          <button onClick={() => setShowEditForm(true)} className="btn btn-sm btn-secondary">
            <Edit2 size={13} /> <span className="hidden sm:inline">Bearbeiten</span>
          </button>
          <button onClick={() => setConfirmDelete(true)} className="btn btn-sm btn-ghost text-rose-600 dark:text-rose-400" aria-label="Löschen">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-6">
        <div className="bg-card border border-card-line rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-8 rounded-lg bg-[#4F6BFF]/10 flex items-center justify-center">
              <Wallet size={15} className="text-[#4F6BFF]" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kaufpreis</span>
          </div>
          <p className="text-base sm:text-lg font-bold tabular-nums text-foreground">{fmt(property.purchasePrice)} €</p>
        </div>

        <div className="bg-card border border-card-line rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp size={15} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Marktwert</span>
          </div>
          <p className="text-base sm:text-lg font-bold tabular-nums text-foreground">{fmt(property.currentValue)} €</p>
          {valueGrowth !== 0 && (
            <p className={cn('text-[11px] font-semibold mt-0.5', valueGrowth > 0 ? 'text-emerald-600' : 'text-red-500')}>
              {valueGrowth > 0 ? '+' : ''}{valueGrowth.toFixed(1)}%
            </p>
          )}
        </div>

        <div className="bg-card border border-card-line rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-8 rounded-lg bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
              <Building2 size={15} className="text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Miete/M</span>
          </div>
          <p className="text-base sm:text-lg font-bold tabular-nums text-foreground">{fmt(totalMonthlyRent)} €</p>
        </div>

        <div className="bg-card border border-card-line rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              'size-8 rounded-lg flex items-center justify-center',
              rendite >= 4 ? 'bg-emerald-100 dark:bg-emerald-500/10' : rendite >= 2.5 ? 'bg-amber-100 dark:bg-amber-500/10' : 'bg-red-100 dark:bg-red-500/10'
            )}>
              <TrendingUp size={15} className={cn(
                rendite >= 4 ? 'text-emerald-600 dark:text-emerald-400' : rendite >= 2.5 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'
              )} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rendite</span>
          </div>
          <p className="text-base sm:text-lg font-bold tabular-nums text-foreground">{rendite.toFixed(1)} %</p>
        </div>

        <div className="bg-card border border-card-line rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-8 rounded-lg bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center">
              <Users size={15} className="text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vermietung</span>
          </div>
          <p className="text-base sm:text-lg font-bold tabular-nums text-foreground">{occupied}/{units.length}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted/80">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${occupancyRate}%`,
                  background: occupancyRate === 100 ? 'var(--success)' : occupancyRate >= 50 ? '#4F6BFF' : 'var(--danger)',
                }}
              />
            </div>
            <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{Math.round(occupancyRate)}%</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scroll-x">
        <div className="inline-flex gap-1 p-1 bg-muted/50 rounded-xl border border-card-line w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                // border is always present to avoid a 1px layout shift when the active
                // state toggles; only the color changes between active and inactive.
                'flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap border',
                activeTab === tab.key
                  ? 'bg-card text-foreground shadow-sm border-card-line'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              )}
            >
              <tab.icon size={13} />
              {tab.label}
              <span className={cn(
                'ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums',
                activeTab === tab.key ? 'bg-[#4F6BFF]/10 text-[#4F6BFF]' : 'bg-muted/80 text-muted-foreground'
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Einheiten Tab */}
      {activeTab === 'einheiten' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowUnitForm(true)} className="btn btn-sm btn-primary">
              <Plus size={14} /> Einheit
            </button>
          </div>
          {units.length === 0 ? (
            <div className="empty-state">
              <div className="rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-3 bg-layer-hover">
                <Building2 size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground-2">Noch keine Einheiten angelegt.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {units.map((u) => {
                // Auch hier: tenants als Quelle der Wahrheit für Belegung (umgekehrte FK).
                const tenant = tenants.find((t) => t.unitId === u.id);
                const isOccupied = !!tenant;
                return (
                  <div key={u.id} className="bg-card border border-card-line rounded-xl p-4 flex items-center gap-4 hover:border-[#4F6BFF]/20 transition-colors">
                    <div className={cn(
                      'size-10 rounded-xl flex items-center justify-center shrink-0',
                      isOccupied ? 'bg-emerald-100 dark:bg-emerald-500/15' : 'bg-amber-100 dark:bg-amber-500/15'
                    )}>
                      <Home size={18} className={isOccupied ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{u.name}</p>
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
                          isOccupied
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                        )}>
                          {isOccupied ? 'Vermietet' : 'Leer'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{u.area} m² · {u.rooms} Zimmer{tenant ? ` · ${tenant.name}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums text-foreground">{fmt(u.currentRent)} €/M</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setEditingUnit(u); }} className="cursor-pointer transition-colors text-muted-foreground hover:text-[#4F6BFF] shrink-0" title="Einheit bearbeiten">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteUnit({ id: u.id, name: u.name }); }} className="cursor-pointer transition-colors text-muted-foreground hover:text-red-500 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mieter Tab */}
      {activeTab === 'mieter' && (
        <div>
          {tenants.length === 0 ? (
            <div className="empty-state">
              <p className="text-sm text-muted-foreground-2">Keine Mieter für dieses Objekt.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {tenants.map((t) => {
                const unit = units.find((u) => u.id === t.unitId);
                return (
                  <div
                    key={t.id}
                    className="bg-card border border-card-line rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-[#4F6BFF]/20 transition-colors"
                    onClick={() => navigate(`/bh/mieter/${t.id}`)}
                  >
                    <div className="size-10 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-[#4F6BFF]">
                        {t.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {unit ? unit.name : 'Keine Einheit'}{t.email ? ` · ${t.email}` : ''}{t.phone ? ` · ${t.phone}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {unit && <p className="text-sm font-bold tabular-nums text-foreground">{fmt(unit.currentRent)} €/M</p>}
                      <p className="text-[11px] text-muted-foreground">Einzug {formatDate(t.moveInDate)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Versorger Tab */}
      {activeTab === 'versorger' && (
        <div>
          {utilities.length === 0 ? (
            <div className="empty-state">
              <p className="text-sm text-muted-foreground-2">Keine Versorger angelegt.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {utilities.map((u) => (
                <div key={u.id} className="bg-card border border-card-line rounded-xl p-4 flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center shrink-0">
                    <Plug size={18} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{u.provider}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {u.type} · Zähler: {u.meterNumber}{u.contractNumber ? ` · Vertrag: ${u.contractNumber}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums text-foreground">{fmt(u.monthlyAdvance)} €/M</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Zähler Tab */}
      {activeTab === 'zaehler' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowMeterForm(true)} className="btn btn-sm btn-primary">
              <Plus size={14} /> Zählerstand
            </button>
          </div>
          {readings.length === 0 ? (
            <div className="empty-state">
              <div className="rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-3 bg-layer-hover">
                <Gauge size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground-2">Noch keine Zählerstände erfasst.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {[...readings].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                <div key={r.id} className="bg-card border border-card-line rounded-xl p-4 flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center shrink-0">
                    <Gauge size={18} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Zähler {r.meterId}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(r.date)}{r.readBy ? ` · ${r.readBy}` : ''}{r.notes ? ` · ${r.notes}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums text-foreground">{r.value.toLocaleString('de-DE')}</p>
                  </div>
                  <button onClick={() => setConfirmDeleteReading({ id: r.id, meterId: r.meterId, date: r.date })} className="cursor-pointer transition-colors text-muted-foreground hover:text-red-500 shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fotos Tab */}
      {activeTab === 'fotos' && (
        <div>
          <PhotoGallery
            photos={photos}
            onAdd={(name, dataUrl) => addPhoto(property.id, name, dataUrl)}
            onDelete={(photoId) => {
              const photo = photos.find((p) => p.id === photoId);
              if (photo) moveToTrash({ entityType: 'propertyPhoto', entityId: photo.id, data: photo, label: photo.name, sublabel: property.name });
              deletePhoto(photoId);
            }}
          />
        </div>
      )}

      {/* Dokumente Tab */}
      {activeTab === 'dokumente' && (
        <div>
          <DocumentList
            documents={documents}
            onAdd={(name, type, size, dataUrl) => addDocument(property.id, name, type, size, dataUrl)}
            onDelete={(docId) => {
              const doc = documents.find((d) => d.id === docId);
              if (doc) moveToTrash({ entityType: 'propertyDocument', entityId: doc.id, data: doc, label: doc.name, sublabel: property.name });
              deleteDocument(docId);
            }}
          />
        </div>
      )}

      {showUnitForm && (
        <UnitForm propertyId={property.id} onClose={() => setShowUnitForm(false)} onSave={(data) => { createUnit(data); setShowUnitForm(false); }} />
      )}

      {editingUnit && (
        <UnitForm
          propertyId={property.id}
          unit={editingUnit}
          onClose={() => setEditingUnit(null)}
          onSave={(data) => { updateUnit(editingUnit.id, data); setEditingUnit(null); }}
        />
      )}

      {showEditForm && (
        <PropertyForm initial={property} onClose={() => setShowEditForm(false)} onSave={(data) => { updateProperty(property.id, data); setShowEditForm(false); }} />
      )}

      {showMeterForm && (
        <MeterReadingForm propertyId={property.id} onClose={() => setShowMeterForm(false)} onSave={(data) => { createReading(data); setShowMeterForm(false); }} />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Objekt in den Papierkorb"
          message={`"${property.name}" mit allen zugehörigen Einheiten, Mietern, Verträgen, Versorgern, Zahlungen, Dokumenten und Fotos in den Papierkorb verschieben? Innerhalb von 30 Tagen wiederherstellbar.`}
          onConfirm={() => { cascadePropertyToTrash(property.id, moveToTrash); navigate('/bh/objekte'); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {confirmDeleteUnit && (
        <ConfirmDialog
          title="Einheit löschen"
          message={`Einheit "${confirmDeleteUnit.name}" in den Papierkorb verschieben? Innerhalb von 30 Tagen wiederherstellbar.`}
          onConfirm={() => {
            const unit = units.find((u) => u.id === confirmDeleteUnit.id);
            if (unit) moveToTrash({ entityType: 'rentalUnit', entityId: unit.id, data: unit, label: unit.name, sublabel: property.name });
            deleteUnit(confirmDeleteUnit.id);
            setConfirmDeleteUnit(null);
          }}
          onCancel={() => setConfirmDeleteUnit(null)}
        />
      )}

      {confirmDeleteReading && (
        <ConfirmDialog
          title="Zählerstand löschen"
          message={`Zählerstand vom ${formatDate(confirmDeleteReading.date)} in den Papierkorb verschieben? Innerhalb von 30 Tagen wiederherstellbar.`}
          onConfirm={() => {
            const reading = readings.find((r) => r.id === confirmDeleteReading.id);
            if (reading) moveToTrash({ entityType: 'meterReading', entityId: reading.id, data: reading, label: `Zähler ${reading.meterId}`, sublabel: `${formatDate(reading.date)} · ${reading.value.toLocaleString('de-DE')}` });
            deleteReading(confirmDeleteReading.id);
            setConfirmDeleteReading(null);
          }}
          onCancel={() => setConfirmDeleteReading(null)}
        />
      )}
    </div>
  );
}
