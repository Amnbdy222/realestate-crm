import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(req) {
  try {
    const { orgName, fullName, email, password } = await req.json();

    if (!orgName || !fullName || !email || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Use service role to bypass RLS
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

    // 1. Create the organization row first
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: orgName })
      .select()
      .single();

    if (orgError) {
      logger.error('Org creation error:', orgError);
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
    }

    // 2. Create the admin user with org_id in metadata
    //    The handle_new_user trigger will populate the profiles table
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'admin',
        org_name: orgName,
        org_id: org.id
      }
    });

    if (userError) {
      // Rollback: delete the org we just created
      await supabaseAdmin.from('organizations').delete().eq('id', org.id);
      logger.error('User creation error:', userError);
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    // 3. Set the org's owner_id to the newly created user
    await supabaseAdmin
      .from('organizations')
      .update({ owner_id: userData.user.id })
      .eq('id', org.id);

    // 3b. Manually update the profile row's org_id to guarantee it is bound,
    // protecting against trigger execution delays or trigger bugs.
    await supabaseAdmin
      .from('profiles')
      .update({ org_id: org.id })
      .eq('id', userData.user.id);

    return NextResponse.json({
      message: 'Organization registered successfully',
      org: { id: org.id, name: org.name },
      user: { id: userData.user.id, email: userData.user.email }
    });

  } catch (err) {
    logger.error('Org Register API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
