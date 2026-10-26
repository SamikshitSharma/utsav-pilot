import { NextRequest, NextResponse } from 'next/server';
import { EventState } from '@/types/event';
import { getAiAssistantAdvice } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      eventState,
    }: {
      message: string;
      eventState: EventState;
    } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message query is required' }, { status: 400 });
    }

    const { reply, aiMetadata } = await getAiAssistantAdvice(message, eventState);

    return NextResponse.json({
      success: true,
      reply,
      aiMetadata,
    });
  } catch (err: any) {
    console.error('API /api/ai/assistant error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
