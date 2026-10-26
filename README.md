# UtsavPilot 🪔✨
> **PromptWars Challenge 5: GenAI-Powered Celebration & Event Planner**  
> *Intelligent, budget-conscious event orchestration for Weddings, Birthdays, and Community Festivals.*

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Gemini 3.8 Flash](https://img.shields.io/badge/Google_Gemini-3.8_Flash-orange?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![Vitest](https://img.shields.io/badge/Tests-23%2F23_Passing-brightgreen?style=for-the-badge&logo=vitest)](https://vitest.dev/)

---

## 1. Executive Summary & Problem Statement

Event planning for budget-conscious organizers is traditionally chaotic. Hiring a professional event planner costs tens of thousands of rupees, yet doing it yourself leads to cognitive overload, fragmented vendor quotes, hidden fees, and cascade failures:
- Increasing guest count from 250 to 320 doesn't just add 70 chairs—it blows past venue fire code capacity, increases catering per plate, triggers table linen rentals, and strains parking logistics.
- Shifting an event date forward compresses critical task lead times and risks forfeiture of vendor deposits.

**UtsavPilot** (*Utsav* = Celebration, *Pilot* = Intelligent Co-pilot) transforms this chaotic process into a structured, delightful, and mathematically grounded experience. It combines a **deterministic business logic core** with **server-side Google Gemini reasoning** (with multi-model tiered fallback), highlighted by the **Event Ripple Engine**—an intelligent change-impact propagation system that detects ripple effects, catches constraint violations, and proposes feasible AI-powered trade-offs for user approval.

---

## 2. Signature Differentiator: Event Ripple Engine

Unlike cosmetic chatbots that merely spit out generic text, the **Event Ripple Engine** operates directly on the active event state:

1. **Deterministic Change Detection**:
   - Calculates signed deltas whenever the user modifies **Guest Count**, **Total Budget**, **Event Date**, or **Venue Capacity**.
2. **Constraint Breach & Physical Safety Checks**:
   - Detects `VENUE_CAPACITY_EXCEEDED` when `guestCount > venueCapacity` (flags fire code, seating density, and emergency egress risks).
   - Detects `BUDGET_OVERRUN` when projected commitments exceed total funds.
   - Detects `IMPOSSIBLE_DEADLINE` when shifting the event date forces prerequisite milestone tasks into the past.
3. **Automated Per-Guest Line Item Scaling**:
   - Line items flagged as `isScalableWithGuests` (such as 4-course catering, welcome drinks, guest favor gifts) automatically re-calculate their cost:  
     $$\text{New Cost} = \text{Fixed Base} + (\text{Guest Count} \times \text{Cost Per Guest})$$
4. **Actionable AI Trade-Off Alternatives**:
   - Gemini synthesizes realistic, creative compromises tailored to the event type (e.g. switching plated dining to live buffet counters, replacing exotic cut flowers with brass urli lamps, mobilizing volunteer marshals).
5. **Non-Destructive Patch Application**:
   - Presents a side-by-side diff in a slide-over review drawer. User-approved changes are applied atomically **without silently overwriting manual edits on unrelated fields**.

---

## 3. Core Pillars & Capabilities

### A. Three Supported Event Archetypes
- **Weddings**: Multi-day rituals (Mandap, Sangeet, Reception), scalable catering per plate, guest favor gifting, photography reels, and strict sound cutoff permits.
- **Birthdays**: Milestone themes (e.g., Space Odyssey 7th Birthday), interactive STEM crafts, custom 3D cakes, kid-safe finger foods, and allergy management.
- **Community Events**: Non-profit cultural festivals (Diwali Mela, Dandiya Nights), stage truss and sound rigs, food stall revenue sharing, and volunteer crowd safety.

### B. Zero-Hallucination Budget Management
- **Integer Minor Currency Units**: All monetary amounts are stored in minor units (e.g., paise: 1 INR = 100 paise) to prevent floating-point drift.
- **Strict Separation of Funds**: Tracks Total Budget, Allocated Funds, Confirmed Vendor Quotes, Paid Deposits, Remaining Buffer, and Contingency (default 10%) separately.
- **Source Transparency**: Every line item clearly displays its provenance badge (`Vendor Quote`, `AI Estimate`, or `User Defined`).
- **Strict Rule**: The LLM is **never** relied upon for arithmetic; all math is computed by pure TypeScript domain functions.

### C. Dynamic Timeline & Actionable Checklist
- Milestones are calculated with offset days relative to the event date (e.g. -60 days, -14 days) using pure UTC date arithmetic (`addDaysToIsoDate`) to eliminate timezone day shifts.
- Supports task completion checkboxes, priorities (`High`, `Medium`, `Low`), assignees/owners, and prerequisite task dependencies.
- Flags overdue tasks and alerts the organizer when prerequisite tasks remain uncompleted.

### D. Vendor Management & Quote Comparator
- Tracks vendor category, name, quotation amount, inclusions list, status (`Booked`, `Shortlisted`, `Quoted`, `Inquired`), deposit paid, and outstanding balance due.
- Features a side-by-side **Quote Comparator** that identifies pricing discrepancies, inclusion differences, and missing contractual clauses (e.g. overtime hourly surcharges, breakage deposits).
- **Integrity Notice**: All demonstration vendors are clearly labeled as `[Sample Data]`. The application never claims real bookings or endorsements.

### E. Explainable AI Assistant & Ideas Hub
- Generates curated recommendations across Theme, Decor, Menu, Entertainment, and Cost-Saving.
- Every suggestion features an **AI Reasoning & Grounding Box** (why it fits this event) and a **Required Trade-Off Box** (what is sacrificed or required).
- Interactive AI Co-Pilot chat drawer grounded in current event state for custom advice.

---

## 4. Technology Stack & Architecture

```
utsav-pilot/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   ├── plan/route.ts        # Gemini Event Plan Generation
│   │   │   │   ├── ripple/route.ts      # Event Ripple Engine AI Enrichment
│   │   │   │   └── assistant/route.ts   # Contextual Q&A Chat Co-Pilot
│   │   ├── globals.css                  # Tailwind styles & festive glassmorphism
│   │   ├── layout.tsx                   # App layout with Plus Jakarta Sans font
│   │   └── page.tsx                     # Main interactive workspace coordinator
│   ├── components/
│   │   ├── Navbar.tsx                   # Brand header & event switcher
│   │   ├── EventHeader.tsx              # Countdown, capacity gauge & constraints
│   │   ├── BudgetBoard.tsx              # Financial health cards & line item matrix
│   │   ├── TimelineChecklist.tsx        # Milestone timeline & dependency tracker
│   │   ├── VendorTracker.tsx            # Vendor quotations & comparator modal
│   │   ├── AiIdeasHub.tsx               # Recommendations with reasoning & trade-offs
│   │   ├── RippleDrawer.tsx             # Signature Event Ripple Engine drawer
│   │   ├── CreateEventModal.tsx         # 3-step structured + natural brief wizard
│   │   ├── AiAssistantModal.tsx         # AI Co-Pilot chat drawer
│   │   └── ImportExportModal.tsx        # JSON Import/Export with runtime Zod validation
│   ├── lib/
│   │   ├── budget-math.ts               # Integer minor currency arithmetic core
│   │   ├── ripple-engine.ts             # Signature Event Ripple Engine (UTC safe)
│   │   ├── gemini.ts                    # Google Gemini multi-model client & fallback
│   │   └── storage.ts                   # LocalStorage persistence & safe demo reset
│   ├── data/
│   │   └── demo-events.ts               # 3 rich, realistic demonstration events
│   └── types/
│       └── event.ts                     # Strict TypeScript data models & Zod schemas
└── tests/
    ├── budget-math.test.ts              # Integer minor currency & multi-currency tests
    ├── ripple-engine.test.ts            # Ripple propagation, UTC date math & patch tests
    ├── schema-validation.test.ts        # AI output schema validation tests
    └── import-export.test.ts            # Import schema validation & edge case tests
```

---

## 5. Automated Tests & Quality Gates

UtsavPilot includes 23 comprehensive automated tests covering critical business logic:

```bash
npm test
```

### Test Results:
```
 ✓ tests/schema-validation.test.ts (2 tests)
 ✓ tests/budget-math.test.ts (7 tests)
 ✓ tests/ripple-engine.test.ts (8 tests)
 ✓ tests/import-export.test.ts (6 tests)

 Test Files  4 passed (4)
      Tests  23 passed (23)
```

### Production Build:
```bash
npm run build
```
- Compiles with zero TypeScript or ESLint errors.
- Generates optimized static pages with dynamic server-side API routes.

---

## 6. Setup & Execution Instructions

### Prerequisites:
- Node.js 18+ (tested on Node.js v24.15.0)
- npm 9+

### Quickstart:
1. Clone the repository and navigate to `utsav-pilot`:
   ```bash
   cd utsav-pilot
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env.local`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.8-flash
   AI_PROVIDER=production
   ```
4. Start the application:
   ```bash
   npm run dev
   # Application will start at http://localhost:3005
   ```
5. Run production build:
   ```bash
   npm run build
   npm run start
   ```

---

## 7. Judge & Evaluator Walkthrough Journey

Evaluators can test the complete application in under 3 minutes:

1. **Explore Demonstration Events**:
   - Select between the **Wedding** (Jaipur Palace), **Birthday** (Space Odyssey), and **Community Festival** (Diwali Mela) using the top event selector.
2. **Trigger the Event Ripple Engine**:
   - Click the glowing **Ripple Engine** button in the header.
   - Drag the **Guest Count** slider from 250 to 350 (exceeding the venue capacity of 300).
   - Observe live detection:
     - 🚨 `VENUE_CAPACITY_EXCEEDED` conflict alert.
     - 📈 Scalable catering line items automatically recalculated.
     - 💡 Contextual AI trade-offs proposed (e.g. live buffet counters, lawn tenting).
   - Click **Accept & Apply Ripple Changes** and verify the dashboard updates.
3. **Verify Budget Precision**:
   - Open the **Budget Management** tab.
   - Click **Add Line Item** and input a custom item (e.g. ₹20,000 for welcome drinks).
   - Verify that subtotal, remaining balance, and contingency recalculate instantly with zero float rounding errors.
4. **Check Timeline Dependencies**:
   - Open the **Timeline & Checklist** tab.
   - Mark a milestone completed and filter by `Pending` vs `Done`.
5. **Inspect Sample Vendor Quotes**:
   - Open the **Vendor Tracker** tab and click **Compare Quotes** to view the scope comparator.
6. **Chat with AI Co-Pilot**:
   - Click **AI Advice** in the header to ask budget-saving or logistical questions grounded in the active event.
7. **Test Custom Data**:
   - Click the **Download** icon in the header to export JSON or paste your own event dataset.
   - Click the **Reset** button anytime to restore pristine demonstration data.
