import { NextRequest, NextResponse } from 'next/server';
import { getAiAssistantAdvice, AssistantRequestSchema } from '@/lib/gemini';
import { parseAndValidateJson, sanitizeErrorMessage } from '@/lib/api-guard';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // 1. Enforce payload size limit (HTTP 413) and validate request schema with bounds (HTTP 400)
  const guard = await parseAndValidateJson(req, AssistantRequestSchema);
  if (!guard.success) {
    return guard.response;
  }

  try {
    const { message, eventState } = guard.data;
    const { reply, aiMetadata } = await getAiAssistantAdvice(message, eventState as any);

    return NextResponse.json({
      success: true,
      reply,
      aiMetadata,
    });
  } catch (err: any) {
    // 2. Safe error response: sanitize server logs and return safe generic error message
    console.error('API /api/ai/assistant error:', sanitizeErrorMessage(err?.message || 'Internal server error'));
    return NextResponse.json(
      { error: 'An unexpected error occurred while retrieving co-pilot advice. Please try again.' },
      { status: 500 }
    );
  }
}
