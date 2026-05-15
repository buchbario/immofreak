import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  // Während der Migration soll die App nicht beim Modulladen crashen,
  // wenn .env noch nicht gesetzt ist. Erst der erste echte API-Call schlägt fehl.
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen — siehe .env.example. ' +
      'Bis das gesetzt ist, schlagen Auth- und DB-Calls fehl.'
  );
}

export const supabase = createClient(url ?? 'http://invalid', anonKey ?? 'invalid', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
