import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../context/TourContext';

export function LoginPage() {
  const { login } = useAuth();
  const { startTour } = useTour();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    if (password !== 'demo') {
      setError('Ungültige Zugangsdaten. Tipp: Passwort ist "demo".');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      login(name, email);
      navigate('/');
    }, 600);
  };

  const handleDemo = () => {
    setLoading(true);
    setTimeout(() => {
      login('Yan', 'yan@immofreak.de');
      navigate('/');
      setTimeout(() => startTour(), 200);
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

      {/* Top: minimal nav bar (just the logo, no clutter) */}
      <header className="px-6 sm:px-8 pt-6 sm:pt-8">
        <a href="/" className="inline-flex items-center">
          <img src="/logo.png" alt="ImmoFreak" className="h-10 sm:h-12 object-contain" />
        </a>
      </header>

      {/* Center: the form is the only thing that matters */}
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">

          {/* Headline */}
          <div className="text-center mb-8">
            <h1 className="text-[28px] sm:text-[32px] font-bold text-[#0f1430] tracking-tight leading-[1.1] mb-2.5">
              Anmelden
            </h1>
            <p className="text-[14px] text-[#1e1b4b]/55 leading-relaxed">
              Dein Immobilien-CRM für Fix &amp; Flip und Buy &amp; Hold.
            </p>
          </div>

          {/* Demo button — clearly primary */}
          <button
            onClick={handleDemo}
            disabled={loading}
            className="group w-full flex items-center justify-center gap-2 px-4 py-3 mb-3 rounded-xl bg-[#4F6BFF] hover:bg-[#3d57e0] text-white font-semibold text-[14px] shadow-[0_6px_16px_-4px_rgba(79,107,255,0.40)] hover:shadow-[0_8px_20px_-4px_rgba(79,107,255,0.50)] hover:-translate-y-px transition-all cursor-pointer disabled:opacity-60"
          >
            <Sparkles size={15} strokeWidth={2.2} />
            Demo starten
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#1e1b4b]/10" />
            <span className="text-[10.5px] font-semibold text-[#1e1b4b]/40 uppercase tracking-[0.1em]">
              oder
            </span>
            <div className="flex-1 h-px bg-[#1e1b4b]/10" />
          </div>

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-[12.5px] font-medium text-[#0f1430] mb-1.5">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="name@beispiel.de"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-[#1e1b4b]/12 text-[14px] text-[#0f1430] placeholder:text-[#1e1b4b]/35 focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15 transition-all"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-medium text-[#0f1430] mb-1.5">Passwort</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-white border border-[#1e1b4b]/12 text-[14px] text-[#0f1430] placeholder:text-[#1e1b4b]/35 focus:outline-none focus:border-[#4F6BFF] focus:ring-2 focus:ring-[#4F6BFF]/15 transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1e1b4b]/45 hover:text-[#0f1430] transition-colors cursor-pointer"
                  aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200">
                <p className="text-[12.5px] text-rose-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mt-1 rounded-lg bg-[#0f1430] text-white font-semibold text-[13.5px] hover:bg-[#1a2050] transition-all cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={14} /> Anmelden
                </>
              )}
            </button>
          </form>

          {/* Demo hint */}
          <p className="text-center text-[11.5px] text-[#1e1b4b]/55 mt-6">
            Demo-Zugang: beliebige E-Mail · Passwort{' '}
            <span className="font-mono bg-white px-1.5 py-0.5 rounded text-[#0f1430] border border-[#1e1b4b]/12">
              demo
            </span>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 sm:px-8 pb-6 sm:pb-8 flex items-center justify-between flex-wrap gap-2 text-[11px] text-[#1e1b4b]/45">
        <span>© {new Date().getFullYear()} ImmoFreak</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          100% lokal — deine Daten bleiben bei dir
        </span>
      </footer>
    </div>
  );
}
