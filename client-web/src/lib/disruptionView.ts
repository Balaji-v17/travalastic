export type DisruptionViewState =
  | 'generating'
  | 'review'
  | 'manual_review'
  | 'applied'
  | 'closed';

/**
 * Formats a delay in minutes into human-readable duration:
 * e.g. 1 -> "1 min", 59 -> "59 min", 60 -> "1 h", 61 -> "1 h 1 min",
 * 125 -> "2 h 5 min", 180 -> "3 h", 200 -> "3 h 20 min".
 */
export function formatDelay(minutes: number | string | null | undefined): string {
  const m = Math.round(Number(minutes) || 0);
  if (m < 1) return '0 min';
  const hours = Math.floor(m / 60);
  const rem = m % 60;

  if (hours === 0) {
    return `${rem} min`;
  }
  if (rem === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${rem} min`;
}

/**
 * Maps a disruption record's status and proposal kind to a UI view state:
 * - 'new' or null -> 'generating'
 * - 'proposed' + 'manual_review' -> 'manual_review'
 * - 'proposed' + 'reschedule' -> 'review'
 * - 'approved' -> 'applied'
 * - 'reverted' | 'dismissed' | 'expired' -> 'closed'
 */
export function viewStateFor(disruption?: {
  status?: string;
  proposal?: { kind?: string } | null;
} | null): DisruptionViewState {
  if (!disruption || !disruption.status) {
    return 'generating';
  }

  const { status, proposal } = disruption;

  switch (status) {
    case 'new':
      return 'generating';
    case 'proposed':
      if (proposal?.kind === 'manual_review') {
        return 'manual_review';
      }
      return 'review';
    case 'approved':
      return 'applied';
    case 'reverted':
    case 'dismissed':
    case 'expired':
      return 'closed';
    default:
      return 'closed';
  }
}

/**
 * Safely resolves an activity title from the trip itinerary by activityId.
 * Falls back to "An activity" and never crashes.
 */
export function resolveActivityTitle(
  activityId: string | number | null | undefined,
  itineraryDays?: Array<{ activities?: any[]; items?: any[] }> | null
): string {
  if (activityId == null || !Array.isArray(itineraryDays)) {
    return 'An activity';
  }

  const targetStr = String(activityId).trim();
  if (!targetStr) {
    return 'An activity';
  }

  for (const day of itineraryDays) {
    const list = Array.isArray(day?.activities)
      ? day.activities
      : Array.isArray(day?.items)
      ? day.items
      : [];

    for (let idx = 0; idx < list.length; idx++) {
      const act = list[idx];
      if (!act) continue;

      if (typeof act === 'string') {
        if (targetStr === String(idx)) {
          return act.trim() || 'An activity';
        }
        continue;
      }

      const id =
        act.id != null
          ? String(act.id)
          : act._id != null
          ? String(act._id)
          : act.placeId != null
          ? String(act.placeId)
          : act.activityId != null
          ? String(act.activityId)
          : String(idx);

      if (
        id === targetStr ||
        String(idx) === targetStr ||
        (act.placeId && String(act.placeId) === targetStr)
      ) {
        const title = act.title || act.name || act.activity;
        if (typeof title === 'string' && title.trim()) {
          return title.trim();
        }
        return 'An activity';
      }
    }
  }

  return 'An activity';
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Extracts 24-hour wall-clock time string "HH:mm" from an ISO local datetime string.
 * Strictly avoids new Date() / timezone conversions so digits are preserved exactly as written.
 * If trailing 'Z' or offset is present, the written clock digits are extracted directly without shifting.
 * Returns null for missing, non-string, or malformed input without throwing.
 */
export function formatLocalTime(isoLocalString: string | null | undefined): string | null {
  if (typeof isoLocalString !== 'string') return null;
  const trimmed = isoLocalString.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/(?:[T\s]|^)(\d{2}):(\d{2})/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${match[1]}:${match[2]}`;
}

/**
 * Formats an ISO local datetime string into "D Mon, HH:mm" (e.g. "20 Nov, 16:05").
 * Uses pure wall-clock string parsing to avoid viewer timezone shifts.
 * Returns null for missing, non-string, or malformed input without throwing.
 */
export function formatLocalDateTime(isoLocalString: string | null | undefined): string | null {
  if (typeof isoLocalString !== 'string') return null;
  const trimmed = isoLocalString.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);

  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day) ||
    isNaN(hours) ||
    isNaN(minutes) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const monthName = MONTH_NAMES[month - 1];
  return `${day} ${monthName}, ${match[4]}:${match[5]}`;
}

/**
 * Generates deterministic reminder lines for pickup / hotel / reservations based ONLY on stored disruption details.
 * Strictly avoids new Date() timezone conversion and uses pure wall-clock string parsing.
 *
 * Rules:
 * - If newArrival exists and the change is not structural:
 *   "Your flight now arrives at 16:05 (was 14:00), local time at the destination airport."
 *   If oldArrival is missing, omit the "(was …)" part.
 *   If midnight rollover (new arrival date > old arrival date), includes "(next day, was …)" or "(next day)".
 * - If structural or newArrival is missing:
 *   "Your flight details changed. Check the airline for the new times."
 * - Always second line:
 *   "If you've arranged a pickup, hotel check-in or any reservation for this flight, tell them about the new time. I can't change those for you."
 */
export function reminderLines(
  details?: {
    oldArrival?: string | null;
    newArrival?: string | null;
    structural?: boolean;
    [key: string]: any;
  } | null
): string[] {
  const alwaysLine =
    "If you've arranged a pickup, hotel check-in or any reservation for this flight, tell them about the new time. I can't change those for you.";

  if (!details || details.structural) {
    return [
      'Your flight details changed. Check the airline for the new times.',
      alwaysLine,
    ];
  }

  const newTime = formatLocalTime(details.newArrival);
  if (!newTime) {
    return [
      'Your flight details changed. Check the airline for the new times.',
      alwaysLine,
    ];
  }

  const oldTime = formatLocalTime(details.oldArrival);
  const oldDateMatch =
    typeof details.oldArrival === 'string'
      ? details.oldArrival.trim().match(/^(\d{4}-\d{2}-\d{2})/)
      : null;
  const newDateMatch =
    typeof details.newArrival === 'string'
      ? details.newArrival.trim().match(/^(\d{4}-\d{2}-\d{2})/)
      : null;

  const oldDate = oldDateMatch ? oldDateMatch[1] : null;
  const newDate = newDateMatch ? newDateMatch[1] : null;
  const isNextDay = Boolean(oldDate && newDate && newDate > oldDate);

  let qualifier = '';
  if (isNextDay && oldTime) {
    qualifier = ` (next day, was ${oldTime})`;
  } else if (isNextDay) {
    qualifier = ' (next day)';
  } else if (oldTime) {
    qualifier = ` (was ${oldTime})`;
  }

  const firstLine = `Your flight now arrives at ${newTime}${qualifier}, local time at the destination airport.`;

  return [firstLine, alwaysLine];
}


