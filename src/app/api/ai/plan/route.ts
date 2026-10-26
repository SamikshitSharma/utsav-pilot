import { NextRequest, NextResponse } from 'next/server';
import { generateEventPlanWithGemini, PlanRequestSchema } from '@/lib/gemini';
import { parseAndValidateJson, sanitizeErrorMessage } from '@/lib/api-guard';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // 1. Enforce payload size limit (HTTP 413) and validate request schema with bounds (HTTP 400)
  const guard = await parseAndValidateJson(req, PlanRequestSchema);
  if (!guard.success) {
    return guard.response;
  }

  try {
    const result = await generateEventPlanWithGemini(guard.data);
    return NextResponse.json({
      success: true,
      plan: result.plan,
      aiMetadata: result.aiMetadata,
    });
  } catch (err: any) {
    // 2. Safe error response: sanitize server logs and never expose internal error/key details to clients
    console.error('API /api/ai/plan error:', sanitizeErrorMessage(err?.message || 'Internal server error'));
    return NextResponse.json(
      { error: 'An unexpected error occurred while generating your event plan. Please try again or switch to simulation mode.' },
      { status: 500 }
    );
  }
}
