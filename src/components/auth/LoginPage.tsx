import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppMode } from '../../context/AppModeContext';
import { useTour } from '../../context/TourContext';
import { useTranslation } from '../../context/LocaleContext';
import { seedDemoData } from '../../lib/seedData';
import { getDashboardRoute, getDefaultDashboard } from '../../lib/utils';

export function LoginPage() {
  const { signIn, enterDemoMode } = useAuth();
  const { setMode } = useAppMode();
  const { startTour } = useTour();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setLoading(false);
      const msg = signInError.message;
      if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Bestätigungs-Mail.');
      } else if (msg.toLowerCase().includes('invalid login credentials')) {
        setError('E-Mail oder Passwort ist falsch.');
      } else {
        setError(msg);
      }
      return;
    }
    const target = getDefaultDashboard();
    localStorage.setItem('immofreak_mode', target);
    setMode(target);
    navigate(getDashboardRoute(target));
  };

  const handleDemo = () => {
    setLoading(true);
    // Demo-Login: lokal, ohne Supabase. Frische Demo-Daten werden in den
    // localStorage gelegt, der Storage-Adapter wird beim Page-Reload auf
    // LocalStorageAdapter umgestellt.
    setTimeout(() => {
      seedDemoData();
      const target = getDefaultDashboard();
      localStorage.setItem('immofreak_mode', target);
      // enterDemoMode macht reload zu '/', deshalb startTour danach starten
      // (nach Mount auf der Dashboard-Seite). Wir setzen das per Flag.
      localStorage.setItem('immofreak_start_tour', 'true');
      enterDemoMode('Yan', 'yan@immofreak.de');
      void target; // referenz fürs Lint, navigate übernimmt reload
      void startTour;
    }, 600);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbff] relative overflow-hidden">
      {/* Subtle brand-tinted background — single very light wash, nothing busy */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 50% 0%, rgba(79, 107, 255, 0.10) 0%, transparent 70%)
          `,
        }}
      />

      <header className="px-6 sm:px-8 pt-6 sm:pt-8">
        <a href="/" className="inline-flex items-center">
          <img src="/logo.png" alt="ImmoFreak" className="h-10 sm:h-12 object-contain" />
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">

          {/* Headline */}
          <div className="text-center mb-8">
            <h1 className="text-[28px] sm:text-[32px] font-bold text-[#0f1430] tracking-tight leading-[1.1] mb-2.5">
              {t('auth.login.submit')}
            </h1>
            <p className="text-[14px] text-[#1e1b4b]/55 leading-relaxed">
              {t('auth.login.subtitle')}
            </p>
          </div>

          {/* Demo button — clearly primary */}
          <button
            onClick={handleDemo}
            disabled={loading}
            className="group w-full flex items-center justify-center gap-2 px-4 py-3 mb-3 rounded-full bg-[#4F6BFF] hover:bg-[#3d57e0] text-white font-semibold text-[14px] shadow-[0_6px_16px_-4px_rgba(79,107,255,0.40)] hover:shadow-[0_8px_20px_-4px_rgba(79,107,255,0.50)] hover:-translate-y-px transition-all cursor-pointer disabled:opacity-60"
          >
            <Sparkles size={15} strokeWidth={2.2} />
            {t('auth.login.demo')}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#1e1b4b]/10" />
            <span className="text-[10.5px] font-semibold text-[#1e1b4b]/40 uppercase tracking-[0.1em]">
              {t('auth.login.email') === 'Email address' ? 'or' : 'oder'}
            </span>
            <div className="flex-1 h-px bg-[#1e1b4b]/10" />
          </div>

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-[12.5px] font-medium text-[#0f1430] mb-1.5">{t('auth.login.email')}</label>
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[12.5px] font-medium text-[#0f1430]">
                  {t('auth.login.password')}
                </label>
                <Link
                  to="/reset-password"
                  className="text-[11.5px] text-[#4F6BFF] hover:underline"
                >
                  Passwort vergessen?
                </Link>
              </div>
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
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1e1b4b]/45 hover:text-[#0f1430] transition-colors cursor-pointer"
                  aria-label={t('auth.login.password')}
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
                  <LogIn size={14} /> {t('auth.login.submit')}
                </>
              )}
            </button>
          </form>

          {/* Signup link */}
          <p className="text-center text-[12.5px] text-[#1e1b4b]/65 mt-5">
            Noch kein Konto?{' '}
            <Link to="/signup" className="text-[#4F6BFF] font-semibold hover:underline">
              Jetzt registrieren
            </Link>
          </p>

          {/* Demo hint */}
          <p className="text-center text-[11.5px] text-[#1e1b4b]/55 mt-4">
            Demo-Zugang: klick einfach{' '}
            <span className="font-semibold text-[#4F6BFF]">„{t('auth.login.demo')}"</span>{' '}
            — keine Registrierung nötig
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 sm:px-8 pb-6 sm:pb-8 flex items-center justify-between flex-wrap gap-2 text-[11px] text-[#1e1b4b]/45">
        <span>© {new Date().getFullYear()} ImmoFreak</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Demo läuft lokal · echte Daten in der Cloud
        </span>
      </footer>
    </div>
  );
}
