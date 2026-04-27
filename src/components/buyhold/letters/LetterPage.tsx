import { useState } from 'react';
import { ArrowRight, FileText, Receipt, Bell, XCircle, ClipboardList, Wallet, RefreshCw, UserCheck, TrendingUp, FileSignature } from 'lucide-react';
import { RentIncreaseLetter } from './RentIncreaseLetter';
import { UtilityBillLetter } from './UtilityBillLetter';
import { DunningLetter } from './DunningLetter';
import { TerminationLetter } from './TerminationLetter';
import { HandoverProtocol } from './HandoverProtocol';
import { DepositSettlement } from './DepositSettlement';
import { AdvancePaymentAdjustment } from './AdvancePaymentAdjustment';
import { TenantSelfDisclosure } from './TenantSelfDisclosure';
import { IndexRentAdjustment } from './IndexRentAdjustment';
import { RentalContractLetter } from './RentalContractLetter';

type LetterType =
  | 'none'
  | 'rent-increase'
  | 'utility-bill'
  | 'dunning'
  | 'termination'
  | 'handover'
  | 'deposit'
  | 'advance-payment'
  | 'self-disclosure'
  | 'index-staffel'
  | 'rental-contract';

type Section = 'vertrag' | 'betrieb' | 'mahnung' | 'uebergabe';

const templates: {
  id: Exclude<LetterType, 'none'>;
  title: string;
  description: string;
  icon: typeof FileText;
  section: Section;
}[] = [
  {
    id: 'self-disclosure',
    title: 'Selbstauskunft',
    description: 'Mieterfragebogen nach BGH-Rechtsprechung + DSGVO Art. 13 — nur zulässige Fragen (kein Familienstand-Detail, keine Religion/Vorstrafen).',
    icon: UserCheck,
    section: 'vertrag',
  },
  {
    id: 'rental-contract',
    title: 'Mietvertrag (Wohnraum)',
    description: 'Rechtssicherer Wohnraummietvertrag nach §§ 535 ff. BGB. Basis: gespeicherter Mietvertrags-Datensatz. Inkl. Kautionsdeckel § 551 BGB, Tierhaltung BGH-konform, Schönheitsreparaturen nach BGH VIII ZR 185/14, DSGVO-Klausel.',
    icon: FileSignature,
    section: 'vertrag',
  },
  {
    id: 'handover',
    title: 'Übergabeprotokoll',
    description: 'Ein- und Auszugsprotokoll nach § 546 BGB mit Zählerständen, Schlüsseln, Mängelliste und Unterschriftsfeldern.',
    icon: ClipboardList,
    section: 'uebergabe',
  },
  {
    id: 'deposit',
    title: 'Kautionsabrechnung',
    description: 'Abrechnung nach § 551 BGB mit Verzinsung, Abzügen mit Nachweis und § 548 BGB Verjährungshinweis.',
    icon: Wallet,
    section: 'uebergabe',
  },
  {
    id: 'utility-bill',
    title: 'Nebenkostenabrechnung',
    description: 'Betriebs- und Heizkostenabrechnung nach § 556 BGB und HeizkostenV mit Verteilerschlüsseln, trennung umlagefähig/nicht umlagefähig und 12-Monats-Einwendungsfrist.',
    icon: Receipt,
    section: 'betrieb',
  },
  {
    id: 'advance-payment',
    title: 'Vorauszahlungsanpassung',
    description: 'Anpassung der Nebenkosten-Vorauszahlung nach § 560 Abs. 4 BGB — auf Basis der letzten Abrechnung, angemessene Höhe.',
    icon: RefreshCw,
    section: 'betrieb',
  },
  {
    id: 'rent-increase',
    title: 'Mieterhöhung (Vergleichsmiete)',
    description: 'Mieterhöhungsverlangen nach § 558 BGB mit Kappungsgrenze, 15-Monats-Sperrfrist, Begründungsmittel und Sonderkündigungsrecht nach § 561 BGB.',
    icon: FileText,
    section: 'vertrag',
  },
  {
    id: 'index-staffel',
    title: 'Staffel- / Indexmiete',
    description: 'Anpassung nach § 557a BGB (Staffelmiete) oder § 557b BGB (VPI-Indexmiete) mit Jahresfrist-Prüfung und Wirksamkeitsdatum.',
    icon: TrendingUp,
    section: 'vertrag',
  },
  {
    id: 'dunning',
    title: 'Mahnung',
    description: '3-stufiges Mahnverfahren (Erinnerung, Mahnung, letzte Mahnung) mit Verzugszinsen nach § 288 BGB und korrekten Zahlungsfristen.',
    icon: Bell,
    section: 'mahnung',
  },
  {
    id: 'termination',
    title: 'Kündigung',
    description: 'Ordentliche und außerordentliche Kündigung nach § 573/573c BGB bzw. § 543 BGB mit automatischer Fristberechnung, Begründungspflicht und Widerspruchsbelehrung.',
    icon: XCircle,
    section: 'mahnung',
  },
];

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'vertrag', label: 'Vertrag & Anpassungen' },
  { key: 'uebergabe', label: 'Übergabe & Kaution' },
  { key: 'betrieb', label: 'Nebenkosten' },
  { key: 'mahnung', label: 'Mahnung & Kündigung' },
];

export function LetterPage() {
  const [letterType, setLetterType] = useState<LetterType>('none');

  if (letterType === 'rent-increase') return <RentIncreaseLetter onBack={() => setLetterType('none')} />;
  if (letterType === 'utility-bill') return <UtilityBillLetter onBack={() => setLetterType('none')} />;
  if (letterType === 'dunning') return <DunningLetter onBack={() => setLetterType('none')} />;
  if (letterType === 'termination') return <TerminationLetter onBack={() => setLetterType('none')} />;
  if (letterType === 'handover') return <HandoverProtocol onBack={() => setLetterType('none')} />;
  if (letterType === 'deposit') return <DepositSettlement onBack={() => setLetterType('none')} />;
  if (letterType === 'advance-payment') return <AdvancePaymentAdjustment onBack={() => setLetterType('none')} />;
  if (letterType === 'self-disclosure') return <TenantSelfDisclosure onBack={() => setLetterType('none')} />;
  if (letterType === 'index-staffel') return <IndexRentAdjustment onBack={() => setLetterType('none')} />;
  if (letterType === 'rental-contract') return <RentalContractLetter onBack={() => setLetterType('none')} />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Schreiben</h1>
          <p className="page-subtitle">Rechtssichere Mieter­vorlagen — alle nach aktueller BGB-, BetrKV-, HeizkostenV- und GEG-Rechtslage</p>
        </div>
      </div>

      <div className="space-y-8">
        {SECTIONS.map((sec) => {
          const items = templates.filter((t) => t.section === sec.key);
          if (items.length === 0) return null;
          return (
            <div key={sec.key}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground-2 mb-3">{sec.label}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((t) => {
                  const Icon = t.icon;
                  return (
                    <div key={t.id} className="surface-hover p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(79, 107, 255, 0.1)' }}>
                          <Icon size={18} className="text-[#4F6BFF]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
                          <p className="text-xs mt-1 leading-relaxed text-muted-foreground-2">{t.description}</p>
                          <button
                            onClick={() => setLetterType(t.id)}
                            className="btn btn-md btn-primary mt-4"
                          >
                            Erstellen
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
