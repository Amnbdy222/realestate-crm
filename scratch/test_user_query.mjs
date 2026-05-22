import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin client to create user
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Client client to login and query
const userClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runTest() {
  const testEmail = `test_query_${Date.now()}@example.com`;
  const testPassword = 'testpassword123';

  // 1. Create a mock organization
  console.log('Creating mock organization...');
  const { data: org, error: orgErr } = await adminClient
    .from('organizations')
    .insert({ name: 'Test Query Org' })
    .select()
    .single();

  if (orgErr) {
    console.error('Error creating org:', orgErr);
    return;
  }
  console.log('Org created:', org.id);

  // 2. Create the user
  console.log(`Creating user ${testEmail}...`);
  const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      full_name: 'Test Query User',
      role: 'admin',
      org_name: 'Test Query Org',
      org_id: org.id
    }
  });

  if (userError) {
    console.error('Error creating user:', userError);
    await adminClient.from('organizations').delete().eq('id', org.id);
    return;
  }
  const userId = userData.user.id;
  console.log('User created:', userId);

  try {
    // 3. Login as the user
    console.log('Logging in as test user...');
    const { data: sessionData, error: loginError } = await userClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (loginError) {
      console.error('Login failed:', loginError);
      return;
    }
    console.log('Login successful! Session token obtained.');

    // 4. Query leads using user client (authenticated)
    console.log('Querying leads as authenticated user...');
    const { data: leads, error: leadsErr } = await userClient.from('leads').select('*');
    if (leadsErr) {
      console.error('Error querying leads:', leadsErr);
    } else {
      console.log(`Leads returned: ${leads.length}`);
      console.log(leads);
    }
  } finally {
    // Cleanup
    console.log('Cleaning up...');
    await adminClient.auth.admin.deleteUser(userId);
    await adminClient.from('organizations').delete().eq('id', org.id);
    console.log('Cleanup finished.');
  }
}

runTest();
