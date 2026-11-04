import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { sendAssistantMessage, type AssistantHistoryItem } from '../../lib/chatApi';
import { SafeMarkdown } from './SafeMarkdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const GENERAL_SUGGESTIONS = [
  'Best time to visit Goa',
  'What should I pack for 5 days?',
  'How do train cancellations work in India?',
];

export default function TravelAssistantPanel() {
  const {
    isTravelAssistantOpen,
    closeTravelAssistant,
    travelAssistantInitialMessage,
    clearTravelAssistantInitialMessage,
    selectedJourneyId,
    journeys,
    navigate,
  } = useApp();

  const { status } = useAuth();

  // Session-only: conversation history is maintained exclusively in React component state.
  // It is NEVER saved to localStorage or persisted to any database.
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [failedMessageText, setFailedMessageText] = useState<string | null>(null);

  // Optional trip hint context
  const [useTripContext, setUseTripContext] = useState(true);
  const activeJourney = selectedJourneyId ? journeys.find((j) => j.id === selectedJourneyId) : null;

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Track active element to restore focus when closed
  useEffect(() => {
    if (isTravelAssistantOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      // Focus input if authed, else focus the panel container
      setTimeout(() => {
        if (status === 'authed') {
          inputRef.current?.focus();
        } else {
          panelRef.current?.focus();
        }
      }, 50);
    } else {
      previousActiveElementRef.current?.focus();
    }
  }, [isTravelAssistantOpen, status]);

  // Handle Escape key to close panel
  useEffect(() => {
    if (!isTravelAssistantOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeTravelAssistant();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTravelAssistantOpen, closeTravelAssistant]);

  // Scroll to bottom when messages change or loading state toggles
  useEffect(() => {
    if (isTravelAssistantOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, inlineError, isTravelAssistantOpen]);

  const handleSend = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend ?? input).trim();
      if (!text || loading) return;

      if (text.length > 1000) {
        setInlineError('Message must be 1000 characters or fewer.');
        return;
      }

      setInlineError(null);
      setFailedMessageText(null);
      setInput('');

      // Add user message to UI state (session-only)
      const userMessage: Message = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        content: text,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setLoading(true);

      // Prepare history payload: previous messages before this new message (capped by sendAssistantMessage)
      const historyPayload: AssistantHistoryItem[] = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));

      const tripId = useTripContext && activeJourney ? activeJourney.id : undefined;

      try {
        const response = await sendAssistantMessage(text, historyPayload, tripId);

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: response.reply,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: any) {
        setFailedMessageText(text);
        setInlineError(err.message || 'Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, useTripContext, activeJourney]
  );

  const handleRetry = useCallback(() => {
    if (!failedMessageText) return;

    // Remove the failed user bubble from the end to prevent duplicates on retry
    setMessages((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].content === failedMessageText) {
        return prev.slice(0, -1);
      }
      return prev;
    });

    const toRetry = failedMessageText;
    setFailedMessageText(null);
    setInlineError(null);
    handleSend(toRetry);
  }, [failedMessageText, handleSend]);

  // Handle initial message passed from trip chat redirect or other triggers
  useEffect(() => {
    if (isTravelAssistantOpen && travelAssistantInitialMessage) {
      const initial = travelAssistantInitialMessage;
      clearTravelAssistantInitialMessage();

      if (status === 'authed') {
        handleSend(initial);
      } else {
        setInput(initial);
      }
    }
  }, [isTravelAssistantOpen, travelAssistantInitialMessage, clearTravelAssistantInitialMessage, status, handleSend]);

  if (!isTravelAssistantOpen) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      id="travel-assistant-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Travel Assistant"
      tabIndex={-1}
      className="fixed bottom-6 right-6 z-50 w-full sm:w-[420px] max-w-[calc(100vw-32px)] h-[580px] max-h-[calc(100vh-100px)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-slide-up focus:outline-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#2F6E68] text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M8 10h.01" />
              <path d="M12 10h.01" />
              <path d="M16 10h.01" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-white text-sm">Travel Assistant</h2>
            <p className="text-xs text-white/80">General advice &amp; planning tips</p>
          </div>
        </div>
        <button
          onClick={closeTravelAssistant}
          aria-label="Close Travel Assistant"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Optional Trip Context Hint Banner */}
      {activeJourney && useTripContext && (
        <div className="px-4 py-2 bg-teal-50 border-b border-teal-100 flex items-center justify-between gap-2 text-xs text-teal-800">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
            <span className="truncate">
              Using your <span className="font-semibold">{activeJourney.destination}</span> trip as context
            </span>
          </div>
          <button
            onClick={() => setUseTripContext(false)}
            aria-label="Remove trip context"
            className="text-teal-600 hover:text-teal-900 p-0.5 rounded hover:bg-teal-100 transition-colors shrink-0"
            title="Remove trip context"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {/* Signed-out state */}
        {status !== 'authed' && (
          <div className="p-6 my-auto text-center flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-[#2F6E68] mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 text-sm mb-1">Sign in to use the Travel Assistant</h3>
            <p className="text-xs text-slate-500 max-w-xs mb-4">
              Get intelligent packing recommendations, weather insights, and general travel guidance for your journeys.
            </p>
            <button
              onClick={() => {
                closeTravelAssistant();
                navigate('auth');
              }}
              className="px-5 py-2.5 bg-[#2F6E68] hover:bg-[#265954] text-white text-xs font-medium rounded-full shadow-sm transition-colors"
            >
              Sign in to continue
            </button>
          </div>
        )}

        {/* Empty state with general suggestions */}
        {status === 'authed' && messages.length === 0 && (
          <div className="py-6 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-[#2F6E68] mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 text-sm mb-1">How can I help you travel?</h3>
            <p className="text-xs text-slate-500 max-w-xs mb-5">
              Ask anything about destinations, general packing checklists, travel weather, or transport rules.
            </p>
            <div className="w-full space-y-2">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider text-left px-1">
                Suggested questions
              </p>
              {GENERAL_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  disabled={loading}
                  className="w-full text-left text-xs text-slate-700 bg-white hover:bg-teal-50/50 border border-slate-200/80 hover:border-teal-200 rounded-xl px-3.5 py-2.5 transition-colors shadow-2xs flex items-center justify-between group"
                >
                  <span>{suggestion}</span>
                  <span className="text-slate-300 group-hover:text-teal-600 transition-colors">
                    &rarr;
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-[#111111] text-white rounded-tr-sm'
                    : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-sm shadow-2xs'
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <SafeMarkdown content={m.content} />
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-1 pl-1">
            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span>Thinking...</span>
          </div>
        )}

        {/* Inline Error with Retry */}
        {inlineError && (
          <div className="p-3 bg-red-50 border border-red-200/80 rounded-xl text-xs text-red-700 flex items-center justify-between gap-2">
            <span className="flex-1">{inlineError}</span>
            {failedMessageText && (
              <button
                onClick={handleRetry}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shrink-0 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {status === 'authed' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about destinations, packing, rules..."
            disabled={loading}
            maxLength={1000}
            className="flex-1 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F6E68] focus:border-[#2F6E68] disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#2F6E68] hover:bg-[#265954] active:bg-[#1E4541] disabled:bg-slate-200 text-white disabled:text-slate-400 transition-colors shrink-0 shadow-sm"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}

