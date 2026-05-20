import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Landmark } from 'lucide-react';
import { cn } from '../../lib/utils';
import { finishBanksapiConnect } from '../../lib/banksapiClient';
import { supabase } from '../../lib/supabase';
import { objectToRow } from '../../lib/caseMapping';
import { bankAccountStore, bankTransactionStore } from '../../lib/storage';
import { generateId } from '../../lib/utils';
import type { BankAccount } from '../../types';

type State = 'loading' | 'success' | 'error';

/**
 * Empfängt den Redirect von BANKSapi REG/Protect nach dem Bank-Login.
 * URL-Format: `/bh/banking/callback?code=<...>&accessId=<...>&bank=<key>&holder=<name>`.
 *
 * Persistierung läuft hier bewusst über direkte Supabase-Inserts (statt
 * `useBanking`'s optimistic Adapter), damit Account und Transaktionen
 * sequentiell mit Foreign-Key-Constraint geschrieben werden — sonst rennt der
 * TX-Insert dem Account-Insert davon und der `bank_account_id_fkey` schlägt.
 */
/**
 * Bank-Favicon via Google-Favicons-Service (deckt ~99% deutscher Banken).
 * Bei Fehler / fehlender Domain fällt auf den Landmark-Icon-Style zurück.
 */
function BankFavicon({ domain, name }: { domain: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!domain || failed) {
    return <Landmark size={28} className="text-[#4F6BFF]" />;
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`}
      alt={name || domain}
      className={cn('size-10 object-contain')}
      onError={() => setFailed(true)}
      loading="eager"
      referrerPolicy="no-referrer"
    />
  );
}

export function BankingCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('loading');
  const [message, setMessage] = useState('Verbinde dein Konto …');
  const [error, setError] = useState('');
  const ranRef = useRef(false);

  // Bank-Info für die Loading-Animation aus den URL-Params lesen — die Edge
  // Function reicht das durch, damit wir das Logo der gewählten Bank zeigen
  // können während wir auf die finalen Kontodaten warten.
  const animBankName = params.get('bankName') || '';
  const animBankDomain = params.get('bankDomain') || '';

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    let mounted = true;
    let navTimer: ReturnType<typeof setTimeout> | null = null;

    const code = params.get('code') || undefined;
    const accessId = params.get('accessId') || undefined;
    const bankKey = params.get('bank') || 'deutsche-bank';
    const holder = params.get('holder') || '';
    const label = params.get('label') || '';
    const baError = params.get('error') || params.get('baError');

    if (baError) {
      setError(`BANKSapi-Fehler: ${baError}`);
      setState('error');
      return;
    }
    if (!code && !accessId) {
      setError('Kein Code / accessId im Callback empfangen.');
      setState('error');
      return;
    }

    (async () => {
      try {
        const result = await finishBanksapiConnect({ code, accessId, bankKey, accountHolder: holder });
        setMessage('Konto wird angelegt …');

        // 1) Account-Row schreiben — wir müssen warten, bevor wir TXs einfügen,
        //    sonst greift die FK-Constraint nicht.
        const safeStr = (v: unknown): string => (typeof v === 'string' ? v : '');
        const accountId = generateId();
        const accountObj: BankAccount = {
          id: accountId,
          bankName: safeStr(result.account.bankName) || 'Bank',
          label: label || undefined,
          iban: safeStr(result.account.iban),
          bic: safeStr(result.account.bic),
          accountHolder: safeStr(result.account.accountHolder),
          balance: typeof result.account.balance === 'number' ? result.account.balance : 0,
          lastSync: new Date().toISOString(),
          status: 'connected',
          color: safeStr(result.account.color) || '#4F6BFF',
          domain: result.account.domain && typeof result.account.domain === 'string' ? result.account.domain : undefined,
          provider: 'banksapi',
          banksapiAccessId: safeStr(result.account.banksapiAccessId),
          banksapiProductId: safeStr(result.account.banksapiProductId),
          consentExpiresAt: safeStr(result.account.consentExpiresAt),
          createdAt: new Date().toISOString(),
        };
        const accountRow = objectToRow(accountObj as unknown as Record<string, unknown>);
        delete accountRow.user_id;
        const { error: accErr } = await supabase.from('bank_accounts').insert(accountRow);
        if (accErr) throw new Error(`Konto-Insert fehlgeschlagen: ${accErr.message}`);

        // 2) Transaktionen in einem Bulk-Insert — Account existiert jetzt, FK passt.
        setMessage(`Lade ${result.transactions.length} Transaktionen …`);
        if (result.transactions.length > 0) {
          // Direkter snake_case-Row-Bau ohne objectToRow-Magic. Pflicht-String-Felder
          // (counterparty, purpose) bekommen IMMER einen String — selbst wenn BANKSapi
          // null/object/missing liefert. Optionale Felder werden bei "leer" weggelassen,
          // damit der Postgres-Default greift.
          // Dedup: BANKSapi liefert manchmal denselben Umsatz mehrfach (z.B. wenn
          // mehrere Produkte auf dieselbe IBAN zeigen) — gegen UNIQUE-Index-Verletzung.
          const seenTxIds = new Set<string>();
          const txRows: Record<string, unknown>[] = [];
          for (let i = 0; i < result.transactions.length; i++) {
            const tx = result.transactions[i];
            const counterparty = typeof tx.counterparty === 'string' ? tx.counterparty : '';
            const purpose = typeof tx.purpose === 'string' ? tx.purpose : '';
            const date = typeof tx.date === 'string' && tx.date
              ? tx.date.slice(0, 10)
              : new Date().toISOString().slice(0, 10);
            const amount = typeof tx.amount === 'number' && Number.isFinite(tx.amount) ? tx.amount : 0;
            const ibanStr = typeof tx.iban === 'string' && tx.iban ? tx.iban : null;
            // Wenn BANKSapi keine eindeutige ID liefert oder die ID doppelt wäre,
            // bauen wir einen synthetischen Schlüssel der den Insert nicht crashen lässt.
            let banksapiTxId = typeof tx.banksapiTransactionId === 'string' && tx.banksapiTransactionId
              ? tx.banksapiTransactionId
              : `${accountId}-${i}-${date}-${amount}`;
            if (seenTxIds.has(banksapiTxId)) {
              banksapiTxId = `${banksapiTxId}-${i}`;
            }
            seenTxIds.add(banksapiTxId);

            const row: Record<string, unknown> = {
              id: generateId(),
              bank_account_id: accountId,
              date,
              amount,
              counterparty,
              purpose,
              banksapi_transaction_id: banksapiTxId,
              is_reconciled: false,
              created_at: new Date().toISOString(),
            };
            if (ibanStr) row.iban = ibanStr;
            txRows.push(row);
          }
          const { error: txErr } = await supabase.from('bank_transactions').insert(txRows);
          if (txErr) throw new Error(`Transaktions-Insert fehlgeschlagen: ${txErr.message}`);
        }

        // 3) Caches verwerfen — beim nächsten Mount fetcht der Adapter frisch.
        bankAccountStore.invalidate();
        bankTransactionStore.invalidate();

        if (!mounted) return;
        setState('success');
        setMessage(`${result.account.bankName} verbunden – ${result.transactions.length} Transaktionen importiert.`);
        navTimer = setTimeout(() => {
          if (mounted) navigate('/bh/banking', { replace: true });
        }, 1500);
      } catch (e) {
        if (!mounted) return;
        setError((e as Error).message || 'Unbekannter Fehler');
        setState('error');
      }
    })();

    return () => {
      mounted = false;
      if (navTimer) clearTimeout(navTimer);
    };
  }, [params, navigate]);

  return (
    <div className="page-container">
      <div className="max-w-md mx-auto mt-16 bg-card border border-card-line rounded-2xl p-8 text-center">
        {state === 'loading' && (
          <>
            {/* Bank-Logo mit rotierendem Ring — selbe Optik wie das alte Demo-Modal */}
            <div className="relative size-16 mx-auto mb-5">
              <div className="size-16 rounded-2xl bg-white border border-card-line flex items-center justify-center shadow-sm overflow-hidden">
                <BankFavicon domain={animBankDomain} name={animBankName} />
              </div>
              <div
                className="absolute -inset-1 rounded-2xl border-2 border-transparent animate-spin"
                style={{ borderTopColor: '#4F6BFF', borderRightColor: '#4F6BFF40' }}
              />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {animBankName ? `${animBankName} wird verbunden` : 'Bank wird verbunden'}
            </h2>
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}
        {state === 'success' && (
          <>
            <div className="size-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={26} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Konto verbunden</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground mt-3">Du wirst weitergeleitet …</p>
          </>
        )}
        {state === 'error' && (
          <>
            <div className="size-14 rounded-2xl bg-red-100 dark:bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={26} className="text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Verbindung fehlgeschlagen</h2>
            <p className="text-sm text-muted-foreground mb-5 whitespace-pre-wrap">{error}</p>
            <button
              onClick={() => navigate('/bh/banking', { replace: true })}
              className="btn btn-md btn-primary"
            >
              <Landmark size={14} /> Zurück zu Banking
            </button>
          </>
        )}
      </div>
    </div>
  );
}
