import { NextRequest, NextResponse } from 'next/server';
import { generateEventPlanWithGemini, PlanGenerationInput } from '@/lib/gemini';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body: PlanGenerationInput = await req.json();

    if (!body.title || !body.type || !body.totalBudgetMinor) {
      return NextResponse.json(
        { error: 'Missing mandatory fields: title, type, and totalBudgetMinor are required.' },
        { status: 400 }
      );
    }

    const result = await generateEventPlanWithGemini(body);
    return NextResponse.json({
      success: true,
      plan: result.plan,
      aiMetadata: result.aiMetadata,
    });
  } catch (err: any) {
    console.error('API /api/ai/plan error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error generating event plan' },
      { status: 500 }
    );
  }
}
