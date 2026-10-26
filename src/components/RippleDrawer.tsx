'use client';

import React, { useState, useEffect } from 'react';
import { EventState, RippleImpactReport, ConflictAlert } from '@/types/event';
import { analyzeRippleImpact, applyRipplePatch } from '@/lib/ripple-engine';
import { formatCurrency } from '@/lib/budget-math';
import {
  Waves,
  X,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Calendar,
  Users,
  Wallet,
  ShieldAlert,
  ShieldCheck,
  Check,
  RotateCcw,
  Zap,
} from 'lucide-react';

interface RippleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventState;
  onApplyPatches: (updatedEvent: EventState) => void;
}

export const RippleDrawer: React.FC<RippleDrawerProps> = ({
  isOpen,
  onClose,
  event,
  onApplyPatches,
}) => {
  // Live Simulation Inputs
  const [simGuestCount, setSimGuestCount] = useState<number>(event.guestCount);
  const [simBudgetMajor, setSimBudgetMajor] = useState<number>(event.totalBudgetMinor / 100);
  const [simDate, setSimDate] = useState<string>(event.date);
  const [simCapacity, setSimCapacity] = useState<number>(event.venueCapacity);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Sync with current event whenever drawer opens or active event changes
  useEffect(() => {
    setSimGuestCount(event.guestCount);
    setSimBudgetMajor(event.totalBudgetMinor / 100);
    setSimDate(event.date);
    setSimCapacity(event.venueCapacity);
  }, [event, isOpen]);

  // Compute live deterministic impact
  const report: RippleImpactReport = analyzeRippleImpact(event, {
    guestCount: simGuestCount,
    totalBudgetMinor: Math.round(simBudgetMajor * 100),
    date: simDate,
    venueCapacity: simCapacity,
  });

  const hasChanges =
    simGuestCount !== event.guestCount ||
    Math.round(simBudgetMajor * 100) !== event.totalBudgetMinor ||
    simDate !== event.date ||
    simCapacity !== event.venueCapacity;

  const handleReset = () => {
    setSimGuestCount(event.guestCount);
    setSimBudgetMajor(event.totalBudgetMinor / 100);
    setSimDate(event.date);
    setSimCapacity(event.venueCapacity);
  };

  const handleApplyChanges = () => {
    const updated = applyRipplePatch(event, report.pendingPatches);
    onApplyPatches(updated);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Waves className="w-5 h-5 text-white animate-festive-pulse" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white flex items-center gap-2">
                Event Ripple Engine
                <span className="bg-white/20 text-white text-[10px] font-mono px-1.5 py-0.5 rounded uppercase">
                  Signature AI
                </span>
              </h3>
              <p className="text-xs text-amber-100 font-medium">
                Change-Impact Propagation & Constraint Analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Simulation Controls Card */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" /> Adjust Key Constraints
              </span>
              {hasChanges && (
                <button
                  onClick={handleReset}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Reset to Original
                </button>
              )}
            </div>

            {/* 1. Guest Count Slider & Input */}
            <div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-800 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" /> Guest Count:
                </span>
                <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                  {simGuestCount} Guests
                </span>
              </div>
              <input
                type="range"
                min="10"
                max={Math.max(500, event.venueCapacity * 1.5)}
                step="5"
                value={simGuestCount}
                onChange={(e) => setSimGuestCount(parseInt(e.target.value) || 1)}
                className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>Original: {event.guestCount}</span>
                <span>Venue Max: {simCapacity}</span>
              </div>
            </div>

            {/* 2. Total Budget Input */}
            <div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-800 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-600" /> Total Budget (₹):
                </span>
                <span className="text-sm font-black text-emerald-700">
                  {formatCurrency(simBudgetMajor * 100, event.currency)}
                </span>
              </div>
              <input
                type="number"
                step="10000"
                value={simBudgetMajor}
                onChange={(e) => setSimBudgetMajor(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full text-sm font-bold border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>

            {/* 3. Event Date Picker */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-rose-500" /> Event Date:
                </label>
                <input
                  type="date"
                  value={simDate}
                  onChange={(e) => setSimDate(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Venue Capacity:
                </label>
                <input
                  type="number"
                  min="1"
                  value={simCapacity}
                  onChange={(e) => setSimCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Active Conflicts and Warnings */}
          {report.conflicts.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                <ShieldAlert className="w-4 h-4 text-rose-600" /> Detected Constraint Breaches ({report.conflicts.length})
              </h4>
              {report.conflicts.map((conflict, i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    conflict.type === 'CRITICAL'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      conflict.type === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'
                    }`}
                  />
                  <div>
                    <div className="font-bold text-xs sm:text-sm">{conflict.message}</div>
                    {conflict.details && (
                      <div className="text-xs opacity-90 mt-0.5">{conflict.details}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Verified Facts vs Estimates */}
          {report.facts.length > 0 && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" /> Verified Consequence Facts
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {report.facts.map((fact, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Affected Budget Line Items Diff */}
          {report.budgetImpact.affectedItems.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Scaled Budget Line Items ({report.budgetImpact.affectedItems.length})
                </h4>
                <span
                  className={`text-xs font-black px-2 py-0.5 rounded-md ${
                    report.budgetImpact.deltaMinor > 0
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  Net Delta: {report.budgetImpact.deltaMinor > 0 ? '+' : ''}
                  {formatCurrency(report.budgetImpact.deltaMinor, event.currency)}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs">
                {report.budgetImpact.affectedItems.map((item) => (
                  <div key={item.id} className="p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-center font-bold text-slate-900">
                      <span>{item.name}</span>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-slate-400 line-through">
                          {formatCurrency(item.oldCostMinor, event.currency)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-indigo-700 font-extrabold">
                          {formatCurrency(item.newCostMinor, event.currency)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected Milestones & Due Dates */}
          {report.taskImpact.affectedTasks.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Rescheduled Milestone Deadlines ({report.taskImpact.affectedTasks.length})
              </h4>
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden text-xs">
                {report.taskImpact.affectedTasks.map((task) => (
                  <div key={task.id} className="p-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-slate-900">{task.title}</span>
                      <div className="text-[11px] text-slate-500 mt-0.5">{task.reason}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-slate-400 line-through">
                        {task.oldDueDate}
                      </div>
                      <div
                        className={`text-xs font-bold ${
                          task.isViolated ? 'text-rose-600 font-extrabold' : 'text-indigo-600'
                        }`}
                      >
                        {task.newDueDate}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actionable AI-Proposed Trade-Offs */}
          {report.aiTradeOffs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" /> Actionable AI Trade-Off Alternatives
              </h4>
              {report.aiTradeOffs.map((tradeOff, idx) => (
                <div
                  key={idx}
                  className="bg-gradient-to-br from-amber-50/50 to-indigo-50/40 border border-amber-200/80 rounded-xl p-4 shadow-2xs space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="font-extrabold text-xs sm:text-sm text-slate-900">
                      {tradeOff.title}
                    </h5>
                    {tradeOff.estimatedSavingsMinor !== 0 && (
                      <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full shrink-0">
                        Saves ~{formatCurrency(tradeOff.estimatedSavingsMinor, event.currency)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {tradeOff.description}
                  </p>
                  <div className="text-[11px] text-amber-900/90 font-medium bg-white/70 p-2 rounded-lg border border-amber-100">
                    <span className="font-bold text-amber-800">Trade-Off:</span> {tradeOff.tradeOff}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancel / Discard
          </button>

          <button
            onClick={handleApplyChanges}
            disabled={!hasChanges}
            className={`inline-flex items-center gap-2 text-xs sm:text-sm font-bold py-2.5 px-5 rounded-xl transition-all shadow-xs ${
              hasChanges
                ? 'bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white cursor-pointer hover:scale-[1.01]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Accept & Apply Ripple Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
