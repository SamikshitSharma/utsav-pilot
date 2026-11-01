'use client';

import React from 'react';
import { EventState } from '@/types/event';
import { formatCurrency } from '@/lib/budget-math';
import {
  Calendar,
  MapPin,
  Users,
  Wallet,
  Sparkles,
  Waves,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Tag,
} from 'lucide-react';

interface EventHeaderProps {
  event: EventState;
  onOpenRippleDrawer?: () => void;
}

export const EventHeader: React.FC<EventHeaderProps> = ({ event }) => {
  // Calculate days remaining
  const eventDate = new Date(event.date);
  const now = new Date();
  const diffTime = eventDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const capacityRatio = event.venueCapacity > 0 ? (event.guestCount / event.venueCapacity) * 100 : 0;
  const isOverCapacity = event.guestCount > event.venueCapacity;

  const getTypeBadge = () => {
    switch (event.type) {
      case 'wedding':
        return (
          <span className="bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            💍 Wedding Celebration
          </span>
        );
      case 'birthday':
        return (
          <span className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            🎂 Birthday Milestone
          </span>
        );
      case 'community':
        return (
          <span className="bg-indigo-100 text-indigo-800 border border-indigo-300 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
            🎉 Community Cultural Event
          </span>
        );
    }
  };

  return (
    <div className="bg-gradient-to-br from-white via-amber-50/30 to-rose-50/20 border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Main Details */}
        <div className="space-y-3 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            {getTypeBadge()}
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              ID: {event.id}
            </span>
            <span
              suppressHydrationWarning
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                diffDays < 0
                  ? 'bg-slate-200 text-slate-700'
                  : diffDays < 14
                  ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              {diffDays < 0
                ? 'Event Passed'
                : diffDays === 0
                ? 'Today!'
                : `${diffDays} Days Away`}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {event.title}
          </h1>

          <p className="text-slate-600 text-sm leading-relaxed line-clamp-2">
            {event.brief}
          </p>

          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs font-medium text-slate-600 pt-1">
            <span className="inline-flex items-center gap-1 text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              {event.location}
            </span>
            <span className="inline-flex items-center gap-1 text-slate-700">
              <Tag className="w-3.5 h-3.5 text-amber-500" />
              Theme: <span className="font-semibold text-slate-900">{event.theme}</span>
            </span>
            {event.dietaryNeeds?.length > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 text-slate-600">
                🥗 {event.dietaryNeeds.slice(0, 2).join(', ')}
                {event.dietaryNeeds.length > 2 ? ` +${event.dietaryNeeds.length - 2}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Right: Constraints KPI Cards & Ripple CTA */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[260px]">
          {/* Guest Capacity Gauge */}
          <div className="bg-white/80 p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-500 font-medium inline-flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                Attendees vs Capacity
              </span>
              <span
                className={`font-bold ${
                  isOverCapacity ? 'text-rose-600' : 'text-slate-800'
                }`}
              >
                {event.guestCount} / {event.venueCapacity}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isOverCapacity
                    ? 'bg-rose-500'
                    : capacityRatio > 85
                    ? 'bg-amber-500'
                    : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, capacityRatio)}%` }}
              />
            </div>
            {isOverCapacity && (
              <div className="text-[11px] text-rose-600 font-bold mt-1.5 inline-flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                Capacity exceeded by {event.guestCount - event.venueCapacity}!
              </div>
            )}
          </div>

          {/* Total Budget Card */}
          <div className="bg-white/80 p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs text-slate-500 font-medium mb-1 inline-flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-emerald-600" />
              Total Budget Limit ({event.contingencyPercent}% Buffer)
            </div>
            <div className="text-lg font-extrabold text-slate-900">
              {formatCurrency(event.totalBudgetMinor, event.currency)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
