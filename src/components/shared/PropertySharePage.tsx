import { useParams } from 'react-router-dom';
import {
  Building2, MapPin, Gauge, ImageIcon, FileText,
  Home, Users, Plug, Download, X,
} from 'lucide-react';
import { useState } from 'react';
import { rentalPropertyStore } from '../../lib/storage';
import { rentalUnitStore } from '../../lib/storage';
import { tenantStore } from '../../lib/storage';
import { utilityStore } from '../../lib/storage';
import { meterReadingStore } from '../../lib/storage';
import { propertyPhotoStore } from '../../lib/storage';
import { propertyDocumentStore } from '../../lib/storage';
import { formatDate } from '../../lib/utils';
import { formatFileSize } from '../../lib/fileDisplay';

export function PropertySharePage() {
  const { id } = useParams<{ id: string }>();
  const [lightbox, setLightbox] = useState<{ name: string; dataUrl: string } | null>(null);

  // Read directly from stores (no auth needed)
  const property = id ? rentalPropertyStore.getById(id) : undefined;
  const units = id ? rentalUnitStore.getByField('propertyId', id) : [];
  const tenants = id ? tenantStore.getAll().filter(t => t.propertyId === id) : [];
  const utilities = id ? utilityStore.getByField('propertyId', id) : [];
  const readings = id ? meterReadingStore.getByField('propertyId', id) : [];
  const photos = id ? propertyPhotoStore.getByField('propertyId', id) : [];
  const documents = id ? propertyDocumentStore.getByField('propertyId', id) : [];

  const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
  const occupied = units.filter((u) => u.tenantId).length;
  const totalRent = units.reduce((sum, u) => sum + u.currentRent, 0);

  if (!property) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground mb-1">Objekt nicht gefunden</h1>
          <p className="text-sm text-muted-foreground">Dieser Link ist ungültig oder das Objekt wurde gelöscht.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-card-line">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-2 mb-3">
            <img src="/logo.png" alt="ImmoFreak" className="h-5 object-contain" />
            <span className="text-xs text-muted-foreground">· Objekt-Übersicht</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">{property.name}</h1>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
            <MapPin size={14} />
            <span>{property.address}</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Einheiten', value: `${units.length}`, icon: Home },
            { label: 'Vermietet', value: `${occupied}/${units.length}`, icon: Users },
            { label: 'Mieteinnahmen', value: `${fmt(totalRent)} €/M`, icon: Building2 },
            { label: 'Versorger', value: `${utilities.length}`, icon: Plug },
          ].map(kpi => (
            <div key={kpi.label} className="bg-card border border-card-line rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon size={14} className="text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
              </div>
              <p className="text-lg font-bold text-foreground tabular-nums">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Info */}
        {property.notes && (
          <div className="bg-card border border-card-line rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-2">Informationen</h2>
            <p className="text-sm text-muted-foreground-2 whitespace-pre-wrap">{property.notes}</p>
          </div>
        )}

        {/* Units */}
        {units.length > 0 && (
          <div className="bg-card border border-card-line rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-card-divider">
              <h2 className="text-sm font-semibold text-foreground">Einheiten ({units.length})</h2>
            </div>
            <div className="divide-y divide-card-divider">
              {units.map(u => {
                const tenant = tenants.find(t => t.id === u.tenantId);
                return (
                  <div key={u.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.area} m² · {u.rooms} Zimmer</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{fmt(u.currentRent)} €/M</p>
                      <span className={`text-xs ${tenant ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {tenant ? 'Vermietet' : 'Leerstand'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Utilities */}
        {utilities.length > 0 && (
          <div className="bg-card border border-card-line rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-card-divider">
              <h2 className="text-sm font-semibold text-foreground">Versorger ({utilities.length})</h2>
            </div>
            <div className="divide-y divide-card-divider">
              {utilities.map(u => (
                <div key={u.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.provider}</p>
                    <p className="text-xs text-muted-foreground">{u.type} · Zähler: {u.meterNumber}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-foreground">{fmt(u.monthlyAdvance)} €/M</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meter Readings */}
        {readings.length > 0 && (
          <div className="bg-card border border-card-line rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-card-divider flex items-center gap-2">
              <Gauge size={15} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Zählerstände ({readings.length})</h2>
            </div>
            <div className="divide-y divide-card-divider">
              {[...readings].sort((a, b) => b.date.localeCompare(a.date)).map(r => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Zähler {r.meterId}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.date)}{r.readBy ? ` · ${r.readBy}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-foreground">{r.value.toLocaleString('de-DE')}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="bg-card border border-card-line rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-card-divider flex items-center gap-2">
              <ImageIcon size={15} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Fotos ({photos.length})</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {photos.map(p => (
                  <div key={p.id} className="aspect-square rounded-xl overflow-hidden border border-card-line cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setLightbox(p)}>
                    <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Documents */}
        {documents.length > 0 && (
          <div className="bg-card border border-card-line rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-card-divider flex items-center gap-2">
              <FileText size={15} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Dokumente ({documents.length})</h2>
            </div>
            <div className="divide-y divide-card-divider">
              {documents.map(d => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={16} className={d.type.includes('pdf') ? 'text-red-500 shrink-0' : 'text-muted-foreground shrink-0'} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(d.size)}</p>
                    </div>
                  </div>
                  {d.dataUrl && (
                    <a href={d.dataUrl} download={d.name} className="text-primary hover:text-primary-hover transition-colors">
                      <Download size={15} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src="/logo.png" alt="ImmoFreak" className="h-4 object-contain opacity-50" />
          </div>
          <p className="text-xs text-muted-foreground">Erstellt mit ImmoFreak CRM</p>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 cursor-pointer" onClick={() => setLightbox(null)}>
            <X size={28} />
          </button>
          <img src={lightbox.dataUrl} alt={lightbox.name} className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
}
