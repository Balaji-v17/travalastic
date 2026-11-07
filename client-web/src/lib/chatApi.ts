import { apiFetch, ApiError } from './api';

export class ChatError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ChatError';
    this.status = status;
    Object.setPrototypeOf(this, ChatError.prototype);
  }
}

function mapChatError(err: any): ChatError {
  const status = err?.status ?? 0;
  if (status === 400) {
    return new ChatError(400, err?.message || 'Invalid message format.');
  }
  if (status === 429) {
    return new ChatError(429, "You're sending messages too quickly, wait a moment");
  }
  if (status >= 500 || status === 408 || status === 0) {
    return new ChatError(status, 'The server took too long to respond. Please try again.');
  }
  return new ChatError(status, err?.message || 'An error occurred. Please try again.');
}

export interface TripChatResponse {
  reply: string;
  updatedItinerary?: any | null;
  conversationId: string;
  answerType?: 'trip' | 'general' | 'in_journey' | 'edit' | 'redirect' | 'booking' | string;
  editId?: string;
  undoable?: boolean;
  modifiedDays?: number[];
}

/**
 * Sends a message to the trip-grounded assistant (POST /chat/message).
 * Preserves conversationId across follow-ups for session continuity.
 */
export async function sendTripMessage(
  tripId: string,
  message: string,
  conversationId?: string
): Promise<TripChatResponse> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new ChatError(400, 'Message cannot be empty.');
  }

  try {
    return await apiFetch<TripChatResponse>('/chat/message', {
      method: 'POST',
      body: {
        itineraryId: tripId,
        message: trimmed,
        ...(conversationId ? { conversationId } : {}),
      },
    });
  } catch (err: any) {
    throw mapChatError(err);
  }
}

export interface AssistantHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantResponse {
  reply: string;
  sources?: Array<{ tool: string; query?: string; result?: any }>;
}

/**
 * Sends a message to the general Travel Assistant (POST /assistant/message).
 * Capped to the newest 10 history items, truncated to 2000 chars per message.
 * Optional tripId passed as context hint if active.
 */
export async function sendAssistantMessage(
  message: string,
  history: AssistantHistoryItem[],
  tripHint?: string | { tripId?: string }
): Promise<AssistantResponse> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new ChatError(400, 'Message cannot be empty.');
  }

  const tripId = typeof tripHint === 'string' ? tripHint.trim() : tripHint?.tripId?.trim();

  // Cap to newest 10 messages (role and content only), each truncated to 2000 chars
  const cleanHistory = (history || [])
    .filter((h) => h.role === 'user' || h.role === 'assistant')
    .slice(-10)
    .map((h) => ({
      role: h.role,
      content: (h.content || '').slice(0, 2000),
    }));

  try {
    return await apiFetch<AssistantResponse>('/assistant/message', {
      method: 'POST',
      body: {
        message: trimmed,
        history: cleanHistory,
        ...(tripId ? { tripId } : {}),
      },
    });
  } catch (err: any) {
    throw mapChatError(err);
  }
}

