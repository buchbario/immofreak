import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2, Landmark } from 'lucide-react';
import { finishBanksapiConnect } from '../../lib/banksapiClient';
import { supabase } from '../../lib/supabase';
import { objectToRow } from '../../lib/caseMapping';
import { bankAccountStore, bankTransactionStore } from '../../lib/storage';
import { generateId } from '../../lib/utils';
import type { BankAccount, BankTransaction } from '../../types';

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
export function BankingCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('loading');
  const [message, setMessage] = useState('Verbinde dein Konto …');
  const [error, setError] = useState('');
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

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
        const accountId = generateId();
        const accountObj: BankAccount = {
          id: accountId,
          bankName: result.account.bankName,
          label: label || undefined,
          iban: result.account.iban,
          bic: result.account.bic,
          accountHolder: result.account.accountHolder,
          balance: result.account.balance,
          lastSync: new Date().toISOString(),
          status: 'connected',
          color: result.account.color,
          domain: result.account.domain,
          provider: 'banksapi',
          banksapiAccessId: result.account.banksapiAccessId,
          banksapiProductId: result.account.banksapiProductId,
          consentExpiresAt: result.account.consentExpiresAt,
          createdAt: new Date().toISOString(),
        };
        const accountRow = objectToRow(accountObj as unknown as Record<string, unknown>);
        delete accountRow.user_id;
        const { error: accErr } = await supabase.from('bank_accounts').insert(accountRow);
        if (accErr) throw new Error(`Konto-Insert fehlgeschlagen: ${accErr.message}`);

        // 2) Transaktionen in einem Bulk-Insert — Account existiert jetzt, FK passt.
        setMessage(`Lade ${result.transactions.length} Transaktionen …`);
        if (result.transactions.length > 0) {
          const txObjs: BankTransaction[] = result.transactions.map((tx) => ({
            id: generateId(),
            bankAccountId: accountId,
            date: tx.date,
            amount: tx.amount,
            counterparty: tx.counterparty,
            purpose: tx.purpose,
            iban: tx.iban,
            banksapiTransactionId: tx.banksapiTransactionId,
            isReconciled: false,
            createdAt: new Date().toISOString(),
          }));
          const txRows = txObjs.map((t) => {
            const row = objectToRow(t as unknown as Record<string, unknown>);
            delete row.user_id;
            return row;
          });
          const { error: txErr } = await supabase.from('bank_transactions').insert(txRows);
          if (txErr) throw new Error(`Transaktions-Insert fehlgeschlagen: ${txErr.message}`);
        }

        // 3) Caches verwerfen — beim nächsten Mount fetcht der Adapter frisch.
        bankAccountStore.invalidate();
        bankTransactionStore.invalidate();

        setState('success');
        setMessage(`${result.account.bankName} verbunden – ${result.transactions.length} Transaktionen importiert.`);
        setTimeout(() => navigate('/bh/banking', { replace: true }), 1500);
      } catch (e) {
        setError((e as Error).message || 'Unbekannter Fehler');
        setState('error');
      }
    })();
  }, [params, navigate]);

  return (
    <div className="page-container">
      <div className="max-w-md mx-auto mt-16 bg-card border border-card-line rounded-2xl p-8 text-center">
        {state === 'loading' && (
          <>
            <div className="size-14 rounded-2xl bg-[#4F6BFF]/10 flex items-center justify-center mx-auto mb-4">
              <Loader2 size={26} className="text-[#4F6BFF] animate-spin" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Bank wird verbunden</h2>
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
