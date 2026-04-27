import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Zap } from 'lucide-react';
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

    // Demo validation
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
      // Slight delay so AppLayout is mounted before the tour starts
      setTimeout(() => startTour(), 200);
    }, 600);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left: Branding panel */}
      <div className="hidden lg:flex lg:w-[45%] relative bg-gradient-to-br from-[#4F6BFF] via-[#6B7FFF] to-[#8B9FFF] items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-16 size-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-32 right-20 size-48 rounded-full bg-white/30 blur-3xl" />
        </div>
        <div className="relative z-10 max-w-md">
          <img src="/logo-white.png" alt="ImmoFreak" className="h-10 mb-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <h1 className="text-3xl font-bold text-white mb-4 leading-tight">
            Dein Immobilien-CRM für Fix & Flip und Buy & Hold.
          </h1>
          <p className="text-white/70 text-base leading-relaxed">
            Projekte verwalten, Deals analysieren, Mieter managen – alles an einem Ort.
          </p>
          <div className="mt-10 flex gap-4">
            {['Projekte', 'Deal Analyzer', 'Mietverwaltung', 'Banking'].map(f => (
              <div key={f} className="px-3 py-1.5 rounded-lg bg-white/15 text-white/90 text-xs font-medium backdrop-blur-sm">
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex flex-col relative px-6 py-12">
        {/* Logo top-right */}
        <div className="absolute top-6 right-6">
          <img src="/logo.png" alt="ImmoFreak" className="h-9 object-contain" />
        </div>

        <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <img src="/logo.png" alt="ImmoFreak" className="h-11 object-contain" />
          </div>

          {/* Desktop header */}
          <div className="hidden lg:block mb-8 text-center">
            <h2 className="text-xl font-bold text-foreground">Willkommen zurück</h2>
            <p className="text-sm text-muted-foreground mt-1">Melde dich an, um fortzufahren.</p>
          </div>

          {/* Mobile header */}
          <div className="lg:hidden text-center mb-6">
            <h2 className="text-xl font-bold text-foreground">Anmelden</h2>
            <p className="text-sm text-muted-foreground mt-1">Melde dich an, um fortzufahren.</p>
          </div>

          {/* Demo Button */}
          <button
            onClick={handleDemo}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 mb-6 rounded-xl bg-gradient-to-r from-[#4F6BFF] to-[#6B7FFF] text-white font-semibold text-sm shadow-lg shadow-[#4F6BFF]/25 hover:shadow-xl hover:shadow-[#4F6BFF]/30 hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-60"
          >
            <Zap size={16} />
            Demo starten
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-card-line" />
            <span className="text-xs text-muted-foreground">oder mit Zugangsdaten</span>
            <div className="flex-1 h-px bg-card-line" />
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="name@beispiel.de"
                className="input w-full"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Passwort</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className="input w-full pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <div className="size-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={15} />
                  Anmelden
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Demo-Zugang: beliebige E-Mail + Passwort <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">demo</span>
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
