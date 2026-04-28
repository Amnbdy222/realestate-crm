import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { requireAuth } from '@/lib/apiAuth';
import { logger } from '@/lib/logger';
import { sanitizeObjectForPrompt } from '@/lib/sanitize';
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

    const { lead, action } = await req.json();

    // Sanitize lead fields before injecting into prompts
    const safeLead = sanitizeObjectForPrompt(lead);

    if (action === 'score') {
      const prompt = `Analyze this real estate lead and assign a score (0-100) and a temperature (hot, warm, cold). 
      Lead Info: 
      Budget: ${safeLead.budget_min} to ${safeLead.budget_max}
      Priority: ${safeLead.priority}
      Location: ${safeLead.preferred_location}
      Notes: ${safeLead.notes}

      Return ONLY valid JSON in this format: {"score": 85, "temperature": "hot"}`;

      const completion = await groqWithRetry(() => groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }));

      const result = JSON.parse(completion.choices[0]?.message?.content || '{"score": 50, "temperature": "warm"}');
      return NextResponse.json(result);
    }

    if (action === 'suggest_followup') {
      const prompt = `You are a real estate agent's AI assistant. Write a short, friendly WhatsApp follow-up message to this lead.
      Lead Name: ${safeLead.full_name}
      Interested in: ${safeLead.property_type}
      Budget: ₹${safeLead.budget_max}
      Status: ${safeLead.status}
      Notes: ${safeLead.notes}
      
      Keep it professional but casual, use an emoji or two. Do not include placeholders, make it ready to send.`;

      const completion = await groqWithRetry(() => groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
      }));

      return NextResponse.json({ message: completion.choices[0]?.message?.content });
    }

    if (action === 'recommend_properties') {
       const prompt = `Based on this lead (Budget: ₹${safeLead.budget_max}, Type: ${safeLead.property_type}, Location: ${safeLead.preferred_location}), write a WhatsApp message recommending 2 hypothetical properties that perfectly match.`;
       
       const completion = await groqWithRetry(() => groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
      }));

      return NextResponse.json({ message: completion.choices[0]?.message?.content });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    logger.error('AI Assist Error:', error);
    return NextResponse.json({ error: 'Failed to process AI request' }, { status: 500 });
  }
}
