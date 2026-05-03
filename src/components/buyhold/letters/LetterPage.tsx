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
      <div className="bg-card border border-card-line rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-card-divider">
          <h1 className="text-[24px] sm:text-[26px] font-bold text-foreground tracking-tight leading-tight mb-1">
            Schreiben
          </h1>
          <p className="text-[13px] text-muted-foreground max-w-2xl leading-relaxed">
            Rechtssichere Mietervorlagen — Mieterhöhung, Kündigung, Selbstauskunft und mehr, alle automatisch nach aktueller Rechtslage.
          </p>
        </div>

        {/* Templates grouped by section */}
        <div className="p-5 sm:p-6 space-y-6">
          {SECTIONS.map((sec) => {
            const items = templates.filter((t) => t.section === sec.key);
            if (items.length === 0) return null;
            return (
              <div key={sec.key}>
                <h2 className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground/70 mb-2.5 px-1">
                  {sec.label}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((t) => {
                    const Icon = t.icon;
                    return (
                      <div
                        key={t.id}
                        className="group bg-card border border-card-line rounded-[12px] p-4 hover:-translate-y-px transition-all hover:shadow-[0_4px_12px_rgba(79,107,255,0.10)] hover:border-[#4F6BFF]/30"
                      >
                        <div className="flex items-start gap-3">
                          <div className="size-10 rounded-[10px] flex items-center justify-center flex-shrink-0 bg-[#4F6BFF]/10 group-hover:bg-[#4F6BFF]/15 transition-colors">
                            <Icon size={17} className="text-[#4F6BFF]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[13.5px] font-semibold text-foreground tracking-tight">{t.title}</h3>
                            <p className="text-[11.5px] mt-1 leading-relaxed text-muted-foreground">{t.description}</p>
                            <button
                              onClick={() => setLetterType(t.id)}
                              className="btn btn-sm btn-primary mt-3"
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
    </div>
  );
}
