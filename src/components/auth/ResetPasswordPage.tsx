import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Mail, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

/**
 * Doppelte Funktion:
 *  1) Ohne Recovery-Session → "Reset-Mail anfordern"
 *  2) Mit Recovery-Session (User klickt Mail-Link → Supabase setzt Session) →
 *     neues Passwort setzen
 */
export function ResetPasswordPage() {
  const { resetPassword, session } = useAuth();
  const navigate = useNavigate();
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Wenn der User über den Mail-Link kommt, ist eine Session da + recoveryMode true
  const showNewPasswordForm = recoveryMode || (session && new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery');

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Bitte E-Mail eingeben.');
      return;
    }
    setLoading(true);
    const { error: err } = await resetPassword(email);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbff]">
      <header className="px-6 sm:px-8 pt-6 sm:pt-8">
        <a href="/" className="inline-flex items-center">
          <img src="/logo.png" alt="ImmoFreak" className="h-10 sm:h-12 object-contain" />
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          {showNewPasswordForm ? (
            <>
              <div className="text-center mb-7">
                <h1 className="text-[26px] font-bold text-[#0f1430] mb-2">Neues Passwort</h1>
                <p className="text-[13.5px] text-[#1e1b4b]/55">Lege ein neues Passwort fest.</p>
              </div>
              <form onSubmit={handleNewPassword} className="space-y-3">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Neues Passwort (mind. 8 Zeichen)"
                  className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/12 text-[14px] focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
                  autoComplete="new-password"
                />
                {error && (
                  <div className="px-3 py-2 rounded-2xl bg-rose-50 border border-rose-200 text-[12.5px] text-rose-700">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#0f1430] text-white font-semibold text-[13.5px] hover:bg-[#1a2050] disabled:opacity-60"
                >
                  <KeyRound size={14} /> Passwort speichern
                </button>
              </form>
            </>
          ) : sent ? (
            <div className="bg-white rounded-3xl border border-[#1e1b4b]/10 p-8 text-center">
              <div className="mx-auto mb-4 size-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <Mail size={26} className="text-emerald-600" />
              </div>
              <h1 className="text-[22px] font-bold text-[#0f1430] mb-2">E-Mail gesendet</h1>
              <p className="text-[13.5px] text-[#1e1b4b]/65 mb-5">
                Wir haben dir einen Link zum Zurücksetzen deines Passworts geschickt.
              </p>
              <p className="text-[11.5px] text-[#1e1b4b]/55 inline-flex items-center gap-1.5 mb-5">
                <CheckCircle2 size={12} className="text-emerald-600" /> Schau ggf. im Spam-Ordner nach
              </p>
              <div>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#0f1430] text-white font-semibold text-[13.5px] hover:bg-[#1a2050]"
                >
                  Zurück zur Anmeldung
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-7">
                <h1 className="text-[26px] font-bold text-[#0f1430] mb-2">Passwort zurücksetzen</h1>
                <p className="text-[13.5px] text-[#1e1b4b]/55">
                  Wir schicken dir einen Link per E-Mail.
                </p>
              </div>
              <form onSubmit={handleRequest} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/12 text-[14px] focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15"
                  autoComplete="email"
                />
                {error && (
                  <div className="px-3 py-2 rounded-2xl bg-rose-50 border border-rose-200 text-[12.5px] text-rose-700">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#0f1430] text-white font-semibold text-[13.5px] hover:bg-[#1a2050] disabled:opacity-60"
                >
                  <Mail size={14} /> Link senden
                </button>
              </form>
              <p className="text-center text-[12.5px] text-[#1e1b4b]/65 mt-6">
                <Link to="/login" className="text-[#4F6BFF] font-semibold hover:underline">
                  Zurück zur Anmeldung
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
