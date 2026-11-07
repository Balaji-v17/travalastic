import { apiFetch } from './api';

export interface DisruptionDetails {
  oldDeparture?: string | null;
  newDeparture?: string | null;
  oldArrival?: string | null;
  newArrival?: string | null;
  delayMinutes?: number | null;
  structural?: boolean;
}

export interface DisruptionChange {
  activityId: string;
  action: 'keep' | 'move' | 'skip' | 'drop';
  fromTime: string;
  toTime?: string;
  reason?: string;
}

export interface DisruptionProposal {
  kind: 'reschedule' | 'manual_review';
  option?: number;
  baseHash?: string;
  summary?: string;
  changes?: DisruptionChange[];
  unchangedCount?: number;
  capped?: boolean;
  dayNumber?: number;
}

export interface DisruptionItem {
  id: string;
  _id?: string;
  type: string;
  source: 'duffel_webhook' | 'simulation';
  simulated: boolean;
  status: 'new' | 'proposed' | 'approved' | 'dismissed' | 'expired' | 'reverted';
  details?: DisruptionDetails;
  dayNumber?: number | null;
  itineraryId: string;
  detectedAt?: string;
  hasProposal?: boolean;
  proposal?: DisruptionProposal | null;
}

export interface NormalizedDisruptionError {
  status: number;
  code: string;
  message: string;
}

export class DisruptionApiError extends Error implements NormalizedDisruptionError {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'DisruptionApiError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, DisruptionApiError.prototype);
  }
}

function normalizeError(err: any): never {
  const status = typeof err?.status === 'number' ? err.status : 0;
  const rawMsg = err?.message || 'Request failed';

  let code = 'error';
  if (
    ['proposal_changed', 'itinerary_changed', 'newer_changes_exist', 'too_old'].includes(
      rawMsg
    )
  ) {
    code = rawMsg;
  } else if (err?.code) {
    code = String(err.code);
  } else if (status === 429) {
    code = 'rate_limit';
  } else if (status === 404) {
    code = 'not_found';
  } else if (status === 502) {
    code = '502';
  }

  let message = rawMsg;
  if (status === 429 && (!message || message.includes('status 429') || message === 'rate_limit')) {
    message = 'Too many requests, try again in a bit';
  }

  throw new DisruptionApiError(status, code, message);
}

/**
 * List the user's disruptions, newest first.
 */
export async function listDisruptionsApi(): Promise<DisruptionItem[]> {
  try {
    const data = await apiFetch<DisruptionItem[]>('/disruptions');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    normalizeError(err);
  }
}

/**
 * Get full disruption record by ID.
 */
export async function getDisruptionApi(id: string): Promise<DisruptionItem> {
  try {
    return await apiFetch<DisruptionItem>(`/disruptions/${id}`);
  } catch (err) {
    normalizeError(err);
  }
}

/**
 * Run proposal generation for a disruption.
 */
export async function generateProposalApi(
  id: string,
  options?: { regenerate?: boolean }
): Promise<{ success: boolean; proposal: DisruptionProposal; status?: string }> {
  try {
    const query = options?.regenerate ? '?regenerate=true' : '';
    return await apiFetch(`/disruptions/${id}/proposal${query}`, {
      method: 'POST',
      body: { regenerate: Boolean(options?.regenerate) },
    });
  } catch (err) {
    normalizeError(err);
  }
}

/**
 * Approve a stored disruption proposal.
 */
export async function approveDisruptionApi(
  id: string,
  baseHash: string
): Promise<{ success: boolean; disruption: DisruptionItem }> {
  try {
    return await apiFetch(`/disruptions/${id}/approve`, {
      method: 'POST',
      body: { baseHash },
    });
  } catch (err) {
    normalizeError(err);
  }
}

/**
 * Dismiss a stored disruption proposal.
 */
export async function dismissDisruptionApi(
  id: string
): Promise<{ success: boolean; disruption: DisruptionItem }> {
  try {
    return await apiFetch(`/disruptions/${id}/dismiss`, {
      method: 'POST',
      body: {},
    });
  } catch (err) {
    normalizeError(err);
  }
}

/**
 * Revert an approved disruption proposal.
 */
export async function undoDisruptionApi(
  id: string
): Promise<{ success: boolean; disruption: DisruptionItem }> {
  try {
    return await apiFetch(`/disruptions/${id}/undo`, {
      method: 'POST',
      body: {},
    });
  } catch (err) {
    normalizeError(err);
  }
}

/**
 * Simulate a flight delay disruption for demo purposes.
 */
export async function simulateDisruptionApi(payload: {
  itineraryId: string;
  dayNumber: number;
  delayMinutes: number;
}): Promise<{ simulated: boolean; disruptionId?: string; id?: string; disruption?: any }> {
  try {
    return await apiFetch('/disruptions/simulate', {
      method: 'POST',
      body: payload,
    });
  } catch (err) {
    normalizeError(err);
  }
}

