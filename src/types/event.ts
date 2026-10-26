import { z } from 'zod';

export type EventType = 'wedding' | 'birthday' | 'community';

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export type BudgetItemSource = 'ai_estimate' | 'user_defined' | 'vendor_quote';
export type BudgetItemPriority = 'must_have' | 'nice_to_have' | 'optional';

export interface BudgetItem {
  id: string;
  category: string;
  name: string;
  estimatedMinor: number; // in minor units (e.g. paise / cents)
  confirmedMinor: number; // 0 if unconfirmed
  paidMinor: number;      // amount already paid
  source: BudgetItemSource;
  isScalableWithGuests: boolean;
  costPerGuestMinor: number; // minor units per head
  fixedCostMinor: number;    // base fixed cost
  priority: BudgetItemPriority;
  notes?: string;
}

export interface BudgetSummary {
  totalBudgetMinor: number;
  allocatedMinor: number;
  estimatedMinor: number;
  confirmedMinor: number;
  paidMinor: number;
  committedMinor: number;
  remainingMinor: number;
  contingencyMinor: number;
  overrunMinor: number;
  isOverBudget: boolean;
  currencySymbol: string;
  currencyCode: CurrencyCode;
}

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  category: string;
  dueDate: string; // ISO date YYYY-MM-DD
  dueOffsetDays: number; // relative to event date (e.g. -45 = 45 days prior)
  priority: TaskPriority;
  status: TaskStatus;
  owner: string;
  prerequisiteTaskIds: string[];
  notes?: string;
  aiGenerated: boolean;
}

export type VendorStatus = 'inquired' | 'quoted' | 'shortlisted' | 'booked' | 'rejected';

export interface Vendor {
  id: string;
  category: string;
  name: string;
  quoteMinor: number;
  depositPaidMinor: number;
  balanceDueMinor: number;
  status: VendorStatus;
  inclusions: string[];
  notes?: string;
  contactEmail?: string;
  contactPhone?: string;
  isSampleData: boolean; // Must always be true for mock/demo vendors
}

export type IdeaCategory = 'theme' | 'decor' | 'menu' | 'entertainment' | 'activity' | 'cost_saving';

export interface IdeaRecommendation {
  id: string;
  category: IdeaCategory;
  title: string;
  description: string;
  reasoning: string;
  tradeOffs: string;
  estimatedSavingsOrCostMinor?: number;
}

export interface EventState {
  id: string;
  title: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  location: string;
  guestCount: number;
  venueCapacity: number;
  totalBudgetMinor: number;
  contingencyPercent: number; // e.g. 10 for 10%
  currency: CurrencyCode;
  theme: string;
  dietaryNeeds: string[];
  accessibilityNeeds: string[];
  brief: string;
  budgetItems: BudgetItem[];
  tasks: Task[];
  vendors: Vendor[];
  ideas: IdeaRecommendation[];
  createdAt: string;
  updatedAt: string;
}

// Zod schemas for runtime validation of persistent/imported event data
export const BudgetItemSchema = z.object({
  id: z.string().default(() => `bud-${Date.now()}`),
  category: z.string().default('General'),
  name: z.string(),
  estimatedMinor: z.number().int().nonnegative().default(0),
  confirmedMinor: z.number().int().nonnegative().default(0),
  paidMinor: z.number().int().nonnegative().default(0),
  source: z.enum(['ai_estimate', 'user_defined', 'vendor_quote']).default('user_defined'),
  isScalableWithGuests: z.boolean().default(false),
  costPerGuestMinor: z.number().int().nonnegative().default(0),
  fixedCostMinor: z.number().int().nonnegative().default(0),
  priority: z.enum(['must_have', 'nice_to_have', 'optional']).default('must_have'),
  notes: z.string().optional(),
});

export const TaskSchema = z.object({
  id: z.string().default(() => `task-${Date.now()}`),
  title: z.string(),
  category: z.string().default('General'),
  dueDate: z.string(),
  dueOffsetDays: z.number().int().default(0),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  status: z.enum(['todo', 'in_progress', 'completed']).default('todo'),
  owner: z.string().default('Organizer'),
  prerequisiteTaskIds: z.array(z.string()).default([]),
  notes: z.string().optional(),
  aiGenerated: z.boolean().default(false),
});

export const VendorSchema = z.object({
  id: z.string().default(() => `ven-${Date.now()}`),
  category: z.string().default('General'),
  name: z.string(),
  quoteMinor: z.number().int().nonnegative().default(0),
  depositPaidMinor: z.number().int().nonnegative().default(0),
  balanceDueMinor: z.number().int().nonnegative().default(0),
  status: z.enum(['inquired', 'quoted', 'shortlisted', 'booked', 'rejected']).default('quoted'),
  inclusions: z.array(z.string()).default([]),
  notes: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  isSampleData: z.boolean().default(true),
});

export const IdeaRecommendationSchema = z.object({
  id: z.string().default(() => `idea-${Date.now()}`),
  category: z.enum(['theme', 'decor', 'menu', 'entertainment', 'activity', 'cost_saving']),
  title: z.string(),
  description: z.string(),
  reasoning: z.string(),
  tradeOffs: z.string(),
  estimatedSavingsOrCostMinor: z.number().int().optional(),
});

export const EventStateSchema = z.object({
  id: z.string().default(() => `ev-${Date.now()}`),
  title: z.string().min(1, 'Event title is required'),
  type: z.enum(['wedding', 'birthday', 'community']),
  date: z.string().min(1, 'Event date is required'),
  location: z.string().default('TBD'),
  guestCount: z.number().int().positive().default(50),
  venueCapacity: z.number().int().positive().default(100),
  totalBudgetMinor: z.number().int().nonnegative().default(0),
  contingencyPercent: z.number().min(0).max(50).default(10),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).default('INR'),
  theme: z.string().default('Celebration'),
  dietaryNeeds: z.array(z.string()).default([]),
  accessibilityNeeds: z.array(z.string()).default([]),
  brief: z.string().default(''),
  budgetItems: z.array(BudgetItemSchema).default([]),
  tasks: z.array(TaskSchema).default([]),
  vendors: z.array(VendorSchema).default([]),
  ideas: z.array(IdeaRecommendationSchema).default([]),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export interface ConflictAlert {
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  code: 'VENUE_CAPACITY_EXCEEDED' | 'BUDGET_OVERRUN' | 'IMPOSSIBLE_DEADLINE' | 'UNRESOLVED_PREREQUISITE' | 'PAYMENT_PENDING';
  message: string;
  details?: string;
}

export interface RippleImpactReport {
  triggerField: 'guestCount' | 'totalBudget' | 'date' | 'venueCapacity' | 'venueRequirements';
  oldValue: string | number;
  newValue: string | number;
  facts: string[];
  conflicts: ConflictAlert[];
  budgetImpact: {
    previousEstimatedMinor: number;
    newEstimatedMinor: number;
    deltaMinor: number;
    overrunMinor: number;
    affectedItems: Array<{
      id: string;
      name: string;
      oldCostMinor: number;
      newCostMinor: number;
      reason: string;
    }>;
  };
  taskImpact: {
    affectedTasks: Array<{
      id: string;
      title: string;
      oldDueDate: string;
      newDueDate: string;
      isViolated: boolean;
      reason: string;
    }>;
  };
  vendorImpact: {
    recommendations: string[];
  };
  aiTradeOffs: Array<{
    title: string;
    description: string;
    estimatedSavingsMinor: number;
    tradeOff: string;
  }>;
  pendingPatches: {
    guestCount?: number;
    totalBudgetMinor?: number;
    date?: string;
    venueCapacity?: number;
    budgetItems?: BudgetItem[];
    tasks?: Task[];
  };
}
