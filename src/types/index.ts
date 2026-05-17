// ============= App Mode =============
export type AppMode = 'fixflip' | 'buyhold' | 'private';

// ============= Private Boards (Trello-style personal todos) =============
export interface PrivateBoard {
  id: string;
  name: string;
  /** Optional emoji or short prefix shown in the sidebar/header */
  icon?: string;
  /** Tailwind gradient classes, e.g. 'from-violet-400 to-fuchsia-500' */
  accent?: string;
  /** Sort order in the boards list (lower = earlier) */
  order: number;
  /** Pinned to sidebar — shows as a quick-access nav entry */
  pinned?: boolean;
  /** Sort order among pinned boards in the sidebar (lower = earlier) */
  pinOrder?: number;
  createdAt: string;
}

export interface PrivateList {
  id: string;
  boardId: string;
  name: string;
  order: number;
  createdAt: string;
}

export type PrivateCardPriority = 'low' | 'normal' | 'high';

export interface PrivateChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface PrivateCard {
  id: string;
  listId: string;
  boardId: string;
  title: string;
  description?: string;
  /** ISO date string */
  dueDate?: string;
  priority?: PrivateCardPriority;
  /** Free-form labels (chips) */
  labels?: string[];
  checklist?: PrivateChecklistItem[];
  order: number;
  createdAt: string;
  /** ISO date when it was completed (Done column) — for stats */
  completedAt?: string;
}

// ============= Leads (Akquise-Pipeline) =============
export type LeadStatus =
  | 'Lead'
  | 'Erstkontakt'
  | 'Kalkulation'
  | 'Besichtigung'
  | 'Angebot'
  | 'Unterlagenprüfung'
  | 'Follow-Up'
  | 'Deal'
  | 'Archiv';

export const LEAD_STATUSES: LeadStatus[] = [
  'Lead',
  'Erstkontakt',
  'Kalkulation',
  'Besichtigung',
  'Angebot',
  'Unterlagenprüfung',
  'Follow-Up',
  'Deal',
  'Archiv',
];

export interface Lead {
  id: string;
  name: string;
  status: LeadStatus;
  address?: string;
  rooms?: number;
  area?: number;
  askingPrice?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  immoscoutUrl?: string;
  /** Sortierung innerhalb der Spalte (Drag & Drop) */
  order: number;
  createdAt: string;
  updatedAt: string;
}

// ============= Fix & Flip Types =============
export type ProjectStatus = 'Akquise' | 'Planung' | 'Sanierung' | 'Verkauf' | 'Abgeschlossen';
export type BudgetItemStatus = 'geplant' | 'beauftragt' | 'abgeschlossen';
export type Trade =
  | 'Maler'
  | 'Elektriker'
  | 'Klempner'
  | 'Tischler'
  | 'Fliesenleger'
  | 'Dachdecker'
  | 'Maurer'
  | 'Trockenbauer'
  | 'Bodenleger'
  | 'Sanitär'
  | 'Home Staging'
  | 'Sonstige';

export const PROJECT_STATUSES: ProjectStatus[] = [
  'Akquise', 'Planung', 'Sanierung', 'Verkauf', 'Abgeschlossen',
];

export const TRADES: Trade[] = [
  'Maler', 'Elektriker', 'Klempner', 'Tischler', 'Fliesenleger',
  'Dachdecker', 'Maurer', 'Trockenbauer', 'Bodenleger', 'Sanitär', 'Home Staging', 'Sonstige',
];

export const BUDGET_ITEM_STATUSES: BudgetItemStatus[] = [
  'geplant', 'beauftragt', 'abgeschlossen',
];

export interface Project {
  id: string;
  name: string;
  address: string;
  purchasePrice: number;
  targetSellPrice: number;
  arv: number;
  renovationBudget: number;
  status: ProjectStatus;
  notes: string;
  /** Optionale URL zum Immoscout-Inserat — wird in der Projekt-Sidebar verlinkt. */
  immoscoutUrl?: string;
  /** Optionale URL zum Grundbuchauszug (z. B. Cloud-PDF, Notar-Portal). */
  grundbuchUrl?: string;
  /** Optionale URL zum externen Exposé-PDF (unabhängig vom eingebauten Exposé-Generator). */
  exposeUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contractor {
  id: string;
  name: string;
  company: string;
  trade: Trade;
  phone: string;
  email: string;
  address: string;
  hourlyRate: number;
  rating: number;
  notes: string;
  createdAt: string;
}

export interface BudgetItem {
  id: string;
  projectId: string;
  contractorId?: string;
  category: string;
  description: string;
  estimatedCost: number;
  actualCost: number;
  status: BudgetItemStatus;
  createdAt: string;
}

export interface ProjectContractor {
  id: string;
  projectId: string;
  contractorId: string;
  assignedAt: string;
}

export interface ProjectPhoto {
  id: string;
  projectId: string;
  name: string;
  dataUrl: string;
  createdAt: string;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  createdAt: string;
}

// ============= Buy & Hold Types =============
export interface RentalProperty {
  id: string;
  name: string;
  address: string;
  purchasePrice: number;
  currentValue: number;
  purchaseDate: string;
  units: number;
  totalArea: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentalUnit {
  id: string;
  propertyId: string;
  name: string;
  area: number;
  rooms: number;
  currentRent: number;
  targetRent: number;
  tenantId?: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  unitId?: string;
  propertyId: string;
  moveInDate: string;
  leaseStart: string;
  leaseEnd?: string;
  deposit: number;
  notes: string;
  createdAt: string;
}

export type UtilityType = 'Strom' | 'Gas' | 'Wasser' | 'Heizung' | 'Internet' | 'Müllabfuhr' | 'Grundsteuer' | 'Versicherung' | 'Hausverwaltung' | 'Sonstige';

export const UTILITY_TYPES: UtilityType[] = [
  'Strom', 'Gas', 'Wasser', 'Heizung', 'Internet', 'Müllabfuhr', 'Grundsteuer', 'Versicherung', 'Hausverwaltung', 'Sonstige',
];

export interface Utility {
  id: string;
  propertyId: string;
  provider: string;
  type: UtilityType;
  contractNumber: string;
  meterNumber: string;
  monthlyAdvance: number;
  notes: string;
  createdAt: string;
}

export interface UtilityCost {
  id: string;
  utilityId: string;
  propertyId: string;
  year: number;
  totalCost: number;
  createdAt: string;
}

export interface TenantPayment {
  id: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  amount: number;
  date: string; // ISO date
  type: 'Miete' | 'Kaution' | 'Nachzahlung' | 'Gutschrift';
  status: 'eingegangen' | 'ausstehend' | 'überfällig';
  notes: string;
  createdAt: string;
}

// ============= Expense Tracking =============
export interface Expense {
  id: string;
  propertyId: string;
  unitId?: string;
  category: 'Instandhaltung' | 'Versicherung' | 'Verwaltung' | 'Grundsteuer' | 'Hausgeld' | 'Sonstiges';
  description: string;
  amount: number;
  date: string;
  isUmlagefaehig: boolean;
  receiptUrl?: string;
  createdAt: string;
}

// ============= Meter Readings =============
export interface MeterReading {
  id: string;
  propertyId: string;
  unitId?: string;
  meterId: string;
  value: number;
  date: string;
  readBy: string;
  notes?: string;
  createdAt: string;
}

// ============= Rental Contracts =============
export interface RentalContract {
  id: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  rentAmount: number;
  operatingCosts: number;
  heatingCosts: number;
  depositAmount: number;
  depositPaid: boolean;
  depositPaidDate?: string;
  startDate: string;
  endDate?: string;
  contractType: 'unbefristet' | 'befristet';
  noticePeriod: number;
  rentPaymentDay: number;
  notes?: string;
  createdAt: string;
}

export interface ContractDocument {
  id: string;
  contractId: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  createdAt: string;
}

// ============= Deal Analyzer =============
export type DealGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface DealAnalysis {
  id: string;
  name: string;
  address: string;
  askingPrice: number;
  arv: number;
  squareMeters: number;
  renovationCost: number;
  renovationMonths: number;
  notarPercent: number;
  grunderwerbsteuerPercent: number;
  maklerPercent: number;
  purchasePrice: number;
  eigenkapital: number;
  zinssatz: number;
  tilgung: number;
  holdingCostsMonthly: number;
  verkaufsmaklerPercent: number;
  notes: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============= Property Photos & Documents =============
export interface PropertyPhoto {
  id: string;
  propertyId: string;
  name: string;
  dataUrl: string;
  createdAt: string;
}

export interface PropertyDocument {
  id: string;
  propertyId: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  createdAt: string;
}

// ============= Banking =============
export type BankAccountStatus = 'connected' | 'disconnected' | 'syncing';
export type TransactionCategory = 'miete' | 'nebenkosten' | 'instandhaltung' | 'versicherung' | 'sonstiges';

export interface BankAccount {
  id: string;
  bankName: string;
  iban: string;
  bic: string;
  accountHolder: string;
  balance: number;
  lastSync: string;
  status: BankAccountStatus;
  color: string;
  /** Optional brand domain (e.g. "dkb.de") used to fetch the real bank logo via Clearbit. */
  domain?: string;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  date: string;
  amount: number;
  counterparty: string;
  purpose: string;
  iban?: string;
  category?: TransactionCategory;
  matchedTenantId?: string;
  matchedPropertyId?: string;
  matchedUnitId?: string;
  isReconciled: boolean;
  createdAt: string;
}

// ============= Tasks / Vorgänge =============
export type TaskStatus = 'offen' | 'in-bearbeitung' | 'erledigt';
export type TaskPriority = 'niedrig' | 'mittel' | 'hoch';
export type TaskCategory =
  | 'Instandhaltung'
  | 'Mieterkommunikation'
  | 'Abrechnung'
  | 'Vertragsmanagement'
  | 'Besichtigung'
  | 'Behörde'
  | 'Sonstiges';

export const TASK_STATUSES: TaskStatus[] = ['offen', 'in-bearbeitung', 'erledigt'];
export const TASK_PRIORITIES: TaskPriority[] = ['niedrig', 'mittel', 'hoch'];
export const TASK_CATEGORIES: TaskCategory[] = [
  'Instandhaltung',
  'Mieterkommunikation',
  'Abrechnung',
  'Vertragsmanagement',
  'Besichtigung',
  'Behörde',
  'Sonstiges',
];

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  /** Dashboard-Kontext, in dem die Aufgabe sichtbar ist. Fehlt das Feld
   *  (Altbestand), wird die Aufgabe weiterhin im Vorgänge-Center angezeigt. */
  mode?: AppMode;
  /** Fix-&-Flip-Projekt-Verknüpfung (nur im fixflip-Modus relevant). */
  projectId?: string;
  /** Buy-&-Hold-Verknüpfungen (nur im buyhold-Modus relevant). */
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  contractId?: string;
  dueDate?: string; // ISO date
  assignedTo?: string; // freier Text: Eigentümer, Hausverwaltung, Handwerker-Name
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============= Distribution Keys =============
export interface DistributionKey {
  id: string;
  propertyId: string;
  name: string;
  type: 'Wohnfläche' | 'Personenzahl' | 'Einheitenzahl' | 'Verbrauch' | 'Individuell';
  description?: string;
  createdAt: string;
}

// ============= Trash =============
export type TrashEntityType =
  | 'tenant'
  | 'tenantPayment'
  | 'rentalUnit'
  | 'meterReading'
  | 'utility'
  | 'utilityCost'
  | 'distributionKey'
  | 'bankAccount'
  | 'bankTransaction'
  | 'rentalContract'
  | 'rentalProperty'
  | 'expense'
  | 'contractor'
  | 'project'
  | 'projectPhoto'
  | 'projectDocument'
  | 'projectContractor'
  | 'budgetItem'
  | 'dealAnalysis'
  | 'propertyPhoto'
  | 'propertyDocument'
  | 'contractDocument'
  | 'task';

export interface TrashItem {
  id: string;
  entityType: TrashEntityType;
  entityId: string;
  data: unknown;
  label: string;
  sublabel?: string;
  deletedAt: string;
}
