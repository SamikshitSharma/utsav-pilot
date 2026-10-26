'use client';

import React, { useState } from 'react';
import { IdeaRecommendation, IdeaCategory, CurrencyCode, BudgetItem, Task } from '@/types/event';
import { formatCurrency } from '@/lib/budget-math';
import {
  Sparkles,
  Lightbulb,
  DollarSign,
  Utensils,
  Palette,
  Music,
  PartyPopper,
  PlusCircle,
  HelpCircle,
  CheckCircle,
} from 'lucide-react';

interface AiIdeasHubProps {
  ideas: IdeaRecommendation[];
  currency: CurrencyCode;
  onAddIdeaAsBudgetItem: (item: BudgetItem) => void;
  onAddIdeaAsTask: (task: Task) => void;
}

export const AiIdeasHub: React.FC<AiIdeasHubProps> = ({
  ideas,
  currency,
  onAddIdeaAsBudgetItem,
  onAddIdeaAsTask,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const categories: Array<{ id: string; label: string; icon: any }> = [
    { id: 'all', label: 'All Recommendations', icon: Sparkles },
    { id: 'cost_saving', label: 'Cost-Saving', icon: DollarSign },
    { id: 'decor', label: 'Decor & Ambience', icon: Palette },
    { id: 'menu', label: 'Menu & Dining', icon: Utensils },
    { id: 'entertainment', label: 'Entertainment', icon: Music },
    { id: 'activity', label: 'Activities', icon: PartyPopper },
  ];

  const filteredIdeas =
    activeCategory === 'all'
      ? ideas
      : ideas.filter((idea) => idea.category === activeCategory);

  const handleConvertIdea = (idea: IdeaRecommendation) => {
    // Convert to a budget line item or task
    if (idea.estimatedSavingsOrCostMinor && idea.estimatedSavingsOrCostMinor !== 0) {
      const budgetItem: BudgetItem = {
        id: `bud-${Date.now()}`,
        category: idea.category === 'decor' ? 'Decor & Floral' : idea.category === 'menu' ? 'Food & Beverage' : 'Entertainment & Music',
        name: idea.title,
        estimatedMinor: Math.abs(idea.estimatedSavingsOrCostMinor),
        confirmedMinor: 0,
        paidMinor: 0,
        source: 'ai_estimate',
        isScalableWithGuests: false,
        costPerGuestMinor: 0,
        fixedCostMinor: Math.abs(idea.estimatedSavingsOrCostMinor),
        priority: 'nice_to_have',
        notes: `AI Recommendation: ${idea.description}`,
      };
      onAddIdeaAsBudgetItem(budgetItem);
    } else {
      const task: Task = {
        id: `task-${Date.now()}`,
        title: `Implement: ${idea.title}`,
        category: 'AI Recommendation',
        dueDate: new Date().toISOString().split('T')[0],
        dueOffsetDays: -14,
        priority: 'medium',
        status: 'todo',
        owner: 'Lead Planner',
        prerequisiteTaskIds: [],
        notes: idea.description,
        aiGenerated: true,
      };
      onAddIdeaAsTask(task);
    }

    setAddedIds(new Set([...Array.from(addedIds), idea.id]));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            AI Co-Pilot Recommendations & Explainable Trade-Offs
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Grounded in your active event scale and budget. Every idea explicitly justifies its reasoning and consequences.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ideas Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredIdeas.map((idea) => {
          const isAdded = addedIds.has(idea.id);

          return (
            <div
              key={idea.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:border-amber-300 transition-all group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-md">
                    {idea.category.replace('_', ' ')}
                  </span>
                  {idea.estimatedSavingsOrCostMinor && idea.estimatedSavingsOrCostMinor < 0 && (
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      Saves ~{formatCurrency(Math.abs(idea.estimatedSavingsOrCostMinor), currency)}
                    </span>
                  )}
                </div>

                <h4 className="font-extrabold text-base text-slate-900 group-hover:text-amber-800 transition-colors">
                  {idea.title}
                </h4>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {idea.description}
                </p>

                {/* Reasoning Box */}
                <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-indigo-900 flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5 text-indigo-600" />
                    AI Reasoning & Grounding:
                  </div>
                  <p className="text-indigo-800/90 leading-relaxed">
                    {idea.reasoning}
                  </p>
                </div>

                {/* Trade-Off Box */}
                <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-amber-900 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                    Required Trade-Off:
                  </div>
                  <p className="text-amber-800/90 leading-relaxed">
                    {idea.tradeOffs}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 mt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => handleConvertIdea(idea)}
                  disabled={isAdded}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold py-2 px-3.5 rounded-lg transition-colors ${
                    isAdded
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-900 hover:bg-slate-800 text-white shadow-2xs'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Added to Plan</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Adopt Recommendation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
