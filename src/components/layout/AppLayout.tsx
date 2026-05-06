import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { GlobalSearch } from './GlobalSearch';
import { MobileBottomNav } from './MobileBottomNav';
import { TourOverlay } from '../tour/TourOverlay';
import { usePrelineInit } from '../../hooks/usePrelineInit';
import { useEnsureContractTemplates } from '../../hooks/useEnsureContractTemplates';

/**
 * AppLayout im Navbar-Layout (statt Sidebar).
 *
 * Vorher: vertikales Sidebar-Rail links + Card-Frame mit gerundetem Inhalt rechts.
 * Jetzt: horizontale Navbar oben, Inhalt darunter — full-width.
 *
 * Mode-Switch, Sektionen, Profil etc. sind jetzt alle in der Navbar
 * (`Navbar.tsx`). Mobile zeigt einen Hamburger-Drawer mit derselben
 * Liste, plus weiterhin die schwebende `MobileBottomNav` am unteren Rand.
 */
export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  usePrelineInit();
  useEnsureContractTemplates();

  // Cmd+K / Ctrl+K shortcut für Global Search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app-shell">
      {/* Sanfter Hintergrund — bleibt wie in der Sidebar-Variante */}
      <div aria-hidden className="app-gradient-bg" />

      <div className="relative flex flex-col h-[100dvh] overflow-hidden">
        <Navbar onSearchClick={() => setSearchOpen(true)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <Outlet />
        </main>

        {/* Mobile bottom navigation — bleibt für schnelle Navigation auf Mobile */}
        <MobileBottomNav />
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <TourOverlay />
    </div>
  );
}
