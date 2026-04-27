import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { MobileBottomNav } from './MobileBottomNav';
import { TourOverlay } from '../tour/TourOverlay';
import { useAppMode } from '../../context/AppModeContext';
import { usePrelineInit } from '../../hooks/usePrelineInit';
import { Menu, Search } from 'lucide-react';

export function AppLayout() {
  const { sidebarOpen, setSidebarOpenTransient } = useAppMode();
  const [searchOpen, setSearchOpen] = useState(false);
  usePrelineInit();

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
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Mobile overlay — Tap schließt den Drawer transient (Desktop-Präferenz bleibt unberührt) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpenTransient(false)}
        />
      )}

      <Sidebar onSearchClick={() => setSearchOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden">
        {/* Top bar — only visible on mobile (logo centered) */}
        <div className="relative sticky top-0 z-20 flex items-center h-12 px-2 flex-shrink-0 bg-card/90 backdrop-blur-sm border-b border-card-line lg:hidden">
          <button
            onClick={() => setSidebarOpenTransient(!sidebarOpen)}
            aria-label="Menü"
            className="size-9 rounded-lg flex items-center justify-center text-foreground hover:bg-layer-hover active:bg-layer-active cursor-pointer"
          >
            <Menu size={20} />
          </button>
          <img src="/logo.png" alt="ImmoFreak" className="h-6 object-contain absolute left-1/2 -translate-x-1/2 pointer-events-none" />
          <div className="flex-1" />
          <button onClick={() => setSearchOpen(true)} aria-label="Suchen" className="size-9 rounded-lg flex items-center justify-center text-foreground hover:bg-layer-hover active:bg-layer-active cursor-pointer">
            <Search size={18} />
          </button>
          <NotificationBell />
        </div>
        {/* Desktop top bar */}
        <div className="hidden lg:flex sticky top-0 z-20 items-center h-12 px-4 flex-shrink-0 bg-card/80 backdrop-blur-sm border-b border-card-line">
          <div className="flex-1" />
          <NotificationBell />
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <Outlet />
        </main>

        {/* Mobile bottom navigation */}
        <MobileBottomNav />
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <TourOverlay />
    </div>
  );
}
