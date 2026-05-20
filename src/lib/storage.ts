import { supabase } from './supabase';
import { objectToRow, rowToObject } from './caseMapping';

/**
 * StorageAdapter — gemeinsames Interface zwischen LocalStorage- und
 * Supabase-Backend. Synchron, damit React-Hooks ohne Suspense laufen.
 */
export interface StorageAdapter<T extends { id: string }> {
  getAll(): T[];
  getById(id: string): T | undefined;
  getByField<K extends keyof T>(field: K, value: T[K]): T[];
  create(item: T): T;
  update(id: string, updates: Partial<T>): T;
  delete(id: string): void;
  subscribe(listener: () => void): () => void;
  /** Verwirft den Cache und triggert einen Refetch (Supabase-Variante). No-op bei LocalStorage. */
  invalidate(): void;
}

// =====================================================================
// LocalStorage Adapter (für Demo / Offline / Legacy)
// =====================================================================

export class LocalStorageAdapter<T extends { id: string }> implements StorageAdapter<T> {
  key: string;
  private listeners = new Set<() => void>();

  constructor(key: string) {
    this.key = key;
  }

  read(): T[] {
    const data = localStorage.getItem(this.key);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch (err) {
      // Korruptes JSON darf die App nicht crashen — Eintrag verwerfen und mit leerer Liste weitermachen.
      // eslint-disable-next-line no-console
      console.warn(`[LocalStorageAdapter:${this.key}] korruptes JSON verworfen`, err);
      try { localStorage.removeItem(this.key); } catch { /* ignore */ }
      return [];
    }
  }

  write(items: T[]): void {
    localStorage.setItem(this.key, JSON.stringify(items));
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  getAll(): T[] {
    return this.read();
  }

  getById(id: string): T | undefined {
    return this.read().find((item) => item.id === id);
  }

  getByField<K extends keyof T>(field: K, value: T[K]): T[] {
    return this.read().filter((item) => item[field] === value);
  }

  create(item: T): T {
    const items = this.read();
    items.push(item);
    this.write(items);
    return item;
  }

  update(id: string, updates: Partial<T>): T {
    const items = this.read();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) throw new Error(`Item with id ${id} not found`);
    items[index] = { ...items[index], ...updates };
    this.write(items);
    return items[index];
  }

  delete(id: string): void {
    const items = this.read().filter((item) => item.id !== id);
    this.write(items);
  }

  invalidate(): void {
    // Synchroner Speicher — kein Cache zu invalidieren. Wir notifizieren trotzdem,
    // damit aufrufender Code (z.B. nach externen Inserts) einheitlich `invalidate()`
    // nutzen kann.
    this.notify();
  }
}

// =====================================================================
// Supabase Adapter
// =====================================================================
//
// Synchroner StorageAdapter über Postgres via supabase-js.
// - Hält intern einen Cache, den `getAll()` synchron liefert.
// - Beim ersten subscribe wird einmalig ein async fetch gestartet, der den
//   Cache füllt und alle Listener notifiziert.
// - Mutationen sind optimistisch: Cache wird sofort aktualisiert + listener
//   getriggert, der Supabase-Call läuft im Hintergrund. Bei Fehler wird
//   revertiert + erneut notifiziert.
// - Bei Auth-Wechsel (Login/Logout) wird der Cache invalidiert.
// =====================================================================

const ALL_SUPABASE_ADAPTERS: SupabaseAdapter<{ id: string }>[] = [];

const CACHE_VERSION = 1;
const CACHE_PREFIX = `supacache:v${CACHE_VERSION}:`;

function cacheKey(table: string): string {
  return `${CACHE_PREFIX}${table}`;
}

function clearAllSupabaseCaches(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch { /* ignore */ }
}

// Auth-Events:
//  • INITIAL_SESSION / TOKEN_REFRESHED → kein Reset. Der erste fires beim Page-Load,
//    der zweite alle ~50 Min. Bei jedem Reload den Cache wegzuwerfen würde die
//    UI auf leer setzen bis der nächste Fetch durch ist — exakt der "alles ist
//    kurz weg"-Effekt, den der User vermeiden will.
//  • SIGNED_OUT / SIGNED_IN / USER_UPDATED → Cache invalidieren, da sich der
//    User-Kontext ändert und RLS andere Zeilen zurückgibt.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
  if (event === 'SIGNED_OUT') clearAllSupabaseCaches();
  for (const a of ALL_SUPABASE_ADAPTERS) {
    a.invalidate();
  }
});

export class SupabaseAdapter<T extends { id: string }> implements StorageAdapter<T> {
  table: string;
  private orderBy: string;
  private cache: T[] = [];
  private fetched = false;
  private fetchInFlight: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  constructor(table: string, orderBy = 'created_at') {
    this.table = table;
    this.orderBy = orderBy;
    ALL_SUPABASE_ADAPTERS.push(this as unknown as SupabaseAdapter<{ id: string }>);
    // Letzten Snapshot aus localStorage laden — so zeigt die UI beim Reload
    // sofort die zuletzt gesehenen Daten an, statt einen leeren Zustand bis
    // der erste Supabase-Fetch zurück ist (typisch 300-800ms).
    this.hydrateFromCache();
  }

  private hydrateFromCache(): void {
    try {
      const raw = localStorage.getItem(cacheKey(this.table));
      if (!raw) return;
      const parsed = JSON.parse(raw) as T[];
      if (Array.isArray(parsed)) this.cache = parsed;
    } catch { /* corrupt cache — ignore */ }
  }

  private persistCache(): void {
    try {
      localStorage.setItem(cacheKey(this.table), JSON.stringify(this.cache));
    } catch { /* quota oder serialization fail — ignorieren */ }
  }

  /** Cache leeren — nächster subscribe holt frisch. */
  invalidate(): void {
    this.cache = [];
    this.fetched = false;
    this.fetchInFlight = null;
    try { localStorage.removeItem(cacheKey(this.table)); } catch { /* ignore */ }
    this.notify();
    // Wenn bereits Listener da sind, gleich neu fetchen
    if (this.listeners.size > 0) {
      void this.ensureFetched();
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    void this.ensureFetched();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.persistCache();
    this.listeners.forEach((l) => l());
  }

  private async ensureFetched(): Promise<void> {
    if (this.fetched) return;
    if (this.fetchInFlight) return this.fetchInFlight;

    this.fetchInFlight = (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        this.cache = [];
        this.fetched = true;
        this.fetchInFlight = null;
        this.notify();
        return;
      }
      const { data, error } = await supabase
        .from(this.table)
        .select('*')
        .order(this.orderBy, { ascending: true });
      if (error) {
        // eslint-disable-next-line no-console
        console.error(`[supabase:${this.table}] fetch fehlgeschlagen:`, error.message);
        this.cache = [];
      } else {
        this.cache = (data ?? []).map((row) => rowToObject<T>(row as Record<string, unknown>));
      }
      this.fetched = true;
      this.fetchInFlight = null;
      this.notify();
    })();

    return this.fetchInFlight;
  }

  getAll(): T[] {
    return this.cache;
  }

  getById(id: string): T | undefined {
    return this.cache.find((it) => it.id === id);
  }

  getByField<K extends keyof T>(field: K, value: T[K]): T[] {
    return this.cache.filter((it) => it[field] === value);
  }

  create(item: T): T {
    // Optimistic insert
    this.cache = [...this.cache, item];
    this.notify();

    void (async () => {
      const row = objectToRow(item as unknown as Record<string, unknown>);
      // user_id wird per DB-Default `auth.uid()` gefüllt — wir lassen es weg.
      delete row.user_id;
      const { error } = await supabase.from(this.table).insert(row);
      if (error) {
        // eslint-disable-next-line no-console
        console.error(`[supabase:${this.table}] insert fehlgeschlagen:`, error.message);
        // revert
        this.cache = this.cache.filter((it) => it.id !== item.id);
        this.notify();
      }
    })();

    return item;
  }

  update(id: string, updates: Partial<T>): T {
    const idx = this.cache.findIndex((it) => it.id === id);
    if (idx === -1) throw new Error(`Item with id ${id} not found`);
    const previous = this.cache[idx];
    const next = { ...previous, ...updates };
    this.cache = [...this.cache.slice(0, idx), next, ...this.cache.slice(idx + 1)];
    this.notify();

    void (async () => {
      const row = objectToRow(updates as unknown as Record<string, unknown>);
      delete row.id;
      delete row.user_id;
      const { error } = await supabase.from(this.table).update(row).eq('id', id);
      if (error) {
        // eslint-disable-next-line no-console
        console.error(`[supabase:${this.table}] update fehlgeschlagen:`, error.message);
        // revert
        this.cache = [
          ...this.cache.slice(0, idx),
          previous,
          ...this.cache.slice(idx + 1),
        ];
        this.notify();
      }
    })();

    return next;
  }

  delete(id: string): void {
    const previous = this.cache.find((it) => it.id === id);
    this.cache = this.cache.filter((it) => it.id !== id);
    this.notify();

    void (async () => {
      const { error } = await supabase.from(this.table).delete().eq('id', id);
      if (error) {
        // eslint-disable-next-line no-console
        console.error(`[supabase:${this.table}] delete fehlgeschlagen:`, error.message);
        if (previous) {
          this.cache = [...this.cache, previous];
          this.notify();
        }
      }
    })();
  }
}

// =====================================================================
// Stores — Routing zur Boot-Zeit:
//   • Demo-Modus (immofreak_demo=true) → LocalStorageAdapter (offline, ohne DB)
//   • Echter Login                    → SupabaseAdapter (Multi-Tenant, RLS)
// Beim Wechsel zwischen den Modi wird die App komplett neu geladen
// (window.location reload), damit die Store-Module neu initialisiert werden.
// =====================================================================

const IS_DEMO =
  typeof window !== 'undefined' &&
  window.localStorage.getItem('immofreak_demo') === 'true';

function makeStore<T extends { id: string }>(
  table: string,
  localKey: string,
  orderBy = 'created_at',
): StorageAdapter<T> {
  return IS_DEMO
    ? new LocalStorageAdapter<T>(localKey)
    : new SupabaseAdapter<T>(table, orderBy);
}

// Fix & Flip
export const projectStore             = makeStore<import('../types').Project>('projects', 'immofreak_projects');
export const contractorStore          = makeStore<import('../types').Contractor>('contractors', 'immofreak_contractors');
export const budgetItemStore          = makeStore<import('../types').BudgetItem>('budget_items', 'immofreak_budget_items');
export const projectContractorStore   = makeStore<import('../types').ProjectContractor>('project_contractors', 'immofreak_project_contractors', 'assigned_at');
export const projectPhotoStore        = makeStore<import('../types').ProjectPhoto>('project_photos', 'immofreak_project_photos');
export const projectDocumentStore     = makeStore<import('../types').ProjectDocument>('project_documents', 'immofreak_project_documents');

// Buy & Hold
export const rentalPropertyStore      = makeStore<import('../types').RentalProperty>('rental_properties', 'immofreak_rental_properties');
export const rentalUnitStore          = makeStore<import('../types').RentalUnit>('rental_units', 'immofreak_rental_units');
export const tenantStore              = makeStore<import('../types').Tenant>('tenants', 'immofreak_tenants');
export const utilityStore             = makeStore<import('../types').Utility>('utilities', 'immofreak_utilities');
export const utilityCostStore         = makeStore<import('../types').UtilityCost>('utility_costs', 'immofreak_utility_costs');
export const tenantPaymentStore       = makeStore<import('../types').TenantPayment>('tenant_payments', 'immofreak_tenant_payments');
export const expenseStore             = makeStore<import('../types').Expense>('expenses', 'immofreak_expenses');
export const meterReadingStore        = makeStore<import('../types').MeterReading>('meter_readings', 'immofreak_meter_readings');
export const rentalContractStore      = makeStore<import('../types').RentalContract>('rental_contracts', 'immofreak_rental_contracts');
export const distributionKeyStore     = makeStore<import('../types').DistributionKey>('distribution_keys', 'immofreak_distribution_keys');
export const contractDocumentStore    = makeStore<import('../types').ContractDocument>('contract_documents', 'immofreak_contract_documents');

// Property Photos & Documents
export const propertyPhotoStore       = makeStore<import('../types').PropertyPhoto>('property_photos', 'immofreak_property_photos');
export const propertyDocumentStore    = makeStore<import('../types').PropertyDocument>('property_documents', 'immofreak_property_documents');

// Deal Analyzer
export const dealAnalysisStore        = makeStore<import('../types').DealAnalysis>('deal_analyses', 'immofreak_deal_analyses');

// Banking
export const bankAccountStore         = makeStore<import('../types').BankAccount>('bank_accounts', 'immofreak_bank_accounts');
export const bankTransactionStore     = makeStore<import('../types').BankTransaction>('bank_transactions', 'immofreak_bank_transactions');
export const tenantPaymentMappingStore = makeStore<import('../types').TenantPaymentMapping>('tenant_payment_mappings', 'immofreak_tenant_payment_mappings');

// Tasks
export const taskStore                = makeStore<import('../types').Task>('tasks', 'immofreak_tasks');

// Leads (Fix & Flip Akquise-Pipeline)
export const leadStore                = makeStore<import('../types').Lead>('leads', 'immofreak_leads');

// Trash
export const trashStore               = makeStore<import('../types').TrashItem>('trash', 'immofreak_trash', 'deleted_at');

// Private Boards
export const privateBoardStore        = makeStore<import('../types').PrivateBoard>('private_boards', 'immofreak_private_boards');
export const privateListStore         = makeStore<import('../types').PrivateList>('private_lists', 'immofreak_private_lists');
export const privateCardStore         = makeStore<import('../types').PrivateCard>('private_cards', 'immofreak_private_cards');
