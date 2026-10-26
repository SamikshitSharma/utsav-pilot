import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const MAX_PAYLOAD_BYTES = 65536; // 64 KiB strict byte limit

export type GuardResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

/**
 * Validates Content-Type, Content-Length, streaming byte size (HTTP 413),
 * valid UTF-8 encoding, JSON syntax (HTTP 400), and Zod schema compliance.
 *
 * Enforces genuine encoded byte size rather than UTF-16 JavaScript string length,
 * preventing multibyte character undercounting and unbounded stream buffering.
 */
export async function parseAndValidateJson<Output, Def extends z.ZodTypeDef = z.ZodTypeDef, Input = any>(
  req: NextRequest,
  schema: z.ZodType<Output, Def, Input>
): Promise<GuardResult<Output>> {
  // 1. Content-Type verification
  const contentType = req.headers.get('content-type');
  if (!contentType || !contentType.toLowerCase().includes('application/json')) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid Content-Type. Expected application/json.' },
        { status: 415 }
      ),
    };
  }

  // 2. Content-Length header verification (fast pre-check)
  const rawCl = req.headers.get('content-length');
  if (rawCl !== null) {
    const cl = parseInt(rawCl, 10);
    if (isNaN(cl) || cl < 0) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Malformed Content-Length header.' },
          { status: 400 }
        ),
      };
    }
    if (cl > MAX_PAYLOAD_BYTES) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Payload too large. Maximum allowable request size is 64KB.' },
          { status: 413 }
        ),
      };
    }
  }

  // 3. Genuine encoded body byte limit enforcement (streaming if available)
  let rawBody: string;

  if (req.body && typeof req.body.getReader === 'function') {
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > MAX_PAYLOAD_BYTES) {
            // Cancel stream early to prevent unbounded memory allocation
            await reader.cancel();
            return {
              success: false,
              response: NextResponse.json(
                { error: 'Payload too large. Maximum allowable request size is 64KB.' },
                { status: 413 }
              ),
            };
          }
          chunks.push(value);
        }
      }
    } catch {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Failed to read request payload stream.' },
          { status: 400 }
        ),
      };
    }

    if (totalBytes === 0) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Empty request body.' },
          { status: 400 }
        ),
      };
    }

    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    try {
      rawBody = new TextDecoder('utf-8', { fatal: true }).decode(combined);
    } catch {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Invalid UTF-8 encoding in request payload.' },
          { status: 400 }
        ),
      };
    }
  } else {
    // Fallback reader with genuine UTF-8 byte counting
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

    if (!rawBody || rawBody.trim().length === 0) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Empty request body.' },
          { status: 400 }
        ),
      };
    }

    // Genuine UTF-8 encoded byte counting
    const byteLength = new TextEncoder().encode(rawBody).byteLength;
    if (byteLength > MAX_PAYLOAD_BYTES) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Payload too large. Maximum allowable request size is 64KB.' },
          { status: 413 }
        ),
      };
    }
  }

  // 4. JSON syntax validation
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

  // 5. Schema validation with bounded types
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
 * Extracts verified client IP address from trusted Vercel proxy headers.
 */
export function extractClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
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
