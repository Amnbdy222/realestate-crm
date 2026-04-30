import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// This endpoint should be protected, e.g., via a simple secret token for cron-jobs
// In a real production setup, you would check headers.authorization against a CRON_SECRET

export async function GET(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Requires service role to bypass RLS

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(process.env.RESEND_API_KEY);

    // 1. Fetch all active lead_campaigns that are due for execution
    const now = new Date().toISOString();
    const { data: enrollments, error: enrollError } = await supabase
      .from('lead_campaigns')
      .select('*, leads(full_name, phone, email, id)')
      .eq('status', 'active')
      .lte('next_execution_time', now);

    if (enrollError) throw enrollError;
    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ message: 'No campaigns due for execution.' });
    }

    let processedCount = 0;

    // 2. Process each due enrollment
    for (const enrollment of enrollments) {
      // Find the specific step in the sequence
      const { data: sequence, error: seqError } = await supabase
        .from('drip_sequences')
        .select('*')
        .eq('campaign_id', enrollment.campaign_id)
        .eq('step_number', enrollment.current_step)
        .single();

      if (seqError || !sequence) {
        // No more steps left! Campaign completed.
        await supabase.from('lead_campaigns').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', enrollment.id);
        continue;
      }

      // We have a step to execute!
      const messageContent = sequence.template_text.replace('[Name]', enrollment.leads.full_name || 'there');
      
      let deliveryStatus = 'delivered';
      
      // If channel is email, actually send the email via Resend
      if (sequence.channel === 'email' && enrollment.leads.email) {
        if (process.env.RESEND_API_KEY) {
          const { error: emailError } = await resend.emails.send({
            from: 'DealBook <onboarding@resend.dev>', // Update this to verified domain
            to: [enrollment.leads.email],
            subject: 'New Update for You', // In a full implementation, you'd add a subject field to the sequence
            html: `<div style="font-family: sans-serif; color: #333;">
                    <p>${messageContent.replace(/\n/g, '<br/>')}</p>
                   </div>`
          });
          if (emailError) {
            console.error('Campaign Email Error:', emailError);
            deliveryStatus = 'failed';
          }
        } else {
          console.log('Skipping real email send: RESEND_API_KEY not configured.');
        }
      }
      
      // Log it into communications
      await supabase.from('communications').insert({
        lead_id: enrollment.leads.id,
        user_id: enrollment.user_id, // The agent who enrolled them
        channel: sequence.channel,
        direction: 'outbound',
        content: messageContent,
        status: deliveryStatus,
        is_automated: true
      });

      // Now, calculate the next step
      const nextStepNum = enrollment.current_step + 1;
      const { data: nextSequence } = await supabase
        .from('drip_sequences')
        .select('*')
        .eq('campaign_id', enrollment.campaign_id)
        .eq('step_number', nextStepNum)
        .single();

      if (nextSequence) {
        // Queue the next step
        const nextTime = new Date();
        nextTime.setDate(nextTime.getDate() + nextSequence.delay_days);
        
        await supabase.from('lead_campaigns').update({
          current_step: nextStepNum,
          next_execution_time: nextTime.toISOString()
        }).eq('id', enrollment.id);
      } else {
        // No next step, mark completed
        await supabase.from('lead_campaigns').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', enrollment.id);
      }

      processedCount++;
    }

    return NextResponse.json({ message: `Successfully processed ${processedCount} sequence steps.` });
  } catch (error) {
    console.error('Campaign processor error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
