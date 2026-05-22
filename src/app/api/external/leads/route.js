import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { logWebhook } from '@/lib/webhookLogger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const externalApiKey = process.env.EXTERNAL_API_KEY;

// Use service role key to bypass RLS and perform admin tasks
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * POST /api/external/leads
 * Adds a new lead from external sources (Postman, Zapier, etc.)
 * Headers:
 * - x-api-key: Your secret API key
 * Body:
 * {
 *   "owner_email": "user@example.com",
 *   "full_name": "John Doe",
 *   "phone": "9876543210",
 *   "email": "john@example.com",
 *   "source": "website",
 *   "property_type": "residential",
 *   "budget_min": 5000000,
 *   "budget_max": 10000000,
 *   "notes": "Lead from external API"
 * }
 */
export async function POST(req) {
  try {
    // 1. Rate limit by IP — 20 requests per minute per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed, remaining, resetInMs } = rateLimit(`external_leads:${ip}`, 20, 60_000);

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(resetInMs / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // 2. Authenticate with API Key
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey || apiKey !== externalApiKey) {
      return NextResponse.json({ error: 'Unauthorized. Invalid or missing API Key.' }, { status: 401 });
    }

    // 3. Parse and Validate Body
    const body = await req.json();
    const { owner_email, ...leadData } = body;

    if (!owner_email) {
      return NextResponse.json({ error: 'owner_email is required to assign the lead to a specific user.' }, { status: 400 });
    }

    if (!leadData.full_name || !leadData.phone) {
      return NextResponse.json({ error: 'full_name and phone are required fields.' }, { status: 400 });
    }

    // 4. Find the user ID from the owner_email
    // Note: In a production app, a profiles table is better for this lookup
    const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    if (userError) throw userError;

    const targetUser = users.find(u => u.email.toLowerCase() === owner_email.toLowerCase());
    if (!targetUser) {
      return NextResponse.json({ error: `User with email ${owner_email} not found in the system.` }, { status: 404 });
    }

    // Fetch the target user's profile to retrieve their organization ID
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', targetUser.id)
      .single();

    if (profileErr) {
      logger.error('Error retrieving target user profile:', profileErr);
    }

    // 5. Prepare lead data
    const finalLeadData = {
      ...leadData,
      user_id: targetUser.id,
      org_id: profile?.org_id || null,
      source: leadData.source || 'other',
      status: leadData.status || 'new',
      priority: leadData.priority || 'medium',
      budget_min: Number(leadData.budget_min || (leadData.budget_max ? 0 : leadData.budget)) || 0,
      budget_max: Number(leadData.budget_max || leadData.budget) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 6. Insert into Database
    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert([finalLeadData])
      .select()
      .single();

    if (error) {
      logger.error('Supabase insert error:', error);
      return NextResponse.json({ error: 'Failed to insert lead into database.' }, { status: 500 });
    }

    // 7. Return Success
    logWebhook('success', body);
    return NextResponse.json({ 
      success: true, 
      message: 'Lead added successfully', 
      lead: {
        id: data.id,
        full_name: data.full_name,
        created_at: data.created_at
      }
    }, { status: 201 });

  } catch (error) {
    logger.error('External API Route Error:', error);
    logWebhook('error', null, error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
