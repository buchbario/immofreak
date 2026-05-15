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
    return data ? JSON.parse(data) : [];
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

// Bei jedem Login/Logout alle Adapter zurücksetzen, damit der nächste
// Subscribe neu fetcht (mit der Identity des neu eingeloggten Users).
supabase.auth.onAuthStateChange((_event) => {
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
  }

  /** Cache leeren — nächster subscribe holt frisch. */
  invalidate(): void {
    this.cache = [];
    this.fetched = false;
    this.fetchInFlight = null;
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
// Stores — Aktive Datenquelle ist Supabase. Wer auf LocalStorage
// zurückwechseln will (z. B. Demo ohne DB), kann hier umstellen:
//   const Store = USE_SUPABASE ? SupabaseAdapter : LocalStorageAdapter;
// =====================================================================

const Store = SupabaseAdapter;

// Fix & Flip
export const projectStore             = new Store<import('../types').Project>('projects');
export const contractorStore          = new Store<import('../types').Contractor>('contractors');
export const budgetItemStore          = new Store<import('../types').BudgetItem>('budget_items');
export const projectContractorStore   = new Store<import('../types').ProjectContractor>('project_contractors', 'assigned_at');
export const projectPhotoStore        = new Store<import('../types').ProjectPhoto>('project_photos');
export const projectDocumentStore     = new Store<import('../types').ProjectDocument>('project_documents');

// Buy & Hold
export const rentalPropertyStore      = new Store<import('../types').RentalProperty>('rental_properties');
export const rentalUnitStore          = new Store<import('../types').RentalUnit>('rental_units');
export const tenantStore              = new Store<import('../types').Tenant>('tenants');
export const utilityStore             = new Store<import('../types').Utility>('utilities');
export const utilityCostStore         = new Store<import('../types').UtilityCost>('utility_costs');
export const tenantPaymentStore       = new Store<import('../types').TenantPayment>('tenant_payments');
export const expenseStore             = new Store<import('../types').Expense>('expenses');
export const meterReadingStore        = new Store<import('../types').MeterReading>('meter_readings');
export const rentalContractStore      = new Store<import('../types').RentalContract>('rental_contracts');
export const distributionKeyStore     = new Store<import('../types').DistributionKey>('distribution_keys');
export const contractDocumentStore    = new Store<import('../types').ContractDocument>('contract_documents');

// Property Photos & Documents
export const propertyPhotoStore       = new Store<import('../types').PropertyPhoto>('property_photos');
export const propertyDocumentStore    = new Store<import('../types').PropertyDocument>('property_documents');

// Deal Analyzer
export const dealAnalysisStore        = new Store<import('../types').DealAnalysis>('deal_analyses');

// Banking
export const bankAccountStore         = new Store<import('../types').BankAccount>('bank_accounts');
export const bankTransactionStore     = new Store<import('../types').BankTransaction>('bank_transactions');

// Tasks
export const taskStore                = new Store<import('../types').Task>('tasks');

// Trash
export const trashStore               = new Store<import('../types').TrashItem>('trash', 'deleted_at');

// Private Boards
export const privateBoardStore        = new Store<import('../types').PrivateBoard>('private_boards');
export const privateListStore         = new Store<import('../types').PrivateList>('private_lists');
export const privateCardStore         = new Store<import('../types').PrivateCard>('private_cards');
