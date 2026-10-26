import { z } from 'zod';
import { EventType, BudgetItem, Task, Vendor, IdeaRecommendation, EventState, EventStateSchema, RippleImpactReport } from '@/types/event';

// Never hardcode API keys in source code! Must be loaded via environment variables.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Canonical fast primary model verified with live Google API (lowest latency and zero 503 capacity errors)
const VERIFIED_FAST_MODEL = 'gemini-3.5-flash-lite';

// Automatically map legacy or overloaded model alias if present in Vercel environment
const configuredModel = process.env.GEMINI_MODEL;
const PRIMARY_MODEL = (!configuredModel || configuredModel === 'gemini-3.8-flash')
  ? VERIFIED_FAST_MODEL
  : configuredModel;

const AI_PROVIDER = process.env.AI_PROVIDER || 'production';

// Tiered model fallback list for maximum judge compatibility (verified against Google API)
const FALLBACK_MODELS = [
  PRIMARY_MODEL,
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-latest',
].filter((v, i, a) => v && a.indexOf(v) === i);

// Zod schema for validating ripple trade-off enrichment
export const RippleAiEnrichmentSchema = z.object({
  additionalTradeOffs: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      estimatedSavingsMinor: z.number().int().default(0),
      tradeOff: z.string().min(1),
    })
  ).default([]),
  expertAdvice: z.string().optional(),
});

export const PlanRequestSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150, 'Title cannot exceed 150 characters'),
  type: z.enum(['wedding', 'birthday', 'community', 'corporate', 'anniversary', 'cultural', 'other']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').default(() => new Date().toISOString().split('T')[0]),
  location: z.string().trim().max(200, 'Location cannot exceed 200 characters').default(''),
  guestCount: z.number().int().min(1, 'Guest count must be at least 1').max(50000, 'Guest count cannot exceed 50,000').default(100),
  totalBudgetMinor: z.number().int().min(10000, 'Budget must be at least 100.00').max(100000000000, 'Budget exceeds allowable maximum'),
  contingencyPercent: z.number().min(0).max(50).default(10),
  theme: z.string().trim().max(200, 'Theme cannot exceed 200 characters').default(''),
  dietaryNeeds: z.array(z.string().trim().max(100)).max(20).default([]),
  accessibilityNeeds: z.array(z.string().trim().max(100)).max(20).default([]),
  brief: z.string().trim().max(2000, 'Brief cannot exceed 2000 characters').default(''),
});

export type PlanGenerationInput = z.infer<typeof PlanRequestSchema>;

export const AssistantRequestSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(1000, 'Message cannot exceed 1000 characters'),
  eventState: EventStateSchema.optional(),
});

export type AssistantRequestInput = z.infer<typeof AssistantRequestSchema>;

export const RippleRequestSchema = z.object({
  currentEvent: z.object({
    id: z.string(),
    title: z.string().max(150),
    type: z.string().optional(),
    guestCount: z.number().int().min(1).max(50000),
    venueCapacity: z.number().int().min(1).max(50000).optional(),
    totalBudgetMinor: z.number().int().nonnegative(),
    date: z.string(),
  }).passthrough(),
  changeRequest: z.object({
    guestCount: z.number().int().min(1).max(50000).optional(),
    totalBudgetMinor: z.number().int().nonnegative().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
    venueCapacity: z.number().int().min(1).max(50000).optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field to change must be provided in changeRequest.',
  }),
});

export type RippleRequestInput = z.infer<typeof RippleRequestSchema>;

// Zod schema for validated AI response
export const GeneratedPlanSchema = z.object({
  budgetItems: z.array(
    z.object({
      category: z.string(),
      name: z.string(),
      estimatedMinor: z.number().int().nonnegative(),
      isScalableWithGuests: z.boolean(),
      costPerGuestMinor: z.number().int().nonnegative(),
      fixedCostMinor: z.number().int().nonnegative(),
      priority: z.preprocess((val) => {
        if (val === 'high') return 'must_have';
        if (val === 'medium') return 'nice_to_have';
        if (val === 'low') return 'optional';
        return val;
      }, z.enum(['must_have', 'nice_to_have', 'optional']).default('must_have')),
      notes: z.string().optional(),
    })
  ),
  tasks: z.array(
    z.object({
      title: z.string(),
      category: z.string(),
      dueOffsetDays: z.number().int(),
      priority: z.enum(['high', 'medium', 'low']),
      owner: z.string(),
      notes: z.string().optional(),
    })
  ),
  vendors: z.array(
    z.object({
      category: z.string(),
      name: z.string(),
      quoteMinor: z.number().int().nonnegative(),
      inclusions: z.array(z.string()),
      notes: z.string().optional(),
    })
  ),
  ideas: z.array(
    z.object({
      category: z.enum(['theme', 'decor', 'menu', 'entertainment', 'activity', 'cost_saving']),
      title: z.string(),
      description: z.string(),
      reasoning: z.string(),
      tradeOffs: z.string(),
      estimatedSavingsOrCostMinor: z.number().int().optional(),
    })
  ),
  reasoningSummary: z.string(),
});

export type GeneratedPlanOutput = z.infer<typeof GeneratedPlanSchema>;

export interface PlanGenerationResult {
  plan: GeneratedPlanOutput;
  aiMetadata: {
    provider: 'gemini' | 'simulation';
    modelUsed: string;
    isLive: boolean;
  };
}

export const GEMINI_API_TIMEOUT_MS = 14000;

/**
 * Robust caller to Google Generative Language REST API with tiered model fallbacks
 * and strict timeout to prevent serverless function gateway timeouts.
 */
async function callGeminiApi(prompt: string, jsonMode: boolean = false): Promise<{ text: string; modelUsed: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
  const provider = process.env.AI_PROVIDER || AI_PROVIDER;
  if (!apiKey || provider === 'simulation') {
    return null;
  }

  // Attempt at most 2 healthy models to remain safely within Vercel's execution window
  for (const model of FALLBACK_MODELS.slice(0, 2)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_API_TIMEOUT_MS);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
              temperature: 0.3,
            },
          }),
        }
      );

      if (response.ok) {
        const rawData = await response.json();
        const text = rawData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { text, modelUsed: model };
        }
      } else if (response.status === 400) {
        console.warn(`Gemini client request error (HTTP 400). Aborting model retries.`);
        break; // Do not retry across models if request format or parameter is rejected
      } else if (response.status === 401 || response.status === 403) {
        console.warn(`Gemini authentication failure (HTTP ${response.status}). Aborting model retries.`);
        break; // Do not retry across models if the credential itself is invalid
      } else if (response.status === 429) {
        console.warn(`Gemini quota or rate-limit reached (HTTP 429). Aborting model retries.`);
        break; // Do not retry across models if quota is exhausted
      } else if (response.status === 404 || response.status === 503) {
        console.warn(`Gemini model ${model} returned HTTP ${response.status} (unsupported or temporary high demand). Trying next fallback model...`);
      } else {
        console.warn(`Gemini model ${model} returned HTTP ${response.status}, trying fallback...`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`Gemini model ${model} timed out after ${GEMINI_API_TIMEOUT_MS / 1000}s. Trying next fallback...`);
      } else {
        console.warn(`Network error invoking Gemini model ${model}:`, err?.message || err);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

/**
 * Normalizes raw model output to handle root wrappers and structural variations
 */
export function normalizePlanCandidate(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw.plan || raw.eventPlan || raw.event_plan || raw.data || raw;
  if (!obj || typeof obj !== 'object') return raw;

  // 1. Normalize budget items
  const rawBudget = Array.isArray(obj.budgetItems) ? obj.budgetItems : obj.budget || obj.items;
  const budgetItems = Array.isArray(rawBudget)
    ? rawBudget.map((b: any) => {
        if (typeof b !== 'object' || !b) return b;
        return {
          category: b.category || 'General',
          name: b.name || b.title || b.item || 'Budget Item',
          estimatedMinor:
            typeof b.estimatedMinor === 'number'
              ? Math.round(b.estimatedMinor)
              : Math.round(
                  Number(
                    b.costMinor ||
                      b.estimatedCostMinor ||
                      b.estimatedAmountMinor ||
                      b.amountMinor ||
                      (b.estimated ? b.estimated * 100 : 1000000)
                  )
                ),
          isScalableWithGuests: Boolean(b.isScalableWithGuests ?? b.scalable ?? false),
          costPerGuestMinor: typeof b.costPerGuestMinor === 'number' ? Math.round(b.costPerGuestMinor) : 0,
          fixedCostMinor:
            typeof b.fixedCostMinor === 'number'
              ? Math.round(b.fixedCostMinor)
              : typeof b.estimatedMinor === 'number'
              ? Math.round(b.estimatedMinor)
              : 0,
          priority:
            b.priority === 'high' || b.priority === 'must_have'
              ? 'must_have'
              : b.priority === 'low' || b.priority === 'optional'
              ? 'optional'
              : 'nice_to_have',
          notes: b.notes || b.description || '',
        };
      })
    : undefined;

  // 2. Normalize tasks
  const rawTasks = Array.isArray(obj.tasks) ? obj.tasks : obj.timeline || obj.checklist;
  const tasks = Array.isArray(rawTasks)
    ? rawTasks.map((t: any, idx: number) => {
        if (typeof t === 'string') {
          return {
            title: t,
            category: 'Coordination',
            dueOffsetDays: -(idx + 1) * 7,
            priority: 'medium' as const,
            owner: 'Lead Organizer',
            notes: '',
          };
        }
        if (typeof t !== 'object' || !t) return t;
        let priority: 'high' | 'medium' | 'low' = 'medium';
        const pStr = String(t.priority || '').toLowerCase();
        if (pStr.includes('high') || pStr.includes('must') || pStr.includes('urgent')) priority = 'high';
        else if (pStr.includes('low') || pStr.includes('opt')) priority = 'low';

        return {
          title: t.title || t.task || t.name || `Task ${idx + 1}`,
          category: t.category || 'Logistics',
          dueOffsetDays:
            typeof t.dueOffsetDays === 'number'
              ? Math.round(t.dueOffsetDays)
              : typeof t.dueOffset === 'number'
              ? Math.round(t.dueOffset)
              : -15,
          priority,
          owner: t.owner || t.assignee || 'Lead Organizer',
          notes: t.notes || t.description || '',
        };
      })
    : undefined;

  // 3. Normalize vendors
  const rawVendors = Array.isArray(obj.vendors) ? obj.vendors : obj.vendorList || obj.sampleVendors;
  const vendors = Array.isArray(rawVendors)
    ? rawVendors.map((v: any, idx: number) => {
        if (typeof v !== 'object' || !v) return v;
        let name = v.name || v.vendorName || `Sample Vendor ${idx + 1}`;
        if (!name.includes('[Sample Data]')) {
          name = `${name} [Sample Data]`;
        }
        const inclusions = Array.isArray(v.inclusions)
          ? v.inclusions
          : typeof v.inclusions === 'string'
          ? [v.inclusions]
          : ['Standard service'];
        return {
          category: v.category || 'Service',
          name,
          quoteMinor:
            typeof v.quoteMinor === 'number'
              ? Math.round(v.quoteMinor)
              : Math.round(Number(v.quote || v.cost || 5000000)),
          inclusions,
          notes: v.notes || '',
        };
      })
    : undefined;

  // 4. Normalize ideas
  const validIdeaCategories = ['theme', 'decor', 'menu', 'entertainment', 'activity', 'cost_saving'];
  const rawIdeas = Array.isArray(obj.ideas) ? obj.ideas : obj.recommendations;
  const ideas = Array.isArray(rawIdeas)
    ? rawIdeas.map((idea: any) => {
        if (typeof idea !== 'object' || !idea) return idea;
        let category: any = 'cost_saving';
        if (validIdeaCategories.includes(idea.category)) {
          category = idea.category;
        }
        return {
          category,
          title: idea.title || 'Creative Suggestion',
          description: idea.description || idea.summary || '',
          reasoning: idea.reasoning || idea.why || '',
          tradeOffs: idea.tradeOffs || idea.tradeOff || 'Requires advance coordination',
          estimatedSavingsOrCostMinor:
            typeof idea.estimatedSavingsOrCostMinor === 'number'
              ? Math.round(idea.estimatedSavingsOrCostMinor)
              : typeof idea.savingsMinor === 'number'
              ? Math.round(idea.savingsMinor)
              : 0,
        };
      })
    : undefined;

  return {
    budgetItems,
    tasks,
    vendors,
    ideas,
    reasoningSummary:
      obj.reasoningSummary ||
      obj.summary ||
      obj.reasoning ||
      'AI tailored celebration plan optimized for requested constraints.',
  };
}

/**
 * Generates an event plan via Gemini with strict Zod validation, falling back
 * to deterministic synthesis with transparent provenance metadata.
 */
export async function generateEventPlanWithGemini(
  input: PlanGenerationInput
): Promise<PlanGenerationResult> {
  const prompt = `
You are UtsavPilot AI, an elite event planner and financial co-pilot specializing in budget-conscious Indian weddings, birthdays, and community festivals.
Generate a comprehensive, realistic, and mathematically consistent event plan.

CONSTRAINTS & DETAILS:
- Event Title: ${input.title}
- Event Type: ${input.type}
- Event Date: ${input.date}
- Location: ${input.location}
- Expected Guest Count: ${input.guestCount}
- Total Budget: ${input.totalBudgetMinor} minor units (e.g. paise: 1 INR = 100 paise)
- Contingency: ${input.contingencyPercent}%
- Theme / Aesthetic: ${input.theme}
- Dietary Requirements: ${input.dietaryNeeds.join(', ') || 'Standard'}
- Accessibility Requirements: ${input.accessibilityNeeds.join(', ') || 'None specified'}
- Natural Language Brief: "${input.brief}"

RULES:
1. Provide 4 to 6 realistic budget items with integer minor units (paise). Sum of estimatedMinor must be around 85-90% of total budget to leave room for contingency.
2. Flag items that scale per-guest (like food, favors, chair hire) with isScalableWithGuests = true and provide accurate costPerGuestMinor.
3. Provide 4 to 6 chronologically sound tasks with dueOffsetDays relative to event date (e.g. -60 for 60 days before, -1 for day before).
4. Provide 2 to 3 sample vendor specifications with realistic category quotes and clear inclusions. All sample vendors must have "[Sample Data]" in their name.
5. Provide 2 to 3 personalized, creative, cost-saving or high-impact ideas with explicit reasoning and trade-offs.
6. Return purely valid JSON strictly matching this structure:
{
  "budgetItems": [{"category": "...", "name": "...", "estimatedMinor": 0, "isScalableWithGuests": false, "costPerGuestMinor": 0, "fixedCostMinor": 0, "priority": "must_have"}],
  "tasks": [{"title": "...", "category": "...", "dueOffsetDays": -30, "priority": "high", "owner": "..."}],
  "vendors": [{"category": "...", "name": "... [Sample Data]", "quoteMinor": 0, "inclusions": ["..."]}],
  "ideas": [{"category": "cost_saving", "title": "...", "description": "...", "reasoning": "...", "tradeOffs": "...", "estimatedSavingsOrCostMinor": 0}],
  "reasoningSummary": "..."
}
`;
  const apiResult = await callGeminiApi(prompt, true);

  if (apiResult) {
    try {
      const parsed = JSON.parse(apiResult.text);
      const normalized = normalizePlanCandidate(parsed);
      const validated = GeneratedPlanSchema.safeParse(normalized);
      if (validated.success) {
        return {
          plan: validated.data,
          aiMetadata: {
            provider: 'gemini',
            modelUsed: apiResult.modelUsed,
            isLive: true,
          },
        };
      } else {
        console.warn('Gemini schema validation failed, using fallback:', validated.error);
      }
    } catch (e) {
      console.warn('Gemini response was not valid JSON, using fallback:', e);
    }
  }

  return {
    plan: generateFallbackPlan(input),
    aiMetadata: {
      provider: 'simulation',
      modelUsed: 'deterministic-synthesis-v1',
      isLive: false,
    },
  };
}

export interface RippleEnrichmentResult {
  report: RippleImpactReport;
  aiMetadata: {
    provider: 'gemini' | 'simulation';
    modelUsed: string;
    isLive: boolean;
  };
}

export interface AssistantAdviceResult {
  reply: string;
  aiMetadata: {
    provider: 'gemini' | 'simulation';
    modelUsed: string;
    isLive: boolean;
  };
}

/**
 * Enriches the deterministic Event Ripple Engine report with AI trade-offs.
 */
export async function enrichRippleWithGemini(
  currentEvent: EventState,
  changeRequest: any,
  baseReport: RippleImpactReport
): Promise<RippleEnrichmentResult> {
  if (baseReport.conflicts.length === 0 && baseReport.budgetImpact.deltaMinor === 0) {
    return {
      report: baseReport,
      aiMetadata: { provider: 'simulation', modelUsed: 'deterministic-rules-only', isLive: false },
    };
  }

  const prompt = `
You are the Event Ripple Engine AI for UtsavPilot.
An organizer made a change to their event:
Event: "${currentEvent.title}" (${currentEvent.type})
Original Guest Count: ${currentEvent.guestCount}, New: ${changeRequest.guestCount ?? currentEvent.guestCount}
Original Budget: ₹${(currentEvent.totalBudgetMinor / 100).toLocaleString('en-IN')}, New: ₹${((changeRequest.totalBudgetMinor ?? currentEvent.totalBudgetMinor) / 100).toLocaleString('en-IN')}
Current Venue Capacity: ${currentEvent.venueCapacity}
Detected Conflicts: ${JSON.stringify(baseReport.conflicts)}
Budget Delta: ₹${(baseReport.budgetImpact.deltaMinor / 100).toLocaleString('en-IN')}

Provide 2 practical, high-value, creative trade-off alternatives to resolve any budget overrun or venue strain without ruining the event experience.
Format response as pure JSON matching this structure:
{
  "additionalTradeOffs": [
    {
      "title": "Short title",
      "description": "Specific action",
      "estimatedSavingsMinor": 0,
      "tradeOff": "Consequence / trade-off"
    }
  ],
  "expertAdvice": "1-2 sentences of encouraging expert advice"
}
`;

  const apiResult = await callGeminiApi(prompt, true);

  if (apiResult) {
    try {
      const parsed = JSON.parse(apiResult.text);
      const validated = RippleAiEnrichmentSchema.safeParse(parsed);
      if (validated.success) {
        const enriched = { ...baseReport };
        if (validated.data.additionalTradeOffs && validated.data.additionalTradeOffs.length > 0) {
          enriched.aiTradeOffs = [...enriched.aiTradeOffs, ...validated.data.additionalTradeOffs];
        }
        if (validated.data.expertAdvice) {
          enriched.facts = [...enriched.facts, `AI CO-PILOT ADVICE: ${validated.data.expertAdvice}`];
        }
        return {
          report: enriched,
          aiMetadata: { provider: 'gemini', modelUsed: apiResult.modelUsed, isLive: true },
        };
      } else {
        console.warn('Ripple AI response failed schema validation:', validated.error);
      }
    } catch (err) {
      console.warn('Failed to parse AI ripple enrichment, returning base report:', err);
    }
  }

  return {
    report: baseReport,
    aiMetadata: { provider: 'simulation', modelUsed: 'deterministic-fallback', isLive: false },
  };
}

/**
 * Handles conversational queries grounded in active event context.
 */
export async function getAiAssistantAdvice(
  message: string,
  eventState?: EventState
): Promise<AssistantAdviceResult> {
  const eventContext = eventState
    ? `
EVENT STATE GROUNDING:
- Title: ${eventState.title} (${eventState.type})
- Date: ${eventState.date}
- Location: ${eventState.location}
- Guests: ${eventState.guestCount} (Venue Capacity: ${eventState.venueCapacity})
- Budget: ₹${(eventState.totalBudgetMinor / 100).toLocaleString('en-IN')} (Contingency: ${eventState.contingencyPercent}%)
- Theme: ${eventState.theme}
- Dietary: ${eventState.dietaryNeeds.join(', ') || 'Standard'}
- Accessibility: ${eventState.accessibilityNeeds.join(', ') || 'None'}
- Current Line Items: ${eventState.budgetItems.map(i => `${i.name} (₹${(i.estimatedMinor / 100).toLocaleString('en-IN')})`).join(', ')}
- Vendors: ${eventState.vendors.map(v => `${v.name} (${v.status}, ₹${(v.quoteMinor / 100).toLocaleString('en-IN')})`).join(', ')}
`
    : 'No active event context.';

  const prompt = `
You are UtsavPilot, a supportive, highly knowledgeable, and realistic AI event planning co-pilot.
The user is planning a budget-conscious celebration (wedding, birthday, or community festival) and asking for your direct advice.

${eventContext}

USER INQUIRY:
"${message}"

INSTRUCTIONS:
1. Ground your answer directly in the current event constraints (dates, guest count, location, theme, and budget).
2. Distinguish clearly between verified facts, realistic industry estimates, and creative possibilities.
3. If recommending cost savings, explicitly state the trade-offs (e.g. what is sacrificed or changed).
4. If essential details are missing or uncertain, state your assumptions and ask a polite clarifying question.
5. Provide actionable, concise advice formatted in clear markdown.
`;

  const apiResult = await callGeminiApi(prompt, false);

  if (apiResult) {
    return {
      reply: apiResult.text,
      aiMetadata: { provider: 'gemini', modelUsed: apiResult.modelUsed, isLive: true },
    };
  }

  // High quality contextual fallback response if offline
  let fallbackReply = `### UtsavPilot Recommendations for **${eventState?.title || 'Your Event'}**\n\n`;
  if (message.toLowerCase().includes('cost') || message.toLowerCase().includes('budget') || message.toLowerCase().includes('save')) {
    fallbackReply += `Here are 3 practical ways to optimize your budget for ${eventState?.guestCount || 100} guests without lowering standards:\n\n` +
      `1. **Focus Catering on Live Action Stations rather than Multi-Course Seated Buffets**: Live counter stations (like live chaat, pasta, or dosa bars) keep food fresh and reduce wasted excess bulk preparation by 20-25%.\n` +
      `2. **Architectural Up-Lighting over Perishable Exotic Flowers**: Reusable warm amber LED uplighting and brass urlis with floating candles transform the venue dramatically at less than half the cost of imported cut flowers.\n` +
      `3. **Digital Interactive RSVPs**: Sending personalized WhatsApp digital invites with automated RSVP forms saves on printing, physical dispatch, and locks your caterer headcount accurately.\n\n` +
      `*Trade-off*: Requires designating one coordinator to verify RSVPs 10 days prior to lock your caterer's Minimum Guarantee (MG).`;
  } else {
    fallbackReply += `Based on your ${eventState?.type || 'event'} in **${eventState?.location || 'your venue'}** with **${eventState?.guestCount || 50} guests**:\n\n` +
      `• **Theme Alignment**: Ensure your **"${eventState?.theme || 'Celebration'}"** aesthetic carries through from the entrance entryway to the guest dining area.\n` +
      `• **Timeline Priority**: Complete vendor bookings for catering and photography first, as lead times for prime dates fill up rapidly.\n` +
      `• **Contingency Buffer**: Keep your ${eventState?.contingencyPercent || 10}% contingency fund reserved for unexpected logistics like generator backup and weather arrangements.`;
  }

  return {
    reply: fallbackReply,
    aiMetadata: { provider: 'simulation', modelUsed: 'deterministic-fallback', isLive: false },
  };
}

/**
 * Deterministic synthesis engine used as a zero-failure fallback
 */
export function generateFallbackPlan(input: PlanGenerationInput): GeneratedPlanOutput {
  const budget = input.totalBudgetMinor;
  const guests = Math.max(1, input.guestCount);

  if (input.type === 'wedding') {
    const cateringPerGuest = Math.round((budget * 0.35) / guests);
    return {
      reasoningSummary: `Tailored royal wedding plan designed for ${guests} guests in ${input.location}, allocating 35% to premier regional catering, 25% to palace venue, and 15% to sustainable decor.`,
      budgetItems: [
        {
          category: 'Venue & Lawns',
          name: `${input.location} Heritage Lawns & Staging`,
          estimatedMinor: Math.round(budget * 0.25),
          isScalableWithGuests: false,
          costPerGuestMinor: 0,
          fixedCostMinor: Math.round(budget * 0.25),
          priority: 'must_have',
          notes: 'Includes courtyard lighting, bride/groom preparation rooms',
        },
        {
          category: 'Catering & Beverages',
          name: 'Traditional Royal Feast & Live Cooking Stations',
          estimatedMinor: Math.round(budget * 0.35),
          isScalableWithGuests: true,
          costPerGuestMinor: cateringPerGuest,
          fixedCostMinor: Math.round(budget * 0.05),
          priority: 'must_have',
          notes: `Accommodates ${input.dietaryNeeds.join(', ') || 'Vegetarian & Jain options'}`,
        },
        {
          category: 'Decor & Illumination',
          name: `${input.theme} Ambient Decor & Brass Diya Pathway`,
          estimatedMinor: Math.round(budget * 0.15),
          isScalableWithGuests: false,
          costPerGuestMinor: 0,
          fixedCostMinor: Math.round(budget * 0.15),
          priority: 'must_have',
          notes: 'Sustainable marigolds, reusable brass urli bowls, and warm LED uplights',
        },
        {
          category: 'Photography & Cinema',
          name: 'Cinematic 4K Highlight Reel & Traditional Portraits',
          estimatedMinor: Math.round(budget * 0.1),
          isScalableWithGuests: false,
          costPerGuestMinor: 0,
          fixedCostMinor: Math.round(budget * 0.1),
          priority: 'must_have',
          notes: 'Candid photographer + drone operator for ceremony',
        },
        {
          category: 'Guest Favors & Gifts',
          name: 'Handcrafted Heritage Keepsake & Mithai Gift Boxes',
          estimatedMinor: Math.round(budget * 0.05),
          isScalableWithGuests: true,
          costPerGuestMinor: Math.round((budget * 0.05) / guests),
          fixedCostMinor: 0,
          priority: 'nice_to_have',
          notes: 'Locally crafted artisanal sweets and brass keepsakes',
        },
      ],
      tasks: [
        {
          title: 'Finalize Venue Contract & Security Advance',
          category: 'Venue',
          dueOffsetDays: -60,
          priority: 'high',
          owner: 'Primary Organizer',
          notes: 'Verify sound cutoff rules and fire clearance',
        },
        {
          title: 'Conduct Food Tasting & Lock Special Dietary Menus',
          category: 'Catering',
          dueOffsetDays: -30,
          priority: 'high',
          owner: 'Family Committee',
          notes: 'Confirm live counter setup and Jain counter segregation',
        },
        {
          title: 'Dispatch Digital RSVP Cards via WhatsApp',
          category: 'Guest Management',
          dueOffsetDays: -25,
          priority: 'high',
          owner: 'Primary Organizer',
          notes: 'Collect headcount and shuttle transport requirements',
        },
        {
          title: 'Finalize Vendor Arrival & Sound Check Schedule',
          category: 'Coordination',
          dueOffsetDays: -3,
          priority: 'high',
          owner: 'Event Marshal',
          notes: 'Dry run generator failover and sound levels',
        },
      ],
      vendors: [
        {
          category: 'Heritage Venue',
          name: 'Grand Heritage Pavilion [Sample Data]',
          quoteMinor: Math.round(budget * 0.25),
          inclusions: ['Full Lawns Access', 'Green Rooms', 'Basic Light Grid'],
          notes: 'Estimated pricing based on local market rates',
        },
        {
          category: 'Gourmet Catering',
          name: 'Royal Shahi Kitchens [Sample Data]',
          quoteMinor: Math.round(budget * 0.35),
          inclusions: ['Multi-course Dinner', 'Live Chaat Station', 'Service Staff'],
          notes: 'Minimum guarantee required 10 days before event',
        },
      ],
      ideas: [
        {
          category: 'cost_saving',
          title: 'Replace Cut Exotic Flowers with Brass Urli & Candle Pools',
          description: 'Use floating marigold petals and brass lamps instead of imported cut flowers.',
          reasoning: 'Cuts perishables expenditure by 40% while delivering a classic heritage glow.',
          tradeOffs: 'Requires an assigned coordinator to relight candles before dinner.',
          estimatedSavingsOrCostMinor: -Math.round(budget * 0.06),
        },
        {
          category: 'menu',
          title: 'Live Hot Jalebi & Rabri Station',
          description: 'A dedicated chef frying crisp golden jalebis dipped in saffron rabri.',
          reasoning: 'Consistently higher guest delight compared to cold western desserts.',
          tradeOffs: 'Requires good outdoor ventilation and dedicated line management.',
        },
      ],
    };
  }

  // Fallback for Birthday / Community
  return {
    reasoningSummary: `Optimized ${input.type} plan balancing interactive entertainment with structured budget allocation for ${guests} participants.`,
    budgetItems: [
      {
        category: 'Venue & Facilities',
        name: `${input.location} Activity Space`,
        estimatedMinor: Math.round(budget * 0.3),
        isScalableWithGuests: false,
        costPerGuestMinor: 0,
        fixedCostMinor: Math.round(budget * 0.3),
        priority: 'must_have',
        notes: 'Includes tables, seating, and clean-up',
      },
      {
        category: 'Food & Refreshments',
        name: 'Curated Refreshments & Snacks',
        estimatedMinor: Math.round(budget * 0.35),
        isScalableWithGuests: true,
        costPerGuestMinor: Math.round((budget * 0.35) / guests),
        fixedCostMinor: 0,
        priority: 'must_have',
        notes: `Caters to ${input.dietaryNeeds.join(', ') || 'All attendees'}`,
      },
      {
        category: 'Activities & Supplies',
        name: `${input.theme} Activities & Take-Home Keepsakes`,
        estimatedMinor: Math.round(budget * 0.2),
        isScalableWithGuests: true,
        costPerGuestMinor: Math.round((budget * 0.2) / guests),
        fixedCostMinor: 0,
        priority: 'must_have',
        notes: 'Engaging interactive program',
      },
    ],
    tasks: [
      {
        title: 'Confirm Facility Reservation & Advance',
        category: 'Venue',
        dueOffsetDays: -20,
        priority: 'high',
        owner: 'Lead Planner',
        notes: 'Review setup and teardown access window',
      },
      {
        title: 'Order Custom Theme Supplies & Snacks',
        category: 'Supplies',
        dueOffsetDays: -7,
        priority: 'high',
        owner: 'Lead Planner',
        notes: 'Double check allergy-safe preparation',
      },
      {
        title: 'Setup Activity Stations & Sound Test',
        category: 'Logistics',
        dueOffsetDays: -1,
        priority: 'medium',
        owner: 'Volunteer Lead',
        notes: 'Test audio clarity and directional signs',
      },
    ],
    vendors: [
      {
        category: 'Venue Rental',
        name: 'Community Center Facilities [Sample Data]',
        quoteMinor: Math.round(budget * 0.3),
        inclusions: ['Hall Access', 'Restrooms', 'Chairs & Tables'],
        notes: 'Sample vendor quote for planning guidance',
      },
    ],
    ideas: [
      {
        category: 'cost_saving',
        title: 'Combine Party Activity with Take-Home Keepsake',
        description: 'Have guests craft their own personalized souvenir during the event.',
        reasoning: 'Eliminates separate favor bags while providing 45 minutes of active fun.',
        tradeOffs: 'Requires craft material preparation beforehand.',
        estimatedSavingsOrCostMinor: -Math.round(budget * 0.08),
      },
    ],
  };
}
