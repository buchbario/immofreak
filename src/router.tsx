import { createBrowserRouter, Navigate, useNavigationType } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AuthGuard } from './components/auth/AuthGuard';
import { LoginPage } from './components/auth/LoginPage';
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
import { TaskListPage } from './components/buyhold/TaskListPage';
import { DokumenteArchivPage } from './components/buyhold/DokumenteArchivPage';
import { TrashPage } from './components/buyhold/TrashPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { PropertySharePage } from './components/shared/PropertySharePage';
import { PrivateDashboardPage } from './components/private/PrivateDashboardPage';
import { PrivateBoardPage } from './components/private/PrivateBoardPage';

// Modul-Singleton: zeigt, ob `RootRedirect` innerhalb dieser Page-Session bereits
// einmal die Default-Dashboard-Präferenz angewendet hat. Überlebt In-App-Navigation,
// wird aber bei Page-Reload zurückgesetzt (Modul wird neu evaluiert).
let defaultDashboardApplied = false;

/**
 * Root-Redirect für `/`.
 *
 * Die Default-Dashboard-Präferenz (Einstellungen → Standard-Dashboard) darf **nur
 * beim echten Page-Reload** greifen — nicht bei In-App-Navigation. Sonst würde
 * der Mode-Switch „Fix & Flip" den User wieder nach `/bh` umleiten, wenn seine
 * Default-Präferenz „Buy & Hold" ist.
 *
 * Unterscheidung:
 * - `POP` + erster Mount in dieser Session → echter Page-Load → Default anwenden
 * - `PUSH`/`REPLACE` (In-App-`navigate`) → direkt das F&F-Dashboard rendern
 * - `POP` (Back/Forward) nach initialem Load → F&F-Dashboard (User hatte bewusst
 *   hierher navigiert, also respektieren wir die History)
 */
function RootRedirect() {
  const navigationType = useNavigationType();

  if (navigationType !== 'POP') {
    // In-App-Navigation zu `/` → immer F&F-Dashboard
    defaultDashboardApplied = true;
    return <DashboardPage />;
  }

  if (!defaultDashboardApplied) {
    // Erster `/`-Mount nach Page-Load → Default-Präferenz anwenden
    defaultDashboardApplied = true;
    const def = getDefaultDashboard();
    if (def === 'fixflip') return <DashboardPage />;
    return <Navigate to="/bh" replace />;
  }

  // Back/Forward auf `/` innerhalb der Session → F&F-Dashboard
  return <DashboardPage />;
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
  { path: 'share/:id', element: <PropertySharePage /> },
  {
    path: '/',
    element: <AuthGuard><AppLayout /></AuthGuard>,
    children: [
      // Fix & Flip
      { index: true, element: <RootRedirect /> },
      { path: 'projekte', element: <ProjectListPage /> },
      { path: 'projekte/:id', element: <ProjectDetailPage /> },
      { path: 'projekte/:id/expose', element: <ExposeGenerator /> },
      { path: 'handwerker', element: <ContractorListPage /> },
      { path: 'handwerker/:id', element: <ContractorDetailPage /> },
      { path: 'kalkulator', element: <CalculatorPage /> },
      { path: 'deal-analyzer', element: <DealAnalyzerPage /> },
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
      { path: 'bh/vorgaenge', element: <TaskListPage /> },
      { path: 'bh/dokumente', element: <DokumenteArchivPage /> },
      { path: 'bh/papierkorb', element: <TrashPage /> },
      // Privat (Trello-style personal todos)
      { path: 'privat', element: <PrivateDashboardPage /> },
      { path: 'privat/boards', element: <PrivateDashboardPage /> },
      { path: 'privat/boards/:id', element: <PrivateBoardPage /> },
      // Shared
      { path: 'einstellungen', element: <SettingsPage /> },
      // 404: fängt alle unbekannten Pfade innerhalb des AppLayouts ab
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  // 404 außerhalb des AppLayouts (z. B. wenn /login nicht matcht)
  { path: '*', element: <Navigate to="/" replace /> },
]);
