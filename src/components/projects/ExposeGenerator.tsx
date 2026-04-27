import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, Eye, Palette, Type, Image as ImageIcon, MapPin, Home, Euro, Ruler,
  ChevronRight, AlertTriangle, Zap, Star, ChevronUp, ChevronDown, FileText, Scale, Bath, Layers,
} from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';
import { useProjectPhotos } from '../../hooks/useProjectPhotos';
import type { ProjectPhoto } from '../../types';
import { formatCurrency } from '../../lib/utils';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

type DesignTemplate = 'modern' | 'elegant' | 'minimal' | 'magazine' | 'luxury' | 'portfolio';
type EnergyCertificateType = 'bedarf' | 'verbrauch' | 'none';
type ObjectType =
  | 'Eigentumswohnung'
  | 'Einfamilienhaus'
  | 'Mehrfamilienhaus'
  | 'Doppelhaushälfte'
  | 'Reihenhaus'
  | 'Gewerbe'
  | 'Grundstück'
  | 'Sonstige';
type PropertyCondition =
  | 'Neubau'
  | 'Erstbezug nach Sanierung'
  | 'Neuwertig'
  | 'Gepflegt'
  | 'Renoviert'
  | 'Saniert'
  | 'Modernisiert'
  | 'Renovierungsbedürftig';
type EquipmentStandard = 'Einfach' | 'Standard' | 'Gehoben' | 'Luxuriös';
type HeatingType =
  | 'Gas'
  | 'Öl'
  | 'Fernwärme'
  | 'Wärmepumpe'
  | 'Pellet / Holz'
  | 'Strom'
  | 'Gas-Etagenheizung'
  | 'Nachtspeicher'
  | 'Sonstige';
type CommissionType = 'provisionsfrei' | 'käuferseitig' | 'geteilt';

interface ExposeConfig {
  template: DesignTemplate;
  primaryColor: string;

  // Texts
  headline: string;
  description: string;
  location: string;
  locationDescription: string;
  features: string[];

  // Visibility
  showPrice: boolean;

  // Photos
  coverPhotoId: string;
  photoOrder: string[];

  // Contact
  contactName: string;
  contactPhone: string;
  contactEmail: string;

  // Eckdaten
  objectType: ObjectType;
  area: string;
  plotArea: string;
  rooms: string;
  bathrooms: string;
  floor: string;
  totalFloors: string;
  yearBuilt: string;
  modernizationYear: string;
  availableFrom: string;
  condition: PropertyCondition;
  equipment: EquipmentStandard;
  heatingType: HeatingType;

  // Rechtliches
  commissionType: CommissionType;
  commissionRate: string;
  commissionNote: string;
  hoaFee: string;
  landRegisterInfo: string;
  specialRights: string;

  // Energieausweis (GEG § 87)
  energyClass: string;
  energyCertificateType: EnergyCertificateType;
  energyValue: string;
  energySource: string;
  energyCertIssueYear: string;
  energyCertExempt: boolean;
}

const ENERGY_SOURCES = ['Gas', 'Öl', 'Fernwärme', 'Wärmepumpe', 'Pellet / Holz', 'Strom', 'Sonstige'];

const OBJECT_TYPES: ObjectType[] = [
  'Eigentumswohnung', 'Einfamilienhaus', 'Mehrfamilienhaus', 'Doppelhaushälfte',
  'Reihenhaus', 'Gewerbe', 'Grundstück', 'Sonstige',
];

const CONDITIONS: PropertyCondition[] = [
  'Neubau', 'Erstbezug nach Sanierung', 'Neuwertig', 'Gepflegt',
  'Renoviert', 'Saniert', 'Modernisiert', 'Renovierungsbedürftig',
];

const EQUIPMENT_STANDARDS: EquipmentStandard[] = ['Einfach', 'Standard', 'Gehoben', 'Luxuriös'];

const HEATING_TYPES: HeatingType[] = [
  'Gas', 'Öl', 'Fernwärme', 'Wärmepumpe', 'Pellet / Holz', 'Strom',
  'Gas-Etagenheizung', 'Nachtspeicher', 'Sonstige',
];

const COMMISSION_OPTIONS: { value: CommissionType; label: string }[] = [
  { value: 'provisionsfrei', label: 'Provisionsfrei für Käufer' },
  { value: 'käuferseitig', label: 'Käuferprovision' },
  { value: 'geteilt', label: 'Provision geteilt' },
];

const TEMPLATES: { id: DesignTemplate; name: string; desc: string; accentClass: string }[] = [
  { id: 'modern',    name: 'Modern',    desc: 'Großes Heldenbild, klare Typografie',       accentClass: 'from-blue-500 to-blue-600' },
  { id: 'elegant',   name: 'Elegant',   desc: 'Dunkler Header, farbige Akzente',           accentClass: 'from-slate-700 to-slate-900' },
  { id: 'minimal',   name: 'Minimal',   desc: 'Viel Weissraum, dezent',                    accentClass: 'from-gray-200 to-gray-300' },
  { id: 'magazine',  name: 'Magazine',  desc: 'Editorial-Look mit Serifen & Spalten',      accentClass: 'from-stone-100 to-stone-200' },
  { id: 'luxury',    name: 'Luxus',     desc: 'Schwarz mit Gold — Premium-Auftritt',       accentClass: 'from-neutral-900 to-amber-700' },
  { id: 'portfolio', name: 'Portfolio', desc: 'Bild-dominiert, Galerie im Raster',         accentClass: 'from-emerald-500 to-teal-600' },
];

const COLOR_PRESETS = ['#3b82f6', '#0d9488', '#2563eb', '#dc2626', '#d97706', '#171717', '#b45309', '#7c3aed'];

const DEFAULT_FEATURES = [
  'Hochwertig saniert',
  'Neue Fenster',
  'Fussbodenheizung',
  'Moderne Einbauküche',
  'Balkon / Terrasse',
  'Tiefgaragenstellplatz',
  'Aufzug',
  'Keller',
  'Smart-Home',
  'Garten',
];

type Photo = ProjectPhoto;

export function ExposeGenerator() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject } = useProjects();
  const { photos } = useProjectPhotos(id);
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.5);

  const calcScale = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 32;
      setPreviewScale(Math.min(containerWidth / 794, 1));
    }
  }, []);

  useEffect(() => {
    calcScale();
    window.addEventListener('resize', calcScale);
    return () => window.removeEventListener('resize', calcScale);
  }, [calcScale]);

  const project = getProject(id || '');

  const [config, setConfig] = useState<ExposeConfig>({
    template: 'modern',
    primaryColor: '#3b82f6',
    headline: project ? `${project.name} — Erstbezug nach Sanierung` : '',
    description:
      'Dieses hochwertig sanierte Objekt überzeugt durch seine moderne Ausstattung und die hervorragende Lage. Alle Arbeiten wurden mit hochwertigen Materialien und nach neuesten Standards durchgeführt.',
    location: project?.address || '',
    locationDescription:
      'Zentrale Lage mit hervorragender Infrastruktur. Einkaufsmöglichkeiten, Schulen und öffentliche Verkehrsmittel in unmittelbarer Nähe.',
    features: ['Hochwertig saniert', 'Neue Fenster', 'Fussbodenheizung', 'Moderne Einbauküche'],
    showPrice: true,
    coverPhotoId: '',
    photoOrder: [],
    contactName: 'Yan',
    contactPhone: '+49 170 1234567',
    contactEmail: 'yan@immofreak.de',
    objectType: 'Eigentumswohnung',
    area: '85',
    plotArea: '',
    rooms: '3',
    bathrooms: '1',
    floor: '',
    totalFloors: '',
    yearBuilt: '1965',
    modernizationYear: '2025',
    availableFrom: 'sofort',
    condition: 'Erstbezug nach Sanierung',
    equipment: 'Gehoben',
    heatingType: 'Wärmepumpe',
    commissionType: 'provisionsfrei',
    commissionRate: '',
    commissionNote: '',
    hoaFee: '',
    landRegisterInfo: '',
    specialRights: '',
    energyClass: 'B',
    energyCertificateType: 'none',
    energyValue: '',
    energySource: '',
    energyCertIssueYear: '',
    energyCertExempt: false,
  });

  // Sync photoOrder with actual photos: add new, remove stale, auto-set cover on first load
  useEffect(() => {
    const photoIds = photos.map(p => p.id);
    setConfig(prev => {
      const kept = prev.photoOrder.filter(pid => photoIds.includes(pid));
      const added = photoIds.filter(pid => !kept.includes(pid));
      const nextOrder = [...kept, ...added];

      let nextCover = prev.coverPhotoId;
      if (nextCover && !photoIds.includes(nextCover)) nextCover = '';
      if (!nextCover && nextOrder.length > 0) nextCover = nextOrder[0];

      const orderChanged =
        nextOrder.length !== prev.photoOrder.length ||
        nextOrder.some((v, i) => v !== prev.photoOrder[i]);
      const coverChanged = nextCover !== prev.coverPhotoId;

      if (!orderChanged && !coverChanged) return prev;
      return { ...prev, photoOrder: nextOrder, coverPhotoId: nextCover };
    });
  }, [photos]);

  const gegReady =
    config.energyCertExempt ||
    (config.energyCertificateType !== 'none' &&
      config.energyValue.trim() !== '' &&
      config.energySource.trim() !== '' &&
      config.energyClass.trim() !== '' &&
      config.yearBuilt.trim() !== '');

  // Build ordered photo list based on config.photoOrder
  const orderedPhotos: Photo[] = config.photoOrder
    .map(pid => photos.find(p => p.id === pid))
    .filter((p): p is Photo => !!p);

  const heroPhotoObj = orderedPhotos.find(p => p.id === config.coverPhotoId) || orderedPhotos[0];
  const heroPhoto = heroPhotoObj?.dataUrl || null;
  const galleryPhotos = orderedPhotos.filter(p => p.id !== heroPhotoObj?.id);

  const update = (partial: Partial<ExposeConfig>) => setConfig(prev => ({ ...prev, ...partial }));

  const toggleFeature = (feature: string) => {
    setConfig(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const movePhoto = (photoId: string, direction: -1 | 1) => {
    setConfig(prev => {
      const idx = prev.photoOrder.indexOf(photoId);
      if (idx === -1) return prev;
      const next = idx + direction;
      if (next < 0 || next >= prev.photoOrder.length) return prev;
      const newOrder = [...prev.photoOrder];
      [newOrder[idx], newOrder[next]] = [newOrder[next], newOrder[idx]];
      return { ...prev, photoOrder: newOrder };
    });
  };

  const setCover = (photoId: string) => update({ coverPhotoId: photoId });

  const handleExportPDF = async () => {
    if (!previewRef.current) return;
    if (!gegReady) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      pdf.save(`Expose_${project?.name || 'Projekt'}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  if (!project) {
    return (
      <div className="page-container py-10 text-center">
        <p className="text-sm text-muted-foreground-2">Projekt nicht gefunden.</p>
      </div>
    );
  }

  const templateProps = { config, project, heroPhoto, galleryPhotos };

  return (
    <div className="px-6 sm:px-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/projekte/${id}`)} className="btn btn-sm btn-ghost rounded-lg">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">Expose erstellen</h1>
            <p className="page-subtitle">{project.name} · {project.address}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!gegReady && (
            <div className="flex items-center gap-1.5 text-xs text-amber-500">
              <AlertTriangle size={14} />
              <span>GEG-Pflichtangaben fehlen</span>
            </div>
          )}
          <button
            onClick={handleExportPDF}
            disabled={exporting || !gegReady}
            className="btn btn-md btn-primary"
          >
            <Download size={16} />
            {exporting ? 'Exportiert...' : 'PDF exportieren'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 pb-8">
        {/* Sidebar — Settings */}
        <div className="space-y-4 order-2 xl:order-1">
          {/* Template Selection */}
          <div className="surface p-5">
            <h3 className="section-title mb-3 flex items-center gap-2">
              <Palette size={14} className="text-blue-400" /> Design wählen
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => update({ template: t.id })}
                  className={`relative text-left p-3 rounded-lg border-2 transition-all overflow-hidden ${
                    config.template === t.id
                      ? 'border-blue-500 bg-primary/10'
                      : 'border-card-line hover:border-muted-foreground'
                  }`}
                >
                  <div className={`h-1.5 rounded-full mb-2 bg-gradient-to-r ${t.accentClass}`} />
                  <p className={`text-sm font-semibold ${config.template === t.id ? 'text-blue-400' : 'text-foreground'}`}>
                    {t.name}
                  </p>
                  <p className="text-[10px] mt-0.5 text-muted-foreground leading-snug">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div className="surface p-5">
            <h3 className="section-title mb-3">Akzentfarbe</h3>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => update({ primaryColor: c })}
                  className={`w-8 h-8 rounded-full transition-all ring-offset-background ${config.primaryColor === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="relative w-8 h-8 rounded-full border-2 border-dashed border-card-line flex items-center justify-center cursor-pointer overflow-hidden transition-colors">
                <input
                  type="color"
                  value={config.primaryColor}
                  onChange={e => update({ primaryColor: e.target.value })}
                  className="opacity-0 absolute w-0 h-0"
                />
                <span className="text-xs text-muted-foreground">+</span>
              </label>
            </div>
          </div>

          {/* Photos — Cover & Order */}
          <div className="surface p-5">
            <h3 className="section-title mb-1 flex items-center gap-2">
              <ImageIcon size={14} className="text-blue-400" /> Bilder
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              {orderedPhotos.length === 0
                ? 'Füge Fotos im Projekt-Detail hinzu.'
                : 'Stern = Titelbild · Pfeile für Reihenfolge'}
            </p>
            {orderedPhotos.length > 0 && (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {orderedPhotos.map((p, idx) => {
                  const isCover = p.id === (heroPhotoObj?.id || '');
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                        isCover ? 'border-amber-400/60 bg-amber-400/5' : 'border-card-line bg-layer-hover'
                      }`}
                    >
                      <div className="size-12 rounded-md overflow-hidden shrink-0 bg-gray-100">
                        <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">
                          {isCover ? 'Titelbild' : `Bild ${idx + 1}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{p.name}</p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => setCover(p.id)}
                          title="Als Titelbild"
                          className={`p-1.5 rounded-md transition-colors ${
                            isCover
                              ? 'text-amber-400'
                              : 'text-muted-foreground hover:text-amber-400 hover:bg-card'
                          }`}
                        >
                          <Star size={14} fill={isCover ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          onClick={() => movePhoto(p.id, -1)}
                          disabled={idx === 0}
                          title="Nach oben"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => movePhoto(p.id, 1)}
                          disabled={idx === orderedPhotos.length - 1}
                          title="Nach unten"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Text */}
          <div className="surface p-5">
            <h3 className="section-title mb-3 flex items-center gap-2">
              <Type size={14} className="text-blue-400" /> Texte
            </h3>
            <div className="space-y-3">
              <div>
                <label className="input-label">Überschrift</label>
                <input value={config.headline} onChange={e => update({ headline: e.target.value })} className="input" />
              </div>
              <div>
                <label className="input-label">Objektbeschreibung</label>
                <textarea value={config.description} onChange={e => update({ description: e.target.value })} rows={3} className="input" />
              </div>
              <div>
                <label className="input-label">Lage (Adresse)</label>
                <input value={config.location} onChange={e => update({ location: e.target.value })} className="input" />
              </div>
              <div>
                <label className="input-label">Lagebeschreibung</label>
                <textarea value={config.locationDescription} onChange={e => update({ locationDescription: e.target.value })} rows={2} className="input" />
              </div>
            </div>
          </div>

          {/* Eckdaten */}
          <div className="surface p-5">
            <h3 className="section-title mb-3 flex items-center gap-2">
              <Home size={14} className="text-blue-400" /> Eckdaten
            </h3>
            <div className="space-y-3">
              <div>
                <label className="input-label">Objektart</label>
                <select
                  value={config.objectType}
                  onChange={e => update({ objectType: e.target.value as ObjectType })}
                  className="input"
                >
                  {OBJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Wohnfläche (m²)</label>
                  <input value={config.area} onChange={e => update({ area: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="input-label">Grundstück (m²)</label>
                  <input value={config.plotArea} onChange={e => update({ plotArea: e.target.value })} className="input" placeholder="optional" />
                </div>
                <div>
                  <label className="input-label">Zimmer</label>
                  <input value={config.rooms} onChange={e => update({ rooms: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="input-label">Badezimmer</label>
                  <input value={config.bathrooms} onChange={e => update({ bathrooms: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="input-label">Etage</label>
                  <input value={config.floor} onChange={e => update({ floor: e.target.value })} className="input" placeholder="z.B. 2" />
                </div>
                <div>
                  <label className="input-label">Etagen gesamt</label>
                  <input value={config.totalFloors} onChange={e => update({ totalFloors: e.target.value })} className="input" placeholder="z.B. 4" />
                </div>
                <div>
                  <label className="input-label">Baujahr</label>
                  <input value={config.yearBuilt} onChange={e => update({ yearBuilt: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="input-label">Modernisiert</label>
                  <input value={config.modernizationYear} onChange={e => update({ modernizationYear: e.target.value })} className="input" placeholder="z.B. 2025" />
                </div>
              </div>
              <div>
                <label className="input-label">Verfügbar ab</label>
                <input value={config.availableFrom} onChange={e => update({ availableFrom: e.target.value })} className="input" placeholder="sofort / nach Absprache / 01.09.2026" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Zustand</label>
                  <select
                    value={config.condition}
                    onChange={e => update({ condition: e.target.value as PropertyCondition })}
                    className="input"
                  >
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Ausstattung</label>
                  <select
                    value={config.equipment}
                    onChange={e => update({ equipment: e.target.value as EquipmentStandard })}
                    className="input"
                  >
                    {EQUIPMENT_STANDARDS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="input-label">Heizungsart</label>
                <select
                  value={config.heatingType}
                  onChange={e => update({ heatingType: e.target.value as HeatingType })}
                  className="input"
                >
                  {HEATING_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground-2">
                <input type="checkbox" checked={config.showPrice} onChange={e => update({ showPrice: e.target.checked })} className="rounded" />
                Preis anzeigen
              </label>
            </div>
          </div>

          {/* Rechtliches / Provision */}
          <div className="surface p-5">
            <h3 className="section-title mb-3 flex items-center gap-2">
              <Scale size={14} className="text-blue-400" /> Rechtliches & Kosten
            </h3>
            <div className="space-y-3">
              <div>
                <label className="input-label">Provision</label>
                <select
                  value={config.commissionType}
                  onChange={e => update({ commissionType: e.target.value as CommissionType })}
                  className="input"
                >
                  {COMMISSION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {config.commissionType !== 'provisionsfrei' && (
                <>
                  <div>
                    <label className="input-label">Provisionshöhe</label>
                    <input
                      value={config.commissionRate}
                      onChange={e => update({ commissionRate: e.target.value })}
                      placeholder="z.B. 3,57 % inkl. MwSt."
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="input-label">Hinweis zur Provision</label>
                    <input
                      value={config.commissionNote}
                      onChange={e => update({ commissionNote: e.target.value })}
                      placeholder="z.B. fällig bei notariellem Kaufvertrag"
                      className="input"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="input-label">Hausgeld (monatlich)</label>
                <input
                  value={config.hoaFee}
                  onChange={e => update({ hoaFee: e.target.value })}
                  placeholder="z.B. 280 € (davon 80 € umlagefähig)"
                  className="input"
                />
              </div>
              <div>
                <label className="input-label">Grundbuch-Hinweis</label>
                <input
                  value={config.landRegisterInfo}
                  onChange={e => update({ landRegisterInfo: e.target.value })}
                  placeholder="z.B. lastenfrei / Grundschuld zur Löschung"
                  className="input"
                />
              </div>
              <div>
                <label className="input-label">Sonderrechte / Hinweise</label>
                <input
                  value={config.specialRights}
                  onChange={e => update({ specialRights: e.target.value })}
                  placeholder="z.B. Denkmalschutz, Erbbaurecht"
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Energieausweis (GEG § 87) */}
          <div className="surface p-5">
            <h3 className="section-title mb-1 flex items-center gap-2">
              <Zap size={14} className="text-amber-500" /> Energieausweis
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Pflichtangaben nach § 87 GEG bei Immobilieninseraten
            </p>
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.energyCertExempt}
                  onChange={e => update({ energyCertExempt: e.target.checked })}
                  className="mt-0.5"
                />
                <span>Objekt ist von der Ausweispflicht befreit (z. B. Baudenkmal, § 79 Abs. 4 GEG)</span>
              </label>

              {!config.energyCertExempt && (
                <>
                  <div>
                    <label className="input-label">Art des Ausweises</label>
                    <select
                      value={config.energyCertificateType}
                      onChange={e => update({ energyCertificateType: e.target.value as EnergyCertificateType })}
                      className="input"
                    >
                      <option value="none">— bitte wählen —</option>
                      <option value="bedarf">Bedarfsausweis</option>
                      <option value="verbrauch">Verbrauchsausweis</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="input-label">
                        {config.energyCertificateType === 'bedarf' ? 'Endenergiebedarf' : 'Endenergieverbrauch'} (kWh/m²·a)
                      </label>
                      <input
                        value={config.energyValue}
                        onChange={e => update({ energyValue: e.target.value })}
                        className="input"
                        placeholder="z.B. 75"
                      />
                    </div>
                    <div>
                      <label className="input-label">Energieklasse</label>
                      <input
                        value={config.energyClass}
                        onChange={e => update({ energyClass: e.target.value })}
                        className="input"
                        placeholder="A+, A, B, ..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="input-label">Wesentlicher Energieträger</label>
                    <select
                      value={config.energySource}
                      onChange={e => update({ energySource: e.target.value })}
                      className="input"
                    >
                      <option value="">— bitte wählen —</option>
                      {ENERGY_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Ausstellungsjahr des Ausweises</label>
                    <input
                      value={config.energyCertIssueYear}
                      onChange={e => update({ energyCertIssueYear: e.target.value })}
                      className="input"
                      placeholder="z.B. 2024"
                    />
                  </div>
                </>
              )}

              {!gegReady && (
                <div className="flex items-start gap-2 p-2.5 rounded-[10px] text-xs" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <p>
                    Pflichtangaben nach § 87 GEG unvollständig. Der PDF-Export ist gesperrt, bis alle Felder ausgefüllt oder eine Befreiung aktiviert sind. Bußgelder bis 15.000 € sind möglich.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Features */}
          <div className="surface p-5">
            <h3 className="section-title mb-3">Ausstattungs-Merkmale</h3>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_FEATURES.map(f => (
                <button
                  key={f}
                  onClick={() => toggleFeature(f)}
                  className={`py-1.5 px-3 text-xs font-medium rounded-full transition-all ${
                    config.features.includes(f)
                      ? 'bg-[#4F6BFF] text-white'
                      : 'bg-layer-hover text-muted-foreground-2'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="surface p-5">
            <h3 className="section-title mb-3">Kontakt</h3>
            <div className="space-y-3">
              <input value={config.contactName} onChange={e => update({ contactName: e.target.value })} placeholder="Name" className="input" />
              <input value={config.contactPhone} onChange={e => update({ contactPhone: e.target.value })} placeholder="Telefon" className="input" />
              <input value={config.contactEmail} onChange={e => update({ contactEmail: e.target.value })} placeholder="E-Mail" className="input" />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="order-1 xl:order-2">
          <div className="sticky top-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={14} className="text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground-2">Vorschau</span>
            </div>
            <div ref={containerRef} className="surface overflow-hidden">
              <div className="p-3 sm:p-4" style={{ height: 1123 * previewScale + 32 }}>
                <div
                  ref={previewRef}
                  className="bg-white mx-auto origin-top"
                  style={{ width: 794, height: 1123, transform: `scale(${previewScale})` }}
                >
                  {config.template === 'modern'    && <ModernTemplate {...templateProps} />}
                  {config.template === 'elegant'   && <ElegantTemplate {...templateProps} />}
                  {config.template === 'minimal'   && <MinimalTemplate {...templateProps} />}
                  {config.template === 'magazine'  && <MagazineTemplate {...templateProps} />}
                  {config.template === 'luxury'    && <LuxuryTemplate {...templateProps} />}
                  {config.template === 'portfolio' && <PortfolioTemplate {...templateProps} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Shared helpers for templates ====================

function getCommissionLabel(c: ExposeConfig): string {
  if (c.commissionType === 'provisionsfrei') return 'Provisionsfrei für Käufer';
  if (c.commissionType === 'käuferseitig') return `Käuferprovision${c.commissionRate ? ` · ${c.commissionRate}` : ''}`;
  return `Provision geteilt${c.commissionRate ? ` · ${c.commissionRate}` : ''}`;
}

function KeyFactsTable({ config, project, compact }: { config: ExposeConfig; project: any; compact?: boolean }) {
  const rows = [
    { label: 'Objektart', value: config.objectType },
    config.showPrice && { label: 'Kaufpreis', value: formatCurrency(project.targetSellPrice) },
    { label: 'Wohnfläche', value: config.area ? `${config.area} m²` : null },
    { label: 'Zimmer', value: config.rooms || null },
    { label: 'Badezimmer', value: config.bathrooms || null },
    { label: 'Grundstück', value: config.plotArea ? `${config.plotArea} m²` : null },
    { label: 'Etage', value: config.floor ? (config.totalFloors ? `${config.floor} von ${config.totalFloors}` : config.floor) : null },
    { label: 'Baujahr', value: config.yearBuilt || null },
    { label: 'Modernisiert', value: config.modernizationYear || null },
    { label: 'Zustand', value: config.condition },
    { label: 'Ausstattung', value: config.equipment },
    { label: 'Heizung', value: config.heatingType },
    { label: 'Energieklasse', value: config.energyClass || null },
    { label: 'Verfügbar ab', value: config.availableFrom || null },
    { label: 'Hausgeld', value: config.hoaFee || null },
    { label: 'Provision', value: getCommissionLabel(config) },
    { label: 'Grundbuch', value: config.landRegisterInfo || null },
    { label: 'Besonderheiten', value: config.specialRights || null },
  ].filter((r): r is { label: string; value: string } => !!r && typeof r.value === 'string' && r.value.length > 0);

  return (
    <div className={`grid grid-cols-2 ${compact ? 'gap-x-4 gap-y-1' : 'gap-x-6 gap-y-1.5'}`}>
      {rows.map(r => (
        <div key={r.label} className={`flex justify-between border-b border-gray-200/60 ${compact ? 'py-0.5 text-[9px]' : 'py-1 text-[10px]'}`}>
          <span className="text-gray-500">{r.label}</span>
          <span className="font-semibold text-gray-900 text-right ml-2 truncate">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ==================== TEMPLATE: MODERN ====================
function ModernTemplate({ config, project, heroPhoto, galleryPhotos }: {
  config: ExposeConfig; project: any; heroPhoto: string | null; galleryPhotos: Photo[];
}) {
  return (
    <div className="w-full h-full flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Hero */}
      <div className="relative h-[360px] overflow-hidden" style={{ backgroundColor: config.primaryColor }}>
        {heroPhoto ? (
          <img src={heroPhoto} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={64} className="text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-10">
          <div className="inline-block px-3 py-1 rounded-full text-[11px] font-bold text-white mb-3" style={{ backgroundColor: config.primaryColor }}>
            {config.objectType.toUpperCase()} · ZU VERKAUFEN
          </div>
          <h1 className="text-[28px] font-bold text-white leading-tight max-w-[600px]">{config.headline || project.name}</h1>
          <div className="flex items-center gap-2 mt-3 text-white/80 text-[13px]">
            <MapPin size={14} />
            <span>{config.location}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 flex flex-col">
        {/* Key Facts */}
        <div className="flex gap-6 mb-6">
          {config.showPrice && (
            <FactChip color={config.primaryColor} icon={<Euro size={18} />} label="KAUFPREIS" value={formatCurrency(project.targetSellPrice)} />
          )}
          {config.area && (
            <FactChip color={config.primaryColor} icon={<Ruler size={18} />} label="WOHNFLÄCHE" value={`${config.area} m²`} />
          )}
          {config.rooms && (
            <FactChip color={config.primaryColor} icon={<Home size={18} />} label="ZIMMER" value={config.rooms} />
          )}
          {config.bathrooms && (
            <FactChip color={config.primaryColor} icon={<Bath size={18} />} label="BÄDER" value={config.bathrooms} />
          )}
        </div>

        {/* Description + Features grid */}
        <div className="grid grid-cols-[1fr_240px] gap-6 mb-6">
          <div>
            <h2 className="text-[13px] font-bold text-gray-900 mb-2">Objektbeschreibung</h2>
            <p className="text-[11px] text-gray-600 leading-relaxed mb-4">{config.description}</p>
            <h2 className="text-[13px] font-bold text-gray-900 mb-2">Lage</h2>
            <p className="text-[11px] text-gray-600 leading-relaxed">{config.locationDescription}</p>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: config.primaryColor + '08' }}>
            <p className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2">Eckdaten</p>
            <KeyFactsTable config={config} project={project} compact />
          </div>
        </div>

        {/* Features */}
        {config.features.length > 0 && (
          <div className="mb-5">
            <h2 className="text-[13px] font-bold text-gray-900 mb-2">Ausstattung</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {config.features.map(f => (
                <div key={f} className="flex items-center gap-1.5 text-[11px] text-gray-700">
                  <ChevronRight size={11} style={{ color: config.primaryColor }} />
                  {f}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gallery */}
        {galleryPhotos.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-5">
            {galleryPhotos.slice(0, 4).map(p => (
              <div key={p.id} className="h-[85px] rounded-lg overflow-hidden">
                <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* GEG */}
        <EnergyDisclosure config={config} />

        {/* Contact Footer */}
        <div className="mt-auto pt-4 border-t border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-bold text-gray-900">{config.contactName}</p>
            <p className="text-[10px] text-gray-500">{config.contactPhone} · {config.contactEmail}</p>
          </div>
          <div className="text-[9px] text-gray-300 font-medium">Erstellt mit ImmoFreak</div>
        </div>
      </div>
    </div>
  );
}

function FactChip({ color, icon, label, value }: { color: string; icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15', color }}>
        {icon}
      </div>
      <div>
        <p className="text-[9px] text-gray-400 font-medium">{label}</p>
        <p className="text-[15px] font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

// ==================== TEMPLATE: ELEGANT ====================
function ElegantTemplate({ config, project, heroPhoto, galleryPhotos }: {
  config: ExposeConfig; project: any; heroPhoto: string | null; galleryPhotos: Photo[];
}) {
  return (
    <div className="w-full h-full flex flex-col bg-gray-50" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Dark Header */}
      <div className="bg-gray-900 text-white px-10 py-7">
        <div className="flex items-center justify-between mb-5">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: config.primaryColor }}>
            Immobilien-Expose
          </div>
          <div className="text-[10px] text-gray-400">{config.contactName} · {config.contactPhone}</div>
        </div>
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">{config.objectType}</div>
        <h1 className="text-[26px] font-bold leading-tight">{config.headline || project.name}</h1>
        <div className="flex items-center gap-2 mt-2 text-gray-400 text-[12px]">
          <MapPin size={13} />
          <span>{config.location}</span>
        </div>
        <div className="flex gap-7 mt-5">
          {config.showPrice && (
            <div>
              <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: config.primaryColor }}>Kaufpreis</p>
              <p className="text-[20px] font-bold mt-0.5">{formatCurrency(project.targetSellPrice)}</p>
            </div>
          )}
          {config.area && (
            <div>
              <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: config.primaryColor }}>Wohnfläche</p>
              <p className="text-[20px] font-bold mt-0.5">{config.area} m²</p>
            </div>
          )}
          {config.rooms && (
            <div>
              <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: config.primaryColor }}>Zimmer</p>
              <p className="text-[20px] font-bold mt-0.5">{config.rooms}</p>
            </div>
          )}
          {config.bathrooms && (
            <div>
              <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: config.primaryColor }}>Bäder</p>
              <p className="text-[20px] font-bold mt-0.5">{config.bathrooms}</p>
            </div>
          )}
        </div>
      </div>

      {/* Hero Image */}
      <div className="h-[240px] overflow-hidden">
        {heroPhoto ? (
          <img src={heroPhoto} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <ImageIcon size={48} className="text-gray-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-10 py-6 bg-white flex flex-col">
        <div className="grid grid-cols-[1fr_220px] gap-7">
          <div>
            <h2 className="text-[13px] font-bold text-gray-900 mb-2">Objektbeschreibung</h2>
            <p className="text-[11px] text-gray-600 leading-relaxed mb-4">{config.description}</p>

            <h2 className="text-[13px] font-bold text-gray-900 mb-2">Lage</h2>
            <p className="text-[11px] text-gray-600 leading-relaxed mb-4">{config.locationDescription}</p>

            {config.features.length > 0 && (
              <>
                <h2 className="text-[13px] font-bold text-gray-900 mb-2">Ausstattung</h2>
                <div className="grid grid-cols-2 gap-1">
                  {config.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-[11px] text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.primaryColor }} />
                      {f}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Sidebar Details */}
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Eckdaten</p>
              <KeyFactsTable config={config} project={project} compact />
            </div>
            <EnergyDisclosure config={config} compact />
          </div>
        </div>

        {/* Gallery */}
        {galleryPhotos.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mt-5">
            {galleryPhotos.slice(0, 4).map(p => (
              <div key={p.id} className="h-[75px] rounded-lg overflow-hidden">
                <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-bold text-gray-900">{config.contactName}</p>
            <p className="text-[10px] text-gray-500">{config.contactPhone} · {config.contactEmail}</p>
          </div>
          <div className="text-[10px] text-gray-300">ImmoFreak</div>
        </div>
      </div>
    </div>
  );
}

// ==================== TEMPLATE: MINIMAL ====================
function MinimalTemplate({ config, project, heroPhoto, galleryPhotos }: {
  config: ExposeConfig; project: any; heroPhoto: string | null; galleryPhotos: Photo[];
}) {
  return (
    <div className="w-full h-full flex flex-col p-10" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Top line */}
      <div className="flex items-center justify-between mb-8">
        <div className="h-1 w-16 rounded-full" style={{ backgroundColor: config.primaryColor }} />
        <div className="text-[10px] text-gray-400 font-medium">{config.objectType} · Expose · {new Date().toLocaleDateString('de-DE')}</div>
      </div>

      {/* Title */}
      <h1 className="text-[28px] font-bold text-gray-900 leading-tight mb-2">{config.headline || project.name}</h1>
      <p className="text-[13px] text-gray-500 flex items-center gap-1.5 mb-6">
        <MapPin size={13} /> {config.location}
      </p>

      {/* Hero */}
      <div className="h-[240px] rounded-[10px] overflow-hidden mb-6">
        {heroPhoto ? (
          <img src={heroPhoto} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-[10px]">
            <ImageIcon size={48} className="text-gray-300" />
          </div>
        )}
      </div>

      {/* Key Facts Row */}
      <div className="flex gap-6 mb-5 pb-5 border-b border-gray-200">
        {config.showPrice && <KeyFact label="Kaufpreis" value={formatCurrency(project.targetSellPrice)} color={config.primaryColor} primary />}
        {config.area && <KeyFact label="Wohnfläche" value={`${config.area} m²`} />}
        {config.rooms && <KeyFact label="Zimmer" value={config.rooms} />}
        {config.bathrooms && <KeyFact label="Bäder" value={config.bathrooms} />}
        {config.yearBuilt && <KeyFact label="Baujahr" value={config.yearBuilt} />}
      </div>

      {/* Two Column */}
      <div className="grid grid-cols-[1fr_1fr] gap-8 mb-5">
        <div>
          <h2 className="text-[12px] font-bold text-gray-900 mb-2">Beschreibung</h2>
          <p className="text-[10.5px] text-gray-600 leading-relaxed mb-3">{config.description}</p>
          <h2 className="text-[12px] font-bold text-gray-900 mb-2">Lage</h2>
          <p className="text-[10.5px] text-gray-600 leading-relaxed">{config.locationDescription}</p>
        </div>
        <div>
          <h2 className="text-[12px] font-bold text-gray-900 mb-2">Ausstattung</h2>
          <div className="space-y-1">
            {config.features.map(f => (
              <div key={f} className="flex items-center gap-2 text-[10.5px] text-gray-700">
                <div className="w-3 h-[2px] rounded-full" style={{ backgroundColor: config.primaryColor }} />
                {f}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h2 className="text-[12px] font-bold text-gray-900 mb-2">Eckdaten</h2>
            <KeyFactsTable config={config} project={project} compact />
          </div>
        </div>
      </div>

      {/* Gallery */}
      {galleryPhotos.length > 0 && (
        <div className="grid grid-cols-5 gap-1.5 mb-5">
          {galleryPhotos.slice(0, 5).map(p => (
            <div key={p.id} className="h-[65px] rounded-md overflow-hidden">
              <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* GEG */}
      <EnergyDisclosure config={config} />

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-gray-200 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-gray-900">{config.contactName}</p>
          <p className="text-[10px] text-gray-400">{config.contactPhone} · {config.contactEmail}</p>
        </div>
        <div className="text-[9px] text-gray-300 font-medium">ImmoFreak</div>
      </div>
    </div>
  );
}

function KeyFact({ label, value, color, primary }: { label: string; value: string; color?: string; primary?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 font-medium mb-0.5">{label}</p>
      <p className="text-[18px] font-bold" style={{ color: primary ? color : '#111827' }}>{value}</p>
    </div>
  );
}

// ==================== TEMPLATE: MAGAZINE ====================
function MagazineTemplate({ config, project, heroPhoto, galleryPhotos }: {
  config: ExposeConfig; project: any; heroPhoto: string | null; galleryPhotos: Photo[];
}) {
  const description = config.description || '';
  const firstChar = description.charAt(0);
  const restOfDescription = description.slice(1);

  return (
    <div className="w-full h-full flex flex-col bg-stone-50" style={{ fontFamily: 'Georgia, serif' }}>
      {/* Magazine Header */}
      <div className="px-12 pt-8 pb-4 border-b-2 border-gray-900 flex items-center justify-between">
        <div className="text-[9px] tracking-[0.35em] uppercase text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
          Immobilien · Edition {new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })}
        </div>
        <div className="text-[9px] tracking-[0.3em] uppercase font-bold text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
          № 01 — Feature
        </div>
      </div>

      {/* Title section */}
      <div className="px-12 py-6">
        <div className="text-[10px] uppercase tracking-[0.25em] mb-3" style={{ color: config.primaryColor, fontFamily: 'Inter, sans-serif' }}>
          {config.objectType} · {config.condition}
        </div>
        <h1 className="text-[38px] leading-[1.05] font-bold text-gray-900 italic max-w-[640px]">{config.headline || project.name}</h1>
        <p className="text-[12px] text-gray-500 mt-3 flex items-center gap-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
          <MapPin size={12} /> {config.location}
        </p>
      </div>

      {/* Hero with overlay stats */}
      <div className="relative h-[260px] mx-12 overflow-hidden">
        {heroPhoto ? (
          <img src={heroPhoto} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-stone-200 flex items-center justify-center">
            <ImageIcon size={48} className="text-stone-400" />
          </div>
        )}
        <div className="absolute bottom-3 right-3 bg-white/95 px-4 py-2 flex gap-4" style={{ fontFamily: 'Inter, sans-serif' }}>
          {config.showPrice && (
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">Preis</p>
              <p className="text-[14px] font-bold text-gray-900">{formatCurrency(project.targetSellPrice)}</p>
            </div>
          )}
          {config.area && (
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">Fläche</p>
              <p className="text-[14px] font-bold text-gray-900">{config.area} m²</p>
            </div>
          )}
          {config.rooms && (
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-wider">Zimmer</p>
              <p className="text-[14px] font-bold text-gray-900">{config.rooms}</p>
            </div>
          )}
        </div>
      </div>

      {/* Three-column editorial content */}
      <div className="flex-1 px-12 py-6 grid grid-cols-3 gap-6">
        {/* Column 1 — description with drop cap */}
        <div className="col-span-2 grid grid-cols-2 gap-6">
          <div>
            <p className="text-[9px] uppercase tracking-[0.25em] text-gray-500 mb-2 font-bold" style={{ fontFamily: 'Inter, sans-serif' }}>
              Das Objekt
            </p>
            <p className="text-[11px] leading-[1.7] text-gray-800">
              <span className="float-left text-[38px] leading-[0.9] mr-1 mt-0.5 font-bold" style={{ color: config.primaryColor }}>
                {firstChar}
              </span>
              {restOfDescription}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.25em] text-gray-500 mb-2 font-bold" style={{ fontFamily: 'Inter, sans-serif' }}>
              Die Lage
            </p>
            <p className="text-[11px] leading-[1.7] text-gray-800">{config.locationDescription}</p>
            {config.features.length > 0 && (
              <div className="mt-3">
                <p className="text-[9px] uppercase tracking-[0.25em] text-gray-500 mb-2 font-bold" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Highlights
                </p>
                <div className="space-y-0.5">
                  {config.features.slice(0, 6).map(f => (
                    <div key={f} className="text-[10px] text-gray-700 italic before:content-['—'] before:mr-1 before:text-gray-400">
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 3 — stats sidebar */}
        <div className="border-l-2 border-gray-900 pl-4" style={{ fontFamily: 'Inter, sans-serif' }}>
          <p className="text-[9px] uppercase tracking-[0.25em] text-gray-500 mb-3 font-bold">Faktencheck</p>
          <KeyFactsTable config={config} project={project} compact />
        </div>
      </div>

      {/* Gallery strip */}
      {galleryPhotos.length > 0 && (
        <div className="grid grid-cols-6 gap-0 px-12 pb-3">
          {galleryPhotos.slice(0, 6).map(p => (
            <div key={p.id} className="h-[60px] overflow-hidden">
              <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* GEG & Footer */}
      <div className="px-12 pb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
        <EnergyDisclosure config={config} compact />
        <div className="mt-3 pt-3 border-t-2 border-gray-900 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-gray-900">{config.contactName}</p>
            <p className="text-[9px] text-gray-500">{config.contactPhone} · {config.contactEmail}</p>
          </div>
          <div className="text-[9px] tracking-[0.3em] uppercase text-gray-400">ImmoFreak Magazine</div>
        </div>
      </div>
    </div>
  );
}

// ==================== TEMPLATE: LUXURY ====================
function LuxuryTemplate({ config, project, heroPhoto, galleryPhotos }: {
  config: ExposeConfig; project: any; heroPhoto: string | null; galleryPhotos: Photo[];
}) {
  const GOLD = '#c9a866';
  return (
    <div className="w-full h-full flex flex-col bg-neutral-950 text-white relative overflow-hidden" style={{ fontFamily: 'Georgia, serif' }}>
      {/* Decorative corner lines */}
      <div className="absolute top-6 left-6 w-10 h-10 border-l border-t" style={{ borderColor: GOLD }} />
      <div className="absolute top-6 right-6 w-10 h-10 border-r border-t" style={{ borderColor: GOLD }} />
      <div className="absolute bottom-6 left-6 w-10 h-10 border-l border-b" style={{ borderColor: GOLD }} />
      <div className="absolute bottom-6 right-6 w-10 h-10 border-r border-b" style={{ borderColor: GOLD }} />

      {/* Header */}
      <div className="px-14 pt-10 pb-4 text-center">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="h-px w-8" style={{ backgroundColor: GOLD }} />
          <span className="text-[9px] tracking-[0.45em] uppercase" style={{ color: GOLD, fontFamily: 'Inter, sans-serif' }}>
            Exclusive Property
          </span>
          <div className="h-px w-8" style={{ backgroundColor: GOLD }} />
        </div>
        <h1 className="text-[32px] italic leading-tight max-w-[620px] mx-auto">{config.headline || project.name}</h1>
        <p className="text-[11px] text-neutral-400 mt-2 flex items-center justify-center gap-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
          <MapPin size={12} /> {config.location}
        </p>
      </div>

      {/* Hero */}
      <div className="mx-14 h-[280px] relative overflow-hidden">
        {heroPhoto ? (
          <img src={heroPhoto} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
            <ImageIcon size={48} className="text-neutral-700" />
          </div>
        )}
        <div className="absolute inset-0 ring-1 ring-inset" style={{ boxShadow: `inset 0 0 0 1px ${GOLD}40` }} />
      </div>

      {/* Stats row */}
      <div className="px-14 py-5 grid grid-cols-4 gap-4" style={{ fontFamily: 'Inter, sans-serif' }}>
        {config.showPrice && <LuxStat label="Kaufpreis" value={formatCurrency(project.targetSellPrice)} gold={GOLD} />}
        {config.area && <LuxStat label="Wohnfläche" value={`${config.area} m²`} gold={GOLD} />}
        {config.rooms && <LuxStat label="Zimmer" value={config.rooms} gold={GOLD} />}
        {config.bathrooms && <LuxStat label="Bäder" value={config.bathrooms} gold={GOLD} />}
      </div>

      {/* Content */}
      <div className="flex-1 px-14 grid grid-cols-[1fr_220px] gap-6">
        <div>
          <p className="text-[9px] tracking-[0.4em] uppercase mb-2" style={{ color: GOLD, fontFamily: 'Inter, sans-serif' }}>
            — Residence
          </p>
          <p className="text-[11px] leading-[1.75] text-neutral-300 italic mb-4">{config.description}</p>

          <p className="text-[9px] tracking-[0.4em] uppercase mb-2" style={{ color: GOLD, fontFamily: 'Inter, sans-serif' }}>
            — Location
          </p>
          <p className="text-[11px] leading-[1.75] text-neutral-300 italic mb-4">{config.locationDescription}</p>

          {config.features.length > 0 && (
            <>
              <p className="text-[9px] tracking-[0.4em] uppercase mb-2" style={{ color: GOLD, fontFamily: 'Inter, sans-serif' }}>
                — Features
              </p>
              <div className="grid grid-cols-2 gap-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                {config.features.slice(0, 10).map(f => (
                  <div key={f} className="text-[10px] text-neutral-300 flex items-center gap-2">
                    <span style={{ color: GOLD }}>◆</span>{f}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Details Sidebar */}
        <div className="border border-neutral-800 p-4 bg-neutral-900/50" style={{ fontFamily: 'Inter, sans-serif' }}>
          <p className="text-[9px] tracking-[0.4em] uppercase mb-3" style={{ color: GOLD }}>Details</p>
          <div className="space-y-1">
            {[
              { label: 'Objektart', value: config.objectType },
              { label: 'Zustand', value: config.condition },
              { label: 'Ausstattung', value: config.equipment },
              { label: 'Baujahr', value: config.yearBuilt },
              { label: 'Modernisiert', value: config.modernizationYear },
              { label: 'Heizung', value: config.heatingType },
              { label: 'Energieklasse', value: config.energyClass },
              { label: 'Verfügbar', value: config.availableFrom },
              { label: 'Hausgeld', value: config.hoaFee },
              { label: 'Provision', value: getCommissionLabel(config) },
            ].filter(d => d.value).map(d => (
              <div key={d.label} className="flex justify-between text-[9.5px] border-b border-neutral-800 pb-1">
                <span className="text-neutral-500">{d.label}</span>
                <span className="text-neutral-200 text-right ml-2 truncate">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gallery */}
      {galleryPhotos.length > 0 && (
        <div className="grid grid-cols-4 gap-1 px-14 py-4">
          {galleryPhotos.slice(0, 4).map(p => (
            <div key={p.id} className="h-[70px] overflow-hidden">
              <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* GEG + Footer */}
      <div className="px-14 pb-8" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="border border-neutral-800 bg-neutral-900/40 p-3 mb-3">
          <p className="text-[9px] tracking-[0.3em] uppercase mb-1.5" style={{ color: GOLD }}>Energieausweis</p>
          {config.energyCertExempt ? (
            <p className="text-[9px] text-neutral-400">Befreit nach § 79 Abs. 4 GEG (z.B. Baudenkmal).</p>
          ) : (
            <p className="text-[9px] text-neutral-400">
              {config.energyCertificateType === 'bedarf' ? 'Bedarfsausweis' : config.energyCertificateType === 'verbrauch' ? 'Verbrauchsausweis' : '—'} ·{' '}
              {config.energyValue ? `${config.energyValue} kWh/(m²·a)` : '—'} · Klasse {config.energyClass || '—'} ·{' '}
              {config.energySource || '—'} · Baujahr {config.yearBuilt || '—'} · Ausstellung {config.energyCertIssueYear || '—'}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold" style={{ color: GOLD }}>{config.contactName}</p>
            <p className="text-[9px] text-neutral-400">{config.contactPhone} · {config.contactEmail}</p>
          </div>
          <div className="text-[9px] tracking-[0.35em] uppercase text-neutral-600">ImmoFreak · Luxury</div>
        </div>
      </div>
    </div>
  );
}

function LuxStat({ label, value, gold }: { label: string; value: string; gold: string }) {
  return (
    <div className="text-center border border-neutral-800 py-3 bg-neutral-900/40">
      <p className="text-[9px] tracking-[0.35em] uppercase mb-1" style={{ color: gold }}>{label}</p>
      <p className="text-[15px] font-semibold text-white">{value}</p>
    </div>
  );
}

// ==================== TEMPLATE: PORTFOLIO ====================
function PortfolioTemplate({ config, project, heroPhoto, galleryPhotos }: {
  config: ExposeConfig; project: any; heroPhoto: string | null; galleryPhotos: Photo[];
}) {
  return (
    <div className="w-full h-full flex flex-col bg-white" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Top bar */}
      <div className="px-8 pt-6 pb-3 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.primaryColor }} />
          <span className="text-[10px] tracking-[0.3em] uppercase font-bold text-gray-900">Portfolio</span>
          <span className="text-[10px] text-gray-400">· {config.objectType}</span>
        </div>
        <div className="text-[10px] text-gray-500">{new Date().toLocaleDateString('de-DE')}</div>
      </div>

      {/* Split hero: big photo + title panel */}
      <div className="grid grid-cols-[1.2fr_1fr] h-[300px]">
        <div className="overflow-hidden">
          {heroPhoto ? (
            <img src={heroPhoto} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <ImageIcon size={48} className="text-gray-300" />
            </div>
          )}
        </div>
        <div className="p-8 flex flex-col justify-center" style={{ backgroundColor: config.primaryColor + '10' }}>
          <div className="text-[10px] uppercase tracking-[0.3em] font-bold mb-3" style={{ color: config.primaryColor }}>
            {config.condition}
          </div>
          <h1 className="text-[24px] font-bold leading-tight text-gray-900 mb-2">{config.headline || project.name}</h1>
          <p className="text-[11px] text-gray-500 flex items-center gap-1.5 mb-4">
            <MapPin size={11} /> {config.location}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {config.showPrice && <PortfolioStat label="Preis" value={formatCurrency(project.targetSellPrice)} color={config.primaryColor} />}
            {config.area && <PortfolioStat label="Fläche" value={`${config.area} m²`} />}
            {config.rooms && <PortfolioStat label="Zimmer" value={config.rooms} />}
            {config.bathrooms && <PortfolioStat label="Bäder" value={config.bathrooms} />}
          </div>
        </div>
      </div>

      {/* Gallery grid — hero of this template */}
      {galleryPhotos.length > 0 && (
        <div className="grid grid-cols-4 gap-1 h-[200px]">
          {galleryPhotos.slice(0, 8).map(p => (
            <div key={p.id} className="overflow-hidden">
              <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Content strip */}
      <div className="flex-1 px-8 py-5 grid grid-cols-[1fr_1fr_240px] gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText size={11} style={{ color: config.primaryColor }} />
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-900">Objekt</p>
          </div>
          <p className="text-[10.5px] leading-[1.7] text-gray-600">{config.description}</p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={11} style={{ color: config.primaryColor }} />
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-900">Lage</p>
          </div>
          <p className="text-[10.5px] leading-[1.7] text-gray-600">{config.locationDescription}</p>
          {config.features.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {config.features.slice(0, 8).map(f => (
                <span key={f} className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: config.primaryColor + '15', color: config.primaryColor }}>
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="border-l border-gray-200 pl-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers size={11} style={{ color: config.primaryColor }} />
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-900">Daten</p>
          </div>
          <KeyFactsTable config={config} project={project} compact />
        </div>
      </div>

      {/* GEG */}
      <div className="px-8 pb-3">
        <EnergyDisclosure config={config} compact />
      </div>

      {/* Footer */}
      <div className="px-8 pb-5 pt-3 border-t border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-gray-900">{config.contactName}</p>
          <p className="text-[9px] text-gray-500">{config.contactPhone} · {config.contactEmail}</p>
        </div>
        <div className="text-[9px] tracking-[0.3em] uppercase text-gray-300">ImmoFreak · Portfolio</div>
      </div>
    </div>
  );
}

function PortfolioStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-[15px] font-bold" style={{ color: color || '#111827' }}>{value}</p>
    </div>
  );
}

// ==================== ENERGY DISCLOSURE (GEG § 87) ====================
function EnergyDisclosure({ config, compact }: { config: ExposeConfig; compact?: boolean }) {
  if (config.energyCertExempt) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-gray-50 ${compact ? 'p-2.5' : 'p-3'}`}>
        <p className={`font-bold text-gray-900 ${compact ? 'text-[10px]' : 'text-[11px]'} mb-1`}>Energieausweis</p>
        <p className={`text-gray-600 ${compact ? 'text-[9px]' : 'text-[10px]'} leading-relaxed`}>
          Das Gebäude ist gemäß § 79 Abs. 4 GEG von der Pflicht zur Erstellung eines Energieausweises befreit (z. B. als Baudenkmal).
        </p>
      </div>
    );
  }

  const certLabel = config.energyCertificateType === 'bedarf' ? 'Bedarfsausweis' :
                    config.energyCertificateType === 'verbrauch' ? 'Verbrauchsausweis' : '—';
  const valueLabel = config.energyCertificateType === 'bedarf' ? 'Endenergiebedarf' : 'Endenergieverbrauch';

  return (
    <div className={`rounded-lg border border-gray-200 bg-gray-50 ${compact ? 'p-2.5' : 'p-3'}`}>
      <p className={`font-bold text-gray-900 ${compact ? 'text-[10px]' : 'text-[11px]'} mb-1.5 uppercase tracking-wider`}>
        Energieausweis (§ 87 GEG)
      </p>
      <div className={`${compact ? 'space-y-0.5' : 'grid grid-cols-2 gap-x-4 gap-y-0.5'}`}>
        {[
          { label: 'Ausweisart', value: certLabel },
          { label: valueLabel, value: config.energyValue ? `${config.energyValue} kWh/(m²·a)` : '—' },
          { label: 'Energieklasse', value: config.energyClass || '—' },
          { label: 'Energieträger', value: config.energySource || '—' },
          { label: 'Baujahr', value: config.yearBuilt || '—' },
          { label: 'Ausstellung', value: config.energyCertIssueYear || '—' },
        ].map(d => (
          <div key={d.label} className={`flex justify-between ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
            <span className="text-gray-500">{d.label}</span>
            <span className="font-medium text-gray-900">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
