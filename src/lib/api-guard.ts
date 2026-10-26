import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const MAX_PAYLOAD_BYTES = 65536; // 64 KB limit to prevent serverless memory abuse

export type GuardResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

/**
 * Validates payload size (HTTP 413) and parses/validates JSON body against Zod schema (HTTP 400).
 * Prevents memory exhaustion, payload bombing, and token flooding attacks.
 */
export async function parseAndValidateJson<Output, Def extends z.ZodTypeDef = z.ZodTypeDef, Input = any>(
  req: NextRequest,
  schema: z.ZodType<Output, Def, Input>
): Promise<GuardResult<Output>> {
  // 1. Content-Length header pre-check (fast-reject before reading stream)
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Payload too large. Maximum allowable request size is 64KB.' },
        { status: 413 }
      ),
    };
  }

  // 2. Stream read & size enforcement
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Failed to read request payload.' },
        { status: 400 }
      ),
    };
  }

  if (rawBody.length > MAX_PAYLOAD_BYTES) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Payload too large. Maximum allowable request size is 64KB.' },
        { status: 413 }
      ),
    };
  }

  // 3. JSON parsing
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Malformed JSON payload.' },
        { status: 400 }
      ),
    };
  }

  // 4. Schema validation
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const errorDetails = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Validation failed.',
          details: errorDetails,
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Strips sensitive keys, API secrets, or credential tokens from error messages
 * before logging or safe handling.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return 'Unknown error';
  return message
    .replace(/key=[A-Za-z0-9_-]+/gi, 'key=[REDACTED]')
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
}
