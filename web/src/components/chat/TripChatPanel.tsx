import { useState, useRef, useEffect } from 'react';
import type { Journey } from '../../data/mockData';
import { sendTripMessage, type TripChatResponse } from '../../lib/chatApi';
import { useApp } from '../../store/AppContext';
import { SafeMarkdown } from './SafeMarkdown';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  answerType?: string;
  isEditProposal?: boolean;
}

const STATIC_SUGGESTED_PROMPTS = [
  'Summarize my trip',
  "What's planned for Day 2?",
  'Explain my estimated budget',
];

interface TripChatPanelProps {
  journey: Journey;
  onClose: () => void;
  isInline?: boolean;
}

export default function TripChatPanel({
  journey,
  onClose,
  isInline = false,
}: TripChatPanelProps) {
  const { openTravelAssistant } = useApp();

  // Backend does not expose a GET conversation history endpoint, so the panel
  // starts fresh each session and preserves conversationId in state across follow-up messages.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [failedMessageText, setFailedMessageText] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Remember active element to return focus on close
  useEffect(() => {
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    return () => {
      previousActiveElementRef.current?.focus();
    };
  }, []);

  // Escape key handler
  useEffect(() => {
    if (isInline) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInline, onClose]);

  // Auto-scroll on new message or loading state
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, inlineError]);

  const handleSend = async (textToSend: string, isRetry = false) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    setInlineError(null);

    let updatedMessages = messages;
    if (!isRetry) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'user',
        content: trimmed,
      };
      updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput('');
    }

    setLoading(true);
    setFailedMessageText(null);

    try {
      const res: TripChatResponse = await sendTripMessage(journey.id, trimmed, conversationId);

      if (res.conversationId) {
        setConversationId(res.conversationId);
      }

      const isEditProposal = Boolean(res.answerType === 'edit' || res.editId);

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: res.reply || 'Here is the information from your trip plan.',
        answerType: res.answerType,
        isEditProposal,
      };

      setMessages([...updatedMessages, assistantMsg]);
    } catch (err: any) {
      setInlineError(err.message || 'Unable to get response. Please try again.');
      setFailedMessageText(trimmed);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleRetry = () => {
    if (failedMessageText) {
      handleSend(failedMessageText, true);
    }
  };

  const handleOpenTravelAssistant = (lastUserQuestion?: string) => {
    onClose();
    openTravelAssistant(lastUserQuestion);
  };

  const getLastUserQuestion = (): string => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i].content;
      }
    }
    return '';
  };

  const renderAnswerBadge = (type?: string) => {
    if (!type) return null;
    switch (type) {
      case 'trip':
      case 'trip_qa':
        return (
          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full inline-block mb-1">
            Trip Plan
          </span>
        );
      case 'in_journey':
        return (
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full inline-block mb-1">
            Today's Schedule
          </span>
        );
      case 'general':
      case 'general_qa':
        return (
          <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full inline-block mb-1">
            General Travel Advice
          </span>
        );
      case 'edit':
        return (
          <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full inline-block mb-1">
            Itinerary Proposal
          </span>
        );
      case 'redirect':
        return (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full inline-block mb-1">
            General Question
          </span>
        );
      case 'booking':
        return (
          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full inline-block mb-1">
            Booking Inquiry
          </span>
        );
      default:
        return null;
    }
  };

  const content = (
    <div className={`relative w-full ${isInline ? 'h-full' : 'sm:w-[500px]'} bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[620px] overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
              <path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="white" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">Ask about your trip</h2>
            <p className="text-xs text-slate-400">
              {journey.destination} &middot; {journey.itinerary.length} days
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close trip chat"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Suggested prompts strip */}
      {messages.length === 0 && (
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex gap-1.5 flex-wrap">
          {STATIC_SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              disabled={loading}
              onClick={() => handleSend(prompt)}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 text-slate-700 text-xs font-medium rounded-full transition-all text-left disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Messages log */}
      <div
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-[#FAF9F6]/30"
      >
        {messages.length === 0 ? (
          <div className="py-12 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
                <path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="currentColor" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">Your trip assistant is ready</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Ask about day-by-day plans, recommended activities, travel pace, or budget for {journey.destination}.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {m.role === 'assistant' && renderAnswerBadge(m.answerType)}

              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white border border-slate-200/80 text-slate-800 shadow-sm rounded-bl-sm'
                }`}
              >
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div>
                    <SafeMarkdown content={m.content} />

                    {/* Edit Proposal Notice */}
                    {m.isEditProposal && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 italic">
                        Applying edits from chat is available in the mobile app for now.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Off-topic redirect action */}
              {m.role === 'assistant' && m.answerType === 'redirect' && (
                <button
                  onClick={() => handleOpenTravelAssistant(getLastUserQuestion())}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 text-xs font-semibold transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z" />
                  </svg>
                  Ask the Travel Assistant &rarr;
                </button>
              )}
            </div>
          ))
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200/80 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Inline Error with Retry */}
        {inlineError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-xs text-red-700 animate-slide-up">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <p className="font-medium">{inlineError}</p>
            </div>
            {failedMessageText && (
              <button
                onClick={handleRetry}
                disabled={loading}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-md font-semibold transition-colors whitespace-nowrap"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your trip..."
            className="flex-1 px-4 py-2.5 bg-slate-100 border border-slate-200/60 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center shrink-0 shadow-sm"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );

  if (isInline) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      {content}
    </div>
  );
}

