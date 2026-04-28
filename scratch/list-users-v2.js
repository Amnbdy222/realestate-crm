const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

async function listUsers() {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error(error);
    return;
  }
  console.log('--- REGISTERED EMAILS ---');
  users.forEach(u => console.log(u.email));
  console.log('-------------------------');
}

listUsers();
