import { useEffect, useState, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, HardHat, Calculator, Settings, Zap,
  Home, Users, Plug, FileText, ChevronDown, LogOut,
  PanelLeftOpen, PanelLeftClose, Receipt, Wallet, BarChart3, Gauge, X,
  SlidersHorizontal,
  CreditCard, ChevronRight, SearchCheck, Search, Landmark, Trash2,
  Sparkles, ListTodo, FolderArchive,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppMode } from '../../context/AppModeContext';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../context/TourContext';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const fixFlipSections: NavSection[] = [
  {
    title: 'ÜBERSICHT',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    title: 'VERWALTUNG',
    items: [
      { to: '/projekte', icon: Building2, label: 'Projekte' },
      { to: '/handwerker', icon: HardHat, label: 'Handwerker' },
    ],
  },
  {
    title: 'WERKZEUGE',
    items: [
      { to: '/kalkulator', icon: Calculator, label: 'Kalkulator' },
      { to: '/deal-analyzer', icon: SearchCheck, label: 'Deal Analyzer' },
      { to: '/papierkorb', icon: Trash2, label: 'Papierkorb' },
    ],
  },
];

const buyHoldSections: NavSection[] = [
  {
    title: 'ÜBERSICHT',
    items: [
      { to: '/bh', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/bh/banking', icon: Landmark, label: 'Banking' },
      { to: '/bh/transaktionen', icon: Receipt, label: 'Transaktionen' },
      { to: '/bh/finanzen', icon: Wallet, label: 'Finanzen' },
    ],
  },
  {
    title: 'VERWALTUNG',
    items: [
      { to: '/bh/objekte', icon: Home, label: 'Objekte' },
      { to: '/bh/mieter', icon: Users, label: 'Mieter' },
      { to: '/bh/versorger', icon: Plug, label: 'Versorger' },
      { to: '/bh/mietvertraege', icon: FileText, label: 'Mietverträge' },
      { to: '/bh/zaehler', icon: Gauge, label: 'Zähler' },
      { to: '/bh/ausgaben', icon: CreditCard, label: 'Ausgaben' },
      { to: '/bh/vorgaenge', icon: ListTodo, label: 'Vorgänge' },
      { to: '/bh/dokumente', icon: FolderArchive, label: 'Archiv' },
    ],
  },
  {
    title: 'WERKZEUGE',
    items: [
      { to: '/bh/schreiben', icon: FileText, label: 'Schreiben' },
      { to: '/bh/nebenkosten', icon: Receipt, label: 'Nebenkosten' },
      { to: '/bh/berichte', icon: BarChart3, label: 'Berichte' },
      { to: '/bh/papierkorb', icon: Trash2, label: 'Papierkorb' },
    ],
  },
];

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-dropdown border border-dropdown-line rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-[60] shadow-lg text-foreground">
        {label}
      </div>
    </div>
  );
}

export function Sidebar({ onSearchClick }: { onSearchClick?: () => void }) {
  const { mode, setMode, sidebarOpen, setSidebarOpen, setSidebarOpenTransient } = useAppMode();
  const { userName, userEmail, logout } = useAuth();
  const { startTour } = useTour();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const profileRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const path = location.pathname;
    // Shared routes — do not affect the active mode
    const isShared = path === '/' || path.startsWith('/einstellungen');
    if (isShared) return;
    const isBH = path.startsWith('/bh');
    if (isBH && mode !== 'buyhold') setMode('buyhold');
    if (!isBH && mode !== 'fixflip') setMode('fixflip');
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    // Mobile: Drawer nach Navigation schließen — aber transient, damit die
    // vom User gewählte Desktop-Präferenz in localStorage erhalten bleibt.
    if (window.matchMedia('(max-width: 1023px)').matches) setSidebarOpenTransient(false);
  }, [location.pathname]);

  const sections = mode === 'fixflip' ? fixFlipSections : buyHoldSections;
  const ModeIcon = mode === 'fixflip' ? Zap : Home;
  const modeLabel = mode === 'fixflip' ? 'Fix & Flip' : 'Buy & Hold';
  const modeDesc = mode === 'fixflip' ? 'Projekte verwalten' : 'Mietobjekte verwalten';
  const open = sidebarOpen;

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const switchMode = (m: 'fixflip' | 'buyhold') => {
    if (m === mode) { setModeOpen(false); return; }
    setMode(m); setModeOpen(false);
    navigate(m === 'fixflip' ? '/' : '/bh');
  };

  const handleStartTour = () => {
    // On mobile the drawer would cover the first tour spotlight — close it transient,
    // damit die Desktop-Präferenz beim nächsten Start nicht überschrieben wird.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setSidebarOpenTransient(false);
    }
    // Small delay so the sidebar close animation finishes first
    setTimeout(() => startTour(), 220);
  };

  return (
    <aside
      className={cn(
        'flex flex-col transition-[width,transform] duration-200 z-40 h-[100dvh] flex-shrink-0',
        'bg-sidebar border-r border-sidebar-line',
        'fixed inset-y-0 left-0 lg:sticky lg:top-0',
        // Mobile: slide-in drawer at fixed width 270px (off-screen when closed)
        open
          ? 'w-[270px] translate-x-0 lg:w-[250px] overflow-hidden'
          : '-translate-x-full w-[270px] lg:translate-x-0 lg:w-[72px] overflow-hidden lg:overflow-visible'
      )}
    >
      {/* ── Logo ── */}
      <div className={cn(
        'flex items-center flex-shrink-0',
        open ? 'justify-between px-4 pt-3.5 pb-3' : 'justify-center px-2 py-3'
      )}>
        <div
          className={cn('flex items-center', !open && 'cursor-pointer')}
          onClick={() => { if (!open) setSidebarOpen(true); }}
        >
          {open ? (
            <img src="/logo.png" alt="ImmoFreak" className="h-7 object-contain" />
          ) : (
            <img src="/logo-icon.png" alt="ImmoFreak" className="size-7 object-contain flex-shrink-0" />
          )}
        </div>
        {/* Close button — Mobile schließt den Drawer transient (Desktop-Präferenz
            bleibt unberührt); Desktop klappt die Sidebar auf Icon-Breite und
            persistiert die Präferenz in localStorage. */}
        {open && (
          <>
            <button
              onClick={() => setSidebarOpenTransient(false)}
              aria-label="Sidebar schließen"
              className="lg:hidden size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-nav-hover cursor-pointer"
            >
              <X size={18} />
            </button>
            <Tip label="Sidebar einklappen">
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Sidebar einklappen"
                className="hidden lg:flex size-8 rounded-lg items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-nav-hover cursor-pointer"
              >
                <PanelLeftClose size={18} strokeWidth={1.9} />
              </button>
            </Tip>
          </>
        )}
      </div>

      {/* Divider */}
      <div className={cn('flex-shrink-0', open ? 'px-4 mb-2' : 'px-2 mb-2')}>
        <div className="border-t border-sidebar-divider" />
      </div>

      {/* ── Search ── */}
      <div className={cn('flex-shrink-0 mb-2', open ? 'px-3' : 'px-2.5')}>
        {open ? (
          <button
            onClick={onSearchClick}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-nav-hover hover:text-foreground transition-colors cursor-pointer border border-card-line bg-card/50"
          >
            <Search size={15} className="shrink-0" />
            <span className="flex-1 text-left text-xs">Suchen...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium text-muted-foreground border border-card-divider">
              ⌘K
            </kbd>
          </button>
        ) : (
          <Tip label="Suchen (⌘K)">
            <button
              onClick={onSearchClick}
              aria-label="Suchen"
              className="w-full flex items-center justify-center py-2.5 rounded-lg text-muted-foreground hover:bg-sidebar-nav-hover hover:text-foreground transition-colors cursor-pointer"
            >
              <Search size={20} strokeWidth={2} />
            </button>
          </Tip>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className={cn('flex-1 pb-2', open ? 'px-3 overflow-y-auto overflow-x-hidden' : 'px-2.5 overflow-visible')}>
        {open ? (
          <div className="flex flex-col">
            {sections.map(section => (
              <div key={section.title} className="mb-1">
                <button
                  onClick={() => toggleSection(section.title)}
                  className="flex items-center gap-1.5 px-3 py-1.5 w-full text-left cursor-pointer group"
                >
                  <ChevronRight
                    size={12}
                    className={cn(
                      'text-muted-foreground transition-transform',
                      !collapsedSections[section.title] && 'rotate-90'
                    )}
                  />
                  <span className="text-[11px] font-medium tracking-wider text-muted-foreground">
                    {section.title}
                  </span>
                </button>
                {!collapsedSections[section.title] && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {section.items.map(item => (
                      <NavLink key={item.to} to={item.to} end={item.to === '/' || item.to === '/bh'}>
                        {({ isActive }) => (
                          <div
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors duration-100',
                              isActive
                                ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] font-bold'
                                : 'text-foreground hover:bg-sidebar-nav-hover font-semibold'
                            )}
                          >
                            <item.icon size={17} className="flex-shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                            <span className="text-sm truncate">{item.label}</span>
                          </div>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sections.flatMap(s => s.items).map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/' || item.to === '/bh'}>
                {({ isActive }) => (
                  <Tip label={item.label}>
                    <div
                      className={cn(
                        'flex items-center justify-center py-2.5 rounded-lg transition-colors duration-100',
                        isActive
                          ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]'
                          : 'text-muted-foreground hover:bg-sidebar-nav-hover hover:text-foreground'
                      )}
                    >
                      <item.icon size={20} className="flex-shrink-0" strokeWidth={isActive ? 2.2 : 1.9} />
                    </div>
                  </Tip>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* ── Bottom ── */}
      <div className={cn('flex-shrink-0 pb-3 pt-2 border-t border-sidebar-divider', open ? 'px-3' : 'px-2.5')}>
        {/* Start Tour */}
        {open ? (
          <button
            onClick={handleStartTour}
            className="group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer mb-1 text-foreground hover:bg-sidebar-nav-hover text-sm font-semibold"
          >
            <span className="relative flex items-center justify-center size-[17px]">
              <Sparkles
                size={17}
                className="text-[#4F6BFF] transition-transform group-hover:scale-110"
                strokeWidth={2}
              />
            </span>
            Tour starten
            <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#4F6BFF]/10 text-[#4F6BFF] tracking-wide">
              DEMO
            </span>
          </button>
        ) : (
          <Tip label="Tour starten">
            <button
              onClick={handleStartTour}
              aria-label="Tour starten"
              className="group w-full flex items-center justify-center py-2 rounded-lg cursor-pointer mb-1 text-[#4F6BFF] hover:bg-sidebar-nav-hover"
            >
              <Sparkles size={20} className="transition-transform group-hover:scale-110" strokeWidth={2} />
            </button>
          </Tip>
        )}

        {/* Settings */}
        {open ? (
          <button onClick={() => navigate('/einstellungen')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer mb-1 text-foreground hover:bg-sidebar-nav-hover text-sm font-semibold">
            <Settings size={17} />
            Einstellungen
          </button>
        ) : (
          <Tip label="Einstellungen">
            <button
              onClick={() => navigate('/einstellungen')}
              aria-label="Einstellungen"
              className="w-full flex items-center justify-center py-2 rounded-lg cursor-pointer mb-1 text-muted-foreground hover:text-foreground hover:bg-sidebar-nav-hover"
            >
              <Settings size={20} strokeWidth={1.9} />
            </button>
          </Tip>
        )}

        {/* Mode Switch */}
        <div className={cn('relative', open ? '' : '')} ref={modeRef} data-tour="mode-switch">
          {open ? (
            <button
              onClick={() => setModeOpen(!modeOpen)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer border text-left mb-1',
                mode === 'fixflip'
                  ? 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20'
                  : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20'
              )}
            >
              <div className={cn(
                'size-8 rounded-lg flex items-center justify-center flex-shrink-0',
                mode === 'fixflip' ? 'bg-amber-500' : 'bg-emerald-500'
              )}>
                <ModeIcon size={15} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-semibold',
                  mode === 'fixflip' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                )}>{modeLabel}</p>
                <p className="text-xs text-muted-foreground truncate">{modeDesc}</p>
              </div>
              <SlidersHorizontal size={14} className="text-muted-foreground flex-shrink-0" />
            </button>
          ) : (
            <Tip label={modeLabel}>
              <button
                onClick={() => setModeOpen(!modeOpen)}
                aria-label={`Modus wechseln — aktuell ${modeLabel}`}
                className="w-full flex items-center justify-center py-2 rounded-lg cursor-pointer mb-1"
              >
                <div className={cn(
                  'size-9 rounded-lg flex items-center justify-center',
                  mode === 'fixflip' ? 'bg-amber-500' : 'bg-emerald-500'
                )}>
                  <ModeIcon size={17} className="text-white" />
                </div>
              </button>
            </Tip>
          )}
          {modeOpen && (
            <div className={cn(
              'absolute z-[70] bottom-full mb-1 bg-dropdown border border-dropdown-line rounded-lg shadow-lg p-1',
              open ? 'left-0 right-0' : 'left-0 w-[220px]'
            )}>
              {(['buyhold', 'fixflip'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer text-sm',
                    mode === m ? 'bg-primary/10 text-primary font-medium' : 'text-dropdown-item-foreground hover:bg-dropdown-item-hover'
                  )}
                >
                  <div className={cn(
                    'size-8 rounded-lg flex items-center justify-center',
                    m === 'fixflip' ? 'bg-amber-500' : 'bg-emerald-500'
                  )}>
                    {m === 'fixflip' ? <Zap size={14} className="text-white" /> : <Home size={14} className="text-white" />}
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{m === 'fixflip' ? 'Fix & Flip' : 'Buy & Hold'}</p>
                    <p className="text-xs text-muted-foreground">{m === 'fixflip' ? 'Projekte verwalten' : 'Mietobjekte verwalten'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User */}
        <div className="relative" ref={profileRef}>
          {open ? (
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg transition-colors cursor-pointer hover:bg-sidebar-nav-hover"
            >
              <div className="size-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold text-white">{(userName || 'U').charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-sm font-semibold flex-1 text-left truncate text-foreground">{userName || 'User'}</span>
              <ChevronDown size={13} className={cn('transition-transform text-muted-foreground', profileOpen && 'rotate-180')} />
            </button>
          ) : (
            <Tip label={userName || 'Profil'}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label="Profil"
                className="w-full flex items-center justify-center py-2 cursor-pointer rounded-lg hover:bg-sidebar-nav-hover"
              >
                <div className="size-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{(userName || 'U').charAt(0).toUpperCase()}</span>
                </div>
              </button>
            </Tip>
          )}
          {profileOpen && (
            <div className={cn(
              'absolute bottom-full mb-1 py-1 z-[70] bg-dropdown border border-dropdown-line rounded-lg shadow-lg',
              open ? 'left-0 right-0' : 'left-0 w-48'
            )}>
              <div className="px-3 py-2 border-b border-dropdown-divider">
                <p className="text-sm font-semibold text-dropdown-item-foreground">{userName || 'User'}</p>
                <p className="text-xs text-muted-foreground">{userEmail || ''}</p>
              </div>
              <div className="py-1">
                <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 transition-colors cursor-pointer text-sm text-muted-foreground hover:bg-dropdown-item-hover">
                  <LogOut size={14} /> Abmelden
                </button>
              </div>
            </div>
          )}
        </div>

        {!open && (
          <Tip label="Sidebar öffnen">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Sidebar öffnen"
              className="w-full flex items-center justify-center py-2 rounded-lg cursor-pointer mt-0.5 text-muted-foreground hover:text-foreground hover:bg-sidebar-nav-hover"
            >
              <PanelLeftOpen size={20} strokeWidth={1.9} />
            </button>
          </Tip>
        )}
      </div>
    </aside>
  );
}
