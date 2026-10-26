'use client';

import React from 'react';
import { EventState, EventType } from '@/types/event';
import {
  Sparkles,
  Waves,
  PlusCircle,
  RotateCcw,
  Download,
  Bot,
  Heart,
  Cake,
  Users,
  ChevronDown,
} from 'lucide-react';

interface NavbarProps {
  events: EventState[];
  activeEvent: EventState;
  onSelectEvent: (id: string) => void;
  onOpenCreateModal: () => void;
  onOpenRippleDrawer: () => void;
  onOpenAiAssistant: () => void;
  onOpenImportExport: () => void;
  onResetDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  events,
  activeEvent,
  onSelectEvent,
  onOpenCreateModal,
  onOpenRippleDrawer,
  onOpenAiAssistant,
  onOpenImportExport,
  onResetDemo,
}) => {
  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'wedding':
        return <Heart className="w-4 h-4 text-rose-500 inline mr-1.5" />;
      case 'birthday':
        return <Cake className="w-4 h-4 text-amber-500 inline mr-1.5" />;
      case 'community':
        return <Users className="w-4 h-4 text-indigo-500 inline mr-1.5" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-festive-glow text-white font-bold text-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-700 bg-clip-text text-transparent">
                  UtsavPilot
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  GenAI Co-Pilot
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                Celebration Orchestration with Event Ripple Engine
              </p>
            </div>
          </div>

          {/* Event Switcher Selector */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                id="event-selector"
                value={activeEvent.id}
                onChange={(e) => onSelectEvent(e.target.value)}
                className="appearance-none bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-lg py-2 pl-3 pr-8 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 cursor-pointer max-w-[200px] sm:max-w-[280px] truncate"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.type.toUpperCase()}: {ev.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
            </div>

            <button
              id="new-event-btn"
              onClick={onOpenCreateModal}
              title="Create New Event with AI"
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold py-2 px-3 rounded-lg shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">New Event</span>
            </button>
          </div>

          {/* Differentiator & Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Signature Feature: Ripple Engine Trigger */}
            <button
              id="ripple-engine-trigger-btn"
              onClick={onOpenRippleDrawer}
              className="relative inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-bold text-xs sm:text-sm py-2 px-3 sm:px-4 rounded-lg shadow-festive-glow transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Waves className="w-4 h-4 animate-festive-pulse" />
              <span>Ripple Engine</span>
              <span className="hidden md:inline-flex bg-white/20 text-[10px] px-1.5 py-0.2 rounded-md font-mono">
                Differentiator
              </span>
            </button>

            {/* AI Assistant Chat */}
            <button
              id="ai-assistant-trigger-btn"
              onClick={onOpenAiAssistant}
              title="Ask UtsavPilot AI Co-Pilot"
              className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs sm:text-sm py-2 px-3 rounded-lg transition-colors"
            >
              <Bot className="w-4 h-4 text-indigo-600" />
              <span className="hidden lg:inline">AI Advice</span>
            </button>

            {/* Demo Data Reset */}
            <button
              id="reset-demo-btn"
              onClick={onResetDemo}
              title="Reset to Pristine Demo Events"
              className="inline-flex items-center p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Import / Export JSON */}
            <button
              id="import-export-btn"
              onClick={onOpenImportExport}
              title="Import or Export Event JSON"
              className="inline-flex items-center p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
