import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const body = await request.json();
    const { to, subject, message, leadId, userId } = body;

    if (!to || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 });
    }

    // 1. Send the email via Resend
    // Note: If you don't have a verified domain, Resend requires you to send FROM 'onboarding@resend.dev' 
    // AND you can only send TO your registered Resend email address.
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'DealBook <onboarding@resend.dev>', // Update this to your verified domain later (e.g. hello@yourdomain.com)
      to: [to],
      subject: subject,
      html: `<div style="font-family: sans-serif; color: #333;">
              <p>${message.replace(/\n/g, '<br/>')}</p>
             </div>`
    });

    if (emailError) {
      console.error('Resend Error:', emailError);
      return NextResponse.json({ error: emailError.message }, { status: 400 });
    }

    // 2. Log to communications table in Supabase
    if (leadId && userId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from('communications').insert({
          lead_id: leadId,
          user_id: userId,
          channel: 'email',
          direction: 'outbound',
          content: `Subject: ${subject}\n\n${message}`,
          status: 'delivered',
          is_automated: false
        });
      }
    }

    return NextResponse.json({ success: true, data: emailData });
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
