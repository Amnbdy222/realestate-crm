import { createClient } from '@supabase/supabase-js';

/**
 * Validates the request has a valid Supabase session.
 * Returns { user } on success, or { error, status } on failure.
 */
export async function requireAuth(req) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return { error: 'Unauthorized. Missing auth token.', status: 401 };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: 'Unauthorized. Invalid or expired session.', status: 401 };
  }

  return { user };
}
