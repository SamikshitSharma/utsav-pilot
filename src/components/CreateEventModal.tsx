'use client';

import React, { useState } from 'react';
import { EventState, EventType, CurrencyCode } from '@/types/event';
import { addDaysToIsoDate } from '@/lib/ripple-engine';
import {
  Sparkles,
  X,
  Heart,
  Cake,
  Users,
  Calendar,
  MapPin,
  Wallet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Tag,
  ShieldCheck,
} from 'lucide-react';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated: (
    event: EventState,
    aiMetadata?: { provider: string; modelUsed: string; isLive: boolean }
  ) => void;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onEventCreated,
}) => {
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingPhase, setLoadingPhase] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Form Fields
  const [eventType, setEventType] = useState<EventType>('wedding');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('2026-12-20');
  const [location, setLocation] = useState('Jaipur Heritage Lawn');
  const [guestCount, setGuestCount] = useState<number>(200);
  const [venueCapacity, setVenueCapacity] = useState<number>(250);
  const [totalBudgetMajor, setTotalBudgetMajor] = useState<number>(1500000); // ₹15,00,000
  const [contingencyPercent, setContingencyPercent] = useState<number>(10);
  const [theme, setTheme] = useState('Royal Rajputana Minimalist');
  const [dietaryInput, setDietaryInput] = useState('Vegetarian, Jain counter');
  const [accessibilityInput, setAccessibilityInput] = useState('Wheelchair ramps, Elder seating');
  const [brief, setBrief] = useState(
    'A warm cultural wedding celebration with close family. High priority on outstanding regional cuisine and live music, while keeping strict control over decor and favor expenses.'
  );

  const handleTypeSelect = (type: EventType) => {
    setEventType(type);
    if (type === 'wedding') {
      setTitle("Kabir & Ananya's Royal Celebration");
      setLocation('Jaipur Heritage Lawn');
      setTheme('Royal Rajputana Minimalist');
      setGuestCount(200);
      setVenueCapacity(250);
      setTotalBudgetMajor(1500000);
      setBrief(
        'A warm cultural wedding celebration with close family. High priority on outstanding regional cuisine and live music, while keeping strict control over decor and favor expenses.'
      );
    } else if (type === 'birthday') {
      setTitle("Vihaan's 5th Superhero Galactic Quest");
      setLocation('Koramangala Community Play Center, Bengaluru');
      setTheme('Superhero Space Academy');
      setGuestCount(40);
      setVenueCapacity(50);
      setTotalBudgetMajor(40000);
      setBrief(
        'Interactive 5th birthday party with hands-on craft games, costume parade, custom cake, and healthy kids snacks on an economical budget.'
      );
    } else {
      setTitle('Silver Oaks Annual Dandiya & Cultural Mela');
      setLocation('Silver Oaks Society Lawns, Ahmedabad');
      setTheme('Navratri Radiance & Folk Rhythm');
      setGuestCount(350);
      setVenueCapacity(400);
      setTotalBudgetMajor(200000);
      setBrief(
        'Non-profit housing society festive mela. Live folk music rig, community food stalls, trophy awards, and volunteer crowd safety.'
      );
    }
  };

  const handleGeneratePlan = async () => {
    setIsLoading(true);
    setErrorMsg('');
    setLoadingPhase('Connecting to Gemini 3.8 Flash model...');

    try {
      setLoadingPhase('Synthesizing budget line items & per-head cost rates...');

      const response = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          type: eventType,
          date,
          location,
          guestCount,
          totalBudgetMinor: Math.round(totalBudgetMajor * 100),
          contingencyPercent,
          theme,
          dietaryNeeds: dietaryInput.split(',').map((s) => s.trim()).filter(Boolean),
          accessibilityNeeds: accessibilityInput.split(',').map((s) => s.trim()).filter(Boolean),
          brief,
        }),
      });

      setLoadingPhase('Validating typed Zod schemas and mathematical constraints...');

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate plan');
      }

      const plan = data.plan;

      // Construct EventState
      const newEvent: EventState = {
        id: `ev-${Date.now()}`,
        title,
        type: eventType,
        date,
        location,
        guestCount,
        venueCapacity,
        totalBudgetMinor: Math.round(totalBudgetMajor * 100),
        contingencyPercent,
        currency: 'INR',
        theme,
        dietaryNeeds: dietaryInput.split(',').map((s) => s.trim()).filter(Boolean),
        accessibilityNeeds: accessibilityInput.split(',').map((s) => s.trim()).filter(Boolean),
        brief,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        budgetItems: plan.budgetItems.map((item: any, idx: number) => ({
          ...item,
          id: `item-${Date.now()}-${idx}`,
          confirmedMinor: 0,
          paidMinor: 0,
          source: 'ai_estimate',
        })),
        tasks: plan.tasks.map((task: any, idx: number) => ({
          ...task,
          id: `task-${Date.now()}-${idx}`,
          dueDate: addDaysToIsoDate(date, task.dueOffsetDays || 0),
          status: 'todo',
          prerequisiteTaskIds: [],
          aiGenerated: true,
        })),
        vendors: plan.vendors.map((v: any, idx: number) => ({
          ...v,
          id: `ven-${Date.now()}-${idx}`,
          depositPaidMinor: 0,
          balanceDueMinor: v.quoteMinor,
          status: 'quoted',
          isSampleData: true,
        })),
        ideas: plan.ideas.map((idea: any, idx: number) => ({
          ...idea,
          id: `idea-${Date.now()}-${idx}`,
        })),
      };

      onEventCreated(newEvent, data.aiMetadata);
      onClose();
    } catch (err: any) {
      console.error('Error in plan generation:', err);
      setErrorMsg(err.message || 'Plan generation failed. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingPhase('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-900">Create New Celebration</h3>
              <p className="text-xs text-slate-500">
                Powered by Gemini 3.8 Flash & Deterministic Financial Logic
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800">
            {errorMsg}
          </div>
        )}

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6 text-xs font-bold text-slate-400">
          <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-amber-600' : ''}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[11px]">
              1
            </span>
            <span>Event Basics</span>
          </div>
          <div className="w-12 h-0.5 bg-slate-200" />
          <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-amber-600' : ''}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[11px]">
              2
            </span>
            <span>Scale & Budget</span>
          </div>
          <div className="w-12 h-0.5 bg-slate-200" />
          <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-amber-600' : ''}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[11px]">
              3
            </span>
            <span>Vision & Brief</span>
          </div>
        </div>

        {/* STEP 1: Event Type & Basics */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Select Event Type *
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleTypeSelect('wedding')}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    eventType === 'wedding'
                      ? 'border-rose-500 bg-rose-50/70 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Heart
                    className={`w-6 h-6 mb-2 ${
                      eventType === 'wedding' ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">Wedding</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Multi-day rituals</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeSelect('birthday')}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    eventType === 'birthday'
                      ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Cake
                    className={`w-6 h-6 mb-2 ${
                      eventType === 'birthday' ? 'text-amber-600' : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">Birthday</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Games & theme cake</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeSelect('community')}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    eventType === 'community'
                      ? 'border-indigo-500 bg-indigo-50/70 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Users
                    className={`w-6 h-6 mb-2 ${
                      eventType === 'community' ? 'text-indigo-600' : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">Community</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Festivals & melas</div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Event Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Aarav & Meera's Royal Wedding"
                className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" /> Event Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" /> Location / Venue *
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Jaipur, Bengaluru, Mumbai..."
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!title || !date || !location}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 px-6 rounded-xl transition-colors disabled:opacity-50"
              >
                <span>Continue to Constraints</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Scale, Venue Capacity & Budget */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expected Guests *
                </label>
                <input
                  type="number"
                  min="5"
                  value={guestCount}
                  onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Venue Maximum Capacity *
                </label>
                <input
                  type="number"
                  min="5"
                  value={venueCapacity}
                  onChange={(e) => setVenueCapacity(parseInt(e.target.value) || 1)}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Total Budget Limit (₹) *
                </label>
                <input
                  type="number"
                  step="5000"
                  min="1000"
                  value={totalBudgetMajor}
                  onChange={(e) => setTotalBudgetMajor(parseFloat(e.target.value) || 0)}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contingency Buffer (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={contingencyPercent}
                  onChange={(e) => setContingencyPercent(parseInt(e.target.value) || 0)}
                  className="w-full text-sm border border-slate-300 rounded-xl p-3 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Theme & Aesthetic Vision
              </label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g. Royal Marigold & Heritage Brass"
                className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-slate-600 font-semibold text-sm py-2 px-4 rounded-xl hover:bg-slate-100"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-2.5 px-6 rounded-xl transition-colors"
              >
                <span>Continue to Vision</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Natural Language Brief & Requirements */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Natural-Language Event Brief & Priorities *
              </label>
              <textarea
                rows={4}
                required
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Describe what matters most, what to prioritize, dietary preferences, or specific entertainment ideas..."
                className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-amber-500 focus:outline-hidden leading-relaxed"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                The Gemini model uses this unstructured context to customize tasks, vendor recommendations, and creative ideas.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dietary Needs (comma-separated)
                </label>
                <input
                  type="text"
                  value={dietaryInput}
                  onChange={(e) => setDietaryInput(e.target.value)}
                  placeholder="Vegetarian, Jain, Halal..."
                  className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Accessibility Needs
                </label>
                <input
                  type="text"
                  value={accessibilityInput}
                  onChange={(e) => setAccessibilityInput(e.target.value)}
                  placeholder="Wheelchair ramps, quiet zone..."
                  className="w-full text-xs border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Loading Indicator */}
            {isLoading && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-3 text-indigo-900 animate-pulse">
                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                <div className="text-xs font-bold">{loadingPhase}</div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 text-slate-600 font-semibold text-sm py-2 px-4 rounded-xl hover:bg-slate-100 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={isLoading || !brief}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-extrabold text-sm py-3 px-7 rounded-xl shadow-festive-glow transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Orchestrating Plan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate AI Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
