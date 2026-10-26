import { describe, it, expect } from 'vitest';
import { calculateBudgetSummary, formatCurrency, calculateScalableItemCost } from '../src/lib/budget-math';
import { BudgetItem } from '../src/types/event';

describe('Budget Math & Minor Currency Units', () => {
  it('formats minor currency units properly in INR with Indian numbering', () => {
    // 18,00,000 INR = 180,000,000 paise
    expect(formatCurrency(180000000, 'INR')).toBe('₹18,00,000');
    // 45,000 INR = 4,500,000 paise
    expect(formatCurrency(4500000, 'INR')).toBe('₹45,000');
    // Zero
    expect(formatCurrency(0, 'INR')).toBe('₹0');
  });

  it('calculates allocated, remaining, contingency and detects overruns deterministically', () => {
    const items: BudgetItem[] = [
      {
        id: '1',
        category: 'Venue',
        name: 'Palace Hall',
        estimatedMinor: 40000000, // ₹4,00,000
        confirmedMinor: 40000000,
        paidMinor: 15000000,
        source: 'vendor_quote',
        isScalableWithGuests: false,
        costPerGuestMinor: 0,
        fixedCostMinor: 40000000,
        priority: 'must_have',
      },
      {
        id: '2',
        category: 'Food',
        name: 'Dinner Buffet',
        estimatedMinor: 30000000, // ₹3,00,000
        confirmedMinor: 0,
        paidMinor: 0,
        source: 'ai_estimate',
        isScalableWithGuests: true,
        costPerGuestMinor: 120000,
        fixedCostMinor: 0,
        priority: 'must_have',
      },
    ];

    const totalBudget = 100000000; // ₹10,00,000
    const contingencyPct = 10; // 10% = ₹1,00,000

    const summary = calculateBudgetSummary(items, totalBudget, contingencyPct, 'INR');

    // Allocated = 4,00,000 (confirmed) + 3,00,000 (estimated) = 7,00,000 (70,000,000 minor)
    expect(summary.allocatedMinor).toBe(70000000);
    // Contingency = 10% of 10,00,000 = 1,00,000 (10,000,000 minor)
    expect(summary.contingencyMinor).toBe(10000000);
    // Total commitment = 70,00,000 + 10,00,000 = 80,00,000 (80,000,000 minor)
    // Remaining = 10,00,000 - 8,00,000 = 2,00,000 (20,000,000 minor)
    expect(summary.remainingMinor).toBe(20000000);
    expect(summary.overrunMinor).toBe(0);
    expect(summary.isOverBudget).toBe(false);
  });

  it('correctly flags budget overruns when commitments exceed budget', () => {
    const items: BudgetItem[] = [
      {
        id: '1',
        category: 'Venue',
        name: 'Luxury Resort',
        estimatedMinor: 95000000, // ₹9,50,000
        confirmedMinor: 95000000,
        paidMinor: 50000000,
        source: 'vendor_quote',
        isScalableWithGuests: false,
        costPerGuestMinor: 0,
        fixedCostMinor: 95000000,
        priority: 'must_have',
      },
    ];

    const totalBudget = 100000000; // ₹10,00,000
    const contingencyPct = 10; // 10% = ₹1,00,000

    // Total commitment = 9,50,000 + 1,00,000 = 10,50,000
    // Overrun = 50,000 (5,000,000 minor)
    const summary = calculateBudgetSummary(items, totalBudget, contingencyPct, 'INR');
    expect(summary.overrunMinor).toBe(5000000);
    expect(summary.remainingMinor).toBe(0);
    expect(summary.isOverBudget).toBe(true);
  });

  it('scales per-guest item costs accurately without float drift', () => {
    const item: BudgetItem = {
      id: 'food',
      category: 'Food',
      name: 'Plate Service',
      estimatedMinor: 10000000,
      confirmedMinor: 0,
      paidMinor: 0,
      source: 'ai_estimate',
      isScalableWithGuests: true,
      costPerGuestMinor: 125000, // ₹1,250 per guest
      fixedCostMinor: 500000,    // ₹5,000 base
      priority: 'must_have',
    };

    // 250 guests * 125000 + 500000 = 31250000 + 500000 = 31750000 (₹3,17,500)
    expect(calculateScalableItemCost(item, 250)).toBe(31750000);
    // 0 guests should only equal fixed cost
    expect(calculateScalableItemCost(item, 0)).toBe(500000);
  });

  it('formats international currencies (USD, EUR, GBP) correctly', () => {
    // 2,500 USD = 250,000 cents
    expect(formatCurrency(250000, 'USD')).toBe('$2,500');
    // 1,200 EUR = 120,000 cents
    expect(formatCurrency(120000, 'EUR')).toBe('€1,200');
    // 850 GBP = 85,000 pence
    expect(formatCurrency(85000, 'GBP')).toBe('£850');
  });

  it('handles multi-crore budgets without integer precision degradation', () => {
    // ₹50 Crores = 50,00,00,000 INR = 50,00,00,00,000 paise (5 * 10^10)
    const largeBudgetPaise = 50000000000;
    const formatted = formatCurrency(largeBudgetPaise, 'INR');
    expect(formatted).toBe('₹50,00,00,000');

    const item: BudgetItem = {
      id: 'mega-venue',
      category: 'Venue',
      name: 'Island Resort Full Buyout',
      estimatedMinor: 20000000000, // ₹20 Crores
      confirmedMinor: 20000000000,
      paidMinor: 5000000000,
      source: 'vendor_quote',
      isScalableWithGuests: false,
      costPerGuestMinor: 0,
      fixedCostMinor: 20000000000,
      priority: 'must_have',
    };

    const summary = calculateBudgetSummary([item], largeBudgetPaise, 10, 'INR');
    // Allocated = 20 Cr (20,000,000,000)
    expect(summary.allocatedMinor).toBe(20000000000);
    // Contingency = 10% of 50 Cr = 5 Cr (5,000,000,000)
    expect(summary.contingencyMinor).toBe(5000000000);
    // Committed = 25 Cr (25,000,000,000)
    expect(summary.committedMinor).toBe(25000000000);
    // Remaining = 25 Cr (25,000,000,000)
    expect(summary.remainingMinor).toBe(25000000000);
    expect(summary.isOverBudget).toBe(false);
  });

  it('handles zero budget cap with immediate overrun detection', () => {
    const item: BudgetItem = {
      id: 'any-item',
      category: 'Misc',
      name: 'Setup Fee',
      estimatedMinor: 100000, // ₹1,000
      confirmedMinor: 100000,
      paidMinor: 0,
      source: 'user_defined',
      isScalableWithGuests: false,
      costPerGuestMinor: 0,
      fixedCostMinor: 100000,
      priority: 'must_have',
    };

    const summary = calculateBudgetSummary([item], 0, 10, 'INR');
    expect(summary.isOverBudget).toBe(true);
    expect(summary.overrunMinor).toBe(100000);
    expect(summary.remainingMinor).toBe(0);
  });
});
