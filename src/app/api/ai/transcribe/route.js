import { NextResponse } from 'next/server';
import Groq from "groq-sdk";
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

    const formData = await req.formData();
    const file = formData.get('file');
    const extractLead = formData.get('extract_lead') === 'true';
    const summarizeCall = formData.get('summarize_call') === 'true';

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // 1. Transcribe the audio using Whisper
    const transcription = await groqWithRetry(() => groq.audio.transcriptions.create({
      file: file,
      model: "whisper-large-v3",
      response_format: "json",
    }));

    const transcriptText = transcription.text;

    // 2. Process Transcript (Extract Lead or Summarize Call)
    let aiResponse = null;

    if (extractLead) {
      const prompt = `
        You are a Real Estate CRM assistant. Extract the lead details from the following voice note transcription.
        Return ONLY a JSON object with these exact keys: full_name, phone, email, budget_max, preferred_location, property_type, notes.
        If a field is not mentioned, make it null. 
        Ensure budget is a number (e.g. 80 lakhs = 8000000).
        
        Transcription: "${transcriptText}"
      `;

      const completion = await groqWithRetry(() => groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama3-8b-8192",
        response_format: { type: "json_object" }
      }));
      aiResponse = JSON.parse(completion.choices[0].message.content);
    } 
    else if (summarizeCall) {
      const prompt = `
        You are an expert sales assistant. Analyze this call transcript.
        Return ONLY a JSON object with these exact keys:
        - summary (2-3 sentences max)
        - action_items (Array of short string tasks)
        - sentiment (one of: 'hot', 'warm', 'cold')
        
        Transcription: "${transcriptText}"
      `;

      const completion = await groqWithRetry(() => groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama3-8b-8192",
        response_format: { type: "json_object" }
      }));
      aiResponse = JSON.parse(completion.choices[0].message.content);
    }

    return NextResponse.json({ 
      transcript: transcriptText,
      extractedData: aiResponse
    });

  } catch (error) {
    logger.error("Transcription error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
