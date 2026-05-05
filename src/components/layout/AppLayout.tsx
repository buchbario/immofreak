import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { MobileBottomNav } from './MobileBottomNav';
import { TourOverlay } from '../tour/TourOverlay';
import { useAppMode } from '../../context/AppModeContext';
import { usePrelineInit } from '../../hooks/usePrelineInit';
import { useEnsureContractTemplates } from '../../hooks/useEnsureContractTemplates';
import { Menu } from 'lucide-react';

export function AppLayout() {
  const { sidebarOpen, setSidebarOpenTransient } = useAppMode();
  const [searchOpen, setSearchOpen] = useState(false);
  usePrelineInit();
  // Stellt sicher, dass jeder Mieter auch einen Mietvertrag hat — legt fehlende
  // Vertrags-Vorlagen automatisch im Hintergrund an. Idempotent.
  useEnsureContractTemplates();

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    if (isMobile && sidebarOpen) {
      document.body.classList.add('body-lock');
    } else {
      document.body.classList.remove('body-lock');
    }
    return () => document.body.classList.remove('body-lock');
  }, [sidebarOpen]);

  return (
    <div className="app-shell">
      {/* Gradient background — soft pastels with blue/violet/rose tints */}
      <div aria-hidden className="app-gradient-bg" />

      {/* Mobile overlay for sidebar drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpenTransient(false)}
        />
      )}

      <div className="relative flex h-[100dvh] overflow-hidden p-0 sm:p-3 gap-0 sm:gap-3">
        <Sidebar onSearchClick={() => setSearchOpen(true)} />

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-card sm:rounded-2xl sm:border sm:border-card-line sm:shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          {/* Mobile-only floating top bar — minimal, just menu + logo + bell */}
          <div className="lg:hidden relative flex items-center justify-between h-12 px-3 flex-shrink-0 border-b border-card-divider">
            <button
              onClick={() => setSidebarOpenTransient(!sidebarOpen)}
              aria-label="Menü"
              className="size-9 -ml-1.5 rounded-lg flex items-center justify-center text-foreground hover:bg-layer-hover active:bg-layer-active cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <img src="/logo.png" alt="ImmoFreak" className="h-6 object-contain absolute left-1/2 -translate-x-1/2 pointer-events-none" />
            <NotificationBell />
          </div>

          <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            <Outlet />
          </main>

          {/* Mobile bottom navigation */}
          <MobileBottomNav />
        </div>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <TourOverlay />
    </div>
  );
}
