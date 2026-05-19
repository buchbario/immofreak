import { supabase } from './supabase';

/**
 * Wrapper für die Supabase Edge Function `banksapi-proxy`.
 * Die Function hält alle Secrets (BANKSAPI_CLIENT_SECRET etc.) — der Browser
 * schickt nur den Supabase-JWT mit, damit die Function den User identifizieren
 * kann.
 *
 * Aktueller Stand: Stub-Phase. Die Function liefert deterministische Mock-Daten
 * zurück, persistiert aber noch nichts in Postgres. Schritt 7 ersetzt den Stub
 * durch echte BANKSapi-REST-Calls + serverseitige Token-Persistierung.
 */

export interface BanksapiAccount {
  banksapiAccessId: string;
  banksapiProductId: string;
  bankName: string;
  iban: string;
  bic: string;
  accountHolder: string;
  balance: number;
  color: string;
  domain: string;
  consentExpiresAt: string;
}

export interface BanksapiTransaction {
  banksapiTransactionId: string;
  date: string;
  amount: number;
  counterparty: string;
  purpose: string;
  iban?: string;
}

async function invoke<T>(path: string, body?: Record<string, unknown>, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(`banksapi-proxy/${path}`, {
    method,
    body,
  });
  if (error) {
    // supabase-js wirft bei nicht-deployten Functions einen FunctionsFetchError,
    // weil der Gateway 404 liefert (kein CORS-konformer JSON-Response). Wir
    // mappen das hier auf eine konkrete Deploy-Anweisung, damit der User nicht
    // raten muss.
    const ctx = (error as { context?: { status?: number } }).context;
    const msg = error.message || '';
    const isMissingDeploy =
      ctx?.status === 404 ||
      msg.includes('Failed to send a request') ||
      msg.includes('FunctionsFetchError') ||
      msg.includes('Failed to fetch');
    if (isMissingDeploy) {
      throw new Error(
        'Edge Function `banksapi-proxy` ist nicht erreichbar.\n\n' +
          'Deploy-Anleitung:\n' +
          '1. Supabase CLI installieren: `brew install supabase/tap/supabase`\n' +
          '2. Projekt verlinken: `supabase link --project-ref hlzlzhkedayfgoxphhbs`\n' +
          '3. Deployen: `supabase functions deploy banksapi-proxy`',
      );
    }
    throw new Error(msg || 'Unbekannter Edge-Function-Fehler');
  }
  if ((data as { error?: string } | null)?.error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export function startBanksapiConnect(opts: {
  redirectUri: string;
  bankKey: string;
  /** BIC der gewählten Bank — Edge Function nutzt das zur Provider-Auflösung. */
  bankBic?: string;
  /** IBAN des Users (optional). Wird genutzt um die exakte Filiale per BLZ zu finden
   *  — wichtig bei Sparkasse/Volksbank wo der BIC mehrdeutig ist. */
  iban?: string;
  accountHolder?: string;
  /** Optionale interne Konto-Bezeichnung — wird im Callback wieder eingelesen. */
  label?: string;
}) {
  return invoke<{ redirectUrl: string; code: string; mode: string }>('connect/start', opts);
}

export function finishBanksapiConnect(opts: {
  accessId?: string;
  code?: string;
  bankKey: string;
  accountHolder?: string;
}) {
  return invoke<{ account: BanksapiAccount; transactions: BanksapiTransaction[]; mode: string }>(
    'connect/finish',
    opts,
  );
}

export function getBanksapiMode() {
  return invoke<{ mode: 'real' | 'stub' }>('mode', undefined, 'GET');
}

export function syncBanksapiAccount(accessId: string) {
  return invoke<{ accessId: string; transactions: BanksapiTransaction[]; mode: string }>(
    `accounts/${accessId}/sync`,
    {},
  );
}

export function disconnectBanksapiAccount(accessId: string) {
  return invoke<{ ok: boolean; mode: string }>(`accounts/${accessId}/disconnect`, {});
}
