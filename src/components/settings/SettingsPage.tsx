import { useState, type ReactNode } from 'react';
import {
  User, Palette, Database, Building2, Landmark, Home, Zap, Wrench,
  Download, Upload, Trash2, Check, Eye, EyeOff, Lock,
  AlertCircle, Languages, LayoutDashboard,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { NumberInput } from '../ui/NumberInput';
import { useLandlordSettings } from '../../hooks/useLandlordSettings';
import { useTranslation } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { LOCALE_FLAG, LOCALE_LABEL } from '../../i18n/translations';
import type { AppMode } from '../../types';
import {
  BUNDESLAENDER,
  DEFAULT_BUNDESLAND_CODE,
  DEFAULT_NOTAR_PCT,
  DEFAULT_MAKLER_PCT,
  getBundeslandByCode,
} from '../../lib/bundesland';

/* ────────────────────────────────────────────────────────────
   Settings page
   ──────────────────────────────────────────────────────────────
   Eine Seite, fünf klare Bereiche. Vertikales Tab-Rail auf Desktop,
   horizontale Pille-Tabs auf Mobile. Pro Bereich: schlanke Sektionen
   ohne verschachtelte Karten, simpler Bottom-Save mit "Saved"-Status.
   ──────────────────────────────────────────────────────────── */

type Tab = 'account' | 'appearance' | 'landlord' | 'calc' | 'data';

const SAVED_FLASH_MS = 2000;

interface TabDef {
  id: Tab;
  label: string;
  desc: string;
  icon: typeof User;
}

export function SettingsPage() {
  const { settings: landlord, save: saveLandlord } = useLandlordSettings();
  const { t } = useTranslation();
  const { userName: authName, userEmail: authEmail, isDemo } = useAuth();
  const [tab, setTab] = useState<Tab>('account');

  // ── Profile (Quelle: AuthContext für echte User, sonst localStorage als Fallback)
  const initialFirstName =
    localStorage.getItem('immofreak_profile_firstname')
    ?? (authName.split(' ')[0] || '');
  const initialLastName =
    localStorage.getItem('immofreak_profile_lastname')
    ?? authName.split(' ').slice(1).join(' ');
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const profileEmail = authEmail || localStorage.getItem('immofreak_profile_email') || '';

  // ── Password
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [showPwCurrent, setShowPwCurrent] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);

  // ── Default dashboard
  const [defaultDashboard, setDefaultDashboard] = useState<AppMode>(() => {
    const saved = localStorage.getItem('immofreak_default_dashboard');
    return saved === 'fixflip' ? 'fixflip' : 'buyhold';
  });

  // ── Landlord (single bag of fields, saved together)
  const [landlordDraft, setLandlordDraft] = useState(landlord);
  const updateLandlord = <K extends keyof typeof landlordDraft>(k: K, v: (typeof landlordDraft)[K]) =>
    setLandlordDraft((d) => ({ ...d, [k]: v }));

  // ── Fix & Flip Defaults
  const [ffBundesland, setFfBundesland] = useState<string>(() =>
    localStorage.getItem('immofreak_ff_bundesland') || DEFAULT_BUNDESLAND_CODE,
  );
  const [ffPurchaseTax, setFfPurchaseTax] = useState(() => {
    const stored = localStorage.getItem('immofreak_ff_purchase_tax');
    if (stored !== null) return Number(stored);
    const bl = getBundeslandByCode(localStorage.getItem('immofreak_ff_bundesland') || DEFAULT_BUNDESLAND_CODE);
    return bl?.grunderwerbsteuer ?? 6;
  });
  const [ffNotarFee, setFfNotarFee] = useState(() =>
    Number(localStorage.getItem('immofreak_ff_notar_fee') ?? DEFAULT_NOTAR_PCT),
  );
  const [ffBrokerFee, setFfBrokerFee] = useState(() =>
    Number(localStorage.getItem('immofreak_ff_broker_fee') ?? DEFAULT_MAKLER_PCT),
  );

  // ── Saved-flash state per category
  const [savedFor, setSavedFor] = useState<Tab | null>(null);
  const flash = (which: Tab) => {
    setSavedFor(which);
    setTimeout(() => setSavedFor(null), SAVED_FLASH_MS);
  };

  // ── Data export/import/reset
  const [showReset, setShowReset] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  // ── Save handlers
  const handleSaveAccount = async () => {
    const fullName = `${firstName} ${lastName}`.trim();
    localStorage.setItem('immofreak_profile_firstname', firstName);
    localStorage.setItem('immofreak_profile_lastname', lastName);
    localStorage.setItem('immofreak_profile_name', fullName);

    // Für echte Supabase-User: Profil-Metadaten und ggf. Passwort dort updaten.
    if (!isDemo) {
      const updates: { data?: Record<string, unknown>; password?: string } = {
        data: { full_name: fullName },
      };
      if (pwCurrent || pwNew || pwConfirm) {
        if (!pwNew) { setPwError('Bitte neues Passwort eingeben.'); return; }
        if (pwNew.length < 8) { setPwError('Neues Passwort muss mindestens 8 Zeichen lang sein.'); return; }
        if (pwNew !== pwConfirm) { setPwError('Neues Passwort und Bestätigung stimmen nicht überein.'); return; }
        updates.password = pwNew;
      }
      const { error } = await supabase.auth.updateUser(updates);
      if (error) { setPwError(error.message); return; }
      setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwError('');
      flash('account');
      return;
    }

    // Demo: weiterhin localStorage-basiertes Passwort
    if (pwCurrent || pwNew || pwConfirm) {
      const stored = localStorage.getItem('immofreak_password') || 'demo';
      if (!pwCurrent) { setPwError('Bitte aktuelles Passwort eingeben.'); return; }
      if (pwCurrent !== stored) { setPwError('Aktuelles Passwort ist nicht korrekt.'); return; }
      if (pwNew.length < 6) { setPwError('Neues Passwort muss mindestens 6 Zeichen lang sein.'); return; }
      if (pwNew !== pwConfirm) { setPwError('Neues Passwort und Bestätigung stimmen nicht überein.'); return; }
      localStorage.setItem('immofreak_password', pwNew);
      setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwError('');
    }
    flash('account');
  };

  const handleSaveAppearance = () => {
    localStorage.setItem('immofreak_default_dashboard', defaultDashboard);
    flash('appearance');
  };

  const handleSaveLandlord = () => {
    saveLandlord(landlordDraft);
    flash('landlord');
  };

  const handleSelectBundesland = (code: string) => {
    const bl = getBundeslandByCode(code);
    if (!bl) return;
    setFfBundesland(code);
    setFfPurchaseTax(bl.grunderwerbsteuer);
  };

  const handleSaveCalc = () => {
    localStorage.setItem('immofreak_ff_bundesland', ffBundesland);
    localStorage.setItem('immofreak_ff_purchase_tax', String(ffPurchaseTax));
    localStorage.setItem('immofreak_ff_notar_fee', String(ffNotarFee));
    localStorage.setItem('immofreak_ff_broker_fee', String(ffBrokerFee));
    flash('calc');
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
    keys.forEach((k) => localStorage.removeItem(k));
    window.location.href = '/';
  };

  // Storage stats
  const dataStats = (() => {
    let totalSize = 0;
    let storeCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('immofreak_')) {
        const val = localStorage.getItem(key) || '';
        totalSize += val.length * 2;
        try { const arr = JSON.parse(val); if (Array.isArray(arr)) storeCount += arr.length; }
        catch { /* not an array */ }
      }
    }
    return { storeCount, sizeMB: (totalSize / (1024 * 1024)).toFixed(2) };
  })();

  const ffTotalPct = ffPurchaseTax + ffNotarFee + ffBrokerFee;

  const TABS: TabDef[] = [
    { id: 'account',    label: t('settings.section.profile'),     desc: 'Name, E-Mail, Passwort',         icon: User },
    { id: 'appearance', label: t('settings.section.appearance'),  desc: t('settings.section.appearance.desc'), icon: Palette },
    { id: 'landlord',   label: 'Vermieter',                       desc: 'Stammdaten & Bankverbindung',    icon: Building2 },
    { id: 'calc',       label: 'Kalkulation',                     desc: 'Kaufnebenkosten-Defaults',       icon: Wrench },
    { id: 'data',       label: 'Daten',                           desc: 'Backup, Import, Reset',          icon: Database },
  ];

  return (
    <div className="page-container max-w-5xl">
      {/* Page header */}
      <div className="mb-6 sm:mb-7 px-1">
        <h1 className="text-[26px] sm:text-[30px] font-bold text-foreground tracking-tight leading-[1.15] mb-1.5">
          {t('settings.title')}
        </h1>
        <p className="text-[14px] text-muted-foreground max-w-2xl leading-relaxed">
          Profil, Vermieterdaten und App-Defaults — alle an einem Ort.
        </p>
      </div>

      {/* Mobile pills (visible < lg) */}
      <div className="lg:hidden mb-4 -mx-4 px-4 overflow-x-auto no-scrollbar">
        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-card border border-card-line shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {TABS.map((tabDef) => {
            const isActive = tab === tabDef.id;
            const Icon = tabDef.icon;
            return (
              <button
                key={tabDef.id}
                onClick={() => setTab(tabDef.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer',
                  isActive
                    ? 'bg-[#4F6BFF] text-white shadow-[0_1px_2px_rgba(79,107,255,0.25)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-layer-hover',
                )}
              >
                <Icon size={13} strokeWidth={isActive ? 2.4 : 2} />
                {tabDef.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5 sm:gap-6">
        {/* Desktop side-rail */}
        <aside className="hidden lg:block">
          <nav className="bg-card border border-card-line rounded-2xl p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sticky top-3">
            {TABS.map((tabDef) => {
              const isActive = tab === tabDef.id;
              const Icon = tabDef.icon;
              return (
                <button
                  key={tabDef.id}
                  onClick={() => setTab(tabDef.id)}
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer',
                    isActive
                      ? 'bg-[#4F6BFF]/8 ring-1 ring-[#4F6BFF]/20'
                      : 'hover:bg-layer-hover',
                  )}
                >
                  <div className={cn(
                    'size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                    isActive ? 'bg-[#4F6BFF]/15 text-[#4F6BFF]' : 'bg-card-line/40 text-muted-foreground',
                  )}>
                    <Icon size={15} strokeWidth={isActive ? 2.4 : 2} />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className={cn(
                      'text-[13px] font-semibold leading-tight',
                      isActive ? 'text-[#4F6BFF]' : 'text-foreground',
                    )}>
                      {tabDef.label}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-tight truncate">
                      {tabDef.desc}
                    </p>
                  </div>
                </button>
              );
            })}
            <div className="px-3 pt-3 pb-1.5 mt-2 border-t border-card-divider">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="" className="h-5 object-contain shrink-0" />
                <p className="text-[10.5px] text-muted-foreground/80 leading-tight">
                  ImmoFreak v1.0.0
                </p>
              </div>
            </div>
          </nav>
        </aside>

        {/* Content card */}
        <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          {tab === 'account' && (
            <CategoryFrame
              title={t('settings.section.profile')}
              description="Deine persönlichen Informationen und das Passwort für deinen Account."
              saved={savedFor === 'account'}
              onSave={handleSaveAccount}
            >
              {/* Avatar + readonly identity */}
              <div className="flex items-center gap-4 mb-6">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-[#4F6BFF] to-[#6B5BFF] flex items-center justify-center shrink-0 ring-2 ring-white shadow-[0_2px_8px_rgba(79,107,255,0.20)]">
                  <span className="text-[19px] font-bold text-white">{(firstName.charAt(0) || '?').toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-foreground truncate">{`${firstName} ${lastName}`.trim() || 'Unbenannt'}</p>
                  <p className="text-[12.5px] text-muted-foreground truncate flex items-center gap-1">
                    <Lock size={11} /> {profileEmail}
                  </p>
                </div>
              </div>

              <SubSection title="Name">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Vorname">
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" placeholder="Max" />
                  </Field>
                  <Field label="Nachname">
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" placeholder="Mustermann" />
                  </Field>
                </div>
                <Field
                  label={<span className="inline-flex items-center gap-1.5">E-Mail <Lock size={11} className="text-muted-foreground" /></span>}
                  help="E-Mail kann nach Registrierung nicht geändert werden."
                >
                  <input value={profileEmail} disabled readOnly className="input opacity-60 cursor-not-allowed" type="email" />
                </Field>
              </SubSection>

              <SubSection title="Passwort ändern" optional>
                <Field label="Aktuelles Passwort">
                  <PasswordInput value={pwCurrent} onChange={(v) => { setPwCurrent(v); setPwError(''); }} show={showPwCurrent} onToggle={() => setShowPwCurrent((s) => !s)} placeholder="••••••••" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Neues Passwort">
                    <PasswordInput value={pwNew} onChange={(v) => { setPwNew(v); setPwError(''); }} show={showPwNew} onToggle={() => setShowPwNew((s) => !s)} placeholder="Mindestens 6 Zeichen" />
                  </Field>
                  <Field label="Wiederholen">
                    <input
                      type={showPwNew ? 'text' : 'password'}
                      value={pwConfirm}
                      onChange={(e) => { setPwConfirm(e.target.value); setPwError(''); }}
                      className="input"
                      placeholder="Passwort wiederholen"
                      autoComplete="new-password"
                    />
                  </Field>
                </div>
                {pwError && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                    <AlertCircle size={13} className="text-red-600 shrink-0 mt-0.5" />
                    <p className="text-[12.5px] text-red-700">{pwError}</p>
                  </div>
                )}
              </SubSection>
            </CategoryFrame>
          )}

          {tab === 'appearance' && (
            <CategoryFrame
              title={t('settings.section.appearance')}
              description={t('settings.section.appearance.desc')}
              saved={savedFor === 'appearance'}
              onSave={handleSaveAppearance}
            >
              {/* Language */}
              <SubSection title={<span className="inline-flex items-center gap-1.5"><Languages size={13} /> {t('settings.language.label')}</span>}>
                <div className="grid grid-cols-2 gap-3">
                  <LocaleCard locale="de" />
                  <LocaleCard locale="en" />
                </div>
                <p className="text-[12px] text-muted-foreground">{t('settings.language.help')}</p>
              </SubSection>

              {/* Default dashboard */}
              <SubSection title={<span className="inline-flex items-center gap-1.5"><LayoutDashboard size={13} /> {t('settings.defaultDashboard.label')}</span>}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: 'buyhold' as const, label: t('mode.buyhold.label'), desc: t('mode.buyhold.desc'), icon: Home, accent: 'emerald' as const },
                    { id: 'fixflip' as const, label: t('mode.fixflip.label'), desc: t('mode.fixflip.desc'), icon: Zap, accent: 'amber' as const },
                  ].map((opt) => {
                    const active = defaultDashboard === opt.id;
                    const OptIcon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDefaultDashboard(opt.id)}
                        className={cn(
                          'flex items-start gap-3 p-3.5 rounded-xl border text-left transition-colors cursor-pointer',
                          active
                            ? 'border-[#4F6BFF] bg-[#4F6BFF]/5 ring-1 ring-[#4F6BFF]/20'
                            : 'border-card-divider hover:bg-layer-hover',
                        )}
                      >
                        <div className={cn(
                          'size-9 rounded-lg flex items-center justify-center shrink-0',
                          opt.accent === 'emerald' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600',
                        )}>
                          <OptIcon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13.5px] font-semibold text-foreground">{opt.label}</p>
                            {active && <Check size={13} className="text-[#4F6BFF]" />}
                          </div>
                          <p className="text-[11.5px] text-muted-foreground mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[12px] text-muted-foreground">{t('settings.defaultDashboard.help')}</p>
              </SubSection>

              {/* Currency (read-only for now) */}
              <SubSection title="Währung">
                <Field help="Aktuell ist EUR fest hinterlegt.">
                  <input value="EUR — Euro (€)" disabled className="input opacity-60" />
                </Field>
              </SubSection>
            </CategoryFrame>
          )}

          {tab === 'landlord' && (
            <CategoryFrame
              title="Vermieter"
              description="Diese Daten werden in Mahnungen, Mietverträgen und Nebenkosten-Abrechnungen verwendet."
              saved={savedFor === 'landlord'}
              onSave={handleSaveLandlord}
            >
              <SubSection title={<span className="inline-flex items-center gap-1.5"><Building2 size={13} /> Stammdaten</span>}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Firma / Hausverwaltung">
                    <input value={landlordDraft.companyName} onChange={(e) => updateLandlord('companyName', e.target.value)} className="input" placeholder="Musterverwaltung GmbH" />
                  </Field>
                  <Field label="Ansprechpartner">
                    <input value={landlordDraft.contactName} onChange={(e) => updateLandlord('contactName', e.target.value)} className="input" placeholder="Max Mustermann" />
                  </Field>
                </div>
                <Field label="Straße und Hausnummer">
                  <input value={landlordDraft.street} onChange={(e) => updateLandlord('street', e.target.value)} className="input" placeholder="Musterstr. 1" />
                </Field>
                <div className="grid grid-cols-[100px_1fr] gap-3">
                  <Field label="PLZ">
                    <input value={landlordDraft.zip} onChange={(e) => updateLandlord('zip', e.target.value)} className="input" />
                  </Field>
                  <Field label="Ort">
                    <input value={landlordDraft.city} onChange={(e) => updateLandlord('city', e.target.value)} className="input" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Telefon">
                    <input value={landlordDraft.phone} onChange={(e) => updateLandlord('phone', e.target.value)} className="input" placeholder="+49 …" />
                  </Field>
                  <Field label="E-Mail">
                    <input value={landlordDraft.email} onChange={(e) => updateLandlord('email', e.target.value)} className="input" type="email" />
                  </Field>
                  <Field label="Steuer-Nr." help="Optional">
                    <input value={landlordDraft.taxId} onChange={(e) => updateLandlord('taxId', e.target.value)} className="input" />
                  </Field>
                </div>
              </SubSection>

              <SubSection title={<span className="inline-flex items-center gap-1.5"><Landmark size={13} /> Bankverbindung</span>}>
                <Field label={<span>IBAN <span className="text-red-500">*</span></span>}>
                  <input value={landlordDraft.iban} onChange={(e) => updateLandlord('iban', e.target.value)} className="input font-mono tracking-wide" placeholder="DE00 0000 0000 0000 0000 00" />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="BIC">
                    <input value={landlordDraft.bic} onChange={(e) => updateLandlord('bic', e.target.value)} className="input font-mono" placeholder="DEUTDEFFXXX" />
                  </Field>
                  <Field label="Bankname">
                    <input value={landlordDraft.bankName} onChange={(e) => updateLandlord('bankName', e.target.value)} className="input" placeholder="Deutsche Bank" />
                  </Field>
                </div>
                <Field label="Standard-Verwendungszweck" help="Wird auf Mahnungen und Forderungen vorgeschlagen.">
                  <input value={landlordDraft.defaultPaymentPurpose} onChange={(e) => updateLandlord('defaultPaymentPurpose', e.target.value)} className="input" placeholder="Miete + Mieternummer" />
                </Field>
              </SubSection>

              <SubSection title={<span className="inline-flex items-center gap-1.5"><User size={13} /> Unterschrift</span>}>
                <Field label="Unterzeichnende Person / Firma" help="Erscheint unten auf Schreiben und Mietverträgen.">
                  <input value={landlordDraft.signatureName} onChange={(e) => updateLandlord('signatureName', e.target.value)} className="input" placeholder="Max Mustermann — Vermieter" />
                </Field>
              </SubSection>
            </CategoryFrame>
          )}

          {tab === 'calc' && (
            <CategoryFrame
              title="Kalkulation"
              description="Kaufnebenkosten-Defaults, automatisch befüllt im Kalkulator und Deal Analyzer."
              saved={savedFor === 'calc'}
              onSave={handleSaveCalc}
            >
              <SubSection title="Bundesland">
                <Field help="Grunderwerbsteuer wird automatisch übernommen — manuelles Anpassen weiter unten möglich.">
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
                </Field>

                {/* Live total preview — minimaler Block */}
                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#4F6BFF]/6 border border-[#4F6BFF]/20">
                  <div className="min-w-0">
                    <p className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">Kaufnebenkosten gesamt</p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      {ffPurchaseTax.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} % + {ffNotarFee.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} % + {ffBrokerFee.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %
                    </p>
                  </div>
                  <p className="text-[22px] font-bold tabular-nums text-[#4F6BFF] shrink-0">
                    {ffTotalPct.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %
                  </p>
                </div>
              </SubSection>

              <SubSection title="Einzelne Sätze">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Grunderwerbsteuer" help="Aus Bundesland übernommen">
                    <NumberInput value={ffPurchaseTax} onChange={(v) => setFfPurchaseTax(v === '' ? 0 : v)} suffix="%" decimals={2} className="input" />
                  </Field>
                  <Field label="Notar & Grundbuch" help="Üblich: 1,5–2,0 %">
                    <NumberInput value={ffNotarFee} onChange={(v) => setFfNotarFee(v === '' ? 0 : v)} suffix="%" decimals={2} className="input" />
                  </Field>
                  <Field label="Makler" help="Inkl. USt — Bestellerprinzip seit 2020">
                    <NumberInput value={ffBrokerFee} onChange={(v) => setFfBrokerFee(v === '' ? 0 : v)} suffix="%" decimals={2} className="input" />
                  </Field>
                </div>
              </SubSection>
            </CategoryFrame>
          )}

          {tab === 'data' && (
            <CategoryFrame
              title="Daten"
              description="Backup deiner kompletten App-Daten als JSON-Datei. Wiederherstellen, importieren oder vollständig zurücksetzen."
              hideSave
            >
              {/* Storage stats card */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card-line/30 border border-card-divider mb-5">
                <div className="size-10 rounded-xl bg-[#4F6BFF]/10 flex items-center justify-center shrink-0">
                  <Database size={17} className="text-[#4F6BFF]" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-foreground tabular-nums">{dataStats.storeCount} Datensätze</p>
                  <p className="text-[12px] text-muted-foreground tabular-nums">{dataStats.sizeMB} MB im lokalen Speicher</p>
                </div>
              </div>

              <SubSection title="Backup">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={handleExport} className={cn('btn btn-md w-full', exportDone ? 'btn-primary' : 'btn-secondary')}>
                    {exportDone ? <><Check size={14} /> Exportiert</> : <><Download size={14} /> Als JSON exportieren</>}
                  </button>
                  <button onClick={handleImport} className="btn btn-md btn-secondary w-full">
                    <Upload size={14} /> Backup importieren
                  </button>
                </div>
                <p className="text-[12px] text-muted-foreground">Beim Import werden bestehende Daten überschrieben — vorher Export nicht vergessen.</p>
              </SubSection>

              <SubSection title="Gefahrenzone" danger>
                <button
                  onClick={() => setShowReset(true)}
                  className="btn btn-md w-full bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                >
                  <Trash2 size={14} /> Alle Daten zurücksetzen
                </button>
                <p className="text-[12px] text-muted-foreground">
                  Alle Projekte, Objekte, Mieter, Verträge, Boards und Einstellungen werden unwiderruflich gelöscht.
                </p>
              </SubSection>
            </CategoryFrame>
          )}
        </div>
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

// ─── Layout primitives ─────────────────────────────────────

interface CategoryFrameProps {
  title: string;
  description: string;
  children: ReactNode;
  saved?: boolean;
  hideSave?: boolean;
  onSave?: () => void;
}

/**
 * Header + Body + Save-Footer einer Kategorie. Eine einzige Karte pro Tab,
 * darin sind die Subsections nur durch Trennstriche getrennt — keine
 * verschachtelten Karten mehr.
 */
function CategoryFrame({ title, description, children, saved, hideSave, onSave }: CategoryFrameProps) {
  return (
    <>
      <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-3.5 border-b border-card-divider">
        <h2 className="text-[17px] font-semibold text-foreground tracking-tight leading-tight">{title}</h2>
        <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-1 max-w-2xl">{description}</p>
      </div>
      <div className="p-5 sm:p-7 space-y-7">
        {children}
      </div>
      {!hideSave && (
        <div className="px-5 sm:px-7 py-3.5 border-t border-card-divider flex items-center justify-between gap-3 bg-card/40">
          <p className="text-[12px] text-muted-foreground">
            {saved ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                <Check size={13} /> Gespeichert
              </span>
            ) : (
              'Änderungen werden lokal in deinem Browser gespeichert.'
            )}
          </p>
          <button onClick={onSave} className="btn btn-md btn-primary">
            Speichern
          </button>
        </div>
      )}
    </>
  );
}

interface SubSectionProps {
  title: ReactNode;
  optional?: boolean;
  danger?: boolean;
  children: ReactNode;
}

function SubSection({ title, optional, danger, children }: SubSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className={cn(
          'text-[12.5px] font-bold uppercase tracking-[0.06em]',
          danger ? 'text-red-600' : 'text-muted-foreground',
        )}>
          {title}
        </h3>
        {optional && (
          <span className="text-[10.5px] font-semibold text-muted-foreground/70 bg-card-line/40 px-1.5 py-0.5 rounded-md">
            optional
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

interface FieldProps {
  label?: ReactNode;
  help?: ReactNode;
  children: ReactNode;
}

function Field({ label, help, children }: FieldProps) {
  return (
    <div>
      {label && <label className="input-label">{label}</label>}
      {children}
      {help && <p className="text-[11.5px] text-muted-foreground mt-1.5 leading-relaxed">{help}</p>}
    </div>
  );
}

interface PasswordInputProps {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
}

function PasswordInput({ value, onChange, show, onToggle, placeholder }: PasswordInputProps) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input pr-10"
        placeholder={placeholder}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

interface LocaleCardProps {
  locale: 'de' | 'en';
}

function LocaleCard({ locale }: LocaleCardProps) {
  const { locale: current, setLocale } = useTranslation();
  const active = current === locale;
  return (
    <button
      type="button"
      onClick={() => setLocale(locale)}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer',
        active
          ? 'border-[#4F6BFF] bg-[#4F6BFF]/5 ring-1 ring-[#4F6BFF]/20'
          : 'border-card-divider hover:bg-layer-hover',
      )}
      aria-pressed={active}
    >
      <span className="text-[24px] leading-none" aria-hidden>{LOCALE_FLAG[locale]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[13.5px] font-semibold text-foreground">{LOCALE_LABEL[locale]}</p>
          {active && <Check size={13} className="text-[#4F6BFF]" />}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {locale === 'de' ? 'de-DE' : 'en-GB'}
        </p>
      </div>
    </button>
  );
}
