import {
  Sparkles, SlidersHorizontal, Home, Building2, Users, Receipt,
  Zap, LayoutDashboard, SearchCheck, Rocket,
} from 'lucide-react';
import type { AppMode } from '../../types';

export interface TourStep {
  title: string;
  description: string;
  /** Optional route to navigate to when this step becomes active. */
  route?: string;
  /** Optional mode to switch into when this step becomes active. */
  mode?: AppMode;
  /** Optional short tip shown under the description. */
  tip?: string;
  /** Optional CSS selector for the element to spotlight. */
  targetSelector?: string;
  /** Extra padding around the spotlight (default 8px). */
  spotlightPad?: number;
  icon: typeof Sparkles;
  /** Accent color for the icon tile. */
  accent: 'blue' | 'emerald' | 'amber' | 'violet';
}

export const tourSteps: TourStep[] = [
  {
    title: 'Willkommen bei ImmoFreak',
    description:
      'In 10 kurzen Schritten zeigen wir dir die wichtigsten Funktionen. Die Tour führt dich durch beide Modi – Buy & Hold und Fix & Flip.',
    tip: 'Klicke auf „Weiter“, um loszulegen.',
    icon: Sparkles,
    accent: 'blue',
  },
  {
    title: 'Zwei Modi — ein CRM',
    description:
      'ImmoFreak vereint zwei Arbeitsweisen: „Fix & Flip“ für Sanierungsprojekte und „Buy & Hold“ für langfristige Vermietung. Der Modus-Umschalter befindet sich unten in der Sidebar.',
    tip: 'Wir starten jetzt mit Buy & Hold.',
    icon: SlidersHorizontal,
    accent: 'violet',
    targetSelector: '[data-tour="mode-switch"]',
    spotlightPad: 4,
  },
  {
    title: 'Portfolio-Dashboard',
    description:
      'Das Buy & Hold Dashboard zeigt dir alle KPIs auf einen Blick: Gesamtwert, monatliche Mieteinnahmen, Brutto- und Nettorendite sowie die Belegungsquote.',
    icon: Home,
    accent: 'blue',
    mode: 'buyhold',
    route: '/bh',
    targetSelector: '[data-tour="bh-kpis"]',
  },
  {
    title: 'Objekte verwalten',
    description:
      'Lege Mietobjekte mit Adresse, Kaufpreis und Einheiten an. Pro Objekt siehst du sofort Rendite, belegte Einheiten und Mieteinnahmen.',
    tip: 'Tipp: Klicke auf ein Objekt, um Details zu öffnen.',
    icon: Building2,
    accent: 'emerald',
    mode: 'buyhold',
    route: '/bh/objekte',
    targetSelector: '[data-tour="property-list"]',
  },
  {
    title: 'Mieter & Mietverträge',
    description:
      'Erfasse Mieter mit Kaltmiete, Laufzeit und Kontaktdaten. Auslaufende Verträge werden automatisch markiert, damit du rechtzeitig reagieren kannst.',
    icon: Users,
    accent: 'violet',
    mode: 'buyhold',
    route: '/bh/mieter',
    targetSelector: '[data-tour="tenant-list"]',
    spotlightPad: 6,
  },
  {
    title: 'Zahlungen tracken',
    description:
      'Erfasse Mieteingänge, behalte ausstehende und überfällige Zahlungen im Blick und exportiere Übersichten für deinen Steuerberater.',
    icon: Receipt,
    accent: 'emerald',
    mode: 'buyhold',
    route: '/bh/transaktionen',
    targetSelector: '[data-tour="transactions-kpis"]',
  },
  {
    title: 'Fix & Flip Modus',
    description:
      'Wir wechseln jetzt in den Fix & Flip Modus. Hier verwaltest du Sanierungsprojekte mit Kaufpreis, Renovierungsbudget und Zielrendite.',
    icon: Zap,
    accent: 'amber',
    mode: 'fixflip',
    route: '/',
    targetSelector: '[data-tour="ff-kpis"]',
  },
  {
    title: 'Projekte & Kanban',
    description:
      'Ziehe Projekte per Drag & Drop durch die Phasen: Akquise → Planung → Sanierung → Verkauf → Abgeschlossen. Immer im Überblick, wie weit jedes Projekt ist.',
    tip: 'In der Detailansicht findest du Budget-Tracking, Timeline und Handwerker-Zuordnung.',
    icon: LayoutDashboard,
    accent: 'blue',
    mode: 'fixflip',
    route: '/projekte',
    targetSelector: '[data-tour="project-kanban"]',
    spotlightPad: 4,
  },
  {
    title: 'Deal Analyzer',
    description:
      'Bevor du kaufst: Prüfe mit dem Deal Analyzer, ob sich ein Objekt lohnt. Er rechnet Kaufnebenkosten, Sanierung, ROI und erwarteten Gewinn automatisch aus.',
    icon: SearchCheck,
    accent: 'violet',
    mode: 'fixflip',
    route: '/deal-analyzer',
    targetSelector: '[data-tour="deal-analyzer"]',
  },
  {
    title: 'Bereit loszulegen',
    description:
      'Du kennst jetzt die wichtigsten Funktionen. Gelöschte Einträge landen im Papierkorb — 30 Tage wiederherstellbar. Viel Erfolg mit ImmoFreak!',
    tip: 'Klicke auf „Fertig“, um die Tour abzuschließen.',
    icon: Rocket,
    accent: 'emerald',
  },
];
