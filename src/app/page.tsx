'use client';

import React, { useState, useEffect } from 'react';
import { EventState, BudgetItem, Task, Vendor } from '@/types/event';
import { DEMO_EVENTS } from '@/data/demo-events';
import {
  loadEventsFromStorage,
  saveEventsToStorage,
  loadActiveEventId,
  saveActiveEventId,
  resetStorageToDemo,
} from '@/lib/storage';
import { Navbar } from '@/components/Navbar';
import { EventHeader } from '@/components/EventHeader';
import { BudgetBoard } from '@/components/BudgetBoard';
import { TimelineChecklist } from '@/components/TimelineChecklist';
import { VendorTracker } from '@/components/VendorTracker';
import { AiIdeasHub } from '@/components/AiIdeasHub';
import { RippleDrawer } from '@/components/RippleDrawer';
import { CreateEventModal } from '@/components/CreateEventModal';
import { AiAssistantModal } from '@/components/AiAssistantModal';
import { ImportExportModal } from '@/components/ImportExportModal';
import {
  LayoutDashboard,
  Wallet,
  CheckSquare,
  Store,
  Sparkles,
  Waves,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export default function Home() {
  const [events, setEvents] = useState<EventState[]>(DEMO_EVENTS);
  const [activeEventId, setActiveEventId] = useState<string>(DEMO_EVENTS[0].id);
  const [activeTab, setActiveTab] = useState<'overview' | 'budget' | 'timeline' | 'vendors' | 'ideas'>('overview');

  // Modal / Drawer visibility states
  const [isRippleDrawerOpen, setIsRippleDrawerOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Hydrate from localStorage on client mount
  useEffect(() => {
    const loaded = loadEventsFromStorage();
    setEvents(loaded);
    const savedActiveId = loadActiveEventId();
    if (loaded.some((e) => e.id === savedActiveId)) {
      setActiveEventId(savedActiveId);
    } else if (loaded.length > 0) {
      setActiveEventId(loaded[0].id);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const activeEvent = events.find((e) => e.id === activeEventId) || events[0] || DEMO_EVENTS[0];

  const handleSelectEvent = (id: string) => {
    setActiveEventId(id);
    saveActiveEventId(id);
  };

  const handleUpdateActiveEvent = (updated: EventState) => {
    const updatedEvents = events.map((ev) => (ev.id === updated.id ? updated : ev));
    setEvents(updatedEvents);
    saveEventsToStorage(updatedEvents);
  };

  const handleResetDemo = () => {
    if (confirm('Reset celebration planner to pristine demonstration events? (This preserves sample data for judges)')) {
      const reset = resetStorageToDemo();
      setEvents(reset);
      setActiveEventId(reset[0].id);
      showToast('Successfully restored pristine demonstration events!');
    }
  };

  const handleEventCreated = (
    newEvent: EventState,
    aiMetadata?: { provider: string; modelUsed: string; isLive: boolean }
  ) => {
    const updatedEvents = [newEvent, ...events];
    setEvents(updatedEvents);
    setActiveEventId(newEvent.id);
    saveEventsToStorage(updatedEvents);
    saveActiveEventId(newEvent.id);
    const sourceLabel = aiMetadata?.isLive
      ? `Live Google Gemini (${aiMetadata.modelUsed})`
      : 'Deterministic Offline Synthesis';
    showToast(`Created & planned "${newEvent.title}" via ${sourceLabel}!`);
  };

  const handleImportEvent = (importedEvent: EventState) => {
    const updatedEvents = [importedEvent, ...events];
    setEvents(updatedEvents);
    setActiveEventId(importedEvent.id);
    saveEventsToStorage(updatedEvents);
    saveActiveEventId(importedEvent.id);
    showToast(`Successfully imported "${importedEvent.title}"!`);
  };

  const handleApplyRipplePatches = (updatedEvent: EventState) => {
    handleUpdateActiveEvent(updatedEvent);
    showToast('Event Ripple Engine changes approved and applied non-destructively!');
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-slate-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs sm:text-sm font-bold py-3 px-5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 animate-in slide-in-from-bottom duration-300">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        events={events}
        activeEvent={activeEvent}
        onSelectEvent={handleSelectEvent}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onOpenRippleDrawer={() => setIsRippleDrawerOpen(true)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onOpenImportExport={() => setIsImportExportOpen(true)}
        onResetDemo={handleResetDemo}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Event Header Banner with Countdown and Constraints */}
        <EventHeader
          event={activeEvent}
          onOpenRippleDrawer={() => setIsRippleDrawerOpen(true)}
        />

        {/* Primary Navigation Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto gap-2 text-xs sm:text-sm font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-3 inline-flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Workspace Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('budget')}
            className={`pb-3 px-3 inline-flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'budget'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Budget Management ({activeEvent.budgetItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-3 px-3 inline-flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Timeline & Checklist ({activeEvent.tasks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className={`pb-3 px-3 inline-flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'vendors'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Vendor Tracker ({activeEvent.vendors.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ideas')}
            className={`pb-3 px-3 inline-flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'ideas'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI Co-Pilot Ideas ({activeEvent.ideas.length})</span>
          </button>
        </div>

        {/* Tab Content Views */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Signature Feature Banner */}
            <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white rounded-2xl p-6 shadow-festive-glow flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-1.5 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase">
                  <Waves className="w-3.5 h-3.5 animate-festive-pulse" />
                  <span>Signature Differentiator</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black">
                  Experience the Event Ripple Engine
                </h3>
                <p className="text-xs sm:text-sm text-amber-100 leading-relaxed">
                  Test what happens when guest count scales from 250 to 320, budget shrinks, or deadlines compress. The engine detects physical capacity violations, mathematically reschedules scalable catering, and delivers AI-crafted trade-offs for 1-click approval.
                </p>
              </div>

              <button
                onClick={() => setIsRippleDrawerOpen(true)}
                className="inline-flex items-center justify-center gap-2 bg-white text-slate-900 hover:bg-amber-50 font-black text-sm py-3 px-6 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 shrink-0"
              >
                <Zap className="w-4 h-4 text-amber-600" />
                <span>Launch Ripple Simulation</span>
              </button>
            </div>

            {/* Quick Two-Column View: Budget Health & Upcoming Milestones */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    Financial Health Snapshot
                  </h3>
                  <button
                    onClick={() => setActiveTab('budget')}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700"
                  >
                    View All Items →
                  </button>
                </div>
                <BudgetBoard
                  event={activeEvent}
                  onUpdateBudgetItems={(items) =>
                    handleUpdateActiveEvent({ ...activeEvent, budgetItems: items })
                  }
                  onUpdateContingency={(contingencyPercent) =>
                    handleUpdateActiveEvent({ ...activeEvent, contingencyPercent })
                  }
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                    Milestones & Checklist
                  </h3>
                  <button
                    onClick={() => setActiveTab('timeline')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    View Full Schedule →
                  </button>
                </div>
                <TimelineChecklist
                  tasks={activeEvent.tasks}
                  eventDate={activeEvent.date}
                  onUpdateTasks={(tasks) =>
                    handleUpdateActiveEvent({ ...activeEvent, tasks })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <BudgetBoard
            event={activeEvent}
            onUpdateBudgetItems={(items) =>
              handleUpdateActiveEvent({ ...activeEvent, budgetItems: items })
            }
            onUpdateContingency={(contingencyPercent) =>
              handleUpdateActiveEvent({ ...activeEvent, contingencyPercent })
            }
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineChecklist
            tasks={activeEvent.tasks}
            eventDate={activeEvent.date}
            onUpdateTasks={(tasks) =>
              handleUpdateActiveEvent({ ...activeEvent, tasks })
            }
          />
        )}

        {activeTab === 'vendors' && (
          <VendorTracker
            vendors={activeEvent.vendors}
            currency={activeEvent.currency}
            onUpdateVendors={(vendors) =>
              handleUpdateActiveEvent({ ...activeEvent, vendors })
            }
          />
        )}

        {activeTab === 'ideas' && (
          <AiIdeasHub
            ideas={activeEvent.ideas}
            currency={activeEvent.currency}
            onAddIdeaAsBudgetItem={(item) =>
              handleUpdateActiveEvent({
                ...activeEvent,
                budgetItems: [...activeEvent.budgetItems, item],
              })
            }
            onAddIdeaAsTask={(task) =>
              handleUpdateActiveEvent({
                ...activeEvent,
                tasks: [...activeEvent.tasks, task],
              })
            }
          />
        )}
      </main>

      {/* Signature Event Ripple Engine Drawer */}
      <RippleDrawer
        isOpen={isRippleDrawerOpen}
        onClose={() => setIsRippleDrawerOpen(false)}
        event={activeEvent}
        onApplyPatches={handleApplyRipplePatches}
      />

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onEventCreated={handleEventCreated}
      />

      {/* AI Assistant Chat Modal */}
      <AiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        event={activeEvent}
      />

      {/* Import / Export JSON Modal */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        activeEvent={activeEvent}
        allEvents={events}
        onImportEvent={handleImportEvent}
      />
    </div>
  );
}
