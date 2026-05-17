import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Calculator, SearchCheck,
  Home, Wallet, ListTodo, Sparkles, Target,
} from 'lucide-react';
import { useAppMode } from '../../context/AppModeContext';
import { useTranslation } from '../../context/LocaleContext';
import { usePrivateBoards } from '../../hooks/usePrivateBoards';
import { cn } from '../../lib/utils';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  /** Optional emoji shown instead of the Lucide icon (used for pinned private boards). */
  emoji?: string;
  end?: boolean;
}

// Labels sind hier Translation-Keys (siehe `i18n/translations.ts`).
// Der Renderer ruft t(item.label) auf — Pinned-Boards mit User-Namen
// fallen automatisch auf den unveränderten String zurück.
// Fix & Flip Mobile: Dashboard, Leads, Projekte, Kalkulator, Deal Analyzer,
// Aufgaben. Alles andere (Handwerker, Settings etc.) bewusst desktop-only.
const fixFlipItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'mobilenav.start', end: true },
  { to: '/leads', icon: Target, label: 'mobilenav.leads' },
  { to: '/projekte', icon: Building2, label: 'mobilenav.projects' },
  { to: '/kalkulator', icon: Calculator, label: 'mobilenav.calculator' },
  { to: '/deal-analyzer', icon: SearchCheck, label: 'mobilenav.analyzer' },
  { to: '/aufgaben', icon: ListTodo, label: 'mobilenav.tasks' },
];

// Buy & Hold Mobile: Dashboard, Objekte, Finanzen, Aufgaben — reduzierte Set,
// Mieter / Verträge / Versorger etc. nur am Desktop.
const buyHoldItems: NavItem[] = [
  { to: '/bh', icon: LayoutDashboard, label: 'mobilenav.start', end: true },
  { to: '/bh/objekte', icon: Home, label: 'mobilenav.objects' },
  { to: '/bh/finanzen', icon: Wallet, label: 'mobilenav.finance' },
  { to: '/bh/aufgaben', icon: ListTodo, label: 'mobilenav.tasks' },
];

/**
 * Mode-spezifische Akzent-Farben — Active-Pill und Indicator nutzen diese,
 * damit die Bar visuell mit dem Mode-Switch in der Sidebar konsistent ist.
 */
const MODE_ACCENT = {
  fixflip: {
    pillBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
    pillRing: 'ring-amber-300/40',
    activeText: 'text-white',
    glow: 'shadow-[0_6px_20px_-4px_rgba(249,115,22,0.45)]',
  },
  buyhold: {
    pillBg: 'bg-gradient-to-br from-emerald-400 to-teal-600',
    pillRing: 'ring-emerald-300/40',
    activeText: 'text-white',
    glow: 'shadow-[0_6px_20px_-4px_rgba(16,185,129,0.45)]',
  },
  private: {
    pillBg: 'bg-gradient-to-br from-violet-400 via-fuchsia-500 to-rose-500',
    pillRing: 'ring-violet-300/40',
    activeText: 'text-white',
    glow: 'shadow-[0_6px_20px_-4px_rgba(168,85,247,0.45)]',
  },
} as const;

export function MobileBottomNav() {
  const { mode } = useAppMode();
  const { pinnedBoards } = usePrivateBoards();
  const { t } = useTranslation();

  // Privat-Modus: Start + alle Boards + bis zu 3 angepinnte Boards (Top-3 nach pinOrder).
  // Wenn weniger als 3 gepinnt sind, schrumpft das Grid passend — kein toter Raum.
  const privateItems: NavItem[] = [
    { to: '/privat', icon: LayoutDashboard, label: 'mobilenav.start', end: true },
    { to: '/privat/boards', icon: ListTodo, label: 'mobilenav.boards', end: true },
    ...pinnedBoards.slice(0, 3).map((b) => ({
      to: `/privat/boards/${b.id}`,
      icon: Sparkles, // Fallback falls das Board kein Emoji hat
      label: b.name, // User-Boardname → wird von t() unverändert durchgereicht
      emoji: b.icon,
    })),
  ];

  const items =
    mode === 'fixflip' ? fixFlipItems :
    mode === 'private' ? privateItems :
    buyHoldItems;

  const accent = MODE_ACCENT[mode];

  return (
    <div
      className="lg:hidden flex-shrink-0 px-3 pt-2 pb-2"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0))' }}
    >
      {/* Floating, frosted glass bar — Active-Item wird breiter, damit das Label
          ausreichend Platz bekommt. Inaktive Items sind kompakte Icon-Pills,
          das aktive Item gleitet als breitere Pill mit Icon + Label hervor. */}
      <nav
        className={cn(
          'relative flex items-stretch justify-around gap-1 px-1.5 py-1.5',
          'rounded-2xl backdrop-blur-xl bg-card/85 border border-card-line/80',
          'shadow-[0_8px_28px_-8px_rgba(15,23,42,0.18),0_2px_6px_-2px_rgba(15,23,42,0.06)]',
        )}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'min-w-0 cursor-pointer transition-[flex-grow] duration-300',
                // Active-Item bekommt viel mehr horizontalen Raum — sonst wird das
                // Label auf 5-Item-Bars (Fix-&-Flip / Buy-&-Hold) abgeschnitten.
                isActive ? 'flex-[2_1_0%]' : 'flex-[1_1_0%]',
              )
            }
          >
            {({ isActive }) => (
              <div
                className={cn(
                  'relative h-11 rounded-xl flex items-center justify-center gap-1.5 px-2 transition-all duration-300 w-full',
                  isActive
                    ? cn(accent.pillBg, accent.glow, accent.activeText, 'ring-1 ring-inset', accent.pillRing)
                    : 'text-muted-foreground hover:text-foreground active:bg-layer-hover',
                )}
              >
                {item.emoji ? (
                  <span
                    className="text-[19px] leading-none drop-shadow-sm flex-shrink-0"
                    aria-hidden
                  >
                    {item.emoji}
                  </span>
                ) : (
                  <item.icon
                    size={isActive ? 18 : 20}
                    strokeWidth={isActive ? 2.5 : 1.9}
                    className={cn('flex-shrink-0', isActive && 'drop-shadow-sm')}
                  />
                )}
                {/* Label nur bei Active — bekommt durch flex-[2] genug Raum,
                    damit auch "Handwerker" oder "Analyzer" voll lesbar bleibt. */}
                {isActive && (
                  <span
                    className={cn(
                      'whitespace-nowrap text-[12.5px] font-semibold tracking-tight truncate',
                      // Subtle Schatten verbessert Lesbarkeit auf hellen Gradient-Tönen
                      'drop-shadow-[0_1px_1px_rgba(0,0,0,0.18)]',
                    )}
                  >
                    {t(item.label)}
                  </span>
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
