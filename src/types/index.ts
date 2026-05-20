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
  /** Sort order among pinned boards in the sidebar (lower = earlier).
   *  null = explizit zurückgesetzt (z.B. nach Unpin) — wird so in der DB persistiert. */
  pinOrder?: number | null;
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
  /** Verkaufsziel (Plan). */
  targetSellPrice: number;
  /** Tatsächlicher Verkaufspreis — wird nach Abschluss eingetragen. */
  actualSellPrice?: number;
  /** Legacy/Optional: ARV (After Repair Value). Wird im UI nicht mehr erfasst,
   *  bleibt aber in alten Datensätzen / Deal-Analyzer-Imports erhalten. */
  arv?: number;
  renovationBudget: number;
  status: ProjectStatus;
  notes: string;
  immoscoutUrl?: string;
  grundbuchUrl?: string;
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
  /** `null` wird gesetzt, wenn der Mieter gelöscht wird (Cascade-Delete). */
  tenantId?: string | null;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  unitId?: string | null;
  propertyId: string;
  /** DB-Spalte ist nullable — explizit `null` möglich, wenn kein Einzugsdatum bekannt. */
  moveInDate: string | null;
  leaseStart: string | null;
  leaseEnd?: string | null;
  deposit: number;
  notes: string;
  iban?: string | null;
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
  /** DB-Spalte ist nullable (FK `on delete set null`). Bei Mietern ohne Einheit `null`. */
  unitId: string | null;
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
export type RentalContractStatus = 'draft' | 'generated' | 'signed' | 'active' | 'terminated';

export const RENTAL_CONTRACT_STATUSES: RentalContractStatus[] = [
  'draft', 'generated', 'signed', 'active', 'terminated',
];

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
  depositPaidDate?: string | null;
  startDate: string;
  endDate?: string | null;
  contractType: 'unbefristet' | 'befristet';
  noticePeriod: number;
  rentPaymentDay: number;
  notes?: string;
  /** Lifecycle (optional bis Migration 0008_contract_status angewendet ist):
   *  - `draft`      : Vertrag ist im Tool angelegt, aber noch nicht endgültig generiert.
   *  - `generated`  : Vertrag ist generiert/gedruckt, wartet auf Unterschrift.
   *  - `signed`     : Unterschrieben (manuell markiert) — optional mit Upload des Scans.
   *  - `active`     : Mietverhältnis läuft (Mietbeginn erreicht, Vertrag unterschrieben).
   *  - `terminated` : Vertrag beendet (`endDate < heute` oder explizit gesetzt).
   *
   *  Wenn das Feld fehlt (Altdaten oder Migration nicht angewendet), behandelt die UI
   *  den Vertrag als `'active'` — sonst würden alle bestehenden Verträge plötzlich als
   *  "Entwurf" angezeigt.
   */
  status?: RentalContractStatus;
  /** Unterschriftsdatum (ISO, nullable) — wird bei `signed`/`active` gesetzt. */
  signedAt?: string | null;
  /** FK auf `ContractDocument.id` des hochgeladenen unterschriebenen PDFs (nullable). */
  signedDocumentId?: string | null;
  createdAt: string;
}

/**
 * Effektiver Status eines Vertrags. Fällt für Altdaten / vor-Migration-Daten
 * auf `'active'` zurück, damit die UI nicht plötzlich überall „Entwurf" anzeigt.
 */
export function getEffectiveContractStatus(c: Pick<RentalContract, 'status' | 'endDate'>): RentalContractStatus {
  if (c.status) return c.status;
  if (c.endDate && new Date(c.endDate).getTime() < Date.now()) return 'terminated';
  return 'active';
}

export type ContractDocumentType = 'draft' | 'signed' | 'amendment' | 'other';

export interface ContractDocument {
  id: string;
  contractId: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  /** Inhaltliche Klassifizierung: ist das hier der unterschriebene Hauptvertrag, ein Entwurf, ein Nachtrag? Optional bis Migration 0008 angewendet ist. */
  documentType?: ContractDocumentType;
  /** Markiert das maßgebliche unterschriebene Original. Wird vom Workflow auf `rental_contracts.signed_document_id` referenziert. */
  isSignedOriginal?: boolean;
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
  /** Optionale interne Bezeichnung, z.B. "Mietkonto Berlin". Wenn gesetzt,
   *  wird sie statt `bankName` als Haupt-Titel in der Konten-Liste angezeigt. */
  label?: string;
  iban: string;
  bic: string;
  accountHolder: string;
  balance: number;
  lastSync: string;
  status: BankAccountStatus;
  color: string;
  /** Optional brand domain (e.g. "dkb.de") used to fetch the real bank logo via Clearbit. */
  domain?: string;
  /** Quelle der Konto-Daten. 'demo' für Altdaten/Test, 'banksapi' für echten Open-Banking-Zugang. */
  provider?: BankingProvider;
  /** BANKSapi-Access-ID — gleiche ID für mehrere Produkte (Giro+Tagesgeld) desselben Bank-Zugangs. */
  banksapiAccessId?: string;
  /** BANKSapi-Product-ID — eindeutiges Konto innerhalb des Zugangs. */
  banksapiProductId?: string;
  /** PSD2-Consent-Ablauf (90 Tage Default). Vor Ablauf UI-Warnung anzeigen. */
  consentExpiresAt?: string;
  createdAt: string;
}

export type MatchStatus = 'auto' | 'manual' | 'suggested' | 'unmatched';
export type BankingProvider = 'banksapi' | 'demo';

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  date: string;
  amount: number;
  counterparty: string;
  purpose: string;
  /** IBAN des Gegenkontos (z.B. Mieter-IBAN bei Eingang). */
  iban?: string;
  category?: TransactionCategory;
  /** `null` = explizit aufgehoben (z.B. via unassignTransaction); wird so in der DB persistiert. */
  matchedTenantId?: string | null;
  matchedPropertyId?: string | null;
  matchedUnitId?: string | null;
  /** Status der Mieter-Zuordnung; wird vom Matcher gesetzt oder bei manueller Zuordnung auf 'manual' gesetzt. */
  matchStatus?: MatchStatus;
  /** Confidence 0..1 — nur zur Anzeige/Debug. */
  matchConfidence?: number;
  /** Provider-spezifische Transaktions-ID (Idempotenz beim Re-Sync). */
  banksapiTransactionId?: string;
  isReconciled: boolean;
  /** Manuell als „kein Mieteingang" markiert — wird vom Matcher, der
   *  Mieteingang-Übersicht und den synthetischen TenantPayments
   *  übersprungen. */
  isIgnored?: boolean;
  createdAt: string;
}

/**
 * Gelerntes Mapping Counterparty/IBAN → Mieter. Wird beim manuellen Zuordnen
 * mit "merken"-Checkbox angelegt, damit beim nächsten Sync derselbe Mieter
 * automatisch erkannt wird.
 */
export interface TenantPaymentMapping {
  id: string;
  tenantId: string;
  iban?: string;
  /** Normalisierter Counterparty-String (siehe lib/matcher.ts:normalize). */
  counterpartyName?: string;
  learnedFromTransactionId?: string;
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
  dueDate?: string | null; // ISO date
  assignedTo?: string; // freier Text: Eigentümer, Hausverwaltung, Handwerker-Name
  /** `null` wird beim Reopen einer erledigten Aufgabe gesetzt, damit die DB den Timestamp tatsächlich verliert. */
  completedAt?: string | null;
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
