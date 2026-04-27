import { useState, useEffect, useCallback } from 'react';

export interface LandlordSettings {
  // Absender / Vermieter
  companyName: string;
  contactName: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  taxId: string;
  // Bankverbindung (für Mahnung, Kautionsrückzahlung, etc.)
  iban: string;
  bic: string;
  bankName: string;
  // Standard-Verwendungszweck
  defaultPaymentPurpose: string;
  // Signature / Schlussformel
  signatureName: string;
}

const STORAGE_KEY = 'immofreak_landlord_settings';

const DEFAULT: LandlordSettings = {
  companyName: '',
  contactName: '',
  street: '',
  zip: '',
  city: '',
  phone: '',
  email: '',
  taxId: '',
  iban: '',
  bic: '',
  bankName: '',
  defaultPaymentPurpose: 'Miete bitte angeben',
  signatureName: '',
};

function read(): LandlordSettings {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT;
  try {
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function useLandlordSettings() {
  const [settings, setSettings] = useState<LandlordSettings>(() => read());

  const save = useCallback((next: LandlordSettings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSettings(next);
    window.dispatchEvent(new Event('landlord-settings-updated'));
  }, []);

  const update = useCallback((patch: Partial<LandlordSettings>) => {
    const next = { ...read(), ...patch };
    save(next);
  }, [save]);

  useEffect(() => {
    const handler = () => setSettings(read());
    window.addEventListener('landlord-settings-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('landlord-settings-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const bankInfoBlock = settings.iban
    ? `IBAN: ${settings.iban}${settings.bic ? `\nBIC: ${settings.bic}` : ''}${settings.bankName ? `\nBank: ${settings.bankName}` : ''}${settings.defaultPaymentPurpose ? `\nVerwendungszweck: ${settings.defaultPaymentPurpose}` : ''}`
    : '';

  const senderBlock = [
    settings.companyName,
    settings.contactName,
    [settings.street, [settings.zip, settings.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
  ].filter(Boolean).join(' · ');

  const isComplete = !!(settings.companyName || settings.contactName) && !!settings.street && !!settings.city;

  return { settings, save, update, bankInfoBlock, senderBlock, isComplete };
}
