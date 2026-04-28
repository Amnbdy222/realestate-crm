import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDB() {
  const { data: projects } = await supabase.from('projects').select('*');
  console.log('Projects:', projects);

  const { data: towers } = await supabase.from('towers').select('*');
  console.log('Towers:', towers);

  const { data: units } = await supabase.from('units').select('*');
  console.log('Units count:', units?.length);
  if (units?.length > 0) {
    console.log('Sample unit:', units[0]);
  }
}

checkDB();
