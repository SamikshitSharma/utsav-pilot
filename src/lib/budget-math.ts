import { BudgetItem, BudgetSummary, CurrencyCode } from '@/types/event';

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/**
 * Formats integer minor currency units (paise/cents) into human-readable currency strings.
 * E.g., 180000000 paise (INR) -> "₹18,00,000"
 */
export function formatCurrency(
  minorUnits: number,
  currency: CurrencyCode = 'INR',
  showDecimals: boolean = false
): string {
  const majorUnits = (minorUnits || 0) / 100;
  const symbol = CURRENCY_SYMBOLS[currency] || '₹';

  if (currency === 'INR') {
    // Format according to Indian numbering system (Lakhs, Crores)
    const formatted = showDecimals
      ? majorUnits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : Math.round(majorUnits).toLocaleString('en-IN');
    return `${symbol}${formatted}`;
  }

  const formatted = showDecimals
    ? majorUnits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(majorUnits).toLocaleString('en-US');
  return `${symbol}${formatted}`;
}

/**
 * Deterministically computes the full budget health summary from itemized lines.
 * Strictly avoids IEEE-754 floating point accumulation by operating purely on integers.
 */
export function calculateBudgetSummary(
  items: BudgetItem[],
  totalBudgetMinor: number,
  contingencyPercent: number = 10,
  currency: CurrencyCode = 'INR'
): BudgetSummary {
  const safeTotalBudget = Math.max(0, Math.round(totalBudgetMinor || 0));
  const safeContingencyPct = Math.max(0, Math.min(50, contingencyPercent || 0));

  let estimatedTotal = 0;
  let confirmedTotal = 0;
  let paidTotal = 0;
  let allocatedTotal = 0;

  for (const item of items) {
    const est = Math.max(0, Math.round(item.estimatedMinor || 0));
    const conf = Math.max(0, Math.round(item.confirmedMinor || 0));
    const paid = Math.max(0, Math.round(item.paidMinor || 0));

    estimatedTotal += est;
    confirmedTotal += conf;
    paidTotal += paid;

    // Allocated uses confirmed quote if available, otherwise estimated cost
    const effectiveCost = conf > 0 ? conf : est;
    allocatedTotal += effectiveCost;
  }

  const contingencyMinor = Math.round(safeTotalBudget * (safeContingencyPct / 100));
  const totalCommitment = allocatedTotal + contingencyMinor;

  const overrunMinor = Math.max(0, totalCommitment - safeTotalBudget);
  const remainingMinor = Math.max(0, safeTotalBudget - totalCommitment);
  const isOverBudget = overrunMinor > 0;

  return {
    totalBudgetMinor: safeTotalBudget,
    allocatedMinor: allocatedTotal,
    estimatedMinor: estimatedTotal,
    confirmedMinor: confirmedTotal,
    paidMinor: paidTotal,
    committedMinor: totalCommitment,
    remainingMinor,
    contingencyMinor,
    overrunMinor,
    isOverBudget,
    currencySymbol: CURRENCY_SYMBOLS[currency] || '₹',
    currencyCode: currency,
  };
}

/**
 * Calculates per-guest scalable cost for an individual item based on guest count.
 */
export function calculateScalableItemCost(
  item: BudgetItem,
  guestCount: number
): number {
  if (!item.isScalableWithGuests) {
    return item.fixedCostMinor || item.estimatedMinor || 0;
  }
  const variable = Math.max(0, guestCount) * Math.max(0, item.costPerGuestMinor || 0);
  return Math.round((item.fixedCostMinor || 0) + variable);
}
