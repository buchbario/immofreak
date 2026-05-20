import { useState, useMemo, useEffect } from 'react';
import {
  Landmark, Plus, RefreshCw, ArrowDownLeft, ArrowUpRight,
  CheckCircle2, XCircle, Clock, Search, X,
  Link2, Unlink, CreditCard, TrendingUp, AlertCircle, Check,
  ChevronDown, Users, Sparkles, HelpCircle, UserCheck, Loader2, ShieldCheck, ArrowRight,
  EyeOff, Eye,
} from 'lucide-react';
import { useBanking } from '../../hooks/useBanking';
import { useRentalProperties } from '../../hooks/useRentalProperties';
import { useRentalUnits } from '../../hooks/useRentalUnits';
import { useTenants } from '../../hooks/useTenants';
import { useRentalContracts } from '../../hooks/useRentalContracts';
import { deleteBankAccountPermanently } from '../../lib/cascadeDelete';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn, formatDate, formatDateTime } from '../../lib/utils';
import { PageCard } from '../ui/PageCard';
import { applyMatch, matchTransaction } from '../../lib/matcher';
import { MatchTransactionModal } from './MatchTransactionModal';
import {
  disconnectBanksapiAccount,
  searchBanksapiProviders,
  startBanksapiConnect,
  syncBanksapiAccount,
  type BanksapiProviderHit,
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
type TxFilter = 'alle' | 'eingang' | 'ausgang' | 'miete' | 'ignoriert';

type BankPreset = {
  name: string;
  color: string;
  bic: string;
  domain?: string;
  /** Wenn aus der BANKSapi-Suche gewählt, ist die exakte providerId hier gesetzt. */
  banksapiProviderId?: string;
  /** Bankleitzahl (8 Ziffern) — relevant für Sparkasse/Volksbank, identifiziert die Filiale. */
  blz?: string;
};

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
  { name: 'Revolut', bic: 'REVODEB2', color: '#0075EB', domain: 'revolut.com' },
  { name: 'Santander Consumer Bank', bic: 'SCFBDE33XXX', color: '#EC0000', domain: 'santander.de' },
  { name: 'SolarisBank', bic: 'SOBKDEBBXXX', color: '#FF6D00', domain: 'solarisgroup.com' },
  { name: 'Sparda-Bank', bic: 'GENODEF1S03', color: '#003D7A', domain: 'sparda.de' },
  { name: 'Südwestbank', bic: 'SWBSDESS', color: '#004996', domain: 'suedwestbank.de' },
  { name: 'Sutor Bank', bic: 'MHSBDEHB', color: '#1F2A44', domain: 'sutorbank.de' },
  { name: 'Targobank', bic: 'CMCIDEDD', color: '#E2001A', domain: 'targobank.de' },
  { name: 'Tomorrow Bank', bic: 'SOBKDEBB', color: '#1FC1C8', domain: 'tomorrow.one' },
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

/** Sekundärer Lookup nach BIC — wenn BANKSapi einen Banknamen liefert den wir
 *  nicht im Directory haben (z.B. "Revolut Bank" statt "Revolut"), kommen wir
 *  via BIC trotzdem an das passende Logo + die Markenfarbe. */
const BANK_BY_BIC: Record<string, BankPreset> = (() => {
  const out: Record<string, BankPreset> = {};
  for (const b of [...BANK_PRESETS, ...ADDITIONAL_BANKS]) {
    if (!b.bic) continue;
    const upper = b.bic.toUpperCase();
    out[upper] = b;
    out[upper.slice(0, 8)] = b; // Base-8-BIC für 11-stellige XXX-Varianten
  }
  return out;
})();

function lookupBankByName(name: string, bic?: string): BankPreset | undefined {
  const exact = BANK_DIRECTORY[name];
  if (exact) return exact;
  if (bic) {
    const upper = bic.toUpperCase();
    const byBic = BANK_BY_BIC[upper] || BANK_BY_BIC[upper.slice(0, 8)];
    if (byBic) return byBic;
  }
  // Fuzzy: BANKSapi liefert oft erweiterte Namen wie "Revolut Bank" oder
  // "Sparkasse Berlin" — wir matchen über Token-Überlappung mit dem Directory,
  // damit die Marken-Farbe + das Logo auch dann greifen.
  const norm = name.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!norm) return undefined;
  for (const key of Object.keys(BANK_DIRECTORY)) {
    const k = key.toLowerCase();
    if (norm === k || norm.startsWith(k + ' ') || norm.endsWith(' ' + k) || norm.includes(' ' + k + ' ')) {
      return BANK_DIRECTORY[key];
    }
  }
  // Letztes Mittel: erstes Wort vergleichen ("Revolut Bank" → "Revolut").
  const firstWord = norm.split(' ')[0];
  for (const key of Object.keys(BANK_DIRECTORY)) {
    if (key.toLowerCase() === firstWord) return BANK_DIRECTORY[key];
  }
  return undefined;
}

/**
 * Wählt eine lesbare Textfarbe auf einem Hex-Hintergrund. Heuristik nach
 * Rec. 601-Perzeption (Y = 0.299R + 0.587G + 0.114B). Schwellwert 0.62 —
 * darüber (z.B. Postbank-Gelb #FFCC00, Commerzbank-Gold #FFD700) liefern
 * wir dunklen Text, sonst weiß.
 */
function readableTextOn(hex: string): 'white' | 'dark' {
  const h = hex.replace('#', '').trim();
  if (h.length < 6) return 'white';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return 'white';
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? 'dark' : 'white';
}

/**
 * Versucht aus counterparty + purpose den Händler zu erkennen und liefert
 * Anzeigenamen + (wenn bekannt) eine Domain für das Logo via Google-Favicon-
 * Service. Liste deckt die häufigsten deutschen Marken ab; bei Treffer wird
 * statt des generischen Eingang-/Ausgang-Pfeils das Marken-Favicon angezeigt.
 */
type MerchantHint = { name: string; domain?: string };

const MERCHANT_RULES: ReadonlyArray<{ match: RegExp; name: string; domain?: string }> = [
  // Fastfood / Restaurants
  { match: /mcdonald|\bmcd\b|mc\.d/i, name: "McDonald's", domain: 'mcdonalds.com' },
  { match: /burger\s*king|\bbk\b/i,   name: 'Burger King', domain: 'burgerking.de' },
  { match: /starbucks/i,              name: 'Starbucks',   domain: 'starbucks.de' },
  { match: /subway/i,                 name: 'Subway',      domain: 'subway.de' },
  { match: /\bkfc\b/i,                name: 'KFC',         domain: 'kfc.de' },
  { match: /domino/i,                 name: "Domino's",    domain: 'dominos.de' },
  { match: /lieferando/i,             name: 'Lieferando',  domain: 'lieferando.de' },
  { match: /wolt\b/i,                 name: 'Wolt',        domain: 'wolt.com' },
  // Supermärkte
  { match: /\brewe\b/i,               name: 'REWE',        domain: 'rewe.de' },
  { match: /edeka/i,                  name: 'Edeka',       domain: 'edeka.de' },
  { match: /\blidl\b/i,               name: 'Lidl',        domain: 'lidl.de' },
  { match: /\baldi\b/i,               name: 'ALDI',        domain: 'aldi.de' },
  { match: /kaufland/i,               name: 'Kaufland',    domain: 'kaufland.de' },
  { match: /\bnetto\b/i,              name: 'Netto',       domain: 'netto-online.de' },
  { match: /\bpenny\b/i,              name: 'Penny',       domain: 'penny.de' },
  { match: /globus\b/i,               name: 'Globus',      domain: 'globus.de' },
  // Drogerie & Kiosk
  { match: /\bdm\b|dm.{0,3}drogerie/i, name: 'dm-drogerie', domain: 'dm.de' },
  { match: /rossmann/i,               name: 'Rossmann',    domain: 'rossmann.de' },
  { match: /\bmüller\b|m[üu]ller drogerie/i, name: 'Müller', domain: 'mueller.de' },
  { match: /\bk\.?\s*kiosk\b/i,       name: 'K Kiosk',     domain: 'valora.com' },
  // Tankstellen
  { match: /\bshell\b/i,              name: 'Shell',       domain: 'shell.de' },
  { match: /\baral\b/i,               name: 'Aral',        domain: 'aral.de' },
  { match: /\besso\b/i,               name: 'Esso',        domain: 'esso.de' },
  { match: /\bjet\b.*tank|\btankstelle\s*jet/i, name: 'JET', domain: 'jet-tankstellen.de' },
  { match: /\btotal\b.*service|total.*tank/i, name: 'TotalEnergies', domain: 'totalenergies.de' },
  { match: /\bhem\b\s*tank/i,         name: 'HEM',         domain: 'hem.com' },
  // Online / Abo
  { match: /amazon/i,                 name: 'Amazon',      domain: 'amazon.de' },
  { match: /paypal/i,                 name: 'PayPal',      domain: 'paypal.com' },
  { match: /netflix/i,                name: 'Netflix',     domain: 'netflix.com' },
  { match: /spotify/i,                name: 'Spotify',     domain: 'spotify.com' },
  { match: /disney\+?|disneyplus/i,   name: 'Disney+',     domain: 'disneyplus.com' },
  { match: /apple\.com|itunes|apple pay/i, name: 'Apple',  domain: 'apple.com' },
  { match: /google.*play|googleplay/i,name: 'Google Play', domain: 'play.google.com' },
  { match: /steam/i,                  name: 'Steam',       domain: 'steampowered.com' },
  { match: /microsoft|xbox/i,         name: 'Microsoft',   domain: 'microsoft.com' },
  { match: /openai|chatgpt/i,         name: 'OpenAI',      domain: 'openai.com' },
  // Fitness
  { match: /xtrafit/i,                name: 'XtraFit',     domain: 'xtrafit.de' },
  { match: /\bfitx\b/i,               name: 'FitX',        domain: 'fitx.de' },
  { match: /mcfit/i,                  name: 'McFit',       domain: 'mcfit.com' },
  { match: /clever\s*fit/i,           name: 'clever fit',  domain: 'clever-fit.com' },
  // Verkehr & Mobilität
  { match: /deutsche\s*bahn|\bdb vertrieb|bahn\.de/i, name: 'Deutsche Bahn', domain: 'bahn.de' },
  { match: /\buber\b/i,               name: 'Uber',        domain: 'uber.com' },
  { match: /\bbolt\b/i,               name: 'Bolt',        domain: 'bolt.eu' },
  { match: /\bflixbus|flixtrain/i,    name: 'Flix',        domain: 'flixbus.de' },
  { match: /\bbvg\b/i,                name: 'BVG',         domain: 'bvg.de' },
  // Bargeld / Banking
  { match: /cash at|atm|geldautomat|bargeldabhebung/i, name: 'Bargeld' },
  { match: /sparkasse/i,              name: 'Sparkasse',   domain: 'sparkasse.de' },
  { match: /revpoints|spare change|aufrundung/i, name: 'Aufrundung', domain: 'revolut.com' },
];

function detectMerchant(counterparty: string, purpose: string): MerchantHint {
  const text = `${counterparty} ${purpose}`.trim();
  for (const r of MERCHANT_RULES) {
    if (r.match.test(text)) return { name: r.name, domain: r.domain };
  }
  const cp = counterparty.trim();
  if (cp) return { name: cp };
  const firstWord = purpose.split(/\s+/).find((w) => w.length > 2);
  return { name: firstWord || 'Sonstige' };
}

/**
 * Englische Standard-Bank-Phrasen ins Deutsche übersetzen. Revolut & andere
 * Neobanken liefern Verwendungszweck oft auf Englisch — wir mappen die
 * häufigsten Muster damit die UI durchgehend deutsch wirkt. Unbekanntes
 * bleibt unverändert (z.B. Marken-Eigennamen).
 */
function translatePurpose(text: string): string {
  if (!text) return text;
  let out = text;
  const REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
    [/^Payment from\b/i,                    'Zahlung von'],
    [/^Payment to\b/i,                      'Zahlung an'],
    [/^Transfer from\b/i,                   'Überweisung von'],
    [/^Transfer to\b/i,                     'Überweisung an'],
    [/^Sent to\b/i,                         'Gesendet an'],
    [/^Received from\b/i,                   'Erhalten von'],
    [/^Top[- ]up( from)?\b/i,               'Aufladung'],
    [/^Card payment at\b/i,                 'Kartenzahlung bei'],
    [/^Card payment\b/i,                    'Kartenzahlung'],
    [/^Cash withdrawal\b|^ATM withdrawal\b/i, 'Bargeldabhebung'],
    [/^Cash at\b/i,                         'Bargeld bei'],
    [/\bRevpoints\s+Spare\s*Change\b/gi,    'Aufrundung'],
    [/\bSpare\s*Change\b/gi,                'Aufrundung'],
    [/\bRevpoints\b/gi,                     'Revolut Points'],
    [/^Reward\b/i,                          'Belohnung'],
    [/^Refund( from)?\b/i,                  'Erstattung von'],
    [/^Subscription\b/i,                    'Abo'],
    [/^Direct debit\b/i,                    'Lastschrift'],
    [/^Standing order\b/i,                  'Dauerauftrag'],
    [/^Fee\b/i,                             'Gebühr'],
    [/^Interest\b/i,                        'Zinsen'],
    [/^Exchange( to)?\b/i,                  'Wechsel'],
    [/^Foreign exchange\b/i,                'Devisenwechsel'],
    [/\bPayment\b/g,                        'Zahlung'],
  ];
  for (const [re, rep] of REPLACEMENTS) {
    out = out.replace(re, rep);
  }
  return out;
}

/**
 * Lädt das Marken-Favicon via Google. Wenn keine Domain bekannt ist oder das
 * Logo nicht lädt, wird das Fallback-Element gerendert (Eingang/Ausgang-Pfeil).
 */
function MerchantLogo({
  domain,
  fallback,
  size = 18,
}: {
  domain?: string;
  fallback: React.ReactNode;
  size?: number;
}) {
  // `key={domain}` zwingt React beim Wechsel der Bank zu einem Remount —
  // damit ist `setFailed(false)` im Effect (Verstoß gegen `set-state-in-effect`) überflüssig.
  return <BankFaviconInner key={domain || 'none'} domain={domain} fallback={fallback} size={size} />;
}

function BankFaviconInner({
  domain,
  fallback,
  size,
}: {
  domain?: string;
  fallback: React.ReactNode;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!domain || failed) return <>{fallback}</>;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
      alt=""
      className="object-contain"
      style={{ width: size, height: size }}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

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
  // Remount per Bank-Domain → kein `setState`-im-Effect für den Reset nötig.
  return <BankLogoInner key={bank.domain || 'none'} bank={bank} size={size} whiteBg={whiteBg} />;
}

function BankLogoInner({
  bank,
  size,
  whiteBg,
}: {
  bank: BankPreset;
  size: number;
  whiteBg: boolean;
}) {
  const sources = useMemo(() => {
    if (!bank.domain) return [];
    return [
      `https://www.google.com/s2/favicons?domain=${bank.domain}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${bank.domain}.ico`,
    ];
  }, [bank.domain]);

  const [srcIndex, setSrcIndex] = useState(0);

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

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function maskIban(iban: string, show: boolean) {
  if (show || iban.length < 10) return iban;
  return iban.slice(0, 4) + ' •••• •••• •••• ' + iban.slice(-4);
}

/**
 * Live-Suche gegen BANKSapi's komplette Provider-Liste (~4000 Banken + Filialen).
 * `queryPrefix` wird vor dem User-Input platziert — z.B. "Sparkasse " damit
 * der User nur den Standort eintippen muss.
 */
function BanksapiBankSearch({
  onSelect,
  queryPrefix = '',
  placeholder = 'Banknamen, BIC oder BLZ tippen …',
  autoFocus = true,
}: {
  onSelect: (hit: BanksapiProviderHit) => void;
  queryPrefix?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BanksapiProviderHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fullQuery = (queryPrefix + query).trim();
    if (fullQuery.length < 2) {
      setResults([]);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    const handle = setTimeout(async () => {
      try {
        const hits = await searchBanksapiProviders(fullQuery);
        setResults(hits);
      } catch (e) {
        setError((e as Error).message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, queryPrefix]);

  return (
    <div>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="input pl-9"
          autoFocus={autoFocus}
        />
        {loading && (
          <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
        )}
      </div>

      {error && (
        <div className="mt-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <p className="text-[11px] text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {(queryPrefix + query).trim().length >= 2 && (
        <div className="mt-2 max-h-[280px] overflow-y-auto rounded-lg border border-card-line bg-card">
          {results.length === 0 && !loading && !error && (
            <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">
              Keine Treffer für „{query}".
            </div>
          )}
          {results.map((hit) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => onSelect(hit)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-layer-hover/60 transition-colors cursor-pointer border-b border-card-divider last:border-b-0"
            >
              <div className="size-8 rounded-lg bg-[#4F6BFF]/10 flex items-center justify-center shrink-0">
                <Landmark size={14} className="text-[#4F6BFF]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">{hit.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {hit.bic && <span className="font-mono">{hit.bic}</span>}
                  {hit.bic && hit.blz && <span className="mx-1.5">·</span>}
                  {hit.blz && <span className="font-mono">BLZ {hit.blz}</span>}
                </p>
              </div>
              <ArrowRight size={13} className="text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'select' | 'pick-branch' | 'credentials'>('select');
  const [selected, setSelected] = useState<BankPreset | null>(null);
  /** Wenn gesetzt: User hat eine Multi-Filial-Bank (Sparkasse/Volksbank) aus dem
   *  Quick-Pick gewählt — wir routen ihn zu 'pick-branch' wo er den Standort
   *  eingibt und die konkrete Filiale aussucht. */
  const [bankFamily, setBankFamily] = useState<BankPreset | null>(null);
  const [label, setLabel] = useState('');
  const [holder, setHolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isMultiBranch = (name: string) => /sparkasse|volksbank|raiffeisen|genoss/i.test(name);

  const handleQuickPick = (bank: BankPreset) => {
    if (isMultiBranch(bank.name)) {
      setBankFamily(bank);
      setStep('pick-branch');
    } else {
      setSelected(bank);
      setStep('credentials');
    }
  };

  const handleBranchPicked = (hit: BanksapiProviderHit) => {
    setSelected({
      name: hit.name,
      color: bankFamily?.color || '#4F6BFF',
      bic: hit.bic || '',
      domain: bankFamily?.domain,
      banksapiProviderId: hit.id,
      blz: hit.blz,
    });
    setStep('credentials');
  };

  const handleBack = () => {
    if (step === 'credentials' && bankFamily) {
      setSelected(null);
      setStep('pick-branch');
    } else if (step === 'pick-branch') {
      setBankFamily(null);
      setStep('select');
    } else {
      setStep('select');
    }
  };

  const handleConnect = async () => {
    if (!selected) return;
    setError('');
    setBusy(true);
    try {
      const redirectUri = `${window.location.origin}/bh/banking/callback`;
      // Domain für das Logo: aus dem ausgewählten Preset oder via BIC-Fallback aus
      // dem Directory holen, damit auch search-gepickte Banken das Logo zeigen.
      const directoryHit = lookupBankByName(selected.name, selected.bic);
      const bankDomain = selected.domain || directoryHit?.domain || '';
      const result = await startBanksapiConnect({
        redirectUri,
        bankKey: bankKeyFor(selected.name),
        providerId: selected.banksapiProviderId,
        bankBic: selected.bic,
        bankName: selected.name,
        bankDomain,
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
                    onClick={() => handleQuickPick(bank)}
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
                <label className="input-label">Bank suchen (alle 4.000+ Banken bei BANKSapi)</label>
                <BanksapiBankSearch
                  onSelect={(hit) => {
                    setSelected({
                      name: hit.name,
                      color: '#4F6BFF',
                      bic: hit.bic || '',
                      banksapiProviderId: hit.id,
                      blz: hit.blz,
                    });
                    setStep('credentials');
                  }}
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Tippe Namen, BIC oder BLZ — z.B. „Sparkasse Berlin", „REVODEB2" oder „12030000".
                </p>
              </div>
            </div>
          )}

          {/* Filial-Auswahl für Sparkasse / Volksbank / Raiffeisenbank.
              User hat im vorigen Schritt z.B. "Sparkasse" gepickt; hier tippt er
              den Standort (Stadt / PLZ), wir liefern matching Filialen. */}
          {step === 'pick-branch' && bankFamily && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-card-line bg-muted/30">
                <div className="size-10 rounded-lg bg-white border border-card-line flex items-center justify-center overflow-hidden shrink-0">
                  <BankLogo bank={bankFamily} size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{bankFamily.name}</p>
                  <p className="text-xs text-muted-foreground">Wo befindet sich deine Filiale?</p>
                </div>
              </div>

              <div>
                <label className="input-label">Standort, Stadt oder BLZ</label>
                <BanksapiBankSearch
                  queryPrefix={bankFamily.name + ' '}
                  placeholder="z. B. Berlin, München, 10117 oder 12050000"
                  onSelect={handleBranchPicked}
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Tippe den Standort deiner {bankFamily.name} — die Filiale wird live aus BANKSapi geladen.
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

        {(step === 'pick-branch' || step === 'credentials') && (
          <div className="modal-footer">
            <button onClick={handleBack} className="btn btn-md btn-secondary" disabled={busy}>
              Zurück
            </button>
            {step === 'credentials' && (
              <button
                onClick={handleConnect}
                disabled={busy}
                className="btn btn-md btn-primary"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                {busy ? 'Weiterleitung …' : 'Verbinden'}
              </button>
            )}
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
    toggleIgnoreTransaction,
  } = useBanking();
  const { properties } = useRentalProperties();
  const { allUnits } = useRentalUnits();
  const { allTenants } = useTenants();
  const { allContracts } = useRentalContracts();
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
  const [syncSuccess, setSyncSuccess] = useState<{ accountId: string; added: number; balance?: number; stale?: boolean } | null>(null);

  /**
   * Synchronisierung. Demo-Konten bekommen nur ein lastSync-Update (kein echter
   * API-Call). banksapi-Konten gehen über die Edge Function, die neue/aktuelle
   * Transaktionen + den aktuellen Saldo liefert; Dubletten werden via
   * banksapiTransactionId (UNIQUE-Index in Postgres) abgefangen.
   */
  const handleSync = async (accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;
    setSyncError(null);
    setSyncSuccess(null);

    if (acc.provider !== 'banksapi' || !acc.banksapiAccessId) {
      updateAccount(accountId, { lastSync: new Date().toISOString() });
      return;
    }

    setSyncingId(accountId);
    try {
      // productKey mitgeben — bei Multi-Produkt-Zugängen (Giro+Tagesgeld) liefert
      // BANKSapi sonst zufällig das erste Produkt zurück und unser Saldo wäre
      // für das KONKRETE Konto falsch.
      const result = await syncBanksapiAccount(acc.banksapiAccessId, acc.banksapiProductId);
      const existing = new Set(
        transactions
          .filter(t => t.bankAccountId === accountId && t.banksapiTransactionId)
          .map(t => t.banksapiTransactionId),
      );
      let added = 0;
      let deltaAmount = 0;
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
        added++;
        deltaAmount += tx.amount;
      }
      // Saldo-Update — Reihenfolge:
      //   1. Bei `freshness === 'fresh'` IMMER den Server-Saldo nehmen (Wahrheit).
      //   2. Bei `stale` nur dann nehmen, wenn er sich geändert hat (sonst alter
      //      Wert beibehalten, damit der User keinen veralteten BANKSapi-Cache
      //      sieht).
      //   3. Fallback: alter Saldo + Summe der neu hinzugekommenen Transaktionen.
      let newBalance: number | undefined;
      const serverBalance = result.account?.balance;
      if (typeof serverBalance === 'number') {
        if (result.freshness === 'fresh' || serverBalance !== acc.balance) {
          newBalance = serverBalance;
        }
      } else if (added > 0) {
        newBalance = Math.round((acc.balance + deltaAmount) * 100) / 100;
      }
      const balanceUpdate = typeof newBalance === 'number' ? { balance: newBalance } : {};
      updateAccount(accountId, { ...balanceUpdate, lastSync: new Date().toISOString() });
      setSyncSuccess({
        accountId,
        added,
        // Zeige immer den aktuellen Saldo (neu oder unverändert), damit der User
        // visuelle Bestätigung bekommt, dass der Refresh wirklich gelaufen ist.
        balance: typeof newBalance === 'number'
          ? newBalance
          : typeof serverBalance === 'number'
          ? serverBalance
          : acc.balance,
        // 'stale' = BANKSapi war noch nicht VOLLSTAENDIG durch. Saldo könnte
        // also noch der alte sein — der Client zeigt einen Hinweis und der
        // User kann nochmal klicken.
        stale: result.freshness === 'stale',
      });
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
  // Match-Badges in jeder Filter-Ansicht sichtbar bleiben).
  // Ignorierte Eingänge werden standardmäßig ausgeblendet — nur sichtbar,
  // wenn aktiv über den „Ignoriert"-Filter angefordert.
  const filteredTx = useMemo(() => {
    let txs = [...enrichedTransactions];
    if (txFilter === 'ignoriert') {
      txs = txs.filter(t => t.isIgnored);
    } else {
      txs = txs.filter(t => !t.isIgnored);
      if (txFilter === 'eingang') txs = txs.filter(t => t.amount > 0);
      if (txFilter === 'ausgang') txs = txs.filter(t => t.amount < 0);
      if (txFilter === 'miete') txs = txs.filter(t => t.category === 'miete' || t.matchStatus === 'suggested' || t.matchStatus === 'unmatched');
    }
    if (txSearch) {
      const q = txSearch.toLowerCase();
      txs = txs.filter(t =>
        t.counterparty.toLowerCase().includes(q) ||
        t.purpose.toLowerCase().includes(q)
      );
    }
    return txs.sort((a, b) => b.date.localeCompare(a.date));
  }, [enrichedTransactions, txFilter, txSearch]);

  // Lookup: Konto-ID → Konto + visuelle Bank-Info (Logo/Name). Wird in jeder
  // Transaktions-Zeile angezeigt, damit bei mehreren Konten klar ist, woher
  // die Transaktion stammt.
  const accountInfoMap = useMemo(() => {
    const map = new Map<string, { account: typeof accounts[number]; preset: BankPreset; }>();
    for (const a of accounts) {
      const dir = lookupBankByName(a.bankName, a.bic);
      map.set(a.id, {
        account: a,
        preset: {
          name: a.bankName,
          color: a.color || dir?.color || '#4F6BFF',
          bic: a.bic,
          domain: a.domain || dir?.domain,
        },
      });
    }
    return map;
  }, [accounts]);

  // Rent matching data for selected month
  const rentMatching = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return allTenants
      .filter(t => t.unitId)
      .map(tenant => {
        const unit = allUnits.find(u => u.id === tenant.unitId);
        const property = properties.find(p => p.id === tenant.propertyId);
        const expectedRent = unit?.currentRent || 0;

        // Find matching transaction (nur bestätigte Auto-/Manual-Matches zählen).
        // Ignorierte Transaktionen werden übersprungen — die zählen explizit
        // nicht als Mieteingang.
        const matchingTx = enrichedTransactions.find(tx =>
          tx.matchedTenantId === tenant.id &&
          !tx.isIgnored &&
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

  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
                <span className="tabular-nums font-medium text-foreground">{totalBalance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € Saldo</span>
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
          {syncSuccess && (
            <div className={cn(
              'mb-4 p-3 rounded-xl border',
              syncSuccess.stale
                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
                : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
            )}>
              <div className="flex items-start gap-2">
                {syncSuccess.stale
                  ? <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  : <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                }
                <div className="flex-1">
                  <p className={cn(
                    'text-xs font-semibold',
                    syncSuccess.stale ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400',
                  )}>
                    {syncSuccess.stale
                      ? 'Bank-Sync noch nicht ganz durch'
                      : syncSuccess.added > 0
                        ? `${syncSuccess.added} neue ${syncSuccess.added === 1 ? 'Transaktion' : 'Transaktionen'} geladen`
                        : 'Konto ist auf dem neuesten Stand'}
                  </p>
                  {syncSuccess.stale && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                      Die Bank hat die Anfrage noch nicht abgeschlossen — bitte in ein paar Sekunden nochmal aktualisieren, dann sollte der neue Saldo da sein.
                    </p>
                  )}
                  {!syncSuccess.stale && typeof syncSuccess.balance === 'number' && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5 tabular-nums">
                      Aktueller Saldo: {syncSuccess.balance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSyncSuccess(null)}
                  className={cn(syncSuccess.stale ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}
                >
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
                // Directory first — kuratierte Marken-Farben sind gegenüber dem
                // gespeicherten Fallback (oft generisches #4F6BFF) zu bevorzugen.
                const directoryEntry = lookupBankByName(account.bankName, account.bic);
                const effectiveDomain = account.domain || directoryEntry?.domain;
                const effectiveColor = directoryEntry?.color || account.color || '#4F6BFF';
                const textTone = readableTextOn(effectiveColor);
                const isDarkText = textTone === 'dark';
                const gradient = isDarkText
                  ? `linear-gradient(135deg, ${effectiveColor}, ${effectiveColor}cc)`
                  : `linear-gradient(135deg, ${effectiveColor}dd, ${effectiveColor}99)`;
                const cls = {
                  title:  isDarkText ? 'text-neutral-900' : 'text-white',
                  sub:    isDarkText ? 'text-neutral-900/70' : 'text-white/70',
                  hint:   isDarkText ? 'text-neutral-900/60' : 'text-white/60',
                  amount: isDarkText ? 'text-neutral-900' : 'text-white',
                  status: isDarkText ? 'text-neutral-900/75' : 'text-white/80',
                  dot:    isDarkText ? 'bg-emerald-700' : 'bg-emerald-400',
                };
                return (
                <div
                  key={account.id}
                  className="relative overflow-hidden rounded-2xl border border-card-line"
                >
                  {/* Gradient header */}
                  <div
                    className="px-5 py-4"
                    style={{ background: gradient }}
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
                          <p className={cn('text-sm font-bold truncate', cls.title)}>{account.label || account.bankName}</p>
                          <p className={cn('text-xs truncate', cls.sub)}>
                            {account.label ? account.bankName : (account.accountHolder || ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={cn('size-2 rounded-full animate-pulse', cls.dot)} />
                        <span className={cn('text-[10px] font-medium uppercase tracking-wider', cls.status)}>Verbunden</span>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className={cn('text-xs mb-0.5', cls.hint)}>Kontostand</p>
                        <p className={cn('text-2xl font-bold tabular-nums', cls.amount)}>
                          {account.balance.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </p>
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
                          Zuletzt synchronisiert: {formatDateTime(account.lastSync)}
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
                { key: 'ignoriert', label: 'Ignoriert' },
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
                  const canAssign = isIncome && !tx.isIgnored;
                  const bankInfo = accountInfoMap.get(tx.bankAccountId);
                  const showBankChip = accounts.length > 1 && !!bankInfo;
                  const merchant = detectMerchant(tx.counterparty, tx.purpose);
                  const displayTitle = tx.counterparty || merchant.name;
                  return (
                    <div
                      key={tx.id}
                      onClick={() => canAssign && setAssignTxId(tx.id)}
                      className={cn(
                        'w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors',
                        canAssign ? 'hover:bg-muted/30 cursor-pointer' : 'cursor-default',
                        tx.isIgnored && 'opacity-60',
                      )}
                    >
                      {/* Merchant-Logo bzw. Eingang-/Ausgang-Pfeil mit farbigem Ring */}
                      <div className={cn(
                        'size-10 rounded-xl flex items-center justify-center shrink-0 ring-1 bg-white overflow-hidden',
                        isIncome
                          ? 'ring-emerald-200 dark:ring-emerald-500/30'
                          : 'ring-rose-200 dark:ring-rose-500/30',
                      )}>
                        <MerchantLogo
                          domain={merchant.domain}
                          size={20}
                          fallback={
                            <div className={cn(
                              'size-full flex items-center justify-center',
                              isIncome ? 'bg-emerald-50 dark:bg-emerald-500/15' : 'bg-rose-50 dark:bg-rose-500/15',
                            )}>
                              {isIncome
                                ? <ArrowDownLeft size={16} className="text-emerald-600 dark:text-emerald-400" />
                                : <ArrowUpRight size={16} className="text-rose-500 dark:text-rose-400" />
                              }
                            </div>
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">{displayTitle}</p>
                          <span className={cn(
                            'shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
                            isIncome
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
                          )}>
                            {isIncome ? 'Eingang' : 'Abbuchung'}
                          </span>
                          {showBankChip && bankInfo && (
                            <span
                              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-muted/70 text-muted-foreground max-w-[160px]"
                              title={bankInfo.account.label || bankInfo.account.bankName}
                            >
                              <span className="size-3 rounded bg-white border border-card-line flex items-center justify-center overflow-hidden shrink-0">
                                <BankLogo bank={bankInfo.preset} size={9} />
                              </span>
                              <span className="truncate">{bankInfo.account.label || bankInfo.account.bankName}</span>
                            </span>
                          )}
                          {tx.isIgnored && (
                            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                              <EyeOff size={10} className="shrink-0" />
                              Ignoriert
                            </span>
                          )}
                          {matchedTenant && !tx.isIgnored && (
                            <MatchBadge
                              status={tx.matchStatus === 'auto' ? 'auto' : 'manual'}
                              label={matchedTenant.name}
                            />
                          )}
                          {!matchedTenant && suggestedTenant && !tx.isIgnored && (
                            <MatchBadge status="suggested" label={`Vorschlag: ${suggestedTenant.name}`} />
                          )}
                          {!matchedTenant && !suggestedTenant && isIncome && !tx.isIgnored && (
                            <MatchBadge status="unmatched" label="Offen – zuordnen" />
                          )}
                          {tx.isReconciled && (
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          )}
                        </div>
                        {(() => {
                          const sub = translatePurpose(tx.purpose);
                          // Subtitel ausblenden wenn er identisch mit der Headline ist
                          // (vermeidet "Aufrundung / Aufrundung"-Doppel bei aufgeräumten
                          // Eigenüberweisungen ohne Counterparty).
                          if (!sub || sub.trim().toLowerCase() === displayTitle.trim().toLowerCase()) return null;
                          return <p className="text-xs text-muted-foreground truncate mt-0.5">{sub}</p>;
                        })()}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn(
                          'text-sm font-bold tabular-nums',
                          isIncome
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400',
                        )}>
                          {isIncome ? '+' : ''}{fmt(tx.amount)} €
                        </p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(tx.date)}</p>
                      </div>
                      {isIncome && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleIgnoreTransaction(tx.id); }}
                          className="shrink-0 size-8 rounded-lg border border-card-line flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                          title={tx.isIgnored ? 'Ignorierung aufheben' : 'Als „kein Mieteingang" ignorieren'}
                        >
                          {tx.isIgnored ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      )}
                    </div>
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
          message={`Konto bei "${confirmDisconnect.bankName}" und alle zugehörigen Transaktionen werden endgültig entfernt. Falls du das Konto später wieder brauchst, kannst du es jederzeit erneut verbinden — die Daten werden dann frisch von der Bank geholt.`}
          onConfirm={() => {
            const acc = accounts.find(a => a.id === confirmDisconnect.id);
            if (acc?.provider === 'banksapi' && acc.banksapiAccessId) {
              void handleBanksapiDisconnect(acc.banksapiAccessId);
            }
            deleteBankAccountPermanently(confirmDisconnect.id);
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
