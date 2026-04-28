import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(req) {
  try {
    const { fullName, email, password, adminId } = await req.json();

    if (!email || !password || !fullName || !adminId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Initialize Supabase Admin Client using the Service Role Key
    // This bypasses RLS and allows creating users directly
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Create the user in Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        full_name: fullName,
        role: 'agent',
        admin_id: adminId
      }
    });

    if (error) {
      logger.error('Supabase Admin Error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      message: 'Agent created successfully',
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });

  } catch (err) {
    logger.error('Add Agent API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
