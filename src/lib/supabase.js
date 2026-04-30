import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use a unique storage key scoped to this app to avoid lock conflicts
    // when multiple Supabase clients are accidentally created
    storageKey: 'dealbook-auth-token',
    // Automatically refresh the session in the background
    autoRefreshToken: true,
    // Persist session across page reloads
    persistSession: true,
    // Detect session from URL (needed for OTP magic links)
    detectSessionInUrl: true,
  },
});
