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
async function realCreateWebform(opts: {
  accessId: string;
  callbackUrl: string;
  customerIp: string;
}): Promise<string> {
  const token = await getBanksapiToken();
  const url = `${ENV.BANKSAPI_BASE_URL}/customer/v2/bankzugaenge?callbackUrl=${encodeURIComponent(opts.callbackUrl)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Customer-IP-Address': opts.customerIp,
    },
    body: JSON.stringify({ [opts.accessId]: {} }),
    redirect: 'manual',
  });
  // BANKSapi liefert 451 (Unavailable For Legal Reasons) als Signal für
  // "User-Interaction benötigt" — die eigentliche Webform-URL steht im
  // Location-Header. 201/200 wären andere Statuscodes je nach Doc-Version.
  if (![451, 201, 200].includes(res.status)) {
    const txt = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    throw new Error(`BANKSapi webform request failed (${res.status}): body="${txt}" url="${url}" headers=${JSON.stringify(headers)}`);
  }
  const location = res.headers.get('Location') || res.headers.get('location');
  if (!location) throw new Error('BANKSapi gab keine Webform-URL zurück (Location-Header fehlt)');
  return location;
}

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
 */
async function realGetKontoumsaetze(accessId: string, productId: string): Promise<BanksapiUmsatz[]> {
  const token = await getBanksapiToken();
  const res = await fetch(
    `${ENV.BANKSAPI_BASE_URL}/customer/v2/bankzugaenge/${accessId}/${encodeURIComponent(productId)}/kontoumsaetze`,
    { headers: { 'Authorization': `Bearer ${token}` } },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`BANKSapi kontoumsaetze fetch failed (${res.status}): ${txt}`);
  }
  const json = await res.json();
  // Doc ist unscharf — entweder Array oder Wrapper mit `kontoumsaetze[]`.
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.kontoumsaetze)) return json.kontoumsaetze;
  if (Array.isArray(json?.umsaetze)) return json.umsaetze;
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

function mapBankzugangToAccount(z: BanksapiBankzugang, holderFallback: string) {
  const produkt = z.bankprodukte?.[0];
  const saldoNum =
    typeof produkt?.saldo === 'number'
      ? produkt.saldo
      : parseAmount((produkt?.saldo as any)?.betrag);
  return {
    banksapiAccessId: z.id,
    banksapiProductId: produkt?.id || produkt?.iban || '',
    bankName: z.providerId || 'Bank', // TODO: über /providers/v2 in echten Banknamen auflösen
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
    `holder=${encodeURIComponent(body.accountHolder || '')}`,
    `label=${encodeURIComponent(body.label || '')}`,
    'provider=banksapi',
  ];
  const sep = body.redirectUri.includes('?') ? '&' : '?';
  const appCallbackUrl = `${body.redirectUri}${sep}${queryParts.join('&')}`;

  if (REAL_MODE) {
    const webformUrl = await realCreateWebform({ accessId, callbackUrl: appCallbackUrl, customerIp });
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
    const account = mapBankzugangToAccount(zugang, body.accountHolder || '');
    const produkt = zugang.bankprodukte?.[0];
    const transactions: any[] = [];
    if (produkt) {
      const productKey = produkt.id || produkt.iban || '';
      if (productKey) {
        const umsaetze = await realGetKontoumsaetze(zugang.id, productKey);
        for (const u of umsaetze) transactions.push(mapUmsatzToTransaction(u));
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
    const produkt = zugang.bankprodukte?.[0];
    const transactions: any[] = [];
    if (produkt) {
      const productKey = produkt.id || produkt.iban || '';
      if (productKey) {
        const umsaetze = await realGetKontoumsaetze(accessId, productKey);
        for (const u of umsaetze) transactions.push(mapUmsatzToTransaction(u));
      }
    }
    return jsonResponse({ accessId, transactions, mode: 'real' });
  }
  return jsonResponse({ accessId, transactions: stubBuildTransactions(accessId, true), mode: 'stub' });
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
    return jsonResponse({ error: 'Not Found', route, method: req.method }, 404);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message, mode: REAL_MODE ? 'real' : 'stub' }, 500);
  }
});
