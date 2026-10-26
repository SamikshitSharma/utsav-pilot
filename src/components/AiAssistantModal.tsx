'use client';

import React, { useState } from 'react';
import { EventState } from '@/types/event';
import {
  Bot,
  X,
  Send,
  Sparkles,
  Loader2,
  Lightbulb,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventState;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    provider: 'gemini' | 'simulation';
    modelUsed: string;
    isLive: boolean;
  };
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  event,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Namaste! I am your **UtsavPilot AI Co-Pilot**. I am grounded in your active plan for **${event.title}** (${event.guestCount} guests, ₹${(event.totalBudgetMinor / 100).toLocaleString('en-IN')} budget in ${event.location}). How can I assist you with cost-saving, theme ideas, or vendor questions today?`,
      metadata: {
        provider: 'gemini',
        modelUsed: 'gemini-3.5-flash',
        isLive: true,
      },
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const samplePrompts = [
    'How can I save ₹25,000 on catering without reducing headcount?',
    'What are 3 questions I should ask our decorator about fire permits?',
    'Suggest a crowd-pleasing dessert alternative for winter.',
  ];

  const handleSend = async (queryToSend?: string) => {
    const q = queryToSend || inputQuery;
    if (!q.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          eventState: event,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply,
            metadata: data.aiMetadata,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'I encountered an issue processing that query. Please try again or rephrase.',
          },
        ]);
      }
    } catch (err) {
      console.error('Error in chat assistant:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Network connection issue. Please check your network and try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-indigo-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">UtsavPilot AI Co-Pilot</h3>
              <p className="text-[11px] text-indigo-100 font-medium truncate max-w-[280px]">
                Grounded in &quot;{event.title}&quot;
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

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white rounded-tr-none'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none shadow-2xs'
                }`}
              >
                {msg.content}
                {msg.role === 'assistant' && msg.metadata && (
                  <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center gap-1.5 text-[10px] font-mono">
                    {msg.metadata.isLive ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                        ✨ Live {msg.metadata.modelUsed}
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded">
                        Offline Simulation
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-indigo-600 text-xs font-semibold p-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Gemini 3.8 Flash is reasoning over your event state...</span>
            </div>
          )}
        </div>

        {/* Suggested Prompts */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Quick Questions:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {samplePrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p)}
                disabled={isLoading}
                className="text-left text-[11px] bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-md transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Query Input */}
        <div className="p-3.5 bg-white border-t border-slate-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask advice, budget cuts, or trade-offs..."
              className="flex-1 text-xs sm:text-sm border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={isLoading || !inputQuery.trim()}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition-colors shrink-0 shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
