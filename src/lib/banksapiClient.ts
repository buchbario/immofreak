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
    // supabase-js's FunctionsHttpError versteckt die echte Fehlermeldung. Der
    // Response-Body steckt aber als Response-Objekt in error.context — also
    // hier auspacken, sonst sieht der User nur "Edge Function returned a
    // non-2xx status code" statt der konkreten Ursache.
    const ctx = (error as { context?: Response & { status?: number } }).context;
    let bodyMsg = '';
    if (ctx && typeof (ctx as Response).text === 'function') {
      try {
        const txt = await (ctx as Response).clone().text();
        try {
          const j = JSON.parse(txt);
          bodyMsg = (j && (j.error || j.message)) || '';
        } catch {
          bodyMsg = txt.slice(0, 600);
        }
      } catch { /* ignore */ }
    }

    const msg = error.message || '';
    // 404 → Function ist gar nicht deployed.
    if (ctx?.status === 404) {
      throw new Error(
        'Edge Function `banksapi-proxy` ist nicht deployed.\n\n' +
          'Deploy-Anleitung:\n' +
          '1. Supabase CLI installieren: `brew install supabase/tap/supabase`\n' +
          '2. Projekt verlinken: `supabase link --project-ref hlzlzhkedayfgoxphhbs`\n' +
          '3. Deployen: `supabase functions deploy banksapi-proxy`',
      );
    }
    // 5xx oder Netzwerk-/Timeout-Fehler → transientes Problem, „bitte erneut".
    // Auf Mobile kann ein längerer Sync (BANKSapi-Polling ~15s) die Verbindung
    // verlieren, ohne dass die Function selbst kaputt ist.
    const isTransient =
      (typeof ctx?.status === 'number' && ctx.status >= 500) ||
      msg.includes('Failed to send a request') ||
      msg.includes('FunctionsFetchError') ||
      msg.includes('Failed to fetch') ||
      msg.includes('timeout');
    if (isTransient) {
      throw new Error(
        'Verbindung zur Bank-Schnittstelle unterbrochen. Bitte in ein paar Sekunden erneut versuchen.\n' +
          'Bei stabiler WLAN-Verbindung klappt der Abruf meist beim zweiten Versuch.',
      );
    }
    throw new Error(bodyMsg || msg || 'Unbekannter Edge-Function-Fehler');
  }
  if ((data as { error?: string } | null)?.error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export function startBanksapiConnect(opts: {
  redirectUri: string;
  bankKey: string;
  /** BANKSapi-Provider-UUID (vom Bank-Picker in der UI gesetzt — die robusteste Option). */
  providerId?: string;
  /** BIC der gewählten Bank — Edge Function nutzt das als Fallback zur Provider-Auflösung. */
  bankBic?: string;
  /** Banknamen (z.B. "Revolut Bank") — wird durch URL geschleust für die
   *  Loading-Animation im Callback. */
  bankName?: string;
  /** Logo-Domain (z.B. "revolut.com") — für das Logo im Callback-Loading. */
  bankDomain?: string;
  /** IBAN des Users (optional). Wird genutzt um die exakte Filiale per BLZ zu finden
   *  — wichtig bei Sparkasse/Volksbank wo der BIC mehrdeutig ist. */
  iban?: string;
  accountHolder?: string;
  /** Optionale interne Konto-Bezeichnung — wird im Callback wieder eingelesen. */
  label?: string;
}) {
  return invoke<{ redirectUrl: string; code: string; mode: string }>('connect/start', opts);
}

export interface BanksapiProviderHit {
  id: string;
  name: string;
  bic?: string;
  blz?: string;
}

/**
 * Sucht in BANKSapi's 4000+ Banken nach Namen/BIC/BLZ. Liefert top 30
 * Treffer sortiert nach Relevanz.
 */
export async function searchBanksapiProviders(query: string): Promise<BanksapiProviderHit[]> {
  const path = `providers/search?q=${encodeURIComponent(query)}&limit=30`;
  const res = await invoke<{ providers: BanksapiProviderHit[] }>(path, undefined, 'GET');
  return res.providers || [];
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

/**
 * Triggert einen Refresh bei BANKSapi für genau ein Konto. `productKey`
 * (productId oder IBAN, das was wir im DB-Feld `banksapiProductId` gespeichert
 * haben) ist wichtig wenn der Bankzugang mehrere Produkte enthält (Giro+
 * Tagesgeld). Ohne den Key würde die Edge Function das erste Produkt nehmen
 * und der Saldo wäre für das angefragte Konto falsch.
 */
export function syncBanksapiAccount(accessId: string, productKey?: string) {
  return invoke<{
    accessId: string;
    account: BanksapiAccount | null;
    transactions: BanksapiTransaction[];
    mode: string;
    /** 'fresh' = BANKSapi hat VOLLSTAENDIG-Status erreicht (Saldo + Umsätze
     *  sind frisch von der Bank). 'stale' = Server-Timeout, Daten könnten
     *  noch in Bearbeitung sein. */
    freshness?: 'fresh' | 'stale';
    bankStatus?: string;
  }>(
    `accounts/${accessId}/sync`,
    productKey ? { productKey } : {},
  );
}

export function disconnectBanksapiAccount(accessId: string) {
  return invoke<{ ok: boolean; mode: string }>(`accounts/${accessId}/disconnect`, {});
}
