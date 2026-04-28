import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { requireAuth } from '@/lib/apiAuth';
import { logger } from '@/lib/logger';
import { groqWithRetry } from '@/lib/groqWithRetry';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const data = await req.json();
    const { stats, recentLeads, upcomingFollowups } = data;

    const prompt = `You are an expert Real Estate CRM AI Assistant.
Analyze the following CRM data and provide 3-4 short, actionable bullet points of advice or insights for the real estate agent today. 
Be concise, direct, and use emojis. Do not include any introductory or concluding remarks, just the bullet points.

Data:
- Total Leads: ${stats.totalLeads}
- Active Deals: ${stats.activeDeals}
- Pipeline Value: ${stats.pipelineValue}
- Conversion Rate: ${stats.conversionRate}%
- Recent Leads: ${recentLeads.map(l => `${l.full_name} (${l.status})`).join(', ')}
- Upcoming Follow-ups: ${upcomingFollowups.map(f => `${f.title} with ${f.leads?.full_name} on ${new Date(f.follow_up_date).toLocaleDateString()}`).join(', ')}`;

    const completion = await groqWithRetry(() => groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an intelligent CRM assistant that provides quick, data-driven insights."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 250,
      top_p: 1,
    }));

    const aiMessage = completion.choices[0]?.message?.content || "No insights generated.";

    return NextResponse.json({ insights: aiMessage });

  } catch (error) {
    logger.error('AI Insight Generation Error:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
