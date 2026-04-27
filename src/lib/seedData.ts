import type { Project, Contractor, BudgetItem, ProjectContractor, RentalProperty, RentalUnit, Tenant, Utility, TenantPayment, Expense, MeterReading, RentalContract, DistributionKey, BankAccount, BankTransaction, Task } from '../types';

const SEED_KEY = 'immofreak_seeded';

function seedNewStores() {
  const expenses: Expense[] = [
    { id: 'exp-1', propertyId: 'rp-1', category: 'Grundsteuer', description: 'Grundsteuer Q1 2026', amount: 400, date: '2026-01-15', isUmlagefaehig: true, createdAt: '2026-01-15T10:00:00Z' },
    { id: 'exp-2', propertyId: 'rp-1', category: 'Grundsteuer', description: 'Grundsteuer Q2 2026', amount: 400, date: '2026-04-15', isUmlagefaehig: true, createdAt: '2026-04-15T10:00:00Z' },
    { id: 'exp-3', propertyId: 'rp-1', category: 'Grundsteuer', description: 'Grundsteuer Q3 2026', amount: 400, date: '2026-07-15', isUmlagefaehig: true, createdAt: '2026-07-15T10:00:00Z' },
    { id: 'exp-4', propertyId: 'rp-2', category: 'Grundsteuer', description: 'Grundsteuer Q1 2026', amount: 200, date: '2026-01-15', isUmlagefaehig: true, createdAt: '2026-01-15T10:00:00Z' },
    { id: 'exp-5', propertyId: 'rp-2', category: 'Grundsteuer', description: 'Grundsteuer Q2 2026', amount: 200, date: '2026-04-15', isUmlagefaehig: true, createdAt: '2026-04-15T10:00:00Z' },
    { id: 'exp-6', propertyId: 'rp-1', category: 'Versicherung', description: 'Gebäudeversicherung MFH 2026', amount: 1200, date: '2026-01-02', isUmlagefaehig: true, createdAt: '2026-01-02T10:00:00Z' },
    { id: 'exp-7', propertyId: 'rp-2', category: 'Versicherung', description: 'Gebäudeversicherung ETW 2026', amount: 400, date: '2026-01-05', isUmlagefaehig: true, createdAt: '2026-01-05T10:00:00Z' },
    { id: 'exp-8', propertyId: 'rp-1', category: 'Instandhaltung', description: 'Rohrreinigung Fallrohr', amount: 350, date: '2026-02-10', isUmlagefaehig: false, createdAt: '2026-02-10T10:00:00Z' },
    { id: 'exp-9', propertyId: 'rp-1', category: 'Instandhaltung', description: 'Treppenhausrenovierung', amount: 2800, date: '2026-03-05', isUmlagefaehig: false, createdAt: '2026-03-05T10:00:00Z' },
    { id: 'exp-10', propertyId: 'rp-2', category: 'Hausgeld', description: 'Hausgeld Januar 2026', amount: 250, date: '2026-01-01', isUmlagefaehig: false, createdAt: '2026-01-01T10:00:00Z' },
    { id: 'exp-11', propertyId: 'rp-2', category: 'Hausgeld', description: 'Hausgeld Februar 2026', amount: 250, date: '2026-02-01', isUmlagefaehig: false, createdAt: '2026-02-01T10:00:00Z' },
    { id: 'exp-12', propertyId: 'rp-2', category: 'Hausgeld', description: 'Hausgeld März 2026', amount: 250, date: '2026-03-01', isUmlagefaehig: false, createdAt: '2026-03-01T10:00:00Z' },
    { id: 'exp-13', propertyId: 'rp-1', category: 'Sonstiges', description: 'Gartenpflege Frühjahr', amount: 180, date: '2026-03-20', isUmlagefaehig: true, createdAt: '2026-03-20T10:00:00Z' },
  ];
  const meterReadings: MeterReading[] = [
    { id: 'mr-1', propertyId: 'rp-1', meterId: 'DE00412345678', value: 45230, date: '2026-01-02', readBy: 'Hausverwaltung', notes: 'Jahresablesung', createdAt: '2026-01-02T10:00:00Z' },
    { id: 'mr-2', propertyId: 'rp-1', meterId: 'G-98765432', value: 12850, date: '2026-01-02', readBy: 'Hausverwaltung', notes: 'Jahresablesung', createdAt: '2026-01-02T10:00:00Z' },
    { id: 'mr-3', propertyId: 'rp-1', meterId: 'W-44556677', value: 1875, date: '2026-01-02', readBy: 'Hausverwaltung', createdAt: '2026-01-02T10:00:00Z' },
    { id: 'mr-4', propertyId: 'rp-1', meterId: 'DE00412345678', value: 46890, date: '2026-04-01', readBy: 'Hausverwaltung', createdAt: '2026-04-01T10:00:00Z' },
    { id: 'mr-5', propertyId: 'rp-1', meterId: 'G-98765432', value: 14320, date: '2026-04-01', readBy: 'Hausverwaltung', createdAt: '2026-04-01T10:00:00Z' },
    { id: 'mr-6', propertyId: 'rp-1', meterId: 'W-44556677', value: 2010, date: '2026-04-01', readBy: 'Hausverwaltung', createdAt: '2026-04-01T10:00:00Z' },
    { id: 'mr-7', propertyId: 'rp-2', meterId: 'DE00498765432', value: 8920, date: '2026-01-03', readBy: 'Eigentümer', notes: 'Selbstablesung', createdAt: '2026-01-03T10:00:00Z' },
    { id: 'mr-8', propertyId: 'rp-2', meterId: 'G-11223344', value: 3450, date: '2026-01-03', readBy: 'Eigentümer', createdAt: '2026-01-03T10:00:00Z' },
    { id: 'mr-9', propertyId: 'rp-2', meterId: 'W-ETW-001', value: 520, date: '2026-01-03', readBy: 'Eigentümer', createdAt: '2026-01-03T10:00:00Z' },
    { id: 'mr-10', propertyId: 'rp-2', meterId: 'DE00498765432', value: 9340, date: '2026-04-02', readBy: 'Eigentümer', createdAt: '2026-04-02T10:00:00Z' },
    { id: 'mr-11', propertyId: 'rp-2', meterId: 'G-11223344', value: 3890, date: '2026-04-02', readBy: 'Eigentümer', createdAt: '2026-04-02T10:00:00Z' },
    { id: 'mr-12', propertyId: 'rp-2', meterId: 'W-ETW-001', value: 558, date: '2026-04-02', readBy: 'Eigentümer', createdAt: '2026-04-02T10:00:00Z' },
  ];
  const rentalContracts: RentalContract[] = [
    { id: 'rc-1', propertyId: 'rp-1', unitId: 'ru-1', tenantId: 'ten-1', rentAmount: 650, operatingCosts: 150, heatingCosts: 80, depositAmount: 1950, depositPaid: true, depositPaidDate: '2021-07-25', startDate: '2021-08-01', contractType: 'unbefristet', noticePeriod: 3, rentPaymentDay: 1, createdAt: '2021-07-15T10:00:00Z' },
    { id: 'rc-2', propertyId: 'rp-1', unitId: 'ru-2', tenantId: 'ten-2', rentAmount: 680, operatingCosts: 160, heatingCosts: 85, depositAmount: 2040, depositPaid: true, depositPaidDate: '2021-12-20', startDate: '2022-01-01', contractType: 'unbefristet', noticePeriod: 3, rentPaymentDay: 1, createdAt: '2021-12-01T10:00:00Z' },
    { id: 'rc-3', propertyId: 'rp-1', unitId: 'ru-3', tenantId: 'ten-3', rentAmount: 700, operatingCosts: 170, heatingCosts: 90, depositAmount: 2100, depositPaid: true, depositPaidDate: '2023-03-25', startDate: '2023-04-01', contractType: 'unbefristet', noticePeriod: 3, rentPaymentDay: 1, createdAt: '2023-03-15T10:00:00Z' },
    { id: 'rc-4', propertyId: 'rp-2', unitId: 'ru-5', tenantId: 'ten-4', rentAmount: 750, operatingCosts: 100, heatingCosts: 70, depositAmount: 2250, depositPaid: true, depositPaidDate: '2023-04-25', startDate: '2023-05-01', contractType: 'unbefristet', noticePeriod: 3, rentPaymentDay: 1, createdAt: '2023-04-10T10:00:00Z' },
  ];
  const distributionKeys: DistributionKey[] = [
    { id: 'dk-1', propertyId: 'rp-1', name: 'Verteilung nach Wohnfläche', type: 'Wohnfläche', description: 'Verteilung der Kosten nach Quadratmeter Wohnfläche', createdAt: '2021-06-20T10:00:00Z' },
    { id: 'dk-2', propertyId: 'rp-1', name: 'Verteilung nach Personenzahl', type: 'Personenzahl', description: 'Verteilung der Kosten nach Anzahl der Bewohner', createdAt: '2021-06-20T10:00:00Z' },
    { id: 'dk-3', propertyId: 'rp-1', name: 'Verteilung nach Einheiten', type: 'Einheitenzahl', description: 'Gleichmäßige Verteilung auf alle Wohneinheiten', createdAt: '2021-06-20T10:00:00Z' },
    { id: 'dk-4', propertyId: 'rp-1', name: 'Verteilung nach Verbrauch', type: 'Verbrauch', description: 'Verteilung nach individuellem Verbrauch (Zähler)', createdAt: '2021-06-20T10:00:00Z' },
  ];
  const bankAccounts: BankAccount[] = [
    {
      id: 'ba-1',
      bankName: 'Deutsche Bank',
      iban: 'DE89 3704 0044 0532 0130 5445',
      bic: 'COBADEFFXXX',
      accountHolder: 'Yan Oelchmann',
      balance: 1124.83,
      lastSync: '2026-04-15T08:30:00Z',
      status: 'connected',
      color: '#1e40af',
      createdAt: '2025-06-01T10:00:00Z',
    },
    {
      id: 'ba-2',
      bankName: 'ING',
      iban: 'DE87 5001 0517 0012 3456 5443',
      bic: 'INGDDEFFXXX',
      accountHolder: 'Yan Oelchmann',
      balance: 432.17,
      lastSync: '2026-04-15T08:30:00Z',
      status: 'connected',
      color: '#ea580c',
      createdAt: '2025-06-01T10:00:00Z',
    },
  ];
  const bankTransactions: BankTransaction[] = [
    { id: 'btx-1', bankAccountId: 'ba-1', date: '2026-04-01', amount: 650, counterparty: 'Maria Schmidt', purpose: 'Miete April 2026 EG Links', category: 'miete', matchedTenantId: 'ten-1', matchedPropertyId: 'rp-1', matchedUnitId: 'ru-1', isReconciled: true, createdAt: '2026-04-01T09:00:00Z' },
    { id: 'btx-2', bankAccountId: 'ba-1', date: '2026-04-01', amount: 680, counterparty: 'Jan Müller', purpose: 'Miete April 2026 EG Rechts', category: 'miete', matchedTenantId: 'ten-2', matchedPropertyId: 'rp-1', matchedUnitId: 'ru-2', isReconciled: true, createdAt: '2026-04-01T09:05:00Z' },
    { id: 'btx-3', bankAccountId: 'ba-1', date: '2026-04-02', amount: 700, counterparty: 'Sabine Koch', purpose: 'Miete April 2026 1. OG', category: 'miete', matchedTenantId: 'ten-3', matchedPropertyId: 'rp-1', matchedUnitId: 'ru-3', isReconciled: true, createdAt: '2026-04-02T08:00:00Z' },
    { id: 'btx-4', bankAccountId: 'ba-2', date: '2026-04-01', amount: 750, counterparty: 'Petra Wagner', purpose: 'Miete April 2026 Schöneberg', category: 'miete', matchedTenantId: 'ten-4', matchedPropertyId: 'rp-2', matchedUnitId: 'ru-5', isReconciled: true, createdAt: '2026-04-01T10:00:00Z' },
    { id: 'btx-5', bankAccountId: 'ba-1', date: '2026-04-05', amount: -350, counterparty: 'Stadtwerke Berlin', purpose: 'Strom/Gas MFH Berliner Str. 5 Q2', category: 'nebenkosten', matchedPropertyId: 'rp-1', isReconciled: true, createdAt: '2026-04-05T07:00:00Z' },
    { id: 'btx-6', bankAccountId: 'ba-1', date: '2026-04-10', amount: -180, counterparty: 'Allianz Versicherung', purpose: 'Gebäudeversicherung MFH April', category: 'versicherung', matchedPropertyId: 'rp-1', isReconciled: true, createdAt: '2026-04-10T06:00:00Z' },
    { id: 'btx-7', bankAccountId: 'ba-2', date: '2026-04-08', amount: -250, counterparty: 'WEG Schöneberg', purpose: 'Hausgeld April 2026', category: 'nebenkosten', matchedPropertyId: 'rp-2', isReconciled: true, createdAt: '2026-04-08T07:00:00Z' },
    { id: 'btx-8', bankAccountId: 'ba-1', date: '2026-03-01', amount: 650, counterparty: 'Maria Schmidt', purpose: 'Miete März 2026 EG Links', category: 'miete', matchedTenantId: 'ten-1', matchedPropertyId: 'rp-1', matchedUnitId: 'ru-1', isReconciled: true, createdAt: '2026-03-01T09:00:00Z' },
    { id: 'btx-9', bankAccountId: 'ba-1', date: '2026-03-01', amount: 680, counterparty: 'Jan Müller', purpose: 'Miete März 2026 EG Rechts', category: 'miete', matchedTenantId: 'ten-2', matchedPropertyId: 'rp-1', matchedUnitId: 'ru-2', isReconciled: true, createdAt: '2026-03-01T09:05:00Z' },
    { id: 'btx-10', bankAccountId: 'ba-1', date: '2026-03-02', amount: 700, counterparty: 'Sabine Koch', purpose: 'Miete März 2026 1. OG', category: 'miete', matchedTenantId: 'ten-3', matchedPropertyId: 'rp-1', matchedUnitId: 'ru-3', isReconciled: true, createdAt: '2026-03-02T08:00:00Z' },
    { id: 'btx-11', bankAccountId: 'ba-2', date: '2026-03-01', amount: 750, counterparty: 'Petra Wagner', purpose: 'Miete März 2026 Schöneberg', category: 'miete', matchedTenantId: 'ten-4', matchedPropertyId: 'rp-2', matchedUnitId: 'ru-5', isReconciled: true, createdAt: '2026-03-01T10:00:00Z' },
    { id: 'btx-12', bankAccountId: 'ba-1', date: '2026-03-15', amount: -520, counterparty: 'Rohrreinigung Schnell GmbH', purpose: 'Notfall Rohrreinigung MFH', category: 'instandhaltung', matchedPropertyId: 'rp-1', isReconciled: false, createdAt: '2026-03-15T14:00:00Z' },
  ];
  const tasks: Task[] = [
    { id: 'task-1', title: 'Heizungswartung MFH beauftragen', description: 'Jährliche Wartung der Gaszentralheizung laut § 11 Heizkostenverordnung. Firma Meier Heizungsbau kontaktieren.', status: 'offen', priority: 'hoch', category: 'Instandhaltung', propertyId: 'rp-1', dueDate: '2026-05-15', assignedTo: 'Eigentümer', createdAt: '2026-04-10T09:00:00Z', updatedAt: '2026-04-10T09:00:00Z' },
    { id: 'task-2', title: 'Nebenkostenabrechnung 2025 versenden', description: 'Frist § 556 Abs. 3 BGB: 12 Monate nach Abrechnungszeitraum. Versand bis spätestens 31.12.2026.', status: 'in-bearbeitung', priority: 'hoch', category: 'Abrechnung', propertyId: 'rp-1', dueDate: '2026-12-31', assignedTo: 'Hausverwaltung', createdAt: '2026-03-20T10:00:00Z', updatedAt: '2026-04-05T08:00:00Z' },
    { id: 'task-3', title: 'Zählerstände ablesen (Q2)', description: 'Quartalsablesung Strom/Gas/Wasser für alle Einheiten.', status: 'offen', priority: 'mittel', category: 'Instandhaltung', propertyId: 'rp-1', dueDate: '2026-07-01', assignedTo: 'Hausverwaltung', createdAt: '2026-04-01T10:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'task-4', title: 'Befristeter Mietvertrag Koch ausläuft', description: 'Mietvertrag Sabine Koch endet 2026-03-31. Kontakt wegen Verlängerung aufnehmen. § 573c BGB Kündigungsfrist 3 Monate beachten.', status: 'erledigt', priority: 'hoch', category: 'Vertragsmanagement', propertyId: 'rp-1', unitId: 'ru-3', tenantId: 'ten-3', dueDate: '2026-03-01', assignedTo: 'Eigentümer', completedAt: '2026-02-15T14:00:00Z', createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-02-15T14:00:00Z' },
    { id: 'task-5', title: 'Leerstand 1. OG Rechts vermieten', description: 'Einheit ru-4 steht seit 02/2026 leer. Exposé erstellen, Besichtigungstermine organisieren.', status: 'in-bearbeitung', priority: 'hoch', category: 'Besichtigung', propertyId: 'rp-1', unitId: 'ru-4', dueDate: '2026-06-01', assignedTo: 'Eigentümer', createdAt: '2026-02-05T10:00:00Z', updatedAt: '2026-04-01T10:00:00Z' },
    { id: 'task-6', title: 'Rauchmelder-Prüfung jährlich', description: 'DIN 14676 Wartung aller Rauchmelder dokumentieren. Haftungsrelevant.', status: 'offen', priority: 'mittel', category: 'Instandhaltung', propertyId: 'rp-1', dueDate: '2026-09-30', assignedTo: 'Hausverwaltung', createdAt: '2026-04-15T11:00:00Z', updatedAt: '2026-04-15T11:00:00Z' },
    { id: 'task-7', title: 'Grundsteuerbescheid 2026 prüfen', description: 'Neuer Bescheid vom Finanzamt Pankow. Einspruchsfrist 1 Monat § 355 AO.', status: 'offen', priority: 'niedrig', category: 'Behörde', propertyId: 'rp-1', dueDate: '2026-05-20', assignedTo: 'Eigentümer', createdAt: '2026-04-20T08:00:00Z', updatedAt: '2026-04-20T08:00:00Z' },
    { id: 'task-8', title: 'Hausgeldabrechnung WEG Schöneberg', description: 'Abrechnung 2025 von der Hausverwaltung prüfen und bei Unstimmigkeiten widersprechen.', status: 'offen', priority: 'mittel', category: 'Abrechnung', propertyId: 'rp-2', dueDate: '2026-06-30', assignedTo: 'Eigentümer', createdAt: '2026-04-18T09:00:00Z', updatedAt: '2026-04-18T09:00:00Z' },
  ];
  localStorage.setItem('immofreak_expenses', JSON.stringify(expenses));
  localStorage.setItem('immofreak_meter_readings', JSON.stringify(meterReadings));
  localStorage.setItem('immofreak_rental_contracts', JSON.stringify(rentalContracts));
  localStorage.setItem('immofreak_distribution_keys', JSON.stringify(distributionKeys));
  localStorage.setItem('immofreak_bank_accounts', JSON.stringify(bankAccounts));
  localStorage.setItem('immofreak_bank_transactions', JSON.stringify(bankTransactions));
  localStorage.setItem('immofreak_tasks', JSON.stringify(tasks));
}

// One-shot migration to align demo bank account balances to realistic values.
// Runs at most once (guarded by MIGRATION_KEY) so any manual edits the user
// makes afterwards are preserved on subsequent loads.
const DEMO_BALANCE_MIGRATION_KEY = 'immofreak_migration_demo_bank_balances_v1';
function migrateDemoBankBalances() {
  if (localStorage.getItem(DEMO_BALANCE_MIGRATION_KEY)) return;
  const raw = localStorage.getItem('immofreak_bank_accounts');
  if (!raw) return;
  try {
    const accounts: BankAccount[] = JSON.parse(raw);
    let changed = false;
    for (const acc of accounts) {
      if (acc.id === 'ba-1' && acc.balance !== 1124.83) { acc.balance = 1124.83; changed = true; }
      if (acc.id === 'ba-2' && acc.balance !== 432.17)  { acc.balance = 432.17;  changed = true; }
    }
    if (changed) localStorage.setItem('immofreak_bank_accounts', JSON.stringify(accounts));
  } catch {
    // ignore — store is malformed, migration will retry on next reload
    return;
  }
  localStorage.setItem(DEMO_BALANCE_MIGRATION_KEY, 'true');
}

export function seedIfEmpty() {
  // Always seed new data stores if they're empty
  const needsNewStores = !localStorage.getItem('immofreak_expenses') || JSON.parse(localStorage.getItem('immofreak_expenses') || '[]').length === 0;
  const needsBanking = !localStorage.getItem('immofreak_bank_accounts') || JSON.parse(localStorage.getItem('immofreak_bank_accounts') || '[]').length === 0;
  const needsTasks = !localStorage.getItem('immofreak_tasks') || JSON.parse(localStorage.getItem('immofreak_tasks') || '[]').length === 0;
  if (needsNewStores || needsBanking || needsTasks) {
    seedNewStores();
  }

  // Update existing demo balances to the new values (one-time, idempotent).
  migrateDemoBankBalances();

  if (localStorage.getItem(SEED_KEY)) return;

  const existing = localStorage.getItem('immofreak_projects');
  if (existing && JSON.parse(existing).length > 0) {
    localStorage.setItem(SEED_KEY, 'true');
    return;
  }

  const projects: Project[] = [
    {
      id: 'proj-1',
      name: 'Altbauwohnung Prenzlauer Berg',
      address: 'Kastanienallee 42, 10435 Berlin',
      purchasePrice: 180000,
      targetSellPrice: 310000,
      arv: 320000,
      renovationBudget: 55000,
      status: 'Sanierung',
      notes: 'Altbau 3. OG, 85m². Komplettsanierung Bad und Küche nötig. Böden in gutem Zustand.',
      createdAt: '2025-11-15T10:00:00Z',
      updatedAt: '2026-03-20T14:30:00Z',
    },
    {
      id: 'proj-2',
      name: 'Doppelhaushälfte Potsdam',
      address: 'Am Neuen Garten 17, 14469 Potsdam',
      purchasePrice: 280000,
      targetSellPrice: 450000,
      arv: 460000,
      renovationBudget: 85000,
      status: 'Planung',
      notes: 'Baujahr 1965, guter Grundriss. Energetische Sanierung + neue Fenster.',
      createdAt: '2026-01-10T09:00:00Z',
      updatedAt: '2026-03-28T11:00:00Z',
    },
    {
      id: 'proj-3',
      name: 'Eigentumswohnung Friedrichshain',
      address: 'Boxhagener Str. 88, 10245 Berlin',
      purchasePrice: 120000,
      targetSellPrice: 195000,
      arv: 200000,
      renovationBudget: 30000,
      status: 'Akquise',
      notes: 'Zwangsversteigerung. Termin am 15.04.',
      createdAt: '2026-03-25T16:00:00Z',
      updatedAt: '2026-03-25T16:00:00Z',
    },
  ];

  const contractors: Contractor[] = [
    {
      id: 'cont-1',
      name: 'Stefan Krüger',
      company: 'Krüger Malerarbeiten GmbH',
      trade: 'Maler',
      phone: '+49 170 1234567',
      email: 'info@krueger-maler.de',
      address: 'Frankfurter Allee 120, 10365 Berlin',
      hourlyRate: 45,
      rating: 5,
      notes: 'Sehr zuverlässig, schnelle Arbeit. Empfohlen von NLC.',
      createdAt: '2025-10-01T10:00:00Z',
    },
    {
      id: 'cont-2',
      name: 'Markus Weber',
      company: 'Weber Elektrotechnik',
      trade: 'Elektriker',
      phone: '+49 171 9876543',
      email: 'weber@elektro-berlin.de',
      address: 'Greifswalder Str. 55, 10405 Berlin',
      hourlyRate: 55,
      rating: 4,
      notes: 'Gute Preise bei größeren Aufträgen.',
      createdAt: '2025-10-15T10:00:00Z',
    },
    {
      id: 'cont-3',
      name: 'Ali Yilmaz',
      company: 'Yilmaz Sanitär & Heizung',
      trade: 'Sanitär',
      phone: '+49 172 5551234',
      email: 'ali@yilmaz-sanitaer.de',
      address: 'Sonnenallee 180, 12059 Berlin',
      hourlyRate: 50,
      rating: 5,
      notes: 'Spezialist für Badsanierungen. Top Qualität.',
      createdAt: '2025-11-01T10:00:00Z',
    },
    {
      id: 'cont-4',
      name: 'Thomas Braun',
      company: '',
      trade: 'Fliesenleger',
      phone: '+49 160 3334444',
      email: 'braun.fliesen@gmail.com',
      address: 'Neukölln, Berlin',
      hourlyRate: 40,
      rating: 3,
      notes: '',
      createdAt: '2026-01-20T10:00:00Z',
    },
    {
      id: 'cont-5',
      name: 'Peter Hofmann',
      company: 'Hofmann Trockenbau',
      trade: 'Trockenbauer',
      phone: '+49 173 6667777',
      email: 'info@hofmann-trockenbau.de',
      address: 'Charlottenburg, Berlin',
      hourlyRate: 42,
      rating: 4,
      notes: 'Auch Wochenendarbeit möglich.',
      createdAt: '2026-02-05T10:00:00Z',
    },
  ];

  const budgetItems: BudgetItem[] = [
    {
      id: 'bi-1',
      projectId: 'proj-1',
      contractorId: 'cont-1',
      category: 'Malerarbeiten',
      description: 'Komplette Wohnung streichen (85m²)',
      estimatedCost: 8000,
      actualCost: 7500,
      status: 'abgeschlossen',
      createdAt: '2026-01-10T10:00:00Z',
    },
    {
      id: 'bi-2',
      projectId: 'proj-1',
      contractorId: 'cont-2',
      category: 'Elektrik',
      description: 'Elektrik komplett erneuern, neue Unterverteilung',
      estimatedCost: 12000,
      actualCost: 11500,
      status: 'abgeschlossen',
      createdAt: '2026-01-10T10:00:00Z',
    },
    {
      id: 'bi-3',
      projectId: 'proj-1',
      contractorId: 'cont-3',
      category: 'Bad',
      description: 'Badsanierung komplett (Fliesen, Sanitär, Armaturen)',
      estimatedCost: 15000,
      actualCost: 13800,
      status: 'beauftragt',
      createdAt: '2026-02-01T10:00:00Z',
    },
    {
      id: 'bi-4',
      projectId: 'proj-1',
      category: 'Küche',
      description: 'Neue Einbauküche inkl. Geräte',
      estimatedCost: 8000,
      actualCost: 0,
      status: 'geplant',
      createdAt: '2026-02-15T10:00:00Z',
    },
    {
      id: 'bi-5',
      projectId: 'proj-1',
      contractorId: 'cont-5',
      category: 'Trockenbau',
      description: 'Deckenabhängung Flur + Spots',
      estimatedCost: 3500,
      actualCost: 3200,
      status: 'abgeschlossen',
      createdAt: '2026-01-20T10:00:00Z',
    },
    {
      id: 'bi-6',
      projectId: 'proj-2',
      category: 'Fenster & Türen',
      description: '12 neue Fenster (3-fach Verglasung)',
      estimatedCost: 24000,
      actualCost: 0,
      status: 'geplant',
      createdAt: '2026-03-01T10:00:00Z',
    },
    {
      id: 'bi-7',
      projectId: 'proj-2',
      category: 'Heizung',
      description: 'Neue Gasbrennwertheizung',
      estimatedCost: 18000,
      actualCost: 0,
      status: 'geplant',
      createdAt: '2026-03-01T10:00:00Z',
    },
  ];

  const projectContractors: ProjectContractor[] = [
    { id: 'pc-1', projectId: 'proj-1', contractorId: 'cont-1', assignedAt: '2025-12-01T10:00:00Z' },
    { id: 'pc-2', projectId: 'proj-1', contractorId: 'cont-2', assignedAt: '2025-12-01T10:00:00Z' },
    { id: 'pc-3', projectId: 'proj-1', contractorId: 'cont-3', assignedAt: '2026-01-15T10:00:00Z' },
    { id: 'pc-4', projectId: 'proj-1', contractorId: 'cont-5', assignedAt: '2026-01-15T10:00:00Z' },
  ];

  // Buy & Hold seed data
  const rentalProperties: RentalProperty[] = [
    {
      id: 'rp-1',
      name: 'MFH Berliner Str. 5',
      address: 'Berliner Str. 5, 13187 Berlin',
      purchasePrice: 850000,
      currentValue: 1050000,
      purchaseDate: '2021-06-15',
      units: 4,
      totalArea: 280,
      notes: '4-Familienhaus, Baujahr 1928, saniert 2019. Ruhige Lage.',
      createdAt: '2021-06-15T10:00:00Z',
      updatedAt: '2026-01-10T10:00:00Z',
    },
    {
      id: 'rp-2',
      name: 'ETW Schöneberg',
      address: 'Hauptstr. 88, 10827 Berlin',
      purchasePrice: 220000,
      currentValue: 275000,
      purchaseDate: '2023-03-01',
      units: 1,
      totalArea: 65,
      notes: 'Altbau 2. OG, vermietet seit Kauf.',
      createdAt: '2023-03-01T10:00:00Z',
      updatedAt: '2025-12-01T10:00:00Z',
    },
  ];

  const rentalUnits: RentalUnit[] = [
    { id: 'ru-1', propertyId: 'rp-1', name: 'EG Links', area: 70, rooms: 3, currentRent: 650, targetRent: 750, tenantId: 'ten-1', createdAt: '2021-06-15T10:00:00Z' },
    { id: 'ru-2', propertyId: 'rp-1', name: 'EG Rechts', area: 70, rooms: 3, currentRent: 680, targetRent: 750, tenantId: 'ten-2', createdAt: '2021-06-15T10:00:00Z' },
    { id: 'ru-3', propertyId: 'rp-1', name: '1. OG Links', area: 70, rooms: 3, currentRent: 700, targetRent: 780, tenantId: 'ten-3', createdAt: '2021-06-15T10:00:00Z' },
    { id: 'ru-4', propertyId: 'rp-1', name: '1. OG Rechts', area: 70, rooms: 3, currentRent: 0, targetRent: 780, createdAt: '2021-06-15T10:00:00Z' },
    { id: 'ru-5', propertyId: 'rp-2', name: 'Wohnung', area: 65, rooms: 2, currentRent: 750, targetRent: 850, tenantId: 'ten-4', createdAt: '2023-03-01T10:00:00Z' },
  ];

  const tenants: Tenant[] = [
    {
      id: 'ten-1', name: 'Maria Schmidt', email: 'maria.schmidt@mail.de', phone: '+49 170 1111111',
      propertyId: 'rp-1', unitId: 'ru-1', moveInDate: '2021-08-01', leaseStart: '2021-08-01',
      deposit: 1950, notes: 'Pünktliche Zahlerin.', createdAt: '2021-07-15T10:00:00Z',
    },
    {
      id: 'ten-2', name: 'Jan Müller', email: 'jan.mueller@web.de', phone: '+49 171 2222222',
      propertyId: 'rp-1', unitId: 'ru-2', moveInDate: '2022-01-01', leaseStart: '2022-01-01',
      deposit: 2040, notes: '', createdAt: '2021-12-01T10:00:00Z',
    },
    {
      id: 'ten-3', name: 'Sabine Koch', email: 'sabine.koch@gmail.com', phone: '+49 172 3333333',
      propertyId: 'rp-1', unitId: 'ru-3', moveInDate: '2023-04-01', leaseStart: '2023-04-01',
      deposit: 2100, notes: 'Befristeter Vertrag bis 2026-03-31.', leaseEnd: '2026-03-31', createdAt: '2023-03-15T10:00:00Z',
    },
    {
      id: 'ten-4', name: 'Petra Wagner', email: 'petra.w@outlook.de', phone: '+49 160 4444444',
      propertyId: 'rp-2', unitId: 'ru-5', moveInDate: '2023-05-01', leaseStart: '2023-05-01',
      deposit: 2250, notes: '', createdAt: '2023-04-10T10:00:00Z',
    },
  ];

  const utilities: Utility[] = [
    { id: 'util-1', propertyId: 'rp-1', provider: 'Vattenfall', type: 'Strom', contractNumber: 'VF-2021-88456', meterNumber: 'DE00412345678', monthlyAdvance: 180, notes: '', createdAt: '2021-06-20T10:00:00Z' },
    { id: 'util-2', propertyId: 'rp-1', provider: 'GASAG', type: 'Gas', contractNumber: 'GA-554321', meterNumber: 'G-98765432', monthlyAdvance: 220, notes: 'Heizung + Warmwasser', createdAt: '2021-06-20T10:00:00Z' },
    { id: 'util-3', propertyId: 'rp-1', provider: 'BWB', type: 'Wasser', contractNumber: 'BWB-112233', meterNumber: 'W-44556677', monthlyAdvance: 95, notes: '', createdAt: '2021-06-20T10:00:00Z' },
    { id: 'util-4', propertyId: 'rp-1', provider: 'BSR', type: 'Müllabfuhr', contractNumber: 'BSR-778899', meterNumber: '', monthlyAdvance: 65, notes: '', createdAt: '2021-06-20T10:00:00Z' },
    { id: 'util-5', propertyId: 'rp-1', provider: 'Finanzamt Pankow', type: 'Grundsteuer', contractNumber: '', meterNumber: '', monthlyAdvance: 45, notes: 'Vierteljährlich', createdAt: '2021-06-20T10:00:00Z' },
    { id: 'util-6', propertyId: 'rp-2', provider: 'Vattenfall', type: 'Strom', contractNumber: 'VF-2023-44123', meterNumber: 'DE00498765432', monthlyAdvance: 55, notes: '', createdAt: '2023-03-05T10:00:00Z' },
    { id: 'util-7', propertyId: 'rp-2', provider: 'GASAG', type: 'Gas', contractNumber: 'GA-667788', meterNumber: 'G-11223344', monthlyAdvance: 65, notes: '', createdAt: '2023-03-05T10:00:00Z' },
  ];

  // Tenant payment seed data
  const tenantPayments: TenantPayment[] = [
    // Kaution payments
    { id: 'tp-k1', tenantId: 'ten-1', propertyId: 'rp-1', unitId: 'ru-1', amount: 1950, date: '2021-07-25', type: 'Kaution', status: 'eingegangen', notes: 'Kaution bei Einzug', createdAt: '2021-07-25T10:00:00Z' },
    { id: 'tp-k2', tenantId: 'ten-2', propertyId: 'rp-1', unitId: 'ru-2', amount: 2040, date: '2021-12-20', type: 'Kaution', status: 'eingegangen', notes: 'Kaution bei Einzug', createdAt: '2021-12-20T10:00:00Z' },
    { id: 'tp-k3', tenantId: 'ten-3', propertyId: 'rp-1', unitId: 'ru-3', amount: 2100, date: '2023-03-25', type: 'Kaution', status: 'eingegangen', notes: 'Kaution bei Einzug', createdAt: '2023-03-25T10:00:00Z' },
    { id: 'tp-k4', tenantId: 'ten-4', propertyId: 'rp-2', unitId: 'ru-5', amount: 2250, date: '2023-04-25', type: 'Kaution', status: 'eingegangen', notes: 'Kaution bei Einzug', createdAt: '2023-04-25T10:00:00Z' },

    // ten-1 Maria Schmidt – 650€/month, rp-1, ru-1
    { id: 'tp-1-10', tenantId: 'ten-1', propertyId: 'rp-1', unitId: 'ru-1', amount: 650, date: '2025-10-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2025-10-01T08:00:00Z' },
    { id: 'tp-1-11', tenantId: 'ten-1', propertyId: 'rp-1', unitId: 'ru-1', amount: 650, date: '2025-11-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2025-11-01T08:00:00Z' },
    { id: 'tp-1-12', tenantId: 'ten-1', propertyId: 'rp-1', unitId: 'ru-1', amount: 650, date: '2025-12-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2025-12-01T08:00:00Z' },
    { id: 'tp-1-01', tenantId: 'ten-1', propertyId: 'rp-1', unitId: 'ru-1', amount: 650, date: '2026-01-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2026-01-01T08:00:00Z' },
    { id: 'tp-1-02', tenantId: 'ten-1', propertyId: 'rp-1', unitId: 'ru-1', amount: 650, date: '2026-02-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2026-02-01T08:00:00Z' },
    { id: 'tp-1-03', tenantId: 'ten-1', propertyId: 'rp-1', unitId: 'ru-1', amount: 650, date: '2026-03-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2026-03-01T08:00:00Z' },

    // ten-2 Jan Müller – 680€/month, rp-1, ru-2
    { id: 'tp-2-10', tenantId: 'ten-2', propertyId: 'rp-1', unitId: 'ru-2', amount: 680, date: '2025-10-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2025-10-01T08:00:00Z' },
    { id: 'tp-2-11', tenantId: 'ten-2', propertyId: 'rp-1', unitId: 'ru-2', amount: 680, date: '2025-11-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2025-11-01T08:00:00Z' },
    { id: 'tp-2-12', tenantId: 'ten-2', propertyId: 'rp-1', unitId: 'ru-2', amount: 680, date: '2025-12-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2025-12-01T08:00:00Z' },
    { id: 'tp-2-01', tenantId: 'ten-2', propertyId: 'rp-1', unitId: 'ru-2', amount: 680, date: '2026-01-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2026-01-01T08:00:00Z' },
    { id: 'tp-2-02', tenantId: 'ten-2', propertyId: 'rp-1', unitId: 'ru-2', amount: 680, date: '2026-02-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2026-02-01T08:00:00Z' },
    { id: 'tp-2-03', tenantId: 'ten-2', propertyId: 'rp-1', unitId: 'ru-2', amount: 680, date: '2026-03-01', type: 'Miete', status: 'ausstehend', notes: 'Noch nicht eingegangen', createdAt: '2026-03-01T08:00:00Z' },

    // ten-3 Sabine Koch – 700€/month, rp-1, ru-3
    { id: 'tp-3-10', tenantId: 'ten-3', propertyId: 'rp-1', unitId: 'ru-3', amount: 700, date: '2025-10-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2025-10-01T08:00:00Z' },
    { id: 'tp-3-11', tenantId: 'ten-3', propertyId: 'rp-1', unitId: 'ru-3', amount: 700, date: '2025-11-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2025-11-01T08:00:00Z' },
    { id: 'tp-3-12', tenantId: 'ten-3', propertyId: 'rp-1', unitId: 'ru-3', amount: 700, date: '2025-12-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2025-12-01T08:00:00Z' },
    { id: 'tp-3-01', tenantId: 'ten-3', propertyId: 'rp-1', unitId: 'ru-3', amount: 700, date: '2026-01-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2026-01-01T08:00:00Z' },
    { id: 'tp-3-02', tenantId: 'ten-3', propertyId: 'rp-1', unitId: 'ru-3', amount: 700, date: '2026-02-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2026-02-01T08:00:00Z' },
    { id: 'tp-3-03', tenantId: 'ten-3', propertyId: 'rp-1', unitId: 'ru-3', amount: 700, date: '2026-03-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2026-03-01T08:00:00Z' },

    // ten-4 Petra Wagner – 750€/month, rp-2, ru-5
    { id: 'tp-4-10', tenantId: 'ten-4', propertyId: 'rp-2', unitId: 'ru-5', amount: 750, date: '2025-10-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2025-10-01T08:00:00Z' },
    { id: 'tp-4-11', tenantId: 'ten-4', propertyId: 'rp-2', unitId: 'ru-5', amount: 750, date: '2025-11-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2025-11-01T08:00:00Z' },
    { id: 'tp-4-12', tenantId: 'ten-4', propertyId: 'rp-2', unitId: 'ru-5', amount: 750, date: '2025-12-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2025-12-01T08:00:00Z' },
    { id: 'tp-4-01', tenantId: 'ten-4', propertyId: 'rp-2', unitId: 'ru-5', amount: 750, date: '2026-01-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2026-01-01T08:00:00Z' },
    { id: 'tp-4-02', tenantId: 'ten-4', propertyId: 'rp-2', unitId: 'ru-5', amount: 750, date: '2026-02-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2026-02-01T08:00:00Z' },
    { id: 'tp-4-03', tenantId: 'ten-4', propertyId: 'rp-2', unitId: 'ru-5', amount: 750, date: '2026-03-01', type: 'Miete', status: 'eingegangen', notes: '', createdAt: '2026-03-01T08:00:00Z' },
  ];

  // Expense seed data
  const expenses: Expense[] = [
    // Grundsteuer MFH quarterly (umlagefähig)
    { id: 'exp-1', propertyId: 'rp-1', category: 'Grundsteuer', description: 'Grundsteuer Q1 2026', amount: 400, date: '2026-01-15', isUmlagefaehig: true, createdAt: '2026-01-15T10:00:00Z' },
    { id: 'exp-2', propertyId: 'rp-1', category: 'Grundsteuer', description: 'Grundsteuer Q2 2026', amount: 400, date: '2026-04-15', isUmlagefaehig: true, createdAt: '2026-04-15T10:00:00Z' },
    { id: 'exp-3', propertyId: 'rp-1', category: 'Grundsteuer', description: 'Grundsteuer Q3 2026', amount: 400, date: '2026-07-15', isUmlagefaehig: true, createdAt: '2026-07-15T10:00:00Z' },
    // Grundsteuer ETW (umlagefähig)
    { id: 'exp-4', propertyId: 'rp-2', category: 'Grundsteuer', description: 'Grundsteuer Q1 2026', amount: 200, date: '2026-01-15', isUmlagefaehig: true, createdAt: '2026-01-15T10:00:00Z' },
    { id: 'exp-5', propertyId: 'rp-2', category: 'Grundsteuer', description: 'Grundsteuer Q2 2026', amount: 200, date: '2026-04-15', isUmlagefaehig: true, createdAt: '2026-04-15T10:00:00Z' },
    // Gebäudeversicherung (umlagefähig)
    { id: 'exp-6', propertyId: 'rp-1', category: 'Versicherung', description: 'Gebäudeversicherung MFH 2026', amount: 1200, date: '2026-01-02', isUmlagefaehig: true, createdAt: '2026-01-02T10:00:00Z' },
    { id: 'exp-7', propertyId: 'rp-2', category: 'Versicherung', description: 'Gebäudeversicherung ETW 2026', amount: 400, date: '2026-01-05', isUmlagefaehig: true, createdAt: '2026-01-05T10:00:00Z' },
    // Instandhaltung (not umlagefähig)
    { id: 'exp-8', propertyId: 'rp-1', category: 'Instandhaltung', description: 'Rohrreinigung Fallrohr', amount: 350, date: '2026-02-10', isUmlagefaehig: false, createdAt: '2026-02-10T10:00:00Z' },
    { id: 'exp-9', propertyId: 'rp-1', category: 'Instandhaltung', description: 'Treppenhausrenovierung', amount: 2800, date: '2026-03-05', isUmlagefaehig: false, createdAt: '2026-03-05T10:00:00Z' },
    // Hausgeld ETW (not umlagefähig - owner cost)
    { id: 'exp-10', propertyId: 'rp-2', category: 'Hausgeld', description: 'Hausgeld Januar 2026', amount: 250, date: '2026-01-01', isUmlagefaehig: false, createdAt: '2026-01-01T10:00:00Z' },
    { id: 'exp-11', propertyId: 'rp-2', category: 'Hausgeld', description: 'Hausgeld Februar 2026', amount: 250, date: '2026-02-01', isUmlagefaehig: false, createdAt: '2026-02-01T10:00:00Z' },
    { id: 'exp-12', propertyId: 'rp-2', category: 'Hausgeld', description: 'Hausgeld März 2026', amount: 250, date: '2026-03-01', isUmlagefaehig: false, createdAt: '2026-03-01T10:00:00Z' },
    // Gartenpflege MFH (umlagefähig)
    { id: 'exp-13', propertyId: 'rp-1', category: 'Sonstiges', description: 'Gartenpflege Frühjahr', amount: 180, date: '2026-03-20', isUmlagefaehig: true, createdAt: '2026-03-20T10:00:00Z' },
  ];

  // MeterReading seed data
  const meterReadings: MeterReading[] = [
    // MFH (rp-1) - January 2026
    { id: 'mr-1', propertyId: 'rp-1', meterId: 'DE00412345678', value: 45230, date: '2026-01-02', readBy: 'Hausverwaltung', notes: 'Jahresablesung', createdAt: '2026-01-02T10:00:00Z' },
    { id: 'mr-2', propertyId: 'rp-1', meterId: 'G-98765432', value: 12850, date: '2026-01-02', readBy: 'Hausverwaltung', notes: 'Jahresablesung', createdAt: '2026-01-02T10:00:00Z' },
    { id: 'mr-3', propertyId: 'rp-1', meterId: 'W-44556677', value: 1875, date: '2026-01-02', readBy: 'Hausverwaltung', createdAt: '2026-01-02T10:00:00Z' },
    // MFH (rp-1) - April 2026
    { id: 'mr-4', propertyId: 'rp-1', meterId: 'DE00412345678', value: 46890, date: '2026-04-01', readBy: 'Hausverwaltung', createdAt: '2026-04-01T10:00:00Z' },
    { id: 'mr-5', propertyId: 'rp-1', meterId: 'G-98765432', value: 14320, date: '2026-04-01', readBy: 'Hausverwaltung', createdAt: '2026-04-01T10:00:00Z' },
    { id: 'mr-6', propertyId: 'rp-1', meterId: 'W-44556677', value: 2010, date: '2026-04-01', readBy: 'Hausverwaltung', createdAt: '2026-04-01T10:00:00Z' },
    // ETW (rp-2) - January 2026
    { id: 'mr-7', propertyId: 'rp-2', meterId: 'DE00498765432', value: 8920, date: '2026-01-03', readBy: 'Eigentümer', notes: 'Selbstablesung', createdAt: '2026-01-03T10:00:00Z' },
    { id: 'mr-8', propertyId: 'rp-2', meterId: 'G-11223344', value: 3450, date: '2026-01-03', readBy: 'Eigentümer', createdAt: '2026-01-03T10:00:00Z' },
    { id: 'mr-9', propertyId: 'rp-2', meterId: 'W-ETW-001', value: 520, date: '2026-01-03', readBy: 'Eigentümer', createdAt: '2026-01-03T10:00:00Z' },
    // ETW (rp-2) - April 2026
    { id: 'mr-10', propertyId: 'rp-2', meterId: 'DE00498765432', value: 9340, date: '2026-04-02', readBy: 'Eigentümer', createdAt: '2026-04-02T10:00:00Z' },
    { id: 'mr-11', propertyId: 'rp-2', meterId: 'G-11223344', value: 3890, date: '2026-04-02', readBy: 'Eigentümer', createdAt: '2026-04-02T10:00:00Z' },
    { id: 'mr-12', propertyId: 'rp-2', meterId: 'W-ETW-001', value: 558, date: '2026-04-02', readBy: 'Eigentümer', createdAt: '2026-04-02T10:00:00Z' },
  ];

  // RentalContract seed data
  const rentalContracts: RentalContract[] = [
    {
      id: 'rc-1', propertyId: 'rp-1', unitId: 'ru-1', tenantId: 'ten-1',
      rentAmount: 650, operatingCosts: 150, heatingCosts: 80, depositAmount: 1950,
      depositPaid: true, depositPaidDate: '2021-07-25',
      startDate: '2021-08-01', contractType: 'unbefristet', noticePeriod: 3, rentPaymentDay: 1,
      createdAt: '2021-07-15T10:00:00Z',
    },
    {
      id: 'rc-2', propertyId: 'rp-1', unitId: 'ru-2', tenantId: 'ten-2',
      rentAmount: 680, operatingCosts: 160, heatingCosts: 85, depositAmount: 2040,
      depositPaid: true, depositPaidDate: '2021-12-20',
      startDate: '2022-01-01', contractType: 'unbefristet', noticePeriod: 3, rentPaymentDay: 1,
      createdAt: '2021-12-01T10:00:00Z',
    },
    {
      id: 'rc-3', propertyId: 'rp-1', unitId: 'ru-3', tenantId: 'ten-3',
      rentAmount: 700, operatingCosts: 170, heatingCosts: 90, depositAmount: 2100,
      depositPaid: true, depositPaidDate: '2023-03-25',
      startDate: '2023-04-01', contractType: 'unbefristet', noticePeriod: 3, rentPaymentDay: 1,
      createdAt: '2023-03-15T10:00:00Z',
    },
    {
      id: 'rc-4', propertyId: 'rp-2', unitId: 'ru-5', tenantId: 'ten-4',
      rentAmount: 750, operatingCosts: 100, heatingCosts: 70, depositAmount: 2250,
      depositPaid: true, depositPaidDate: '2023-04-25',
      startDate: '2023-05-01', contractType: 'unbefristet', noticePeriod: 3, rentPaymentDay: 1,
      createdAt: '2023-04-10T10:00:00Z',
    },
  ];

  // DistributionKey seed data (MFH only)
  const distributionKeys: DistributionKey[] = [
    { id: 'dk-1', propertyId: 'rp-1', name: 'Verteilung nach Wohnfläche', type: 'Wohnfläche', description: 'Verteilung der Kosten nach Quadratmeter Wohnfläche', createdAt: '2021-06-20T10:00:00Z' },
    { id: 'dk-2', propertyId: 'rp-1', name: 'Verteilung nach Personenzahl', type: 'Personenzahl', description: 'Verteilung der Kosten nach Anzahl der Bewohner', createdAt: '2021-06-20T10:00:00Z' },
    { id: 'dk-3', propertyId: 'rp-1', name: 'Verteilung nach Einheiten', type: 'Einheitenzahl', description: 'Gleichmäßige Verteilung auf alle Wohneinheiten', createdAt: '2021-06-20T10:00:00Z' },
    { id: 'dk-4', propertyId: 'rp-1', name: 'Verteilung nach Verbrauch', type: 'Verbrauch', description: 'Verteilung nach individuellem Verbrauch (Zähler)', createdAt: '2021-06-20T10:00:00Z' },
  ];

  localStorage.setItem('immofreak_projects', JSON.stringify(projects));
  localStorage.setItem('immofreak_contractors', JSON.stringify(contractors));
  localStorage.setItem('immofreak_budget_items', JSON.stringify(budgetItems));
  localStorage.setItem('immofreak_project_contractors', JSON.stringify(projectContractors));
  localStorage.setItem('immofreak_rental_properties', JSON.stringify(rentalProperties));
  localStorage.setItem('immofreak_rental_units', JSON.stringify(rentalUnits));
  localStorage.setItem('immofreak_tenants', JSON.stringify(tenants));
  localStorage.setItem('immofreak_utilities', JSON.stringify(utilities));
  localStorage.setItem('immofreak_tenant_payments', JSON.stringify(tenantPayments));
  localStorage.setItem('immofreak_expenses', JSON.stringify(expenses));
  localStorage.setItem('immofreak_meter_readings', JSON.stringify(meterReadings));
  localStorage.setItem('immofreak_rental_contracts', JSON.stringify(rentalContracts));
  localStorage.setItem('immofreak_distribution_keys', JSON.stringify(distributionKeys));
  localStorage.setItem(SEED_KEY, 'true');
}
