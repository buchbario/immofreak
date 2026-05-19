import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, Mail, Lock, User, CheckCircle2, Landmark, BarChart3, Receipt, Hammer } from 'lucide-react';
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
    <div className="min-h-screen flex bg-[#fafbff]">
      {/* ─── Left: Brand panel (desktop only) ──────────────────────────── */}
      <aside
        className="hidden lg:flex relative flex-col justify-center w-[44%] xl:w-[40%] p-10 xl:p-14 text-white overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #4F6BFF 0%, #3D56E0 45%, #1E2F8A 100%)' }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.10] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
        <div
          aria-hidden
          className="absolute -top-32 -right-32 size-[420px] rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 max-w-[440px]">
          <h2 className="text-[34px] xl:text-[40px] font-bold tracking-tight leading-[1.05] mb-4">
            Starte in 60 Sekunden.
          </h2>
          <p className="text-[15px] text-white/75 leading-relaxed mb-9">
            Lege dein kostenloses Konto an — egal ob du Buy & Hold oder Fix & Flip betreibst. Kein Setup, kein Onboarding-Aufwand.
          </p>
          <ul className="space-y-3.5">
            {[
              { icon: Landmark,  label: 'Banking-Abgleich mit BANKSapi — Mieteingänge automatisch matchen' },
              { icon: Receipt,   label: 'Mietverträge, Nebenkosten, Zahlungen — alles an einem Ort' },
              { icon: Hammer,    label: 'Fix & Flip: Sanierungsprojekte, Budget, Handwerker — vom Kauf bis zum Verkauf' },
              { icon: BarChart3, label: 'Rendite, Cashflow & Berichte in Echtzeit' },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 mt-0.5 size-7 rounded-lg bg-white/12 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/15">
                  <item.icon size={14} className="text-white" strokeWidth={2.2} />
                </span>
                <span className="text-[13.5px] text-white/85 leading-relaxed pt-1">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="absolute bottom-8 left-10 xl:left-14 z-10 text-[11.5px] text-white/50">
          © {new Date().getFullYear()} ImmoFreak — Made for German real-estate operators
        </p>
      </aside>

      {/* ─── Right: Form panel ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col relative">
        <header className="lg:hidden px-6 pt-7 pb-2">
          <a href="/" className="inline-flex items-center">
            <img src="/logo.png" alt="ImmoFreak" className="h-10 object-contain" />
          </a>
        </header>
        {/* Desktop-only logo top-right */}
        <a
          href="/"
          className="hidden lg:inline-flex absolute top-7 right-8 xl:right-12 items-center z-10"
        >
          <img src="/logo.png" alt="ImmoFreak" className="h-10 object-contain" />
        </a>

        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8 lg:py-12">
          <div className="w-full max-w-[420px]">
            {done ? (
              <div className="text-center">
                <div className="mx-auto mb-5 size-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Mail size={28} className="text-emerald-600" />
                </div>
                <h1 className="text-[24px] sm:text-[28px] font-bold text-[#0f1430] tracking-tight mb-2.5">
                  Bestätigungs-Mail unterwegs
                </h1>
                <p className="text-[14px] text-[#1e1b4b]/65 leading-relaxed mb-6">
                  Wir haben dir eine E-Mail an <span className="font-semibold text-[#0f1430]">{email}</span> geschickt.
                  Klicke auf den Link in der Mail, um dein Konto zu aktivieren.
                </p>
                <div className="text-left bg-[#f7f8ff] rounded-xl p-4 mb-6 border border-[#4F6BFF]/10">
                  <p className="text-[12px] font-semibold text-[#0f1430] flex items-center gap-1.5 mb-2">
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
                  className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-lg bg-[#0f1430] text-white font-semibold text-[13.5px] hover:bg-[#1a2050] transition-all shadow-[0_4px_12px_-4px_rgba(15,20,48,0.30)]"
                >
                  Zur Anmeldung
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-7">
                  <h1 className="text-[26px] sm:text-[30px] font-bold text-[#0f1430] tracking-tight leading-[1.15] mb-2">
                    Konto erstellen
                  </h1>
                  <p className="text-[14px] text-[#1e1b4b]/60 leading-relaxed">
                    Starte mit deiner Immobilien-Verwaltung — kostenlos und in unter einer Minute.
                  </p>
                </div>

                <form onSubmit={handleSignup} className="space-y-3.5">
                  <div>
                    <label className="block text-[12.5px] font-semibold text-[#0f1430]/85 mb-1.5">Vor- und Nachname</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1e1b4b]/40 pointer-events-none" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => { setFullName(e.target.value); setError(''); }}
                        placeholder="Max Mustermann"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-white border border-[#1e1b4b]/12 text-[14px] text-[#0f1430] placeholder:text-[#1e1b4b]/35 focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15 transition-all shadow-[0_1px_2px_rgba(15,20,48,0.04)]"
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-semibold text-[#0f1430]/85 mb-1.5">E-Mail-Adresse</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1e1b4b]/40 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        placeholder="name@example.com"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-white border border-[#1e1b4b]/12 text-[14px] text-[#0f1430] placeholder:text-[#1e1b4b]/35 focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15 transition-all shadow-[0_1px_2px_rgba(15,20,48,0.04)]"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12.5px] font-semibold text-[#0f1430]/85 mb-1.5">Passwort</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1e1b4b]/40 pointer-events-none" />
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        placeholder="Mind. 8 Zeichen"
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-white border border-[#1e1b4b]/12 text-[14px] text-[#0f1430] placeholder:text-[#1e1b4b]/35 focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15 transition-all shadow-[0_1px_2px_rgba(15,20,48,0.04)]"
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
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200">
                      <span className="shrink-0 mt-1 size-1.5 rounded-full bg-rose-500" />
                      <p className="text-[12.5px] text-rose-700 leading-relaxed">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-1 rounded-lg bg-[#0f1430] text-white font-semibold text-[14px] hover:bg-[#1a2050] active:translate-y-px shadow-[0_4px_12px_-4px_rgba(15,20,48,0.30)] hover:shadow-[0_6px_16px_-4px_rgba(15,20,48,0.35)] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <UserPlus size={15} strokeWidth={2.2} /> Konto erstellen
                      </>
                    )}
                  </button>
                </form>

                <p className="text-[11.5px] text-[#1e1b4b]/50 text-center mt-4 leading-relaxed">
                  Mit der Registrierung stimmst du unseren AGB und Datenschutzbestimmungen zu.
                </p>

                <p className="text-center text-[13px] text-[#1e1b4b]/65 mt-6">
                  Bereits registriert?{' '}
                  <Link to="/login" className="text-[#4F6BFF] font-semibold hover:underline">
                    Zur Anmeldung
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>

        <footer className="px-6 sm:px-8 pb-5 text-[11px] text-[#1e1b4b]/40 lg:hidden">
          <span>© {new Date().getFullYear()} ImmoFreak</span>
        </footer>
      </main>
    </div>
  );
}
