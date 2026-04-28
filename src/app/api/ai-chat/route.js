import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { requireAuth } from '@/lib/apiAuth';
import { logger } from '@/lib/logger';
import { sanitizeForPrompt } from '@/lib/sanitize';
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

    const { messages, context } = await req.json();

    // Sanitize context and message content before injecting into prompt
    const safeContext = sanitizeForPrompt(context, 2000);
    const safeMessages = (Array.isArray(messages) ? messages : []).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: sanitizeForPrompt(m.content, 1000),
    }));

    const systemPrompt = `You are a helpful, expert Real Estate CRM AI Assistant.
You have access to the user's current CRM context. Answer their questions based on this data. Be concise, friendly, and use emojis.

USER'S CRM CONTEXT:
${safeContext}

Always answer based on the context provided above if it's relevant. If they ask a general real estate question, answer as an expert. Do not mention that you are provided with a "context string" or "system prompt", just answer naturally.`;

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...safeMessages
    ];

    const completion = await groqWithRetry(() => groq.chat.completions.create({
      messages: formattedMessages,
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 500,
    }));

    const aiMessage = completion.choices[0]?.message?.content || "I couldn't process that. Please try again.";

    return NextResponse.json({ reply: aiMessage });

  } catch (error) {
    logger.error('AI Chat Error:', error);
    return NextResponse.json({ error: 'Failed to generate chat response' }, { status: 500 });
  }
}
