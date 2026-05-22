import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function check() {
  const { data: orgs, error: orgsErr } = await supabase.from('organizations').select('*');
  if (orgsErr) {
    console.error('Error fetching orgs:', orgsErr);
  } else {
    console.log('--- ORGANIZATIONS ---');
    console.log(orgs);
  }

  const { data: profiles, error: profsErr } = await supabase.from('profiles').select('*');
  if (profsErr) {
    console.error('Error fetching profiles:', profsErr);
  } else {
    console.log('--- PROFILES ---');
    console.log(profiles);
  }
}

check();
