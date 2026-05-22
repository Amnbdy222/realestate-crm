import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function check() {
  const { data: properties, error } = await supabase.from('properties').select('*');
  if (error) {
    console.error('Error fetching properties:', error);
  } else {
    console.log('--- PROPERTIES ---');
    properties.forEach(p => {
      console.log({
        id: p.id,
        title: p.title,
        org_id: p.org_id,
        user_id: p.user_id,
        image_url: p.image_url,
        created_at: p.created_at
      });
    });
  }
}

check();
