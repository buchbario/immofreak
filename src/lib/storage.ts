export interface StorageAdapter<T extends { id: string }> {
  getAll(): T[];
  getById(id: string): T | undefined;
  getByField<K extends keyof T>(field: K, value: T[K]): T[];
  create(item: T): T;
  update(id: string, updates: Partial<T>): T;
  delete(id: string): void;
  subscribe(listener: () => void): () => void;
}

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

  /**
   * Pub-Sub: Alle gemounteten `useStorageAdapter`-Hooks abonnieren Änderungen,
   * damit Cross-Store-Writes (z. B. Trash-Restore, Cascade-Delete) überall
   * reaktiv erscheinen — ohne Page-Reload.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    // synchron — listener ruft setState, React batched
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

// Fix & Flip stores
export const projectStore = new LocalStorageAdapter<import('../types').Project>('immofreak_projects');
export const contractorStore = new LocalStorageAdapter<import('../types').Contractor>('immofreak_contractors');
export const budgetItemStore = new LocalStorageAdapter<import('../types').BudgetItem>('immofreak_budget_items');
export const projectContractorStore = new LocalStorageAdapter<import('../types').ProjectContractor>('immofreak_project_contractors');
export const projectPhotoStore = new LocalStorageAdapter<import('../types').ProjectPhoto>('immofreak_project_photos');
export const projectDocumentStore = new LocalStorageAdapter<import('../types').ProjectDocument>('immofreak_project_documents');

// Buy & Hold stores
export const rentalPropertyStore = new LocalStorageAdapter<import('../types').RentalProperty>('immofreak_rental_properties');
export const rentalUnitStore = new LocalStorageAdapter<import('../types').RentalUnit>('immofreak_rental_units');
export const tenantStore = new LocalStorageAdapter<import('../types').Tenant>('immofreak_tenants');
export const utilityStore = new LocalStorageAdapter<import('../types').Utility>('immofreak_utilities');
export const utilityCostStore = new LocalStorageAdapter<import('../types').UtilityCost>('immofreak_utility_costs');
export const tenantPaymentStore = new LocalStorageAdapter<import('../types').TenantPayment>('immofreak_tenant_payments');
export const expenseStore = new LocalStorageAdapter<import('../types').Expense>('immofreak_expenses');
export const meterReadingStore = new LocalStorageAdapter<import('../types').MeterReading>('immofreak_meter_readings');
export const rentalContractStore = new LocalStorageAdapter<import('../types').RentalContract>('immofreak_rental_contracts');
export const distributionKeyStore = new LocalStorageAdapter<import('../types').DistributionKey>('immofreak_distribution_keys');
export const contractDocumentStore = new LocalStorageAdapter<import('../types').ContractDocument>('immofreak_contract_documents');

// Property Photos & Documents
export const propertyPhotoStore = new LocalStorageAdapter<import('../types').PropertyPhoto>('immofreak_property_photos');
export const propertyDocumentStore = new LocalStorageAdapter<import('../types').PropertyDocument>('immofreak_property_documents');

// Deal Analyzer
export const dealAnalysisStore = new LocalStorageAdapter<import('../types').DealAnalysis>('immofreak_deal_analyses');

// Banking
export const bankAccountStore = new LocalStorageAdapter<import('../types').BankAccount>('immofreak_bank_accounts');
export const bankTransactionStore = new LocalStorageAdapter<import('../types').BankTransaction>('immofreak_bank_transactions');

// Tasks / Vorgänge
export const taskStore = new LocalStorageAdapter<import('../types').Task>('immofreak_tasks');

// Trash / Papierkorb
export const trashStore = new LocalStorageAdapter<import('../types').TrashItem>('immofreak_trash');

// Private Boards (Trello-style personal todos)
export const privateBoardStore = new LocalStorageAdapter<import('../types').PrivateBoard>('immofreak_private_boards');
export const privateListStore = new LocalStorageAdapter<import('../types').PrivateList>('immofreak_private_lists');
export const privateCardStore = new LocalStorageAdapter<import('../types').PrivateCard>('immofreak_private_cards');
