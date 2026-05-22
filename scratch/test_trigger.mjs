import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testRegistrationTrigger() {
  const testEmail = `test_trigger_${Date.now()}@example.com`;
  const testPassword = 'testpassword123';
  const mockOrgId = '9975328d-d515-43c7-9276-1e979eb1ec1d'; // Existing org 'kk'

  console.log(`Creating test user ${testEmail}...`);
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      full_name: 'Test Trigger User',
      role: 'admin',
      org_name: 'Test Org Name',
      org_id: mockOrgId
    }
  });

  if (userError) {
    console.error('Error creating user:', userError);
    return;
  }

  const userId = userData.user.id;
  console.log(`User created. User ID: ${userId}`);

  // Fetch the created profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
  } else {
    console.log('Resulting profile:', profile);
  }

  // Cleanup: delete the test user
  console.log('Cleaning up test user...');
  await supabase.auth.admin.deleteUser(userId);
}

testRegistrationTrigger();
