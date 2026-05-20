import { useEffect } from 'react';
import { createBrowserRouter, Navigate, useNavigationType } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AuthGuard } from './components/auth/AuthGuard';
import { LoginPage } from './components/auth/LoginPage';
import { SignupPage } from './components/auth/SignupPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { LeadsPage } from './components/leads/LeadsPage';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { getDefaultDashboard } from './lib/utils';
import { ProjectListPage } from './components/projects/ProjectListPage';
import { ProjectDetailPage } from './components/projects/ProjectDetailPage';
import { ContractorListPage } from './components/contractors/ContractorListPage';
import { ContractorDetailPage } from './components/contractors/ContractorDetailPage';
import { CalculatorPage } from './components/calculator/CalculatorPage';
import { BHDashboardPage } from './components/buyhold/BHDashboardPage';
import { PropertyListPage } from './components/buyhold/PropertyListPage';
import { PropertyDetailPage } from './components/buyhold/PropertyDetailPage';
import { TenantListPage } from './components/buyhold/TenantListPage';
import { TenantDetailPage } from './components/buyhold/TenantDetailPage';
import { UtilityListPage } from './components/buyhold/UtilityListPage';
import { TransactionsPage } from './components/buyhold/TransactionsPage';
import { FinanzenPage } from './components/buyhold/FinanzenPage';
import { AusgabenPage } from './components/buyhold/AusgabenPage';
import { LetterPage } from './components/buyhold/letters/LetterPage';
import { NebenkostenPage } from './components/buyhold/NebenkostenPage';
import { BerichtePage } from './components/buyhold/BerichtePage';
import { MietvertragPage } from './components/buyhold/MietvertragPage';
import { MietvertragDetailPage } from './components/buyhold/MietvertragDetailPage';
import { ZaehlerPage } from './components/buyhold/ZaehlerPage';
import { ExposeGenerator } from './components/projects/ExposeGenerator';
import { DealAnalyzerPage } from './components/deal-analyzer/DealAnalyzerPage';
import { BankingPage } from './components/buyhold/BankingPage';
import { BankingCallback } from './components/buyhold/BankingCallback';
import { TaskListPage } from './components/buyhold/TaskListPage';
import { DokumenteArchivPage } from './components/buyhold/DokumenteArchivPage';
import { TrashPage } from './components/buyhold/TrashPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { PrivateDashboardPage } from './components/private/PrivateDashboardPage';
import { PrivateBoardPage } from './components/private/PrivateBoardPage';

/**
 * Root-Redirect für `/`.
 *
 * Die Default-Dashboard-Präferenz (Einstellungen → Standard-Dashboard) darf **nur
 * beim echten Page-Reload** greifen — nicht bei In-App-Navigation. Sonst würde
 * der Mode-Switch „Fix & Flip" den User wieder nach `/bh` umleiten, wenn seine
 * Default-Präferenz „Buy & Hold" ist.
 *
 * Persistenz via `sessionStorage` statt Modul-Variable, damit der State nicht
 * im Render-Body mutiert wird (React-Compiler-Regel `react-hooks/globals`).
 * `sessionStorage` überlebt In-App-Navigation, wird bei echtem Reload aber
 * vom Tab beibehalten — daher prüfen wir zusätzlich gegen den ersten POP
 * dieser Tab-Lebenszeit über `performance.navigation`-Ersatz (siehe useEffect).
 */
const DEFAULT_APPLIED_KEY = 'immofreak_default_dashboard_applied';

function RootRedirect() {
  const navigationType = useNavigationType();

  if (navigationType !== 'POP') {
    // In-App-Navigation zu `/` → immer F&F-Dashboard.
    // Markierung nur als Effect setzen, damit Render rein bleibt.
    return <DashboardPageWithFlag />;
  }

  const applied = sessionStorage.getItem(DEFAULT_APPLIED_KEY) === 'true';
  if (!applied) {
    const def = getDefaultDashboard();
    if (def === 'fixflip') return <DashboardPageWithFlag />;
    return <NavigateAndFlag to="/bh" />;
  }
  return <DashboardPage />;
}

function DashboardPageWithFlag() {
  useEffect(() => {
    sessionStorage.setItem(DEFAULT_APPLIED_KEY, 'true');
  }, []);
  return <DashboardPage />;
}

function NavigateAndFlag({ to }: { to: string }) {
  useEffect(() => {
    sessionStorage.setItem(DEFAULT_APPLIED_KEY, 'true');
  }, []);
  return <Navigate to={to} replace />;
}

// 404-Seite: fängt alle unbekannten Pfade innerhalb des AppLayouts ab, damit der
// User nach einem Bookmark auf eine umbenannte Route nicht vor einer leeren Seite steht.
function NotFoundPage() {
  return (
    <div className="page-container">
      <div className="surface empty-state">
        <p className="text-lg font-semibold mb-2 text-foreground">Seite nicht gefunden</p>
        <p className="text-sm text-muted-foreground-2 mb-5">
          Die angeforderte Adresse existiert nicht. Möglicherweise wurde sie verschoben oder der Link ist veraltet.
        </p>
        <a href="/" className="btn btn-md btn-primary">Zurück zum Dashboard</a>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  // Public routes
  { path: 'login', element: <LoginPage /> },
  { path: 'signup', element: <SignupPage /> },
  { path: 'reset-password', element: <ResetPasswordPage /> },
  // `/share/:id` wurde entfernt — die Seite las private Property-Daten in einer
  // öffentlichen Route. Ein vollwertiges Share-Feature müsste über `share_tokens`
  // mit eigenständiger RLS-Policy implementiert werden.
  {
    path: '/',
    element: <AuthGuard><AppLayout /></AuthGuard>,
    children: [
      // Fix & Flip
      { index: true, element: <RootRedirect /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'projekte', element: <ProjectListPage /> },
      { path: 'projekte/:id', element: <ProjectDetailPage /> },
      { path: 'projekte/:id/expose', element: <ExposeGenerator /> },
      { path: 'handwerker', element: <ContractorListPage /> },
      { path: 'handwerker/:id', element: <ContractorDetailPage /> },
      { path: 'kalkulator', element: <CalculatorPage /> },
      { path: 'deal-analyzer', element: <DealAnalyzerPage /> },
      { path: 'aufgaben', element: <TaskListPage mode="fixflip" /> },
      { path: 'papierkorb', element: <TrashPage /> },
      // Buy & Hold
      { path: 'bh', element: <BHDashboardPage /> },
      { path: 'bh/objekte', element: <PropertyListPage /> },
      { path: 'bh/objekte/:id', element: <PropertyDetailPage /> },
      { path: 'bh/mieter', element: <TenantListPage /> },
      { path: 'bh/mieter/:id', element: <TenantDetailPage /> },
      { path: 'bh/versorger', element: <UtilityListPage /> },
      { path: 'bh/transaktionen', element: <TransactionsPage /> },
      { path: 'bh/finanzen', element: <FinanzenPage /> },
      { path: 'bh/ausgaben', element: <AusgabenPage /> },
      { path: 'bh/schreiben', element: <LetterPage /> },
      { path: 'bh/nebenkosten', element: <NebenkostenPage /> },
      { path: 'bh/berichte', element: <BerichtePage /> },
      { path: 'bh/mietvertraege', element: <MietvertragPage /> },
      { path: 'bh/mietvertraege/:id', element: <MietvertragDetailPage /> },
      { path: 'bh/zaehler', element: <ZaehlerPage /> },
      { path: 'bh/banking', element: <BankingPage /> },
      { path: 'bh/banking/callback', element: <BankingCallback /> },
      { path: 'bh/aufgaben', element: <TaskListPage mode="buyhold" /> },
      // Legacy-Alias: alte Bookmarks auf /bh/vorgaenge weiterhin bedienen.
      { path: 'bh/vorgaenge', element: <TaskListPage mode="buyhold" /> },
      { path: 'bh/dokumente', element: <DokumenteArchivPage /> },
      { path: 'bh/papierkorb', element: <TrashPage /> },
      // Privat (Trello-style personal todos)
      { path: 'privat', element: <PrivateDashboardPage /> },
      { path: 'privat/boards', element: <PrivateDashboardPage /> },
      { path: 'privat/boards/:id', element: <PrivateBoardPage /> },
      { path: 'privat/aufgaben', element: <TaskListPage mode="private" /> },
      // Shared
      { path: 'einstellungen', element: <SettingsPage /> },
      // 404: fängt alle unbekannten Pfade innerhalb des AppLayouts ab
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  // 404 außerhalb des AppLayouts (z. B. wenn /login nicht matcht)
  { path: '*', element: <Navigate to="/" replace /> },
]);
