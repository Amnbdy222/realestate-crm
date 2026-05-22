import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAnonQuery() {
  console.log('Querying leads anonymously...');
  const { data, error } = await supabase.from('leads').select('*');
  if (error) {
    console.error('Error querying leads:', error);
  } else {
    console.log('Successfully queried leads!');
    console.log(`Leads returned to anonymous client: ${data.length}`);
    if (data.length > 0) {
      console.log('Sample lead:', data[0]);
    }
  }
}

testAnonQuery();
