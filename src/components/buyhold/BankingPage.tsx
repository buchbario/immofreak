import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Landmark, Plus, RefreshCw, ArrowDownLeft, ArrowUpRight,
  CheckCircle2, XCircle, Clock, Search, X,
  Link2, Unlink, CreditCard, TrendingUp, AlertCircle, Check,
  Building2, ChevronDown, Users, Sparkles, HelpCircle, UserCheck, Loader2, ShieldCheck,
} from 'lucide-react';
import { useBanking } from '../../hooks/useBanking';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useTenants } from '../../hooks/useTenants';
import { useRentalContracts } from '../../hooks/useRentalContracts';
import { useTrash } from '../../hooks/useTrash';
import { cascadeBankAccountToTrash } from '../../lib/cascadeDelete';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn, formatDate } from '../../lib/utils';
import { PageCard } from '../ui/PageCard';
import { applyMatch, matchTransaction } from '../../lib/matcher';
import { MatchTransactionModal } from './MatchTransactionModal';
import {
  disconnectBanksapiAccount,
  startBanksapiConnect,
  syncBanksapiAccount,
} from '../../lib/banksapiClient';
import type { BankTransaction } from '../../types';

/**
 * Stub-Mapping vom UI-Banknamen auf den BANKSapi-Provider-Key. Sobald die
 * Edge Function gegen die echte BANKSapi läuft (Schritt 7), kommt hier ein
 * vollständiger Lookup auf die BANKSapi-Bankliste rein.
 */
function bankKeyFor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('sparkasse')) return 'sparkasse';
  if (n.includes('deutsche bank')) return 'deutsche-bank';
  if (n.includes('commerzbank')) return 'commerzbank';
  if (n.startsWith('ing')) return 'ing';
  if (n.includes('volksbank') || n.includes('vr')) return 'volksbank';
  if (n.includes('n26')) return 'n26';
  if (n.includes('dkb')) return 'dkb';
  if (n.includes('postbank')) return 'postbank';
  return 'deutsche-bank';
}

type Tab = 'konten' | 'transaktionen' | 'mieteingang';
type TxFilter = 'alle' | 'eingang' | 'ausgang' | 'miete';

type BankPreset = { name: string; color: string; bic: string; domain?: string };

const BANK_PRESETS: BankPreset[] = [
  { name: 'Deutsche Bank', color: '#0018A8', bic: 'DEUTDEDB', domain: 'deutsche-bank.de' },
  { name: 'Sparkasse', color: '#FF0000', bic: 'SPKADE', domain: 'sparkasse.de' },
  { name: 'Commerzbank', color: '#FFD700', bic: 'COBADEFF', domain: 'commerzbank.de' },
  { name: 'ING', color: '#FF6200', bic: 'INGDDEFF', domain: 'ing.de' },
  { name: 'Volksbank', color: '#003399', bic: 'GENODED1', domain: 'vr.de' },
  { name: 'N26', color: '#36A18B', bic: 'NTSBDEB1', domain: 'n26.com' },
  { name: 'DKB', color: '#007CC3', bic: 'BYLADEM1001', domain: 'dkb.de' },
  { name: 'Postbank', color: '#FFCC00', bic: 'PBNKDEFF', domain: 'postbank.de' },
];

// Additional German banks not shown as tiles — available via dropdown.
// Sorted alphabetically. BICs are standard public SWIFT codes.
// `domain` is used to fetch the real bank logo via Clearbit (https://logo.clearbit.com/{domain}).
const ADDITIONAL_BANKS: BankPreset[] = [
  { name: '1822direkt', bic: 'HELADEF1822', color: '#0055A4', domain: '1822direkt.de' },
  { name: 'Apobank (Deutsche Apotheker- & Ärztebank)', bic: 'DAAEDEDD', color: '#007A33', domain: 'apobank.de' },
  { name: 'Aareal Bank', bic: 'AARBDE5W', color: '#1A4C8B', domain: 'aareal-bank.com' },
  { name: 'BBBank', bic: 'GENODE61BBB', color: '#E3051B', domain: 'bbbank.de' },
  { name: 'BW-Bank (Baden-Württembergische Bank)', bic: 'SOLADEST600', color: '#005CA9', domain: 'bw-bank.de' },
  { name: 'Bank11', bic: 'WELADED1B11', color: '#1F3864', domain: 'bank11.de' },
  { name: 'Bayerische Landesbank (BayernLB)', bic: 'BYLADEMM', color: '#003A70', domain: 'bayernlb.de' },
  { name: 'Berliner Sparkasse', bic: 'BELADEBE', color: '#FF0000', domain: 'berliner-sparkasse.de' },
  { name: 'bunq', bic: 'BUNQNL2A', color: '#3FD2A7', domain: 'bunq.com' },
  { name: 'C24 Bank', bic: 'BYLADEM1001', color: '#005CE6', domain: 'c24.de' },
  { name: 'Comdirect', bic: 'COBADEHD044', color: '#FFD700', domain: 'comdirect.de' },
  { name: 'Consorsbank', bic: 'CSDBDE71', color: '#009BD5', domain: 'consorsbank.de' },
  { name: 'Degussa Bank', bic: 'DEGUDEFF', color: '#CA9A4A', domain: 'degussa.de' },
  { name: 'Deutsche Kreditbank (DKB)', bic: 'BYLADEM1001', color: '#007CC3', domain: 'dkb.de' },
  { name: 'EthikBank', bic: 'GENODEF1ETK', color: '#6AA84F', domain: 'ethikbank.de' },
  { name: 'Evangelische Bank', bic: 'GENODEF1EK1', color: '#8E2F4A', domain: 'eb.de' },
  { name: 'Fidor Bank', bic: 'FDDODEMMXXX', color: '#E5007D', domain: 'fidor.de' },
  { name: 'Fyrst', bic: 'DEUTDEFFXXX', color: '#FF9B00', domain: 'fyrst.de' },
  { name: 'GLS Bank', bic: 'GENODEM1GLS', color: '#005B3A', domain: 'gls.de' },
  { name: 'Hanseatic Bank', bic: 'HASPDEHHXXX', color: '#DE0029', domain: 'hanseaticbank.de' },
  { name: 'HypoVereinsbank (UniCredit)', bic: 'HYVEDEMMXXX', color: '#E3051B', domain: 'hvb.de' },
  { name: 'KD-Bank', bic: 'GENODED1DKD', color: '#1C5EA0', domain: 'kd-bank.de' },
  { name: 'Kreissparkasse', bic: 'BRUSDE66XXX', color: '#FF0000', domain: 'kreissparkasse.de' },
  { name: 'LBBW (Landesbank Baden-Württemberg)', bic: 'SOLADEST600', color: '#003087', domain: 'lbbw.de' },
  { name: 'Mercedes-Benz Bank', bic: 'MEFIDES1XXX', color: '#000000', domain: 'mercedes-benz-bank.de' },
  { name: 'Norisbank', bic: 'NORSDE51XXX', color: '#00A650', domain: 'norisbank.de' },
  { name: 'NordLB', bic: 'NOLADE2HXXX', color: '#003A70', domain: 'nordlb.de' },
  { name: 'Oldenburgische Landesbank (OLB)', bic: 'OLBODEH2XXX', color: '#004B85', domain: 'olb.de' },
  { name: 'Openbank', bic: 'OPENDEMMXXX', color: '#EC0000', domain: 'openbank.de' },
  { name: 'PSD Bank', bic: 'GENODEF1P01', color: '#0069B4', domain: 'psd-bank.de' },
  { name: 'Pax-Bank', bic: 'GENODED1PAX', color: '#6D2077', domain: 'pax-bank.de' },
  { name: 'Raiffeisenbank', bic: 'GENODEF1', color: '#FFCC00', domain: 'raiffeisen.de' },
  { name: 'Revolut', bic: 'REVOLT21', color: '#0075EB', domain: 'revolut.com' },
  { name: 'Santander Consumer Bank', bic: 'SCFBDE33XXX', color: '#EC0000', domain: 'santander.de' },
  { name: 'SolarisBank', bic: 'SOBKDEBBXXX', color: '#FF6D00', domain: 'solarisgroup.com' },
  { name: 'Sparda-Bank', bic: 'GENODEF1S03', color: '#003D7A', domain: 'sparda.de' },
  { name: 'Südwestbank', bic: 'SWBSDESS', color: '#004996', domain: 'suedwestbank.de' },
  { name: 'Sutor Bank', bic: 'HSTBDEHHXXX', color: '#1F2A44', domain: 'sutorbank.de' },
  { name: 'Targobank', bic: 'CMCIDEDD', color: '#E2001A', domain: 'targobank.de' },
  { name: 'Tomorrow Bank', bic: 'TRWIBEB1', color: '#1FC1C8', domain: 'tomorrow.one' },
  { name: 'Triodos Bank', bic: 'TRIODEF1', color: '#009149', domain: 'triodos.de' },
  { name: 'UmweltBank', bic: 'UMWEDE7N', color: '#78BE20', domain: 'umweltbank.de' },
  { name: 'Vivid Money', bic: 'SOBKDEBBXXX', color: '#0B1C2E', domain: 'vivid.money' },
  { name: 'Volkswagen Bank', bic: 'VOWADE2BXXX', color: '#001E50', domain: 'vwfs.de' },
  { name: 'VR Bank', bic: 'GENODEF1', color: '#003399', domain: 'vr.de' },
  { name: 'Wise (TransferWise)', bic: 'TRWIBEB1XXX', color: '#37517E', domain: 'wise.com' },
];

/**
 * Combined lookup of every known bank by display name so we can recover the
 * domain + brand color for accounts that were stored before the `domain` field
 * existed on BankAccount. Falls back gracefully for unknown names.
 */
const BANK_DIRECTORY: Record<string, BankPreset> = (() => {
  const out: Record<string, BankPreset> = {};
  for (const b of [...BANK_PRESETS, ...ADDITIONAL_BANKS]) out[b.name] = b;
  return out;
})();

/**
 * Renders a real bank logo. Tries Google's favicon service first (works for ~99% of
 * bank domains) then falls back to DuckDuckGo's icon service. If all sources fail
 * or no domain is set, shows the Landmark icon in the bank's brand color.
 *
 * Note: Clearbit's Logo API was previously used here but is unreliable after the
 * 2023 HubSpot acquisition (frequently times out or returns 5xx). Removed to keep
 * fallback latency low.
 */
function BankLogo({
  bank,
  size = 18,
  whiteBg = false,
}: {
  bank: BankPreset;
  size?: number;
  /** Wrap in a white background so dark logos (e.g. on gradient cards) stay readable. */
  whiteBg?: boolean;
}) {
  const sources = useMemo(() => {
    if (!bank.domain) return [];
    return [
      `https://www.google.com/s2/favicons?domain=${bank.domain}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${bank.domain}.ico`,
    ];
  }, [bank.domain]);

  const [srcIndex, setSrcIndex] = useState(0);

  // Reset when bank changes.
  useEffect(() => { setSrcIndex(0); }, [bank.domain]);

  if (sources.length === 0 || srcIndex >= sources.length) {
    return <Landmark size={Math.round(size * 0.9)} style={{ color: bank.color }} />;
  }

  return (
    <img
      key={sources[srcIndex]}
      src={sources[srcIndex]}
      alt={bank.name}
      className={cn('object-contain', whiteBg && 'bg-white rounded p-0.5')}
      style={{ width: size, height: size }}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setSrcIndex(i => i + 1)}
    />
  );
}

/**
 * Custom searchable dropdown for bank selection.
 * Matches the app's design language (uses `input`, `surface`, brand accent).
 * - Click outside / Esc closes
 * - Keyboard navigation: ↑↓ to move, Enter to pick
 * - Search filters by bank name
 */
function BankDropdown({
  banks,
  selected,
  onSelect,
  placeholder = 'Bank auswählen…',
}: {
  banks: BankPreset[];
  selected: BankPreset | null;
  onSelect: (bank: BankPreset) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter(b => b.name.toLowerCase().includes(q));
  }, [banks, query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Focus search when opening, reset state when closing
  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      setTimeout(() => searchRef.current?.focus(), 10);
    } else {
      setQuery('');
    }
  }, [open]);

  // Keep active row scrolled into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const bank = filtered[activeIndex];
      if (bank) { onSelect(bank); setOpen(false); }
    }
  };

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card transition-all cursor-pointer text-left',
          open
            ? 'border-[#4F6BFF] ring-2 ring-[#4F6BFF]/15'
            : 'border-card-line hover:border-[#4F6BFF]/40'
        )}
      >
        <div className="size-8 rounded-lg bg-white border border-card-line flex items-center justify-center overflow-hidden shrink-0">
          {selected
            ? <BankLogo bank={selected} size={20} />
            : <Landmark size={15} className="text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          {selected ? (
            <>
              <p className="text-sm font-medium text-foreground truncate">{selected.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">BIC: {selected.bic}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{placeholder}</p>
          )}
        </div>
        <ChevronDown
          size={16}
          className={cn(
            'text-muted-foreground shrink-0 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-card-line bg-card shadow-lg overflow-hidden"
          onKeyDown={onKeyDown}
        >
          {/* Search */}
          <div className="p-2 border-b border-card-line">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
                onKeyDown={onKeyDown}
                placeholder="Suchen…"
                className="input pl-8 h-9 text-sm w-full"
              />
            </div>
          </div>

          {/* List */}
          <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center py-8 px-4">
                <Building2 size={20} className="text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Keine Bank gefunden</p>
              </div>
            ) : (
              filtered.map((bank, idx) => {
                const isActive = idx === activeIndex;
                const isSelected = selected?.name === bank.name;
                return (
                  <button
                    key={bank.name}
                    type="button"
                    data-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => { onSelect(bank); setOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 transition-colors cursor-pointer text-left',
                      isActive && 'bg-[#4F6BFF]/8',
                      isSelected && 'bg-[#4F6BFF]/10'
                    )}
                  >
                    <div className="size-7 rounded-md bg-white border border-card-line flex items-center justify-center overflow-hidden shrink-0">
                      <BankLogo bank={bank} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{bank.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate font-mono">{bank.bic}</p>
                    </div>
                    {isSelected && <Check size={14} className="text-[#4F6BFF] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-card-line bg-muted/30">
            <p className="text-[10px] text-muted-foreground">
              {filtered.length} von {banks.length} Banken
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function maskIban(iban: string, show: boolean) {
  if (show || iban.length < 10) return iban;
  return iban.slice(0, 4) + ' •••• •••• •••• ' + iban.slice(-4);
}

function ConnectModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'select' | 'credentials'>('select');
  const [selected, setSelected] = useState<BankPreset | null>(null);
  const [label, setLabel] = useState('');
  const [holder, setHolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!selected) return;
    setError('');
    setBusy(true);
    try {
      const redirectUri = `${window.location.origin}/bh/banking/callback`;
      const result = await startBanksapiConnect({
        redirectUri,
        bankKey: bankKeyFor(selected.name),
        accountHolder: holder,
        label,
      });
      window.location.href = result.redirectUrl;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-content max-w-lg">
        <div className="modal-header">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Landmark size={16} />
            Konto verbinden
          </h3>
          <button onClick={onClose} className="cursor-pointer text-muted-foreground"><X size={18} /></button>
        </div>

        <div className="modal-body">
          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Wähle deine Bank aus, um dein Konto zu verbinden.</p>
              <div className="grid grid-cols-2 gap-2">
                {BANK_PRESETS.map(bank => (
                  <button
                    key={bank.name}
                    onClick={() => { setSelected(bank); setStep('credentials'); }}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left',
                      'hover:border-[#4F6BFF] hover:bg-[#4F6BFF]/5',
                      'border-card-line bg-card'
                    )}
                  >
                    <div className="size-9 rounded-lg bg-white border border-card-line flex items-center justify-center shrink-0 overflow-hidden">
                      <BankLogo bank={bank} size={22} />
                    </div>
                    <span className="text-sm font-medium text-foreground">{bank.name}</span>
                  </button>
                ))}
              </div>

              {/* Other banks — custom dropdown with logos */}
              <div className="pt-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-card-line" />
                  <span className="text-xs text-muted-foreground">Bank nicht dabei?</span>
                  <div className="flex-1 h-px bg-card-line" />
                </div>
                <label className="input-label">Weitere deutsche Banken</label>
                <BankDropdown
                  banks={ADDITIONAL_BANKS}
                  selected={selected && ADDITIONAL_BANKS.some(b => b.name === selected.name) ? selected : null}
                  onSelect={(bank) => { setSelected(bank); setStep('credentials'); }}
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {ADDITIONAL_BANKS.length} weitere Banken verfügbar. BIC wird automatisch übernommen.
                </p>
              </div>
            </div>
          )}

          {/* Während wir die Webform-URL holen: Bank-Logo mit rotierendem Ring.
              Sobald die URL da ist, springt window.location.href an — die Animation
              ist also genau der Übergang vom Klick bis zum BANKSapi-Redirect. */}
          {step === 'credentials' && selected && busy && (
            <div className="flex flex-col items-center py-10">
              <div className="relative mb-5">
                <div className="size-16 rounded-2xl bg-white border border-card-line flex items-center justify-center overflow-hidden shadow-sm">
                  <BankLogo bank={selected} size={36} />
                </div>
                <div
                  className="absolute -inset-1 rounded-2xl border-2 border-transparent animate-spin"
                  style={{ borderTopColor: selected.color, borderRightColor: selected.color + '40' }}
                />
              </div>
              <p className="text-sm font-semibold text-foreground">Weiterleitung wird vorbereitet …</p>
              <p className="text-xs text-muted-foreground mt-1">Du wirst gleich zum sicheren Bank-Login geleitet</p>
            </div>
          )}

          {step === 'credentials' && selected && !busy && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-card-line bg-muted/30">
                <div className="size-10 rounded-lg bg-white border border-card-line flex items-center justify-center overflow-hidden shrink-0">
                  <BankLogo bank={selected} size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">BIC: {selected.bic}</p>
                </div>
              </div>

              <div>
                <label className="input-label">Bezeichnung <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  className="input"
                  placeholder="z. B. Mietkonto Berlin"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Interner Name für dieses Konto in der App. Leer lassen, um den Banknamen zu nutzen.
                </p>
              </div>

              <div>
                <label className="input-label">Kontoinhaber <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input
                  value={holder}
                  onChange={e => setHolder(e.target.value)}
                  className="input"
                  placeholder="Max Mustermann"
                />
              </div>

              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <ShieldCheck size={13} className="text-[#4F6BFF] mt-0.5 shrink-0" />
                Du wirst auf das sichere Bank-Login weitergeleitet und bestätigst dort den
                90-Tage-Zugriff auf Kontoumsätze. Dein Login bleibt bei der Bank.
              </p>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                  <p className="text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</p>
                </div>
              )}
            </div>
          )}

        </div>

        {(step === 'credentials') && (
          <div className="modal-footer">
            <button onClick={() => setStep('select')} className="btn btn-md btn-secondary" disabled={busy}>
              Zurück
            </button>
            <button onClick={handleConnect} disabled={busy} className="btn btn-md btn-primary">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              {busy ? 'Weiterleitung …' : 'Verbinden'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function BankingPage() {
  const {
    accounts,
    transactions,
    mappings,
    updateAccount,
    addTransaction,
    assignTransaction,
    unassignTransaction,
  } = useBanking();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allTenants } = useTenants();
  const { allContracts } = useRentalContracts();
  const { moveToTrash } = useTrash();
  const [activeTab, setActiveTab] = useState<Tab>('konten');
  const [showConnect, setShowConnect] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState<{ id: string; bankName: string } | null>(null);
  const [txFilter, setTxFilter] = useState<TxFilter>('alle');
  const [txSearch, setTxSearch] = useState('');
  const [assignTxId, setAssignTxId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  /**
   * Reichert alle Transaktionen mit Match-Informationen an. Bereits zugeordnete
   * Transaktionen (matchedTenantId gesetzt) bleiben unverändert. Offene
   * Transaktionen laufen durch den Matcher und bekommen entweder Auto-Match,
   * Vorschlag oder bleiben offen.
   */
  const matchContext = useMemo(
    () => ({ tenants: allTenants, units: allUnits, contracts: allContracts, mappings }),
    [allTenants, allUnits, allContracts, mappings],
  );

  const enrichedTransactions = useMemo(() => {
    return transactions.map((tx) => {
      if (tx.matchedTenantId) return tx;
      const result = matchTransaction(tx, matchContext);
      const enriched = applyMatch(tx, result);
      // suggested-Match: Tipp für UI mitgeben, aber matchedTenantId bleibt leer,
      // damit der Mieteingang-Tab nur bestätigte Zahlungen zählt.
      if (result.status === 'suggested' && result.tenantId) {
        return { ...enriched, _suggestedTenantId: result.tenantId } as BankTransaction & { _suggestedTenantId?: string };
      }
      return enriched;
    });
  }, [transactions, matchContext]);

  const txById = useMemo(() => {
    const map = new Map<string, BankTransaction & { _suggestedTenantId?: string }>();
    for (const tx of enrichedTransactions) map.set(tx.id, tx as BankTransaction & { _suggestedTenantId?: string });
    return map;
  }, [enrichedTransactions]);

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<{ accountId: string; message: string } | null>(null);

  /**
   * Synchronisierung. Demo-Konten bekommen nur ein lastSync-Update (kein echter
   * API-Call). banksapi-Konten gehen über die Edge Function, die neue/aktuelle
   * Transaktionen liefert; Dubletten werden via banksapiTransactionId
   * (UNIQUE-Index in Postgres) abgefangen.
   */
  const handleSync = async (accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;
    setSyncError(null);

    if (acc.provider !== 'banksapi' || !acc.banksapiAccessId) {
      updateAccount(accountId, { lastSync: new Date().toISOString() });
      return;
    }

    setSyncingId(accountId);
    try {
      const result = await syncBanksapiAccount(acc.banksapiAccessId);
      const existing = new Set(
        transactions
          .filter(t => t.bankAccountId === accountId && t.banksapiTransactionId)
          .map(t => t.banksapiTransactionId),
      );
      for (const tx of result.transactions) {
        if (existing.has(tx.banksapiTransactionId)) continue;
        addTransaction({
          bankAccountId: accountId,
          date: tx.date,
          amount: tx.amount,
          counterparty: tx.counterparty,
          purpose: tx.purpose,
          iban: tx.iban,
          banksapiTransactionId: tx.banksapiTransactionId,
          isReconciled: false,
        });
      }
      updateAccount(accountId, { lastSync: new Date().toISOString() });
    } catch (e) {
      setSyncError({ accountId, message: (e as Error).message });
    } finally {
      setSyncingId(null);
    }
  };

  const handleBanksapiDisconnect = async (accessId: string) => {
    try {
      await disconnectBanksapiAccount(accessId);
    } catch {
      // Wir trennen lokal trotzdem — der User kann den Zugang notfalls über
      // das BANKSapi-Dashboard widerrufen.
    }
  };

  // Filtered transactions (basieren auf den angereicherten TXs, damit die
  // Match-Badges in jeder Filter-Ansicht sichtbar bleiben)
  const filteredTx = useMemo(() => {
    let txs = [...enrichedTransactions];
    if (txFilter === 'eingang') txs = txs.filter(t => t.amount > 0);
    if (txFilter === 'ausgang') txs = txs.filter(t => t.amount < 0);
    if (txFilter === 'miete') txs = txs.filter(t => t.category === 'miete' || t.matchStatus === 'suggested' || t.matchStatus === 'unmatched');
    if (txSearch) {
      const q = txSearch.toLowerCase();
      txs = txs.filter(t =>
        t.counterparty.toLowerCase().includes(q) ||
        t.purpose.toLowerCase().includes(q)
      );
    }
    return txs.sort((a, b) => b.date.localeCompare(a.date));
  }, [enrichedTransactions, txFilter, txSearch]);

  // Rent matching data for selected month
  const rentMatching = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return allTenants
      .filter(t => t.unitId)
      .map(tenant => {
        const unit = allUnits.find(u => u.id === tenant.unitId);
        const property = properties.find(p => p.id === tenant.propertyId);
        const expectedRent = unit?.currentRent || 0;

        // Find matching transaction (nur bestätigte Auto-/Manual-Matches zählen)
        const matchingTx = enrichedTransactions.find(tx =>
          tx.matchedTenantId === tenant.id &&
          new Date(tx.date).getFullYear() === year &&
          new Date(tx.date).getMonth() + 1 === month
        );

        const now = new Date();
        const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
        const isPastMonth = new Date(year, month - 1) < new Date(now.getFullYear(), now.getMonth());

        let status: 'paid' | 'pending' | 'missing';
        if (matchingTx) status = 'paid';
        else if (isPastMonth) status = 'missing';
        else status = 'pending';

        return {
          tenant,
          unit,
          property,
          expectedRent,
          matchingTx,
          status,
          isCurrentMonth,
        };
      });
  }, [allTenants, allUnits, properties, enrichedTransactions, selectedMonth]);

  const totalExpected = rentMatching.reduce((s, r) => s + r.expectedRent, 0);
  const totalReceived = rentMatching.filter(r => r.status === 'paid').reduce((s, r) => s + (r.matchingTx?.amount || 0), 0);
  const paidCount = rentMatching.filter(r => r.status === 'paid').length;
  const missingCount = rentMatching.filter(r => r.status === 'missing').length;

  const tabs: { key: Tab; label: string; icon: typeof Landmark }[] = [
    { key: 'konten', label: 'Konten', icon: Landmark },
    { key: 'transaktionen', label: 'Transaktionen', icon: CreditCard },
    { key: 'mieteingang', label: 'Mieteingang', icon: TrendingUp },
  ];

  const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });

  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      });
    }
    return opts;
  }, []);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="page-container">
      <PageCard
        title="Banking"
        description="Verbundene Konten, Transaktionen und automatischer Mieteingang-Abgleich an einem Ort."
        meta={
          <>
            <Landmark size={11} /> {accounts.length} {accounts.length === 1 ? 'Konto' : 'Konten'}
            <span className="size-[3px] rounded-full bg-muted-foreground/40 mx-0.5" />
            <span>{transactions.length} Transaktionen</span>
            {accounts.length > 0 && (
              <>
                <span className="size-[3px] rounded-full bg-muted-foreground/40 mx-0.5" />
                <span className="tabular-nums font-medium text-foreground">{totalBalance.toLocaleString('de-DE', { maximumFractionDigits: 0 })} € Saldo</span>
              </>
            )}
          </>
        }
        actions={
          <button onClick={() => setShowConnect(true)} className="btn btn-sm btn-primary">
            <Plus size={14} /> Konto verbinden
          </button>
        }
        tabs={tabs.map(tab => ({ key: tab.key, label: tab.label }))}
        activeTab={activeTab}
        onTabChange={(k) => setActiveTab(k as Tab)}
      >
        <div className="p-5 sm:p-6">

      {/* ═══ KONTEN TAB ═══ */}
      {activeTab === 'konten' && (
        <div>
          {syncError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                    Synchronisierung fehlgeschlagen
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-0.5 whitespace-pre-wrap">{syncError.message}</p>
                </div>
                <button onClick={() => setSyncError(null)} className="text-red-600 dark:text-red-400">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="size-20 rounded-2xl bg-[#4F6BFF]/10 flex items-center justify-center mb-5">
                <Landmark size={32} className="text-[#4F6BFF]" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Kein Konto verbunden</h2>
              <p className="text-sm text-muted-foreground mb-5 max-w-sm text-center">
                Verbinde dein Bankkonto um Transaktionen zu importieren und Mieteingänge automatisch abzugleichen.
              </p>
              <button onClick={() => setShowConnect(true)} className="btn btn-md btn-primary">
                <Plus size={15} /> Konto verbinden
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {accounts.map(account => {
                // Lookup domain/color from the bank directory so older accounts (stored
                // before `domain` existed on BankAccount) still render their logo.
                const directoryEntry = BANK_DIRECTORY[account.bankName];
                const effectiveDomain = account.domain || directoryEntry?.domain;
                const effectiveColor = account.color || directoryEntry?.color || '#4F6BFF';
                return (
                <div
                  key={account.id}
                  className="relative overflow-hidden rounded-2xl border border-card-line"
                >
                  {/* Gradient header */}
                  <div
                    className="px-5 py-4"
                    style={{
                      background: `linear-gradient(135deg, ${effectiveColor}dd, ${effectiveColor}99)`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="size-9 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                          <BankLogo
                            bank={{ name: account.bankName, color: effectiveColor, bic: account.bic, domain: effectiveDomain }}
                            size={22}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{account.label || account.bankName}</p>
                          <p className="text-xs text-white/70 truncate">
                            {account.label ? account.bankName : (account.accountHolder || ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-medium text-white/80 uppercase tracking-wider">Verbunden</span>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-white/60 mb-0.5">Kontostand</p>
                        <p className="text-2xl font-bold text-white tabular-nums">{fmt(account.balance)} €</p>
                      </div>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="bg-card px-5 py-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-mono text-muted-foreground tracking-wider">
                          {maskIban(account.iban, false)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Zuletzt synchronisiert: {formatDate(account.lastSync)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleSync(account.id)}
                          disabled={syncingId === account.id}
                          className="size-8 rounded-lg border border-card-line flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-60"
                          title={account.provider === 'banksapi' ? 'BANKSapi synchronisieren' : 'Synchronisieren'}
                        >
                          {syncingId === account.id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <RefreshCw size={13} />}
                        </button>
                        <button
                          onClick={() => setConfirmDisconnect({ id: account.id, bankName: account.label || account.bankName })}
                          className="size-8 rounded-lg border border-card-line flex items-center justify-center text-muted-foreground hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Trennen"
                        >
                          <Unlink size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}

              {/* Add account card */}
              <button
                onClick={() => setShowConnect(true)}
                className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-card-line hover:border-[#4F6BFF]/40 hover:bg-[#4F6BFF]/5 transition-all cursor-pointer group"
              >
                <div className="size-12 rounded-xl bg-muted/50 group-hover:bg-[#4F6BFF]/10 flex items-center justify-center transition-colors">
                  <Plus size={20} className="text-muted-foreground group-hover:text-[#4F6BFF] transition-colors" />
                </div>
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Weiteres Konto verbinden
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ TRANSAKTIONEN TAB ═══ */}
      {activeTab === 'transaktionen' && (
        <div>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={txSearch}
                onChange={e => setTxSearch(e.target.value)}
                className="input pl-9 w-full"
                placeholder="Suche nach Name oder Verwendungszweck..."
              />
            </div>
            <div className="flex gap-1.5 p-1 bg-muted/50 rounded-lg border border-card-line">
              {([
                { key: 'alle', label: 'Alle' },
                { key: 'eingang', label: 'Eingang' },
                { key: 'ausgang', label: 'Ausgang' },
                { key: 'miete', label: 'Miete' },
              ] as { key: TxFilter; label: string }[]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setTxFilter(f.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer',
                    txFilter === f.key
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTx.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <CreditCard size={28} className="text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {transactions.length === 0 ? 'Noch keine Transaktionen. Verbinde zuerst ein Konto.' : 'Keine Transaktionen gefunden.'}
              </p>
            </div>
          ) : (
            <div className="bg-card border border-card-line rounded-xl overflow-hidden">
              <div className="divide-y divide-card-divider">
                {filteredTx.map(tx => {
                  const isIncome = tx.amount > 0;
                  const matchedTenant = tx.matchedTenantId
                    ? allTenants.find(t => t.id === tx.matchedTenantId)
                    : undefined;
                  const suggested = (tx as BankTransaction & { _suggestedTenantId?: string })._suggestedTenantId;
                  const suggestedTenant = suggested ? allTenants.find(t => t.id === suggested) : undefined;
                  const canAssign = isIncome;
                  return (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => canAssign && setAssignTxId(tx.id)}
                      disabled={!canAssign}
                      className={cn(
                        'w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors',
                        canAssign ? 'hover:bg-muted/30 cursor-pointer' : 'cursor-default',
                      )}
                    >
                      <div className={cn(
                        'size-9 rounded-xl flex items-center justify-center shrink-0',
                        isIncome ? 'bg-emerald-100 dark:bg-emerald-500/15' : 'bg-red-100 dark:bg-red-500/15'
                      )}>
                        {isIncome
                          ? <ArrowDownLeft size={16} className="text-emerald-600 dark:text-emerald-400" />
                          : <ArrowUpRight size={16} className="text-red-500 dark:text-red-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">{tx.counterparty}</p>
                          {matchedTenant && (
                            <MatchBadge
                              status={tx.matchStatus === 'auto' ? 'auto' : 'manual'}
                              label={matchedTenant.name}
                            />
                          )}
                          {!matchedTenant && suggestedTenant && (
                            <MatchBadge status="suggested" label={`Vorschlag: ${suggestedTenant.name}`} />
                          )}
                          {!matchedTenant && !suggestedTenant && isIncome && (
                            <MatchBadge status="unmatched" label="Offen – zuordnen" />
                          )}
                          {tx.isReconciled && (
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{tx.purpose}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn(
                          'text-sm font-bold tabular-nums',
                          isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                        )}>
                          {isIncome ? '+' : ''}{fmt(tx.amount)} €
                        </p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(tx.date)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ MIETEINGANG TAB ═══ */}
      {activeTab === 'mieteingang' && (
        <div>
          {/* Month selector + KPIs */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="input pr-8 appearance-none cursor-pointer font-medium"
              >
                {monthOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>

            <div className="flex gap-3 flex-1">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {paidCount} bezahlt
                </span>
              </div>
              {missingCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                  <XCircle size={14} className="text-red-500 dark:text-red-400" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                    {missingCount} fehlend
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-card-line ml-auto">
                <span className="text-xs text-muted-foreground">Erhalten:</span>
                <span className="text-xs font-bold text-foreground tabular-nums">{fmt(totalReceived)} / {fmt(totalExpected)} €</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {totalExpected > 0 && (
            <div className="mb-5">
              <div className="h-2 rounded-full bg-muted/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.min((totalReceived / totalExpected) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">
                {totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0}% der erwarteten Miete eingegangen
              </p>
            </div>
          )}

          {rentMatching.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <Users size={28} className="text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Keine Mieter mit zugewiesenen Einheiten gefunden.</p>
            </div>
          ) : (
            <div className="bg-card border border-card-line rounded-xl overflow-hidden">
              <div className="divide-y divide-card-divider">
                {rentMatching.map(({ tenant, unit, property, expectedRent, matchingTx, status }) => (
                  <div key={tenant.id} className="flex items-center gap-4 px-5 py-4">
                    {/* Status icon */}
                    <div className={cn(
                      'size-10 rounded-xl flex items-center justify-center shrink-0',
                      status === 'paid' && 'bg-emerald-100 dark:bg-emerald-500/15',
                      status === 'missing' && 'bg-red-100 dark:bg-red-500/15',
                      status === 'pending' && 'bg-amber-100 dark:bg-amber-500/15',
                    )}>
                      {status === 'paid' && <Check size={18} className="text-emerald-600 dark:text-emerald-400" />}
                      {status === 'missing' && <XCircle size={18} className="text-red-500 dark:text-red-400" />}
                      {status === 'pending' && <Clock size={18} className="text-amber-600 dark:text-amber-400" />}
                    </div>

                    {/* Tenant info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{tenant.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {property && (
                          <span className="text-xs text-muted-foreground truncate">{property.name}</span>
                        )}
                        {unit && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{unit.name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expected vs received */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums text-foreground">{fmt(expectedRent)} €</p>
                      {status === 'paid' && matchingTx && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Eingegangen {formatDate(matchingTx.date)}
                        </p>
                      )}
                      {status === 'missing' && (
                        <p className="text-[11px] text-red-500 mt-0.5">Nicht eingegangen</p>
                      )}
                      {status === 'pending' && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">Ausstehend</p>
                      )}
                    </div>

                    {/* Status badge */}
                    <div className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide shrink-0',
                      status === 'paid' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
                      status === 'missing' && 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
                      status === 'pending' && 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
                    )}>
                      {status === 'paid' && 'Bezahlt'}
                      {status === 'missing' && 'Fehlend'}
                      {status === 'pending' && 'Offen'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

        </div>
      </PageCard>

      {showConnect && (
        <ConnectModal onClose={() => setShowConnect(false)} />
      )}

      {confirmDisconnect && (
        <ConfirmDialog
          title="Konto trennen"
          message={`Konto bei "${confirmDisconnect.bankName}" mit allen zugehörigen Transaktionen in den Papierkorb verschieben? Innerhalb von 30 Tagen wiederherstellbar.`}
          onConfirm={() => {
            const acc = accounts.find(a => a.id === confirmDisconnect.id);
            if (acc?.provider === 'banksapi' && acc.banksapiAccessId) {
              void handleBanksapiDisconnect(acc.banksapiAccessId);
            }
            cascadeBankAccountToTrash(confirmDisconnect.id, moveToTrash);
            setConfirmDisconnect(null);
          }}
          onCancel={() => setConfirmDisconnect(null)}
        />
      )}

      {assignTxId && (() => {
        const tx = txById.get(assignTxId);
        if (!tx) return null;
        return (
          <MatchTransactionModal
            tx={tx}
            tenants={allTenants}
            units={allUnits}
            suggestedTenantId={tx._suggestedTenantId}
            onClose={() => setAssignTxId(null)}
            onSubmit={(tenantId, learn) => {
              assignTransaction(tx.id, tenantId, learn);
              setAssignTxId(null);
            }}
            onUnassign={() => {
              unassignTransaction(tx.id);
              setAssignTxId(null);
            }}
          />
        );
      })()}
    </div>
  );
}

function MatchBadge({
  status,
  label,
}: {
  status: 'auto' | 'manual' | 'suggested' | 'unmatched';
  label: string;
}) {
  const config = {
    auto: {
      icon: Sparkles,
      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    },
    manual: {
      icon: UserCheck,
      cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    },
    suggested: {
      icon: HelpCircle,
      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    },
    unmatched: {
      icon: AlertCircle,
      cls: 'bg-muted text-muted-foreground',
    },
  }[status];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        'shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide max-w-[180px]',
        config.cls,
      )}
    >
      <Icon size={10} className="shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}
