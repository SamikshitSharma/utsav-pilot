# UtsavPilot 🪔✨
> **PromptWars Challenge 5: GenAI-Powered Celebration & Event Planner**  
> *Intelligent, budget-conscious event orchestration for Weddings, Birthdays, and Community Festivals.*

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-3.5_Flash_Lite-orange?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![Vitest](https://img.shields.io/badge/Tests-91%2F91_Passing-brightgreen?style=for-the-badge&logo=vitest)](https://vitest.dev/)

---

## 1. Executive Summary & Problem Statement

Event planning for budget-conscious organizers is traditionally chaotic. Hiring a professional event planner can be expensive, while doing it yourself leads to cognitive overload, fragmented vendor quotes, hidden fees, and cascading changes:
- Increasing guest count affects more than seating: it can exceed the configured venue capacity, increase per-person catering costs, and affect logistics.
- Shifting an event date compresses critical task lead times and can make milestone deadlines impossible.

**UtsavPilot** (*Utsav* = Celebration, *Pilot* = Intelligent Co-pilot) transforms event planning into a structured, budget-conscious workflow. It combines a **deterministic business-logic core** with **server-side Google Gemini reasoning** and a bounded fallback path. Its signature **Event Ripple Engine** detects downstream effects when event constraints change, recalculates affected values, and presents actionable trade-offs for user approval.

---

## 2. Signature Differentiator: Event Ripple Engine

Unlike a chatbot that only produces generic text, the **Event Ripple Engine** evaluates proposed changes against the active event state:

1. **Deterministic Change Detection**:
   - Calculates changes when the user modifies **Guest Count**, **Total Budget**, **Event Date**, or **Venue Capacity**.
2. **Constraint Checks**:
   - Detects `VENUE_CAPACITY_EXCEEDED` when `guestCount > venueCapacity` using the venue capacity configured in the event.
   - Detects `BUDGET_OVERRUN` when projected commitments exceed the available budget.
   - Detects `IMPOSSIBLE_DEADLINE` when shifting the event date moves prerequisite milestone deadlines into the past.
   - These are application-level planning checks; they do not independently certify fire-code, building-code, or local regulatory compliance.
3. **Automated Per-Guest Line Item Scaling**:
   - Line items flagged as `isScalableWithGuests` (such as catering, welcome drinks, or guest favors) can be recalculated using their configured per-person costs:
     ```math
     \text{New Cost} = \text{Fixed Base} + (\text{Guest Count} \times \text{Cost Per Guest})
     ```
4. **AI-Generated Trade-Off Alternatives**:
   - Gemini can propose event-specific alternatives, such as switching plated dining to buffet counters or simplifying decor. Suggestions are advisory and should be reviewed by the organizer.
5. **Non-Destructive Patch Application**:
   - Presents a proposed change set in a review drawer. The user can accept or discard the proposal rather than having changes silently applied.

---

## 3. Core Pillars & Capabilities

### A. Three Supported Event Archetypes
- **Weddings**: Multi-day rituals, scalable catering, guest favors, photography, and event logistics.
- **Birthdays**: Theme planning, activities, cakes, food preferences, and allergy considerations.
- **Community Events**: Cultural festivals, stage and sound requirements, food stalls, and volunteer coordination.

### B. Deterministic Budget Management
- **Integer Minor Currency Units**: Monetary amounts are stored in minor units (e.g., paise: 1 INR = 100 paise) to avoid floating-point arithmetic drift.
- **Budget Visibility**: Tracks total budget, allocated items, vendor quotes, deposits, remaining balance, and contingency.
- **Source Transparency**: Line items display provenance such as `Vendor Quote`, `AI Estimate`, or `User Defined`.
- **Separation of Responsibilities**: TypeScript domain functions perform budget arithmetic and configured cost scaling. Gemini is not relied upon for financial calculations. AI-generated estimates and recommendations are not guaranteed to match actual vendor prices.

### C. Dynamic Timeline & Actionable Checklist
- Milestones use day offsets relative to the event date and UTC-safe date arithmetic.
- Supports task completion, priorities, owners, and prerequisite dependencies.
- Flags overdue tasks and highlights incomplete prerequisites.

### D. Vendor Management & Quote Comparator
- Tracks vendor category, name, quotation amount, inclusions, status, deposits, and outstanding balances.
- Provides a side-by-side quote comparison to help identify pricing and scope differences.
- **Integrity Notice**: Demonstration vendors are sample data. The application does not claim real bookings or vendor endorsements.

### E. Explainable AI Assistant & Ideas Hub
- Generates recommendations across themes, decor, menus, entertainment, activities, and cost-saving ideas.
- Recommendations include contextual reasoning and trade-offs.
- The AI Co-Pilot uses the active event context to answer planning questions. Generated advice should be treated as assistance, not professional or regulatory certification.

---

## 4. Technology Stack & Architecture

- **Application**: Next.js 14.2, React 18, TypeScript, Tailwind CSS.
- **GenAI**: Google Gemini API, called server-side for plan generation, assistant responses, and Ripple recommendation enrichment.
- **Validation**: Zod schemas for request and generated-plan validation.
- **Business logic**: Deterministic TypeScript functions for budget arithmetic, configured per-guest scaling, capacity checks, and date/milestone impact.
- **Persistence**: Browser LocalStorage for event state.
- **Testing**: Vitest.
- **Deployment**: Vercel.

```
utsav-pilot/
├── src/
│   ├── app/
│   │   ├── api/ai/
│   │   │   ├── plan/route.ts          # Event plan generation
│   │   │   ├── ripple/route.ts        # Ripple analysis and AI enrichment
│   │   │   └── assistant/route.ts     # Contextual AI assistant
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── EventHeader.tsx
│   │   ├── BudgetBoard.tsx
│   │   ├── TimelineChecklist.tsx
│   │   ├── VendorTracker.tsx
│   │   ├── AiIdeasHub.tsx
│   │   ├── RippleDrawer.tsx
│   │   ├── CreateEventModal.tsx
│   │   ├── AiAssistantModal.tsx
│   │   └── ImportExportModal.tsx
│   ├── lib/
│   │   ├── budget-math.ts
│   │   ├── ripple-engine.ts
│   │   ├── gemini.ts
│   │   ├── storage.ts
│   │   ├── rate-limiter.ts
│   │   └── api-guard.ts
│   ├── middleware.ts                 # AI API rate limiting
│   ├── data/
│   │   └── demo-events.ts
│   └── types/
│       └── event.ts                   # TypeScript models and Zod schemas
└── tests/
    ├── budget-math.test.ts
    ├── ripple-engine.test.ts
    ├── import-export.test.ts
    ├── schema-validation.test.ts
    ├── gemini-fault-tolerance.test.ts
    ├── ai-provenance-and-fallback.test.ts
    ├── rate-limiting.test.ts
    └── production-hardening.test.ts
```

### API Protection & Abuse Resistance

- AI endpoints are protected by a **20-request-per-60-second** rate-limit policy.
- Requests are limited to **64 KiB**, with content-type, JSON, UTF-8, and schema validation.
- When Upstash/Vercel KV REST credentials are configured, the rate limiter can use a shared store. The currently audited production deployment reports `edge-isolate`, meaning its in-memory fallback is isolate-local rather than a globally synchronized limit.
- Middleware is scoped to `/api/ai/*`. Rate limiting is best-effort protection and is not a substitute for a globally coordinated abuse-prevention service.

---

## 5. Automated Tests & Quality Gates

The current regression suite contains **91 automated tests across 9 test files**, covering business logic, AI fault tolerance, provenance, API validation, rate limiting, and Ripple Engine persistence.

Run the suite with:

```bash
npm test
```

### Verified Test Results

The latest recorded verification for the audited release reported:

```
Test Files  9 passed (9)
     Tests  91 passed (91)
```

Test files:
- `tests/budget-math.test.ts` — integer minor-unit arithmetic.
- `tests/ripple-engine.test.ts` — ripple propagation, date logic, and patches.
- `tests/storage-ripple-persistence.test.ts` — storage lifecycle, active event tracking, and ripple persistence.
- `tests/import-export.test.ts` — import/export validation.
- `tests/schema-validation.test.ts` — schema validation.
- `tests/gemini-fault-tolerance.test.ts` — provider fault handling.
- `tests/ai-provenance-and-fallback.test.ts` — AI provenance and fallback behavior.
- `tests/rate-limiting.test.ts` — rate-limit behavior.
- `tests/production-hardening.test.ts` — request guards and production hardening.

### Additional Quality Gates

```bash
npx tsc --noEmit
npm run lint
npm run build
```

The audited release passed TypeScript compilation and the production build. Lint completed with no errors (one standard font-related warning was reported).

---

## 6. Setup & Execution Instructions

### Prerequisites
- Node.js 18+
- npm 9+

### Quickstart

1. Clone the repository and navigate to the project:
   ```bash
   git clone https://github.com/SamikshitSharma/utsav-pilot.git
   cd utsav-pilot
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env.local` in the project root and configure:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.5-flash-lite
   AI_PROVIDER=production
   ```
   Keep API keys private. Never commit `.env.local` or paste a real key into source code.
4. Start the development server:
   ```bash
   npm run dev
   ```
   The application runs at [http://localhost:3005](http://localhost:3005).
5. Run a production build:
   ```bash
   npm run build
   npm run start
   ```

---

## 7. Judge & Evaluator Walkthrough

The following path demonstrates the core workflows:

1. **Explore Demonstration Events**:
   - Select the Wedding, Birthday, or Community Festival event from the event selector.
2. **Trigger the Event Ripple Engine**:
   - Open the **Ripple Engine**.
   - Increase the guest count beyond the selected venue's configured capacity.
   - Inspect the capacity conflict, recalculated scalable line items, and proposed AI trade-offs.
   - Accept the proposal to apply it, or discard it to leave the event unchanged.
3. **Verify Budget Calculations**:
   - Open **Budget Management** and add a custom line item.
   - Check that totals, remaining balance, and contingency update.
4. **Check Timeline Dependencies**:
   - Open **Timeline & Checklist**, complete a milestone, and inspect pending/done tasks.
5. **Inspect Sample Vendor Quotes**:
   - Open **Vendor Tracker** and use **Compare Quotes**.
6. **Chat with the AI Co-Pilot**:
   - Open **AI Advice** and ask a question related to the active event.
7. **Test Custom Data**:
   - Export event data as JSON or import a dataset. Use **Reset** to restore the demonstration data.

---

## 8. AI Behavior & Limitations

- Gemini is used for event-plan generation, contextual assistant responses, and additional Ripple trade-off recommendations.
- Generated responses are validated against application schemas. Validation improves structural consistency; it does not guarantee factual correctness.
- If live Gemini generation is unavailable or times out, the application can use a deterministic fallback for supported plan-generation paths. The application exposes provenance metadata so live-provider output can be distinguished from fallback output.
- Budget arithmetic and configured constraint checks are deterministic application logic. AI-generated estimates, vendor suggestions, and planning advice can still be inaccurate and should be verified before real-world decisions.
- Venue-capacity checks compare the guest count with the capacity configured in the event. They are not a fire-code or building-safety assessment.
