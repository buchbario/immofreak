import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Building2, HardHat, Calculator, SearchCheck,
  Home, Users, Receipt, Wallet,
} from 'lucide-react';
import { useAppMode } from '../../context/AppModeContext';
import { cn } from '../../lib/utils';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  end?: boolean;
}

const fixFlipItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Start', end: true },
  { to: '/projekte', icon: Building2, label: 'Projekte' },
  { to: '/handwerker', icon: HardHat, label: 'Handwerker' },
  { to: '/kalkulator', icon: Calculator, label: 'Rechner' },
  { to: '/deal-analyzer', icon: SearchCheck, label: 'Analyzer' },
];

const buyHoldItems: NavItem[] = [
  { to: '/bh', icon: LayoutDashboard, label: 'Start', end: true },
  { to: '/bh/objekte', icon: Home, label: 'Objekte' },
  { to: '/bh/mieter', icon: Users, label: 'Mieter' },
  { to: '/bh/transaktionen', icon: Receipt, label: 'Zahlungen' },
  { to: '/bh/finanzen', icon: Wallet, label: 'Finanzen' },
];

export function MobileBottomNav() {
  const { mode } = useAppMode();
  const items = mode === 'fixflip' ? fixFlipItems : buyHoldItems;

  return (
    <nav
      className="lg:hidden flex-shrink-0 bg-card/95 backdrop-blur-md border-t border-card-line"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <div className="grid grid-cols-5 h-14">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="cursor-pointer active:bg-layer-active">
            {({ isActive }) => (
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 h-full transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className={cn('text-[10px] leading-none', isActive ? 'font-semibold' : 'font-medium')}>
                  {item.label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
