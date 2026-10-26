import { NextRequest, NextResponse } from 'next/server';
import { EventState } from '@/types/event';
import { analyzeRippleImpact, RippleChangeRequest } from '@/lib/ripple-engine';
import { enrichRippleWithGemini } from '@/lib/gemini';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const {
      currentEvent,
      changeRequest,
    }: {
      currentEvent: EventState;
      changeRequest: RippleChangeRequest;
    } = await req.json();

    if (!currentEvent || !changeRequest) {
      return NextResponse.json(
        { error: 'currentEvent and changeRequest are required.' },
        { status: 400 }
      );
    }

    // 1. Run deterministic ripple engine first (100% mathematically accurate)
    const baseReport = analyzeRippleImpact(currentEvent, changeRequest);

    // 2. Enrich with Gemini AI reasoning via centralized service
    const { report, aiMetadata } = await enrichRippleWithGemini(
      currentEvent,
      changeRequest,
      baseReport
    );

    return NextResponse.json({
      success: true,
      report,
      aiMetadata,
    });
  } catch (err: any) {
    console.error('API /api/ai/ripple error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error analyzing ripple impact' },
      { status: 500 }
    );
  }
}
