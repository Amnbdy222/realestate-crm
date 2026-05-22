import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(req) {
  try {
    const { fullName, email, password, adminId, orgId } = await req.json();

    if (!email || !password || !fullName || !adminId || !orgId) {
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

    // Verify the admin exists and belongs to this org
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, org_id, role')
      .eq('id', adminId)
      .single();

    if (!adminProfile || adminProfile.role !== 'admin' || adminProfile.org_id !== orgId) {
      return NextResponse.json({ error: 'Unauthorized: invalid admin or org' }, { status: 403 });
    }

    // Get the org name for metadata
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();

    // Create the user in Auth with org_id in metadata
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        full_name: fullName,
        role: 'agent',
        admin_id: adminId,
        org_id: orgId,
        org_name: org?.name || ''
      }
    });

    if (error) {
      logger.error('Supabase Admin Error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Explicitly update the profile row's org_id and admin_id to guarantee they are bound,
    // protecting against trigger execution delays or trigger bugs.
    await supabaseAdmin
      .from('profiles')
      .update({ org_id: orgId, admin_id: adminId })
      .eq('id', data.user.id);

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
