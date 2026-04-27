import { createContext, useContext, useState, useEffect } from 'react';
import type { AppMode } from '../types';

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  sidebarOpen: boolean;
  /**
   * Ändert und **persistiert** den Sidebar-Zustand. Für manuelle User-Aktionen
   * (Toggle-Button, Logo-Klick, Öffnen-Button) gedacht.
   */
  setSidebarOpen: (open: boolean) => void;
  /**
   * Ändert den Sidebar-Zustand **ohne** Persistenz. Für automatische Schließer
   * (z. B. Mobile-Drawer nach Navigation), damit die User-Präferenz erhalten bleibt.
   */
  setSidebarOpenTransient: (open: boolean) => void;
  toggleSidebar: () => void;
}

const AppModeContext = createContext<AppModeContextType>({
  mode: 'buyhold',
  setMode: () => {},
  sidebarOpen: false,
  setSidebarOpen: () => {},
  setSidebarOpenTransient: () => {},
  toggleSidebar: () => {},
});

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    return (localStorage.getItem('immofreak_mode') as AppMode) || 'buyhold';
  });
  const [sidebarOpen, setSidebarOpenState] = useState(() => {
    const saved = localStorage.getItem('immofreak_sidebar');
    return saved === 'closed' ? false : true;
  });

  // Always enforce light mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('immofreak_theme');
  }, []);

  const handleSetMode = (newMode: AppMode) => {
    setModeState(newMode);
    localStorage.setItem('immofreak_mode', newMode);
  };

  const handleSetSidebarOpen = (open: boolean) => {
    setSidebarOpenState(open);
    localStorage.setItem('immofreak_sidebar', open ? 'open' : 'closed');
  };

  const handleSetSidebarOpenTransient = (open: boolean) => {
    setSidebarOpenState(open);
    // bewusst KEIN localStorage-Write — Preference bleibt erhalten
  };

  return (
    <AppModeContext.Provider value={{
      mode,
      setMode: handleSetMode,
      sidebarOpen,
      setSidebarOpen: handleSetSidebarOpen,
      setSidebarOpenTransient: handleSetSidebarOpenTransient,
      toggleSidebar: () => handleSetSidebarOpen(!sidebarOpen),
    }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  return useContext(AppModeContext);
}
