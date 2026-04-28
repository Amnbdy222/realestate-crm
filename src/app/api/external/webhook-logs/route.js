import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { getWebhookLogs } from '@/lib/webhookLogger';

export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({ logs: getWebhookLogs() });
}
