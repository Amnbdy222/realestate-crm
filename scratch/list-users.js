const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function listUsers() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error(error);
    return;
  }
  console.log('USERS_START');
  users.forEach(u => console.log(u.email));
  console.log('USERS_END');
}

listUsers();
