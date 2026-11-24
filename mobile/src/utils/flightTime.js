/**
 * Pure formatting helpers for Duffel airport-local departure and arrival times.
 *
 * IMPORTANT: Duffel times and dates are airport-local with no UTC offset.
 * They MUST be displayed strictly from string parts and NEVER converted
 * to the viewer's device/browser time zone.
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Extracts airport-local clock time from an ISO local datetime string or time string.
 * Strictly avoids new Date() and local-time methods so digits are preserved exactly as written.
 *
 * @param {string|null|undefined} isoString - e.g. "2026-12-01T08:30:00" or "08:30"
 * @param {{ hour12?: boolean }} [options] - hour12: true (default) for "08:30 AM", false for "08:30"
 * @returns {string} e.g. "08:30 AM" or "08:30", or "--:--" on invalid/empty input
 */
export function formatAirportTime(isoString, { hour12 = true } = {}) {
  if (!isoString || typeof isoString !== 'string') return '--:--';
  const trimmed = isoString.trim();
  if (!trimmed) return '--:--';

  const match = trimmed.match(/(?:[T\s]|^)(\d{2}):(\d{2})/);
  if (!match) return trimmed;

  const hours = parseInt(match[1], 10);
  const minutes = match[2];
  if (isNaN(hours) || hours < 0 || hours > 23) return trimmed;

  if (!hour12) {
    return `${match[1]}:${minutes}`;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  const h12Str = String(h12).padStart(2, '0');
  return `${h12Str}:${minutes} ${period}`;
}

/**
 * Extracts airport-local date snippet (e.g. "Dec 1") strictly from date string parts.
 * Never uses new Date() or viewer's time zone.
 *
 * @param {string|null|undefined} isoString - e.g. "2026-12-01T08:30:00" or "2026-12-01"
 * @returns {string} e.g. "Dec 1", or "" on invalid/empty input
 */
export function formatAirportDateSnippet(isoString) {
  if (!isoString || typeof isoString !== 'string') return '';
  const trimmed = isoString.trim();
  const match = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';

  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }

  const monthName = MONTHS[month - 1];
  return `${monthName} ${day}`;
}

/**
 * Extracts airport-local full date (e.g. "Tue, Dec 1, 2026") strictly from date string parts.
 * Uses UTC calendar date (Date.UTC at noon) to determine the invariant weekday name.
 *
 * @param {string|null|undefined} isoString - e.g. "2026-12-01T08:30:00" or "2026-12-01"
 * @returns {string} e.g. "Tue, Dec 1, 2026", or "Date TBD" on missing input
 */
export function formatAirportDate(isoString) {
  if (!isoString || typeof isoString !== 'string') return 'Date TBD';
  const trimmed = isoString.trim();
  const match = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return trimmed;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return trimmed;
  }

  const monthName = MONTHS[month - 1];
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = WEEKDAYS[utcNoon.getUTCDay()];
  return `${weekday}, ${monthName} ${day}, ${year}`;
}

/**
 * Formats combined airport-local time and date (e.g. "08:30 AM (Dec 1)") for summary cards.
 *
 * @param {string|null|undefined} isoString - e.g. "2026-12-01T08:30:00"
 * @returns {string} e.g. "08:30 AM (Dec 1)" or "Scheduled"
 */
export function formatAirportDateTime(isoString) {
  if (!isoString) return 'Scheduled';
  const time = formatAirportTime(isoString, { hour12: true });
  const dateSnippet = formatAirportDateSnippet(isoString);
  if (time === '--:--' && !dateSnippet) return String(isoString);
  if (!dateSnippet) return time;
  return `${time} (${dateSnippet})`;
}

