// Edge Function: banksapi-proxy
//
// Brückt das Frontend zum BANKSapi PSD2-AISP-Backend.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ Modi                                                                     │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ • REAL  — wenn BANKSAPI_CLIENT_ID + BANKSAPI_CLIENT_SECRET gesetzt sind. │
// │            Spricht banksapi.io direkt, REG/Protect Webform-Flow.         │
// │ • STUB  — sonst. Liefert deterministische Mock-Daten für UI-Tests.       │
// │                                                                          │
// │ Auto-Detection — sobald du `supabase secrets set BANKSAPI_CLIENT_ID=...`  │
// │ ausführst, wechselt die Function automatisch in den Real-Mode.           │
// └─────────────────────────────────────────────────────────────────────────┘
//
// Pflicht-Secrets für Real-Mode:
//   supabase secrets set \
//     BANKSAPI_CLIENT_ID=<deine-client-id> \
//     BANKSAPI_CLIENT_SECRET=<dein-secret> \
//     BANKSAPI_BASE_URL=https://banksapi.io
//
// Optional:
//   BANKSAPI_USER_USERNAME / BANKSAPI_USER_PASSWORD   — wenn deine BANKSapi-
//     Lizenz einen User-Token (password grant) verlangt. Ohne diese Vars wird
//     der Mgmt-Token (client_credentials) für alle Calls verwendet.
//
// Deploy: `supabase functions deploy banksapi-proxy`
//
// API: siehe https://docs.banksapi.de/api/banks-connect.html

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ── CORS ─────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
};

// ── ENV / Mode ───────────────────────────────────────────────────────────────
const ENV = {
  BANKSAPI_CLIENT_ID: Deno.env.get('BANKSAPI_CLIENT_ID') || '',
  BANKSAPI_CLIENT_SECRET: Deno.env.get('BANKSAPI_CLIENT_SECRET') || '',
  BANKSAPI_BASE_URL: (Deno.env.get('BANKSAPI_BASE_URL') || 'https://banksapi.io').replace(/\/$/, ''),
  BANKSAPI_USER_USERNAME: Deno.env.get('BANKSAPI_USER_USERNAME') || '',
  BANKSAPI_USER_PASSWORD: Deno.env.get('BANKSAPI_USER_PASSWORD') || '',
  SUPABASE_URL: Deno.env.get('SUPABASE_URL')!,
  SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY')!,
};

const REAL_MODE = !!(ENV.BANKSAPI_CLIENT_ID && ENV.BANKSAPI_CLIENT_SECRET);

// ── Helpers ──────────────────────────────────────────────────────────────────
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function requireUser(req: Request) {
  const supa = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  });
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

function todayMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ═════════════════════════════════════════════════════════════════════════════
// REAL MODE — BANKSapi REST Client
// ═════════════════════════════════════════════════════════════════════════════

let cachedMgmtToken: { token: string; expiresAt: number } | null = null;

const SCOPES = [
  'http://banksapi.io/customer/read',
  'http://banksapi.io/customer/modify',
  'http://banksapi.io/provider/read',
].join(' ');

/**
 * Holt einen Mgmt-Token via client_credentials (oder User-Token via
 * password-Grant, falls BANKSAPI_USER_USERNAME gesetzt ist).
 * Token wird in-memory gecached bis 60 s vor Ablauf.
 */
async function getBanksapiToken(): Promise<string> {
  const now = Date.now();
  if (cachedMgmtToken && cachedMgmtToken.expiresAt - 60_000 > now) {
    return cachedMgmtToken.token;
  }

  const useUserToken = !!(ENV.BANKSAPI_USER_USERNAME && ENV.BANKSAPI_USER_PASSWORD);
  const body = new URLSearchParams();
  if (useUserToken) {
    body.set('grant_type', 'password');
    body.set('username', ENV.BANKSAPI_USER_USERNAME);
    body.set('password', ENV.BANKSAPI_USER_PASSWORD);
  } else {
    body.set('grant_type', 'client_credentials');
  }
  body.set('scope', SCOPES);

  const basic = btoa(`${ENV.BANKSAPI_CLIENT_ID}:${ENV.BANKSAPI_CLIENT_SECRET}`);
  const res = await fetch(`${ENV.BANKSAPI_BASE_URL}/auth/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basic}`,
    },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`BANKSapi token request failed (${res.status}): ${txt}`);
  }
  const json = await res.json();
  const token = json.access_token as string;
  const expiresIn = (json.expires_in as number) || 7200;
  cachedMgmtToken = { token, expiresAt: now + expiresIn * 1000 };
  return token;
}

interface BanksapiBankprodukt {
  id?: string;
  iban?: string;
  bic?: string;
  kontonummer?: string;
  saldo?: number | { betrag?: number; waehrung?: string };
  waehrung?: string;
  inhaber?: string;
}

interface BanksapiBankzugang {
  id: string;
  providerId?: string;
  status?: string;
  aktualisierungszeitpunkt?: string;
  bankprodukte?: BanksapiBankprodukt[];
}

/**
 * Erstellt eine REG/Protect-Webform-Session. AccessId wird clientseitig
 * generiert und im Request-Body unter dem Key gesetzt. BANKSapi antwortet
 * mit HTTP 451 und der Webform-URL im `Location`-Header.
 *
 * Docs: https://docs.banksapi.de/api/banks-connect.html#bankzugaenge
 */
/**
 * Räumt alte REG/Protect-Sessions auf. BANKSapi-Doku empfiehlt: "Delete all
 * REG/Protect sessions before starting new processes" — sonst kann ein
 * unvollständiger früherer Versuch den neuen Zugang blockieren.
 */
async function realDeleteRegprotectSessions(): Promise<void> {
  try {
    const token = await getBanksapiToken();
    await fetch(`${ENV.BANKSAPI_BASE_URL}/customer/v2/regprotect/sessions`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[banksapi] regprotect cleanup failed (non-fatal): ${(e as Error).message}`);
  }
}

// BANKSapi-Demo-Provider — NICHT für echte User. Wird nur als Notfall-Fallback
// für Tests genutzt; falls die Provider-Lookup fehlschlägt sollte besser ein
// Fehler an den Frontend gehen statt im Demo zu landen.
const DEMO_PROVIDER_ID = '00000000-0000-0000-0000-000000000000';

interface BanksapiProvider {
  id: string;
  name?: string;
  bic?: string;
  blz?: string;
}

let providersCache: { list: BanksapiProvider[]; expiresAt: number } | null = null;

/** Lädt die /providers/v2-Liste (4000+ Banken) und cached sie 1h. */
async function getBanksapiProviders(): Promise<BanksapiProvider[]> {
  const now = Date.now();
  if (providersCache && providersCache.expiresAt > now) return providersCache.list;
  const token = await getBanksapiToken();
  const res = await fetch(`${ENV.BANKSAPI_BASE_URL}/providers/v2`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`providers/v2 fetch failed (${res.status})`);
  const json = await res.json();
  const list: BanksapiProvider[] = Array.isArray(json) ? json : (json?.providers ?? []);
  providersCache = { list, expiresAt: now + 60 * 60 * 1000 };
  return list;
}

/**
 * Sucht in der Provider-Liste nach Banken die zum Query-String passen. Sortiert
 * nach Relevanz: exakter Name → Name-Präfix → BIC-Präfix → BLZ-Präfix → Name-Substring.
 * Limit-default 30 hält die Antwort klein.
 */
function searchProviders(providers: BanksapiProvider[], query: string, limit: number): BanksapiProvider[] {
  if (!query) return providers.slice(0, limit);
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);
  type Scored = { p: BanksapiProvider; score: number };
  const scored: Scored[] = [];
  for (const p of providers) {
    const name = (p.name || '').toLowerCase();
    const bic = (p.bic || '').toLowerCase();
    const blz = p.blz || '';
    let score = 0;
    // Exact / Prefix-Matches auf das volle Query bekommen Bonus-Punkte.
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (bic.startsWith(q)) score = 70;
    else if (blz.startsWith(q)) score = 60;
    else if (name.includes(q)) score = 40;
    else if (bic.includes(q)) score = 30;
    else if (blz.includes(q)) score = 20;
    // Multi-Token-Match: alle Tokens müssen im Name vorkommen (z.B. "sparkasse berlin"
    // matched "Berliner Sparkasse" und "Sparkasse Berlin Pankow").
    if (score === 0 && tokens.length > 1) {
      const allTokensInName = tokens.every((t) => name.includes(t));
      if (allTokensInName) score = 25;
    }
    if (score > 0) scored.push({ p, score });
  }
  scored.sort((a, b) => b.score - a.score || (a.p.name || '').localeCompare(b.p.name || ''));
  return scored.slice(0, limit).map((s) => s.p);
}

/**
 * Findet den BANKSapi-Provider für eine Bank anhand BIC und/oder BLZ. BLZ
 * ist exakt — BIC kann mehrdeutig sein (Sparkasse hat 1 BIC, viele Filialen).
 */
function findBanksapiProvider(
  providers: BanksapiProvider[],
  opts: { bic?: string; blz?: string },
): BanksapiProvider | null {
  if (opts.blz) {
    for (const p of providers) if (p.blz === opts.blz) return p;
  }
  if (opts.bic) {
    const bic = opts.bic.toUpperCase();
    const base = bic.slice(0, 8);
    // 1. exakter BIC-Match
    for (const p of providers) if ((p.bic || '').toUpperCase() === bic) return p;
    // 2. BIC mit XXX-Suffix (BANKSapi nutzt oft 11-stellige BICs)
    for (const p of providers) if ((p.bic || '').toUpperCase() === bic.slice(0, 8) + 'XXX') return p;
    // 3. Base-8-Match (kann mehrdeutig sein, nimmt den ersten)
    for (const p of providers) if ((p.bic || '').toUpperCase().startsWith(base)) return p;
  }
  return null;
}

/**
 * Extrahiert die BLZ aus einer deutschen IBAN: Zeichen 5-12 (1-indexed) =
 * BLZ. Z.B. DE89370400440532013000 → BLZ 37040044 (Commerzbank Köln).
 */
function blzFromIban(iban: string | undefined): string | undefined {
  if (!iban) return undefined;
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  if (!clean.startsWith('DE') || clean.length !== 22) return undefined;
  return clean.slice(4, 12);
}

async function realCreateWebform(opts: {
  accessId: string;
  callbackUrl: string;
  customerIp: string;
  providerId?: string;
  bankBic?: string;
  iban?: string;
}): Promise<string> {
  // Alte Sessions löschen (Best-Practice, non-fatal bei Fehler).
  await realDeleteRegprotectSessions();

  let resolvedProviderId = opts.providerId;
  if (!resolvedProviderId) {
    // Fallback-Lookup via BIC/BLZ wenn kein expliziter providerId vom Frontend kam.
    const providers = await getBanksapiProviders();
    const blz = blzFromIban(opts.iban);
    const provider = findBanksapiProvider(providers, { bic: opts.bankBic, blz });
    if (!provider) {
      throw new Error(
        `Diese Bank wurde bei BANKSapi nicht gefunden (BIC: ${opts.bankBic || '–'}, BLZ: ${blz || '–'}). ` +
        `Bitte nutze die Bank-Suche um deine konkrete Bank auszuwählen.`,
      );
    }
    resolvedProviderId = provider.id;
    // eslint-disable-next-line no-console
    console.log(`[banksapi] resolved via BIC/BLZ: id=${provider.id} name=${provider.name} bic=${provider.bic} blz=${provider.blz}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[banksapi] using user-picked providerId=${resolvedProviderId}`);
  }

  const token = await getBanksapiToken();
  const url = `${ENV.BANKSAPI_BASE_URL}/customer/v2/bankzugaenge?callbackUrl=${encodeURIComponent(opts.callbackUrl)}`;
  const body = { [opts.accessId]: { providerId: resolvedProviderId } };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Customer-IP-Address': opts.customerIp,
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
  // BANKSapi liefert 451 als Signal für "User-Interaction benötigt" — die
  // eigentliche Webform-URL steht im Location-Header.
  if (![451, 201, 200].includes(res.status)) {
    const txt = await res.text();
    throw new Error(`BANKSapi webform request failed (${res.status}): ${txt}`);
  }
  const location = res.headers.get('Location') || res.headers.get('location');
  if (!location) throw new Error('BANKSapi gab keine Webform-URL zurück (Location-Header fehlt)');
  return location;
}

// Kept for backwards-compat / debug — currently unused but documents the demo sentinel.
void DEMO_PROVIDER_ID;

/**
 * Liest den Bankzugang inkl. Konten/Produkte. Wird nach Rückkehr aus der
 * Webform aufgerufen, sobald `status === 'VOLLSTAENDIG'`.
 */
async function realGetBankzugang(accessId: string): Promise<BanksapiBankzugang> {
  const token = await getBanksapiToken();
  const res = await fetch(`${ENV.BANKSAPI_BASE_URL}/customer/v2/bankzugaenge/${accessId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`BANKSapi bankzugang fetch failed (${res.status}): ${txt}`);
  }
  return await res.json();
}

interface BanksapiUmsatz {
  betrag?: number | string;
  verwendungszweck?: string;
  buchungsdatum?: string;
  wertstellungsdatum?: string;
  gegenkontoInhaber?: string;
  gegenkontoIban?: string;
  identifier?: string | { batchId?: string; id?: string };
  primanotaNummer?: string;
}

/**
 * Liest die Kontoumsätze eines Bankprodukts.
 * `productId` ist laut Quickstart i.d.R. die IBAN.
 * Antwort-Schema ist in der Public-Doc unscharf — wir versuchen mehrere
 * gängige Shapes und loggen einen Sample, falls keiner matcht.
 */
async function realGetKontoumsaetze(accessId: string, productId: string): Promise<BanksapiUmsatz[]> {
  const token = await getBanksapiToken();
  const url = `${ENV.BANKSAPI_BASE_URL}/customer/v2/bankzugaenge/${accessId}/${encodeURIComponent(productId)}/kontoumsaetze?maxTransactions=all`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`BANKSapi kontoumsaetze fetch failed (${res.status}): ${txt}`);
  }
  const json = await res.json();
  const umsaetze = extractUmsaetze(json);
  // eslint-disable-next-line no-console
  console.log(`[banksapi] kontoumsaetze product=${productId} → ${umsaetze.length} Umsätze (response keys: ${Array.isArray(json) ? '[array]' : Object.keys(json || {}).join(',')})`);
  if (umsaetze.length === 0 && json && typeof json === 'object') {
    // eslint-disable-next-line no-console
    console.log(`[banksapi] empty response sample: ${JSON.stringify(json).slice(0, 800)}`);
  }
  return umsaetze;
}

function extractUmsaetze(obj: any): BanksapiUmsatz[] {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj.kontoumsaetze)) return obj.kontoumsaetze;
  if (Array.isArray(obj.umsaetze)) return obj.umsaetze;
  if (Array.isArray(obj.transactions)) return obj.transactions;
  // Nested-by-productId: { "<id>": { umsaetze: [...] } } oder { "<id>": [...] }
  for (const key of Object.keys(obj)) {
    const inner = obj[key];
    if (Array.isArray(inner)) return inner as BanksapiUmsatz[];
    if (inner && typeof inner === 'object') {
      if (Array.isArray(inner.kontoumsaetze)) return inner.kontoumsaetze;
      if (Array.isArray(inner.umsaetze)) return inner.umsaetze;
      if (Array.isArray(inner.transactions)) return inner.transactions;
    }
  }
  return [];
}

async function realRefreshBankzugang(accessId: string): Promise<void> {
  const token = await getBanksapiToken();
  await fetch(`${ENV.BANKSAPI_BASE_URL}/customer/v2/bankzugaenge?refresh=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ [accessId]: {} }),
  });
}

async function realRevokeBankzugang(accessId: string): Promise<void> {
  const token = await getBanksapiToken();
  await fetch(`${ENV.BANKSAPI_BASE_URL}/customer/v2/bankzugaenge/${accessId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
}

// ── Mapper: BANKSapi → unser Schema ─────────────────────────────────────────
function parseAmount(value: number | string | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value.replace(/\./g, '').replace(',', '.'));
  return 0;
}

async function mapBankzugangToAccount(z: BanksapiBankzugang, holderFallback: string) {
  const produkt = z.bankprodukte?.[0];
  const saldoNum =
    typeof produkt?.saldo === 'number'
      ? produkt.saldo
      : parseAmount((produkt?.saldo as any)?.betrag);

  // Friendly Bank-Name via Provider-Lookup statt UUID anzeigen.
  let bankName = 'Bank';
  if (z.providerId) {
    try {
      const providers = await getBanksapiProviders();
      const match = providers.find((p) => p.id === z.providerId);
      if (match?.name) bankName = match.name;
    } catch (_e) { /* fall back to default */ }
  }

  return {
    banksapiAccessId: z.id,
    banksapiProductId: produkt?.id || produkt?.iban || '',
    bankName,
    iban: produkt?.iban || '',
    bic: produkt?.bic || '',
    accountHolder: produkt?.inhaber || holderFallback,
    balance: saldoNum,
    color: '#4F6BFF',
    domain: '',
    consentExpiresAt: plusDays(90),
  };
}

function mapUmsatzToTransaction(u: BanksapiUmsatz) {
  const idObj = typeof u.identifier === 'object' ? u.identifier : null;
  const txId =
    (typeof u.identifier === 'string' ? u.identifier : undefined) ||
    idObj?.id ||
    idObj?.batchId ||
    u.primanotaNummer ||
    `${u.buchungsdatum || ''}-${u.betrag || ''}-${u.verwendungszweck || ''}`.slice(0, 64);
  return {
    banksapiTransactionId: txId,
    date: (u.buchungsdatum || u.wertstellungsdatum || todayMinus(0)).slice(0, 10),
    amount: parseAmount(u.betrag),
    counterparty: u.gegenkontoInhaber || '',
    purpose: u.verwendungszweck || '',
    iban: u.gegenkontoIban || undefined,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// STUB MODE — deterministische Mock-Daten (für UI-Tests ohne BANKSapi-Zugang)
// ═════════════════════════════════════════════════════════════════════════════

const STUB_BANKS: Record<string, { name: string; bic: string; color: string; domain: string }> = {
  'deutsche-bank': { name: 'Deutsche Bank (Sandbox)', bic: 'DEUTDEDB', color: '#0018A8', domain: 'deutsche-bank.de' },
  'sparkasse': { name: 'Sparkasse (Sandbox)', bic: 'SPKADE', color: '#FF0000', domain: 'sparkasse.de' },
  'commerzbank': { name: 'Commerzbank (Sandbox)', bic: 'COBADEFF', color: '#FFD700', domain: 'commerzbank.de' },
  'ing': { name: 'ING (Sandbox)', bic: 'INGDDEFF', color: '#FF6200', domain: 'ing.de' },
  'volksbank': { name: 'Volksbank (Sandbox)', bic: 'GENODED1', color: '#003399', domain: 'vr.de' },
  'n26': { name: 'N26 (Sandbox)', bic: 'NTSBDEB1', color: '#36A18B', domain: 'n26.com' },
  'dkb': { name: 'DKB (Sandbox)', bic: 'BYLADEM1001', color: '#007CC3', domain: 'dkb.de' },
  'postbank': { name: 'Postbank (Sandbox)', bic: 'PBNKDEFF', color: '#FFCC00', domain: 'postbank.de' },
};

function fakeIban(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const digits = Array.from({ length: 20 }, (_, i) => ((hash >> (i % 8)) + i) % 10).join('');
  return `DE${digits}`;
}

const STUB_TENANTS = [
  { name: 'Petra Wagner', rent: 750 },
  { name: 'Maria Schmidt', rent: 650 },
  { name: 'Jan Müller', rent: 680 },
  { name: 'Sabine Koch', rent: 700 },
];

function stubBuildAccount(bankKey: string, holder: string, userId: string) {
  const bank = STUB_BANKS[bankKey] || STUB_BANKS['deutsche-bank'];
  const accessId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  return {
    banksapiAccessId: accessId,
    banksapiProductId: productId,
    bankName: bank.name,
    iban: fakeIban(`${userId}-${accessId}`),
    bic: bank.bic,
    accountHolder: holder || 'Kontoinhaber',
    balance: 5000 + Math.floor(Math.random() * 25000),
    color: bank.color,
    domain: bank.domain,
    consentExpiresAt: plusDays(90),
  };
}

function stubBuildTransactions(accessId: string, isResync: boolean) {
  const txs: any[] = [];
  const now = new Date();
  const monthLabel = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const tenants = isResync ? STUB_TENANTS.slice(0, 1) : STUB_TENANTS;
  for (const t of tenants) {
    txs.push({
      banksapiTransactionId: `${accessId}-${t.name.replace(/\s+/g, '_')}-${now.getFullYear()}-${now.getMonth() + 1}`,
      date: todayMinus(Math.floor(Math.random() * 5) + 1),
      amount: t.rent,
      counterparty: t.name,
      purpose: `Miete ${monthLabel} ${t.name}`,
      iban: fakeIban(`tenant-${t.name}`),
    });
  }
  if (!isResync) {
    txs.push(
      {
        banksapiTransactionId: `${accessId}-hausverwaltung-${now.getFullYear()}-${now.getMonth() + 1}`,
        date: todayMinus(8),
        amount: -250,
        counterparty: 'Hausverwaltung GmbH',
        purpose: `Hausgeld ${monthLabel}`,
      },
      {
        banksapiTransactionId: `${accessId}-versicherung-${now.getFullYear()}-${now.getMonth() + 1}`,
        date: todayMinus(12),
        amount: -110,
        counterparty: 'DEVK Versicherung',
        purpose: `Gebäudeversicherung ${monthLabel}`,
      },
    );
  }
  return txs;
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTE HANDLERS — pickt je nach REAL_MODE die passende Implementierung
// ═════════════════════════════════════════════════════════════════════════════

interface ConnectStartBody {
  redirectUri: string;
  bankKey?: string;
  bankBic?: string;
  bankName?: string;
  bankDomain?: string;
  iban?: string;
  /** Direkt vom User über die Bank-Suche gewählte BANKSapi-Provider-UUID. */
  providerId?: string;
  accountHolder?: string;
  label?: string;
}

async function handleConnectStart(body: ConnectStartBody, customerIp: string) {
  if (!body.redirectUri) return jsonResponse({ error: 'redirectUri missing' }, 400);

  const accessId = crypto.randomUUID();

  // Gemeinsamer Query-String — wird sowohl von Stub als auch Real-Mode an die
  // App-Callback-URL angehängt, damit die Frontend-Callback-Page die Felder
  // wieder einlesen kann (label/holder werden NICHT an BANKSapi gesendet).
  const queryParts = [
    `accessId=${encodeURIComponent(accessId)}`,
    `bank=${encodeURIComponent(body.bankKey || '')}`,
    `bankName=${encodeURIComponent(body.bankName || '')}`,
    `bankDomain=${encodeURIComponent(body.bankDomain || '')}`,
    `holder=${encodeURIComponent(body.accountHolder || '')}`,
    `label=${encodeURIComponent(body.label || '')}`,
    'provider=banksapi',
  ];
  const sep = body.redirectUri.includes('?') ? '&' : '?';
  const appCallbackUrl = `${body.redirectUri}${sep}${queryParts.join('&')}`;

  if (REAL_MODE) {
    const webformUrl = await realCreateWebform({
      accessId,
      callbackUrl: appCallbackUrl,
      customerIp,
      providerId: body.providerId,
      bankBic: body.bankBic,
      iban: body.iban,
    });
    return jsonResponse({ redirectUrl: webformUrl, accessId, mode: 'real' });
  }

  // STUB: redirected direkt auf den Frontend-Callback mit fake-code zurück.
  const code = `stub-${accessId}`;
  const redirectUrl = `${appCallbackUrl}&code=${encodeURIComponent(code)}`;
  return jsonResponse({ redirectUrl, accessId, code, mode: 'stub' });
}

interface ConnectFinishBody {
  accessId?: string;
  code?: string;
  bankKey?: string;
  accountHolder?: string;
}

async function handleConnectFinish(body: ConnectFinishBody) {
  if (REAL_MODE) {
    if (!body.accessId) return jsonResponse({ error: 'accessId missing' }, 400);
    const zugang = await realGetBankzugang(body.accessId);
    if (zugang.status && zugang.status !== 'VOLLSTAENDIG') {
      return jsonResponse({ error: `Bankzugang nicht fertig: ${zugang.status}`, status: zugang.status }, 409);
    }
    // bankprodukte kann Array ODER keyed-object sein — beide Shapes normalisieren.
    const produkte = normalizeProdukte(zugang.bankprodukte);
    // eslint-disable-next-line no-console
    console.log(`[banksapi] zugang=${zugang.id} status=${zugang.status} produkte=${produkte.length}`);
    const account = await mapBankzugangToAccount({ ...zugang, bankprodukte: produkte }, body.accountHolder || '');
    const transactions: any[] = [];
    // Über ALLE Bankprodukte iterieren — User kann Giro + Sparbuch + Tagesgeld
    // im selben Zugang haben. Wir mergen die Umsätze. Dedup über productKey
    // gegen doppelte Fetches, danach Dedup der TX-IDs gegen UNIQUE-Index.
    const seenProductKeys = new Set<string>();
    const seenTxIds = new Set<string>();
    for (const produkt of produkte) {
      const productKey = produkt.iban || produkt.id || '';
      if (!productKey || seenProductKeys.has(productKey)) continue;
      seenProductKeys.add(productKey);
      try {
        const umsaetze = await realGetKontoumsaetze(zugang.id, productKey);
        for (const u of umsaetze) {
          const tx = mapUmsatzToTransaction(u);
          if (tx.banksapiTransactionId && seenTxIds.has(tx.banksapiTransactionId)) continue;
          if (tx.banksapiTransactionId) seenTxIds.add(tx.banksapiTransactionId);
          transactions.push(tx);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[banksapi] umsatz-fetch failed for product ${productKey}: ${(e as Error).message}`);
      }
    }
    return jsonResponse({ account, transactions, mode: 'real' });
  }

  // STUB
  if (!body.code) return jsonResponse({ error: 'code missing' }, 400);
  const fallbackUserId = 'stub-user';
  const account = stubBuildAccount(body.bankKey || 'deutsche-bank', body.accountHolder || '', fallbackUserId);
  // accessId aus Stub-Code beibehalten, falls Frontend ihn schon kennt
  if (body.accessId) account.banksapiAccessId = body.accessId;
  const transactions = stubBuildTransactions(account.banksapiAccessId, false);
  return jsonResponse({ account, transactions, mode: 'stub' });
}

async function handleAccountSync(accessId: string) {
  if (REAL_MODE) {
    await realRefreshBankzugang(accessId);
    const zugang = await realGetBankzugang(accessId);
    const produkte = normalizeProdukte(zugang.bankprodukte);
    const transactions: any[] = [];
    for (const produkt of produkte) {
      const productKey = produkt.iban || produkt.id || '';
      if (!productKey) continue;
      try {
        const umsaetze = await realGetKontoumsaetze(accessId, productKey);
        for (const u of umsaetze) transactions.push(mapUmsatzToTransaction(u));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[banksapi] sync umsatz-fetch failed for product ${productKey}: ${(e as Error).message}`);
      }
    }
    return jsonResponse({ accessId, transactions, mode: 'real' });
  }
  return jsonResponse({ accessId, transactions: stubBuildTransactions(accessId, true), mode: 'stub' });
}

/**
 * BANKSapi liefert `bankprodukte` mal als Array, mal als Objekt {productId: produkt}.
 * Wir normalisieren auf Array.
 */
function normalizeProdukte(raw: unknown): BanksapiBankprodukt[] {
  if (Array.isArray(raw)) return raw as BanksapiBankprodukt[];
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, BanksapiBankprodukt>);
  }
  return [];
}

async function handleAccountDisconnect(accessId: string) {
  if (REAL_MODE) {
    await realRevokeBankzugang(accessId);
  }
  return jsonResponse({ ok: true, mode: REAL_MODE ? 'real' : 'stub' });
}

// ── Entry Point ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const fnIdx = segments.findIndex((s) => s === 'banksapi-proxy');
  const route = fnIdx >= 0 ? segments.slice(fnIdx + 1).join('/') : '';

  const user = await requireUser(req);
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

  const customerIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';

  try {
    if (req.method === 'POST' && route === 'connect/start') {
      const body = (await req.json().catch(() => ({}))) as ConnectStartBody;
      return await handleConnectStart(body, customerIp);
    }
    if (req.method === 'POST' && route === 'connect/finish') {
      const body = (await req.json().catch(() => ({}))) as ConnectFinishBody;
      return await handleConnectFinish(body);
    }
    if (req.method === 'POST' && route.startsWith('accounts/') && route.endsWith('/sync')) {
      return await handleAccountSync(route.split('/')[1]);
    }
    if (req.method === 'POST' && route.startsWith('accounts/') && route.endsWith('/disconnect')) {
      return await handleAccountDisconnect(route.split('/')[1]);
    }
    if (req.method === 'GET' && route === 'mode') {
      return jsonResponse({ mode: REAL_MODE ? 'real' : 'stub' });
    }
    // GET /providers/search?q=<query>&limit=30 — Fuzzy-Suche über BANKSapi's
    // Provider-Liste (4000+ Banken). Liefert eine kompakte Liste {id, name,
    // bic, blz} sortiert nach Relevanz.
    if (req.method === 'GET' && route === 'providers/search') {
      if (!REAL_MODE) {
        return jsonResponse({
          providers: [
            { id: 'stub-dkb', name: 'DKB (Sandbox)', bic: 'BYLADEM1001', blz: '12030000' },
            { id: 'stub-ing', name: 'ING (Sandbox)', bic: 'INGDDEFFXXX', blz: '50010517' },
          ],
          mode: 'stub',
        });
      }
      const q = url.searchParams.get('q')?.trim().toLowerCase() || '';
      const limit = Math.min(Number(url.searchParams.get('limit')) || 30, 100);
      const providers = await getBanksapiProviders();
      const ranked = searchProviders(providers, q, limit);
      return jsonResponse({
        providers: ranked.map((p) => ({ id: p.id, name: p.name, bic: p.bic, blz: p.blz })),
        total: providers.length,
        mode: 'real',
      });
    }
    return jsonResponse({ error: 'Not Found', route, method: req.method }, 404);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message, mode: REAL_MODE ? 'real' : 'stub' }, 500);
  }
});
