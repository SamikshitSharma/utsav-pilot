import { NextRequest, NextResponse } from 'next/server';
import { analyzeRippleImpact } from '@/lib/ripple-engine';
import { enrichRippleWithGemini, RippleRequestSchema } from '@/lib/gemini';
import { parseAndValidateJson, sanitizeErrorMessage } from '@/lib/api-guard';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // 1. Enforce payload size limit (HTTP 413) and validate request schema with bounds (HTTP 400)
  const guard = await parseAndValidateJson(req, RippleRequestSchema);
  if (!guard.success) {
    return guard.response;
  }

  try {
    const { currentEvent, changeRequest } = guard.data;

    // 2. Run deterministic ripple engine first (100% mathematically accurate)
    const baseReport = analyzeRippleImpact(currentEvent as any, changeRequest as any);

    // 3. Enrich with Gemini AI reasoning via centralized service
    const { report, aiMetadata } = await enrichRippleWithGemini(
      currentEvent as any,
      changeRequest,
      baseReport
    );

    return NextResponse.json({
      success: true,
      report,
      aiMetadata,
    });
  } catch (err: any) {
    // 4. Safe error response: sanitize server logs and return safe generic error message
    console.error('API /api/ai/ripple error:', sanitizeErrorMessage(err?.message || 'Internal server error'));
    return NextResponse.json(
      { error: 'An unexpected error occurred while analyzing ripple impact. Please try again.' },
      { status: 500 }
    );
  }
}
