import { useState } from 'react';
import {
  User, Palette, Database, Info,
  Download, Upload, Trash2, Check, Building2, Landmark, Home, Zap, Wrench, LayoutDashboard,
  KeyRound, Eye, EyeOff, Lock, AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { NumberInput } from '../ui/NumberInput';
import { useAppMode } from '../../context/AppModeContext';
import { useLandlordSettings } from '../../hooks/useLandlordSettings';
import type { AppMode } from '../../types';
import {
  BUNDESLAENDER,
  DEFAULT_BUNDESLAND_CODE,
  DEFAULT_NOTAR_PCT,
  DEFAULT_MAKLER_PCT,
  getBundeslandByCode,
} from '../../lib/bundesland';

function Section({ title, description, icon: Icon, children }: {
  title: string;
  description: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-card-divider flex items-center gap-3">
        <div className="size-9 rounded-[9px] bg-[#4F6BFF]/10 flex items-center justify-center shrink-0">
          <Icon size={16} className="text-[#4F6BFF]" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-semibold text-foreground tracking-tight">{title}</h2>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}

type Tab = 'allgemein' | 'buyhold' | 'fixflip' | 'daten';

export function SettingsPage() {
  const { mode } = useAppMode();
  const { settings: landlord, save: saveLandlord } = useLandlordSettings();

  const [tab, setTab] = useState<Tab>(mode === 'fixflip' ? 'fixflip' : 'buyhold');

  // Profil-Name: Abwärtskompat zu `immofreak_profile_name` (Full-Name).
  // Falls Vor-/Nachname separat gespeichert sind → nutzen, sonst aus Full-Name
  // splitten (erstes Wort = Vorname, Rest = Nachname) und beim Speichern beide
  // Keys schreiben. So bleibt `useAuth().userName` + AuthContext unverändert
  // funktionsfähig.
  const [profileFirstName, setProfileFirstName] = useState(() => {
    const stored = localStorage.getItem('immofreak_profile_firstname');
    if (stored !== null) return stored;
    const full = localStorage.getItem('immofreak_profile_name') || 'Yan';
    return full.split(' ')[0] || 'Yan';
  });
  const [profileLastName, setProfileLastName] = useState(() => {
    const stored = localStorage.getItem('immofreak_profile_lastname');
    if (stored !== null) return stored;
    const full = localStorage.getItem('immofreak_profile_name') || '';
    return full.split(' ').slice(1).join(' ');
  });
  // E-Mail ist nach Registrierung gelockt — nur anzeigen, nicht editieren.
  const profileEmail = localStorage.getItem('immofreak_profile_email') || 'yan@immofreak.de';
  const [profileSaved, setProfileSaved] = useState(false);

  // Passwort-Änderung (localStorage-Demo; im echten Backend → API-Call).
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState(false);
  const [showPwCurrent, setShowPwCurrent] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);

  const [exportDone, setExportDone] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // Standard-Dashboard: welche Ansicht beim Start / nach Tour-Ende geladen wird.
  // Default `buyhold`, da die Mehrheit der Nutzer Vermieter sind.
  const [defaultDashboard, setDefaultDashboard] = useState<AppMode>(() => {
    const saved = localStorage.getItem('immofreak_default_dashboard');
    return saved === 'fixflip' ? 'fixflip' : 'buyhold';
  });
  const [defaultDashboardSaved, setDefaultDashboardSaved] = useState(false);
  const handleSelectDefaultDashboard = (next: AppMode) => {
    setDefaultDashboard(next);
    localStorage.setItem('immofreak_default_dashboard', next);
    setDefaultDashboardSaved(true);
    setTimeout(() => setDefaultDashboardSaved(false), 1500);
  };

  // Landlord form state (committed on Save)
  const [landlordDraft, setLandlordDraft] = useState(landlord);
  const [landlordSaved, setLandlordSaved] = useState(false);

  // Fix & Flip settings. Bundesland ist die "Master"-Quelle für die GrESt —
  // wechselt der Nutzer das Bundesland, wird der GrESt-Wert automatisch
  // übernommen. Nutzer können den Satz danach trotzdem manuell überschreiben
  // (z. B. für Sonderfälle wie ermäßigte Familien-Sätze).
  const [ffBundesland, setFfBundesland] = useState<string>(() =>
    localStorage.getItem('immofreak_ff_bundesland') || DEFAULT_BUNDESLAND_CODE
  );
  const [ffDefaultPurchaseTax, setFfDefaultPurchaseTax] = useState(() => {
    const stored = localStorage.getItem('immofreak_ff_purchase_tax');
    if (stored !== null) return Number(stored);
    const bl = getBundeslandByCode(localStorage.getItem('immofreak_ff_bundesland') || DEFAULT_BUNDESLAND_CODE);
    return bl?.grunderwerbsteuer ?? 6;
  });
  const [ffDefaultNotarFee, setFfDefaultNotarFee] = useState(() =>
    Number(localStorage.getItem('immofreak_ff_notar_fee') ?? DEFAULT_NOTAR_PCT)
  );
  const [ffDefaultBrokerFee, setFfDefaultBrokerFee] = useState(() =>
    Number(localStorage.getItem('immofreak_ff_broker_fee') ?? DEFAULT_MAKLER_PCT)
  );
  const [ffSaved, setFfSaved] = useState(false);

  // Kombinierte Kaufnebenkosten (live, unabhängig vom Save-State).
  const ffTotalPct = ffDefaultPurchaseTax + ffDefaultNotarFee + ffDefaultBrokerFee;

  const handleSelectBundesland = (code: string) => {
    const bl = getBundeslandByCode(code);
    if (!bl) return;
    setFfBundesland(code);
    // GrESt automatisch an das Bundesland angleichen — das ist der Kernpunkt
    // der Feature-Anfrage: "z. B. Hessen insgesamt 8%".
    setFfDefaultPurchaseTax(bl.grunderwerbsteuer);
  };

  const handleSaveProfile = () => {
    const fullName = `${profileFirstName} ${profileLastName}`.trim();
    localStorage.setItem('immofreak_profile_firstname', profileFirstName);
    localStorage.setItem('immofreak_profile_lastname', profileLastName);
    // Kombinierter Name bleibt für Abwärtskompat (AuthContext, Avatar-Fallbacks).
    localStorage.setItem('immofreak_profile_name', fullName);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleSavePassword = () => {
    setPwError('');
    // Demo-Modus: Default-Passwort ist „demo" (siehe LoginPage.tsx). Nach
    // erstem Change liegt das neue Passwort unter `immofreak_password`.
    const stored = localStorage.getItem('immofreak_password') || 'demo';
    if (!pwCurrent) {
      setPwError('Bitte aktuelles Passwort eingeben.');
      return;
    }
    if (pwCurrent !== stored) {
      setPwError('Aktuelles Passwort ist nicht korrekt.');
      return;
    }
    if (pwNew.length < 6) {
      setPwError('Neues Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError('Neues Passwort und Bestätigung stimmen nicht überein.');
      return;
    }
    localStorage.setItem('immofreak_password', pwNew);
    setPwCurrent('');
    setPwNew('');
    setPwConfirm('');
    setPwSaved(true);
    setTimeout(() => setPwSaved(false), 2500);
  };

  const handleSaveLandlord = () => {
    saveLandlord(landlordDraft);
    setLandlordSaved(true);
    setTimeout(() => setLandlordSaved(false), 2000);
  };

  const handleSaveFF = () => {
    localStorage.setItem('immofreak_ff_bundesland', ffBundesland);
    localStorage.setItem('immofreak_ff_purchase_tax', String(ffDefaultPurchaseTax));
    localStorage.setItem('immofreak_ff_notar_fee', String(ffDefaultNotarFee));
    localStorage.setItem('immofreak_ff_broker_fee', String(ffDefaultBrokerFee));
    setFfSaved(true);
    setTimeout(() => setFfSaved(false), 2000);
  };

  const handleExport = () => {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('immofreak_')) {
        try { data[key] = JSON.parse(localStorage.getItem(key)!); }
        catch { data[key] = localStorage.getItem(key); }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `immofreak-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2000);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('immofreak_')) {
              localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            }
          }
          window.location.reload();
        } catch {
          alert('Ungültige Datei. Bitte eine gültige ImmoFreak-Backup-Datei auswählen.');
        }
      };
      reader.onerror = () => {
        console.error('Import-Datei konnte nicht gelesen werden', reader.error);
        alert('Datei konnte nicht gelesen werden. Bitte erneut versuchen.');
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleReset = () => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('immofreak_')) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
    window.location.href = '/';
  };

  const dataStats = (() => {
    let totalSize = 0;
    let storeCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('immofreak_')) {
        const val = localStorage.getItem(key) || '';
        totalSize += val.length * 2;
        try {
          const arr = JSON.parse(val);
          if (Array.isArray(arr)) storeCount += arr.length;
        } catch { /* not an array */ }
      }
    }
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    return { storeCount, sizeMB };
  })();

  const TABS: { id: Tab; label: string; icon: typeof User; modeOnly?: 'fixflip' | 'buyhold' }[] = [
    { id: 'allgemein', label: 'Allgemein', icon: User },
    { id: 'buyhold', label: 'Buy & Hold', icon: Home, modeOnly: 'buyhold' },
    { id: 'fixflip', label: 'Fix & Flip', icon: Zap, modeOnly: 'fixflip' },
    { id: 'daten', label: 'Daten', icon: Database },
  ];

  return (
    <div className="page-container">
      {/* Header card matching the rest of the app */}
      <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden mb-4 sm:mb-5">
        <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-card-divider">
          <h1 className="text-[24px] sm:text-[26px] font-bold text-foreground tracking-tight leading-tight mb-1">
            Einstellungen
          </h1>
          <p className="text-[13px] text-muted-foreground max-w-2xl leading-relaxed">
            Profil, {mode === 'buyhold' ? 'Vermieterdaten' : 'Kalkulations-Defaults'} und Datenverwaltung — alle Einstellungen pro Modus.
          </p>
        </div>

        {/* Underline tabs */}
        <div className="px-5 sm:px-7 py-3 flex items-center gap-3 sm:gap-4 flex-wrap overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'group relative inline-flex items-center gap-1.5 pb-2 -mb-3 text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap',
                  isActive ? 'text-[#4F6BFF]' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon size={14} className="shrink-0" />
                {t.label}
                {isActive && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#4F6BFF]" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 sm:space-y-5">

        {tab === 'allgemein' && (
          <>
            <Section title="Profil" description="Deine persönlichen Informationen" icon={User}>
              <div className="space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b border-card-divider">
                  <div className="size-14 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0">
                    <span className="text-xl font-bold text-white">{(profileFirstName.charAt(0) || '?').toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{`${profileFirstName} ${profileLastName}`.trim() || 'Unbenannt'}</p>
                    <p className="text-xs text-muted-foreground">{profileEmail}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Vorname</label>
                    <input value={profileFirstName} onChange={e => setProfileFirstName(e.target.value)} className="input" placeholder="z. B. Max" />
                  </div>
                  <div>
                    <label className="input-label">Nachname</label>
                    <input value={profileLastName} onChange={e => setProfileLastName(e.target.value)} className="input" placeholder="z. B. Mustermann" />
                  </div>
                </div>
                <div>
                  <label className="input-label flex items-center gap-1.5">
                    E-Mail
                    <Lock size={11} className="text-muted-foreground" />
                  </label>
                  <input value={profileEmail} disabled readOnly className="input opacity-60 cursor-not-allowed" type="email" />
                  <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                    <AlertCircle size={11} />
                    Die E-Mail-Adresse kann nach der Registrierung nicht mehr geändert werden.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button onClick={handleSaveProfile} className={cn('btn btn-md', profileSaved ? 'btn-primary' : 'btn-secondary')}>
                    {profileSaved ? <><Check size={14} /> Gespeichert</> : 'Speichern'}
                  </button>
                </div>
              </div>
            </Section>

            <Section title="Passwort ändern" description="Setze ein neues Passwort für deinen Account" icon={KeyRound}>
              <div className="space-y-4">
                <div>
                  <label className="input-label">Aktuelles Passwort</label>
                  <div className="relative">
                    <input
                      type={showPwCurrent ? 'text' : 'password'}
                      value={pwCurrent}
                      onChange={e => { setPwCurrent(e.target.value); setPwError(''); }}
                      className="input w-full pr-10"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwCurrent(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      aria-label={showPwCurrent ? 'Passwort verbergen' : 'Passwort anzeigen'}
                    >
                      {showPwCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Neues Passwort</label>
                    <div className="relative">
                      <input
                        type={showPwNew ? 'text' : 'password'}
                        value={pwNew}
                        onChange={e => { setPwNew(e.target.value); setPwError(''); }}
                        className="input w-full pr-10"
                        placeholder="Mindestens 6 Zeichen"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwNew(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        aria-label={showPwNew ? 'Passwort verbergen' : 'Passwort anzeigen'}
                      >
                        {showPwNew ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="input-label">Neues Passwort bestätigen</label>
                    <input
                      type={showPwNew ? 'text' : 'password'}
                      value={pwConfirm}
                      onChange={e => { setPwConfirm(e.target.value); setPwError(''); }}
                      className="input w-full"
                      placeholder="Passwort wiederholen"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                {pwError && (
                  <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <AlertCircle size={12} />
                      {pwError}
                    </p>
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={handleSavePassword} className={cn('btn btn-md', pwSaved ? 'btn-primary' : 'btn-secondary')}>
                    {pwSaved ? <><Check size={14} /> Passwort geändert</> : 'Passwort ändern'}
                  </button>
                </div>
              </div>
            </Section>

            <Section title="Standard-Dashboard" description="Welche Ansicht beim Start und nach der Tour geladen wird" icon={LayoutDashboard}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'buyhold' as const, label: 'Buy & Hold', desc: 'Vermietung, Mieter & Nebenkosten', icon: Home, accent: 'emerald' },
                  { id: 'fixflip' as const, label: 'Fix & Flip', desc: 'Projekte, Handwerker & Kalkulation', icon: Zap, accent: 'amber' },
                ].map((opt) => {
                  const active = defaultDashboard === opt.id;
                  const OptIcon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectDefaultDashboard(opt.id)}
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-xl border text-left transition-colors cursor-pointer',
                        active
                          ? 'border-[#4F6BFF] bg-[#4F6BFF]/5 ring-1 ring-[#4F6BFF]/20'
                          : 'border-card-divider hover:bg-muted/40'
                      )}
                    >
                      <div
                        className={cn(
                          'size-9 rounded-lg flex items-center justify-center shrink-0',
                          opt.accent === 'emerald' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                        )}
                      >
                        <OptIcon size={16} className={opt.accent === 'emerald' ? 'text-emerald-600' : 'text-amber-600'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                          {active && <Check size={14} className="text-[#4F6BFF]" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {defaultDashboardSaved && (
                <p className="text-xs text-emerald-600 mt-3 flex items-center gap-1.5">
                  <Check size={12} /> Gespeichert
                </p>
              )}
            </Section>

            <Section title="Darstellung" description="Theme und Anzeigeoptionen" icon={Palette}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Währung</label>
                  <input value="EUR" disabled className="input opacity-60" />
                </div>
                <div>
                  <label className="input-label">Sprache</label>
                  <input value="Deutsch" disabled className="input opacity-60" />
                </div>
              </div>
            </Section>

            <Section title="Über ImmoFreak" description="Version und Info" icon={Info}>
              <div className="flex items-center gap-4">
                <img src="/logo.png" alt="ImmoFreak" className="h-8 object-contain" />
                <div>
                  <p className="text-sm font-semibold text-foreground">ImmoFreak CRM</p>
                  <p className="text-xs text-muted-foreground">Version 1.0.0 · Made with ♥ in Germany</p>
                </div>
              </div>
            </Section>
          </>
        )}

        {tab === 'buyhold' && (
          <>
            <Section title="Vermieter / Absender" description="Daten für Mieter-Schreiben, Mahnungen und Kautionsabrechnung" icon={Building2}>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Firma / Hausverwaltung</label>
                    <input value={landlordDraft.companyName} onChange={e => setLandlordDraft({ ...landlordDraft, companyName: e.target.value })} className="input" placeholder="z. B. Musterverwaltung GmbH" />
                  </div>
                  <div>
                    <label className="input-label">Ansprechpartner</label>
                    <input value={landlordDraft.contactName} onChange={e => setLandlordDraft({ ...landlordDraft, contactName: e.target.value })} className="input" placeholder="z. B. Max Mustermann" />
                  </div>
                </div>
                <div>
                  <label className="input-label">Straße und Hausnummer</label>
                  <input value={landlordDraft.street} onChange={e => setLandlordDraft({ ...landlordDraft, street: e.target.value })} className="input" placeholder="z. B. Musterstr. 1" />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-3">
                  <div>
                    <label className="input-label">PLZ</label>
                    <input value={landlordDraft.zip} onChange={e => setLandlordDraft({ ...landlordDraft, zip: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="input-label">Ort</label>
                    <input value={landlordDraft.city} onChange={e => setLandlordDraft({ ...landlordDraft, city: e.target.value })} className="input" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="input-label">Telefon</label>
                    <input value={landlordDraft.phone} onChange={e => setLandlordDraft({ ...landlordDraft, phone: e.target.value })} className="input" placeholder="+49 ..." />
                  </div>
                  <div>
                    <label className="input-label">E-Mail</label>
                    <input value={landlordDraft.email} onChange={e => setLandlordDraft({ ...landlordDraft, email: e.target.value })} className="input" type="email" />
                  </div>
                  <div>
                    <label className="input-label">Steuernummer / USt-ID</label>
                    <input value={landlordDraft.taxId} onChange={e => setLandlordDraft({ ...landlordDraft, taxId: e.target.value })} className="input" placeholder="optional" />
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Bankverbindung" description="Wird in Mahnungen, Kautionsabrechnung und Nebenkosten-Nachforderungen verwendet" icon={Landmark}>
              <div className="space-y-4">
                <div>
                  <label className="input-label">IBAN <span className="text-red-500">*</span></label>
                  <input value={landlordDraft.iban} onChange={e => setLandlordDraft({ ...landlordDraft, iban: e.target.value })} className="input font-mono" placeholder="DE00 0000 0000 0000 0000 00" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">BIC</label>
                    <input value={landlordDraft.bic} onChange={e => setLandlordDraft({ ...landlordDraft, bic: e.target.value })} className="input font-mono" placeholder="z. B. DEUTDEFFXXX" />
                  </div>
                  <div>
                    <label className="input-label">Bankname</label>
                    <input value={landlordDraft.bankName} onChange={e => setLandlordDraft({ ...landlordDraft, bankName: e.target.value })} className="input" placeholder="z. B. Deutsche Bank" />
                  </div>
                </div>
                <div>
                  <label className="input-label">Standard-Verwendungszweck</label>
                  <input value={landlordDraft.defaultPaymentPurpose} onChange={e => setLandlordDraft({ ...landlordDraft, defaultPaymentPurpose: e.target.value })} className="input" placeholder="z. B. Miete + Mieternummer" />
                </div>
              </div>
            </Section>

            <Section title="Unterschrift" description="Name der/die unter Schreiben erscheint" icon={User}>
              <div>
                <label className="input-label">Unterzeichnende Person / Firma</label>
                <input value={landlordDraft.signatureName} onChange={e => setLandlordDraft({ ...landlordDraft, signatureName: e.target.value })} className="input" placeholder="z. B. Max Mustermann — Vermieter" />
              </div>
            </Section>

            <div className="flex justify-end">
              <button onClick={handleSaveLandlord} className={cn('btn btn-md', landlordSaved ? 'btn-primary' : 'btn-secondary')}>
                {landlordSaved ? <><Check size={14} /> Gespeichert</> : 'Vermieterdaten speichern'}
              </button>
            </div>
          </>
        )}

        {tab === 'fixflip' && (
          <>
            <Section title="Kaufnebenkosten — Defaults" description="Werden automatisch im Kalkulator und Deal Analyzer vorbelegt" icon={Wrench}>
              <div className="space-y-5">
                {/* Bundesland-Auswahl: Master-Quelle für GrESt */}
                <div>
                  <label className="input-label">Bundesland</label>
                  <select
                    value={ffBundesland}
                    onChange={(e) => handleSelectBundesland(e.target.value)}
                    className="input"
                  >
                    {BUNDESLAENDER.map((bl) => (
                      <option key={bl.code} value={bl.code}>
                        {bl.name} — {bl.grunderwerbsteuer.toLocaleString('de-DE', { minimumFractionDigits: 1 })} % GrESt
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Grunderwerbsteuer wird automatisch übernommen. Notar- und Makler-Sätze bleiben unverändert.
                  </p>
                </div>

                {/* Live Gesamt-Übersicht */}
                <div className="p-4 rounded-xl border border-[#4F6BFF]/20 bg-[#4F6BFF]/5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Kaufnebenkosten gesamt</p>
                      <p className="text-xs text-muted-foreground-2 mt-0.5">
                        {getBundeslandByCode(ffBundesland)?.name ?? 'Unbekannt'}: GrESt {ffDefaultPurchaseTax.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} % + Notar {ffDefaultNotarFee.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} % + Makler {ffDefaultBrokerFee.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %
                      </p>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-[#4F6BFF]">
                      {ffTotalPct.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}&nbsp;%
                    </p>
                  </div>
                </div>

                {/* Einzelsätze — weiterhin manuell überschreibbar (z. B. für Sonderfälle) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="input-label">Grunderwerbsteuer</label>
                    <NumberInput value={ffDefaultPurchaseTax} onChange={(v) => setFfDefaultPurchaseTax(v === '' ? 0 : v)} suffix="%" decimals={2} className="input" />
                    <p className="text-[10px] text-muted-foreground mt-1">Aus Bundesland übernommen</p>
                  </div>
                  <div>
                    <label className="input-label">Notar &amp; Grundbuch</label>
                    <NumberInput value={ffDefaultNotarFee} onChange={(v) => setFfDefaultNotarFee(v === '' ? 0 : v)} suffix="%" decimals={2} className="input" />
                    <p className="text-[10px] text-muted-foreground mt-1">Üblich: 1,5–2,0 %</p>
                  </div>
                  <div>
                    <label className="input-label">Makler (inkl. USt)</label>
                    <NumberInput value={ffDefaultBrokerFee} onChange={(v) => setFfDefaultBrokerFee(v === '' ? 0 : v)} suffix="%" decimals={2} className="input" />
                    <p className="text-[10px] text-muted-foreground mt-1">Bestellerprinzip seit 2020</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={handleSaveFF} className={cn('btn btn-md', ffSaved ? 'btn-primary' : 'btn-secondary')}>
                    {ffSaved ? <><Check size={14} /> Gespeichert</> : 'Speichern'}
                  </button>
                </div>
              </div>
            </Section>

            <Section title="Über Fix & Flip" description="Modus-spezifische Info" icon={Zap}>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Im Fix &amp; Flip Modus verwaltest du Projekte mit Sanierungsbudget, Handwerkern und Verkaufskalkulation. Kalkulator und Deal Analyzer nutzen die oben gesetzten Defaults als Ausgangsbasis.
              </p>
            </Section>
          </>
        )}

        {tab === 'daten' && (
          <Section title="Daten" description="Backup, Import und Speicher verwalten" icon={Database}>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 border border-card-divider">
                <div className="size-10 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center shrink-0">
                  <Database size={16} className="text-[#4F6BFF]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{dataStats.storeCount} Datensätze</p>
                  <p className="text-xs text-muted-foreground">{dataStats.sizeMB} MB im lokalen Speicher</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={handleExport} className={cn('btn btn-md w-full', exportDone ? 'btn-primary' : 'btn-secondary')}>
                  {exportDone ? <><Check size={14} /> Exportiert</> : <><Download size={14} /> Daten exportieren</>}
                </button>
                <button onClick={handleImport} className="btn btn-md btn-secondary w-full">
                  <Upload size={14} /> Daten importieren
                </button>
              </div>

              <div className="pt-3 border-t border-card-divider">
                <button onClick={() => setShowReset(true)} className="btn btn-md w-full border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 size={14} /> Alle Daten löschen
                </button>
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  Alle Projekte, Objekte, Mieter und Einstellungen werden unwiderruflich gelöscht.
                </p>
              </div>
            </div>
          </Section>
        )}

      </div>

      {showReset && (
        <ConfirmDialog
          title="Alle Daten löschen"
          message="Bist du sicher? Alle Projekte, Objekte, Mieter, Transaktionen und Einstellungen werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
          onConfirm={handleReset}
          onCancel={() => setShowReset(false)}
        />
      )}
    </div>
  );
}
