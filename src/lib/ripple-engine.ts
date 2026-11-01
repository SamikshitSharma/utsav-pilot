import {
  EventState,
  BudgetItem,
  Task,
  RippleImpactReport,
  ConflictAlert,
} from '@/types/event';
import { calculateBudgetSummary, formatCurrency } from './budget-math';

export interface RippleChangeRequest {
  guestCount?: number;
  totalBudgetMinor?: number;
  date?: string;
  venueCapacity?: number;
}

/**
 * Pure UTC date-math utility that avoids JavaScript locale/timezone shift bugs.
 */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const parts = (isoDate || '').split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return isoDate;
  }
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * The Signature Event Ripple Engine.
 * Analyzes the ripple impact of any parameter change across financial, physical,
 * and chronological constraints, providing mathematical facts, hard conflict alerts,
 * and actionable patch proposals.
 */
export function analyzeRippleImpact(
  current: EventState,
  changes: RippleChangeRequest
): RippleImpactReport {
  const currency = current.currency || 'INR';

  // Determine primary trigger
  let triggerField: RippleImpactReport['triggerField'] = 'guestCount';
  let oldValue: string | number = current.guestCount;
  let newValue: string | number = current.guestCount;

  if (changes.guestCount !== undefined && changes.guestCount !== current.guestCount) {
    triggerField = 'guestCount';
    oldValue = current.guestCount;
    newValue = changes.guestCount;
  } else if (
    changes.totalBudgetMinor !== undefined &&
    changes.totalBudgetMinor !== current.totalBudgetMinor
  ) {
    triggerField = 'totalBudget';
    oldValue = formatCurrency(current.totalBudgetMinor, currency);
    newValue = formatCurrency(changes.totalBudgetMinor, currency);
  } else if (changes.date !== undefined && changes.date !== current.date) {
    triggerField = 'date';
    oldValue = current.date;
    newValue = changes.date;
  } else if (
    changes.venueCapacity !== undefined &&
    changes.venueCapacity !== current.venueCapacity
  ) {
    triggerField = 'venueCapacity';
    oldValue = current.venueCapacity;
    newValue = changes.venueCapacity;
  }

  const targetGuestCount =
    changes.guestCount !== undefined ? Math.max(1, changes.guestCount) : current.guestCount;
  const targetBudgetMinor =
    changes.totalBudgetMinor !== undefined
      ? Math.max(0, changes.totalBudgetMinor)
      : current.totalBudgetMinor;
  const targetVenueCapacity =
    changes.venueCapacity !== undefined
      ? Math.max(1, changes.venueCapacity)
      : current.venueCapacity;
  const targetDate = changes.date || current.date;

  const facts: string[] = [];
  const conflicts: ConflictAlert[] = [];
  const affectedBudgetItems: RippleImpactReport['budgetImpact']['affectedItems'] = [];

  // 1. Recalculate Scalable Budget Items
  const guestDelta = targetGuestCount - current.guestCount;
  const updatedBudgetItems: BudgetItem[] = (current.budgetItems || []).map((item) => {
    if (item.isScalableWithGuests && item.costPerGuestMinor > 0) {
      const oldEst = item.estimatedMinor;
      const newEst = Math.max(
        0,
        Math.round((item.fixedCostMinor || 0) + targetGuestCount * item.costPerGuestMinor)
      );

      if (newEst !== oldEst) {
        const itemDelta = newEst - oldEst;
        affectedBudgetItems.push({
          id: item.id,
          name: item.name,
          oldCostMinor: oldEst,
          newCostMinor: newEst,
          reason: `${item.name} automatically scaled by ${
            itemDelta >= 0 ? '+' : ''
          }${formatCurrency(itemDelta, currency)} (${guestDelta >= 0 ? '+' : ''}${guestDelta} guests @ ${formatCurrency(
            item.costPerGuestMinor,
            currency
          )}/guest)`,
        });
      }

      return {
        ...item,
        estimatedMinor: newEst,
      };
    }
    return item;
  });

  // Calculate new budget metrics
  const oldSummary = calculateBudgetSummary(
    current.budgetItems || [],
    current.totalBudgetMinor,
    current.contingencyPercent,
    currency
  );
  const newSummary = calculateBudgetSummary(
    updatedBudgetItems,
    targetBudgetMinor,
    current.contingencyPercent,
    currency
  );

  const budgetDeltaMinor = newSummary.allocatedMinor - oldSummary.allocatedMinor;

  // 2. Physical Venue Capacity Verification
  if (targetGuestCount > targetVenueCapacity) {
    const overflow = targetGuestCount - targetVenueCapacity;
    conflicts.push({
      type: 'CRITICAL',
      code: 'VENUE_CAPACITY_EXCEEDED',
      message: `Venue capacity exceeded by ${overflow} attendee${overflow > 1 ? 's' : ''}!`,
      details: `Current venue "${current.location || 'Selected Venue'}" has a configured limit of ${targetVenueCapacity} attendees, but target is ${targetGuestCount}. Review local municipal safety rules, fire exit egress, and seating comfort.`,
    });
    facts.push(
      `PHYSICAL CONSTRAINT: Guest count of ${targetGuestCount} exceeds venue configured capacity of ${targetVenueCapacity}.`
    );
  } else if (targetGuestCount > targetVenueCapacity * 0.9) {
    conflicts.push({
      type: 'WARNING',
      code: 'VENUE_CAPACITY_EXCEEDED',
      message: `Venue is near maximum capacity (${Math.round(
        (targetGuestCount / targetVenueCapacity) * 100
      )}% full).`,
      details: `Ensure adequate space for staging, dance floor, catering buffet counters, and emergency egress.`,
    });
  }

  // 3. Financial Health & Overrun Verification
  if (newSummary.isOverBudget) {
    conflicts.push({
      type: 'CRITICAL',
      code: 'BUDGET_OVERRUN',
      message: `Budget Overrun of ${formatCurrency(newSummary.overrunMinor, currency)} detected!`,
      details: `Total projected cost (${formatCurrency(
        newSummary.allocatedMinor + newSummary.contingencyMinor,
        currency
      )}) exceeds available budget of ${formatCurrency(targetBudgetMinor, currency)}.`,
    });
    facts.push(
      `FINANCIAL CONSTRAINT: Projected commitment exceeds total budget by ${formatCurrency(
        newSummary.overrunMinor,
        currency
      )}.`
    );
  } else {
    facts.push(
      `FINANCIAL STATUS: Remaining buffer is ${formatCurrency(
        newSummary.remainingMinor,
        currency
      )} after allocating ${formatCurrency(
        newSummary.contingencyMinor,
        currency
      )} for contingency.`
    );
  }

  // Verify confirmed commitments against target budget
  if (targetBudgetMinor < oldSummary.confirmedMinor) {
    conflicts.push({
      type: 'CRITICAL',
      code: 'BUDGET_OVERRUN',
      message: `Target budget is lower than already confirmed vendor contracts!`,
      details: `Confirmed vendor obligations total ${formatCurrency(
        oldSummary.confirmedMinor,
        currency
      )}, which exceeds the requested budget limit of ${formatCurrency(
        targetBudgetMinor,
        currency
      )}.`,
    });
  }

  // 4. Chronological & Date Ripple Analysis
  const affectedTasks: RippleImpactReport['taskImpact']['affectedTasks'] = [];
  const updatedTasks: Task[] = (current.tasks || []).map((task) => {
    if (changes.date && changes.date !== current.date) {
      // Timezone-safe recalculation of dueDate based on offset days
      const newDueDate = addDaysToIsoDate(targetDate, task.dueOffsetDays || 0);
      const today = new Date().toISOString().split('T')[0];
      const isPastDue = newDueDate < today && task.status !== 'completed';

      if (newDueDate !== task.dueDate) {
        affectedTasks.push({
          id: task.id,
          title: task.title,
          oldDueDate: task.dueDate,
          newDueDate,
          isViolated: isPastDue,
          reason: isPastDue
            ? `New date shifts this task into the past! Must be expedited immediately.`
            : `Rescheduled to maintain ${Math.abs(task.dueOffsetDays)} days before event.`,
        });

        if (isPastDue) {
          conflicts.push({
            type: 'WARNING',
            code: 'IMPOSSIBLE_DEADLINE',
            message: `Task "${task.title}" is now overdue under the new date!`,
            details: `Calculated deadline was ${newDueDate}, which has already passed.`,
          });
        }
      }

      return {
        ...task,
        dueDate: newDueDate,
      };
    }
    return task;
  });

  // 5. Vendor Impact Notes
  const vendorRecommendations: string[] = [];
  if (guestDelta > 0) {
    vendorRecommendations.push(
      `Alert Catering & Food Vendor immediately regarding +${guestDelta} guest count adjustment.`
    );
    vendorRecommendations.push(
      `Request updated plate quote & ensure venue kitchen has staging capacity for ${targetGuestCount} attendees.`
    );
  } else if (guestDelta < 0) {
    vendorRecommendations.push(
      `Check cancellation/adjustment deadline on catering minimum-guarantee (MG) policy to reclaim savings.`
    );
  }
  if (changes.date && changes.date !== current.date) {
    vendorRecommendations.push(
      `Urgent: Contact all booked vendors to reconfirm date availability for ${targetDate}.`
    );
  }

  // 6. Actionable AI Trade-Off Proposals (Context-Aware)
  const aiTradeOffs: RippleImpactReport['aiTradeOffs'] = [];

  if (newSummary.isOverBudget) {
    if (current.type === 'wedding') {
      aiTradeOffs.push({
        title: 'Switch from Plated Service to Live Buffet Stations',
        description:
          'Opt for curated live counter buffet service rather than formal 5-course seated dinner.',
        estimatedSavingsMinor: Math.round(targetGuestCount * 40000), // ~₹400 per guest
        tradeOff: 'More lively, social atmosphere; guests mingle instead of waiting for table service.',
      });
      aiTradeOffs.push({
        title: 'Streamline Floral Decor with Strategic Ambient Up-lighting',
        description:
          'Replace exotic imported floral centerpieces with dramatic architectural warm LED uplighting and reusable brass accents.',
        estimatedSavingsMinor: Math.round(targetBudgetMinor * 0.08), // ~8% of total budget
        tradeOff: 'Modern royal evening aesthetic with substantially lower perishables cost.',
      });
      aiTradeOffs.push({
        title: 'Digital Smart Invites with QR RSVP instead of Heavy Print Boxes',
        description:
          'Use interactive WhatsApp video invite and guest portal for RSVP tracking, printing only for senior elders.',
        estimatedSavingsMinor: Math.round(targetGuestCount * 15000), // ~₹150 per guest
        tradeOff: 'Instant delivery, 100% RSVP accuracy, eco-friendly.',
      });
    } else if (current.type === 'birthday') {
      aiTradeOffs.push({
        title: 'Bundle Photography & Video with Single Hybrid Creator',
        description:
          'Hire a versatile solo content creator who captures 4K video snippets and portrait reels simultaneously.',
        estimatedSavingsMinor: 1000000, // ₹10,000
        tradeOff: 'Casual, candid social-media-ready delivery rather than formal printed album.',
      });
      aiTradeOffs.push({
        title: 'Interactive DIY Craft Favors instead of Store-Bought Goodie Bags',
        description:
          'Incorporate take-home craft creation (e.g. customized planetarium pottery or space badges) as an event activity.',
        estimatedSavingsMinor: Math.round(targetGuestCount * 18000), // ~₹180 per kid
        tradeOff: 'Doubles as an entertainment activity while eliminating generic plastic toys.',
      });
    } else {
      // Community event
      aiTradeOffs.push({
        title: 'Partner with Local Food Stalls & Food Trucks on Revenue Share',
        description:
          'Invite artisanal community food vendors to sell directly on a 15% revenue share rather than organizing mass catering.',
        estimatedSavingsMinor: Math.round(targetBudgetMinor * 0.25), // 25% savings
        tradeOff: 'Vibrant food festival vibe with zero upfront catering financial liability for the community committee.',
      });
      aiTradeOffs.push({
        title: 'Mobilize Youth Volunteer Marshals with Community Hours Certificates',
        description:
          'Replace commercial event staff agencies with university student volunteers trained for hospitality & queue safety.',
        estimatedSavingsMinor: Math.round(targetBudgetMinor * 0.12),
        tradeOff: 'Fosters grassroots youth leadership while keeping community overhead low.',
      });
    }
  }

  if (targetGuestCount > targetVenueCapacity) {
    aiTradeOffs.push({
      title: 'Extend to Outdoor Lawn Canopy / Double Shift Seating',
      description:
        'Coordinate with venue management to open the adjacent covered terrace/lawn for dining while keeping main stage indoors.',
      estimatedSavingsMinor: 0,
      tradeOff: 'Permits accommodating extra attendees safely without moving to a costlier venue.',
    });
  }

  return {
    triggerField,
    oldValue,
    newValue,
    facts,
    conflicts,
    budgetImpact: {
      previousEstimatedMinor: oldSummary.estimatedMinor,
      newEstimatedMinor: newSummary.estimatedMinor,
      deltaMinor: budgetDeltaMinor,
      overrunMinor: newSummary.overrunMinor,
      affectedItems: affectedBudgetItems,
    },
    taskImpact: {
      affectedTasks,
    },
    vendorImpact: {
      recommendations: vendorRecommendations,
    },
    aiTradeOffs,
    pendingPatches: {
      guestCount: changes.guestCount,
      totalBudgetMinor: changes.totalBudgetMinor,
      date: changes.date,
      venueCapacity: changes.venueCapacity,
      budgetItems: affectedBudgetItems.length > 0 ? updatedBudgetItems : undefined,
      tasks: affectedTasks.length > 0 ? updatedTasks : undefined,
    },
  };
}

/**
 * Safely applies approved ripple patches to the current event state without
 * overwriting any manual user edits on unrelated fields.
 */
export function applyRipplePatch(
  current: EventState,
  patches: RippleImpactReport['pendingPatches']
): EventState {
  const updated: EventState = {
    ...current,
    updatedAt: new Date().toISOString(),
  };

  if (patches.guestCount !== undefined) {
    updated.guestCount = patches.guestCount;
  }
  if (patches.totalBudgetMinor !== undefined) {
    updated.totalBudgetMinor = patches.totalBudgetMinor;
  }
  if (patches.date !== undefined) {
    updated.date = patches.date;
  }
  if (patches.venueCapacity !== undefined) {
    updated.venueCapacity = patches.venueCapacity;
  }
  if (patches.budgetItems) {
    // Preserve any existing user-added items while updating patched items
    const patchMap = new Map(patches.budgetItems.map((i) => [i.id, i]));
    const patchedIds = new Set<string>();
    const updatedItems = (current.budgetItems || []).map((item) => {
      const patched = patchMap.get(item.id);
      if (patched) {
        patchedIds.add(item.id);
        return { ...item, ...patched };
      }
      return item;
    });
    // Append any newly added patched items not previously in current
    for (const pItem of patches.budgetItems) {
      if (!patchedIds.has(pItem.id)) {
        updatedItems.push(pItem);
      }
    }
    updated.budgetItems = updatedItems;
  }
  if (patches.tasks) {
    // Preserve any existing user-added tasks while updating patched tasks
    const taskMap = new Map(patches.tasks.map((t) => [t.id, t]));
    const patchedIds = new Set<string>();
    const updatedTasks = (current.tasks || []).map((task) => {
      const patched = taskMap.get(task.id);
      if (patched) {
        patchedIds.add(task.id);
        return { ...task, ...patched };
      }
      return task;
    });
    // Append any newly added patched tasks not previously in current
    for (const pTask of patches.tasks) {
      if (!patchedIds.has(pTask.id)) {
        updatedTasks.push(pTask);
      }
    }
    updated.tasks = updatedTasks;
  }

  return updated;
}
