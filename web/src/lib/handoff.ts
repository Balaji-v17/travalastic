export type ExternalBookingKind = 'hotel' | 'cab' | 'car_rental' | 'train' | 'bus';

export interface ExternalHandoffRecord {
  kind: ExternalBookingKind;
  providerLabel: string;
  timestamp: number;
}

export const HANDOFF_STORAGE_KEY = 'travalastic_external_handoff';
export const HANDOFF_TTL_MS = 30 * 60 * 1000; // 30 minutes

const VALID_KINDS = new Set<ExternalBookingKind>(['hotel', 'cab', 'car_rental', 'train', 'bus']);

function resolveStorage(customStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null) {
  if (customStorage !== undefined) return customStorage;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Remembers an external provider outbound click strictly in sessionStorage.
 * Wrapped in try/catch; never sends data to any server or analytics endpoint.
 */
export function rememberExternalHandoff(
  kind: ExternalBookingKind,
  providerLabel: string,
  now: number = Date.now(),
  customStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): ExternalHandoffRecord | null {
  if (!VALID_KINDS.has(kind)) return null;
  const cleanProvider = typeof providerLabel === 'string' ? providerLabel.trim().slice(0, 80) : '';
  if (!cleanProvider) return null;

  const record: ExternalHandoffRecord = {
    kind,
    providerLabel: cleanProvider,
    timestamp: now,
  };

  try {
    const storage = resolveStorage(customStorage);
    if (storage) {
      storage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(record));
    }
  } catch {
    // Ignore storage quota or private browsing errors
  }

  return record;
}

/**
 * Retrieves an active hand-off record from sessionStorage if it is within 30 minutes.
 * Automatically clears expired or corrupted entries.
 */
export function getActiveExternalHandoff(
  now: number = Date.now(),
  customStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): ExternalHandoffRecord | null {
  try {
    const storage = resolveStorage(customStorage);
    if (!storage) return null;

    const raw = storage.getItem(HANDOFF_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ExternalHandoffRecord>;
    if (
      !parsed ||
      !parsed.kind ||
      !VALID_KINDS.has(parsed.kind) ||
      typeof parsed.providerLabel !== 'string' ||
      !parsed.providerLabel.trim() ||
      typeof parsed.timestamp !== 'number' ||
      isNaN(parsed.timestamp)
    ) {
      storage.removeItem(HANDOFF_STORAGE_KEY);
      return null;
    }

    const elapsed = now - parsed.timestamp;
    if (elapsed < 0 || elapsed > HANDOFF_TTL_MS) {
      storage.removeItem(HANDOFF_STORAGE_KEY);
      return null;
    }

    return {
      kind: parsed.kind,
      providerLabel: parsed.providerLabel.trim(),
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
}

/**
 * Clears any saved hand-off record from sessionStorage.
 */
export function clearExternalHandoff(
  customStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): void {
  try {
    const storage = resolveStorage(customStorage);
    if (storage) {
      storage.removeItem(HANDOFF_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

