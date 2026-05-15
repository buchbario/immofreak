import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, Mail, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function SignupPage() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password || !fullName) {
      setError('Bitte alle Felder ausfüllen.');
      return;
    }
    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    setLoading(true);
    const { error: signupError } = await signUp(email, password, fullName);
    setLoading(false);
    if (signupError) {
      const msg = signupError.message;
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('user already')) {
        setError('Diese E-Mail ist bereits registriert. Bitte einloggen.');
      } else {
        setError(msg);
      }
      return;
    }
    setDone(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbff] relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(79, 107, 255, 0.10) 0%, transparent 70%)',
        }}
      />

      <header className="px-6 sm:px-8 pt-6 sm:pt-8">
        <a href="/" className="inline-flex items-center">
          <img src="/logo.png" alt="ImmoFreak" className="h-10 sm:h-12 object-contain" />
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px]">
          {done ? (
            <div className="bg-white rounded-3xl border border-[#1e1b4b]/10 p-8 text-center shadow-[0_4px_24px_-8px_rgba(15,20,48,0.08)]">
              <div className="mx-auto mb-4 size-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <Mail size={26} className="text-emerald-600" />
              </div>
              <h1 className="text-[22px] font-bold text-[#0f1430] mb-2">
                Bestätigungs-E-Mail gesendet
              </h1>
              <p className="text-[14px] text-[#1e1b4b]/65 leading-relaxed mb-5">
                Wir haben dir eine E-Mail an <span className="font-semibold text-[#0f1430]">{email}</span> geschickt.
                Klicke auf den Link in der Mail, um dein Konto zu aktivieren.
              </p>
              <div className="text-left bg-[#f7f8ff] rounded-2xl p-4 mb-5 space-y-2">
                <p className="text-[12px] font-semibold text-[#0f1430] flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  Mail nicht angekommen?
                </p>
                <ul className="text-[11.5px] text-[#1e1b4b]/65 space-y-1 list-disc list-inside">
                  <li>Schau in den Spam-/Werbung-Ordner</li>
                  <li>Warte 1–2 Minuten</li>
                  <li>Stelle sicher, dass die Adresse korrekt ist</li>
                </ul>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#0f1430] text-white font-semibold text-[13.5px] hover:bg-[#1a2050] transition-all"
              >
                Zur Anmeldung
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-7">
                <h1 className="text-[28px] sm:text-[32px] font-bold text-[#0f1430] tracking-tight leading-[1.1] mb-2.5">
                  Konto erstellen
                </h1>
                <p className="text-[14px] text-[#1e1b4b]/55 leading-relaxed">
                  Starte mit deiner Immobilien-Verwaltung
                </p>
              </div>

              <form onSubmit={handleSignup} className="space-y-3">
                <div>
                  <label className="block text-[12.5px] font-medium text-[#0f1430] mb-1.5">
                    Vor- und Nachname
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setError('');
                    }}
                    placeholder="Max Mustermann"
                    className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/12 text-[14px] text-[#0f1430] placeholder:text-[#1e1b4b]/35 focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15 transition-all"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="block text-[12.5px] font-medium text-[#0f1430] mb-1.5">
                    E-Mail-Adresse
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 rounded-full bg-white border border-[#1e1b4b]/12 text-[14px] text-[#0f1430] placeholder:text-[#1e1b4b]/35 focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15 transition-all"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-[12.5px] font-medium text-[#0f1430] mb-1.5">
                    Passwort (mind. 8 Zeichen)
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      placeholder="••••••••"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-full bg-white border border-[#1e1b4b]/12 text-[14px] text-[#0f1430] placeholder:text-[#1e1b4b]/35 focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15 transition-all"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1e1b4b]/45 hover:text-[#0f1430] transition-colors cursor-pointer"
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="px-3 py-2 rounded-2xl bg-rose-50 border border-rose-200">
                    <p className="text-[12.5px] text-rose-700">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mt-1 rounded-full bg-[#0f1430] text-white font-semibold text-[13.5px] hover:bg-[#1a2050] transition-all cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <UserPlus size={14} /> Konto erstellen
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-[12.5px] text-[#1e1b4b]/65 mt-6">
                Bereits registriert?{' '}
                <Link to="/login" className="text-[#4F6BFF] font-semibold hover:underline">
                  Zur Anmeldung
                </Link>
              </p>
            </>
          )}
        </div>
      </main>

      <footer className="px-6 sm:px-8 pb-6 sm:pb-8 flex items-center justify-between flex-wrap gap-2 text-[11px] text-[#1e1b4b]/45">
        <span>© {new Date().getFullYear()} ImmoFreak</span>
      </footer>
    </div>
  );
}
