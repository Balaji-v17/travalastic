/**
 * Pure price age evaluation helper.
 * Determines if a hotel's price review date is current, stale (> 180 days), missing, or in the future.
 */

export interface PriceAgeResult {
  formattedDate: string;
  isOlderThan180Days: boolean;
  isStale: boolean;
  daysAgo: number | null;
  label: string;
  status: 'current' | 'stale' | 'missing' | 'future';
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(date: Date): string {
  const m = MONTH_NAMES[date.getUTCMonth()];
  const d = date.getUTCDate();
  const y = date.getUTCFullYear();
  return `${m} ${d}, ${y}`;
}

export function computePriceAge(
  dateValue: string | Date | null | undefined,
  nowInput?: string | Date
): PriceAgeResult {
  if (!dateValue) {
    return {
      formattedDate: 'Not recorded',
      isOlderThan180Days: true,
      isStale: true,
      daysAgo: null,
      label: 'Not recorded',
      status: 'missing',
    };
  }

  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (isNaN(date.getTime())) {
    return {
      formattedDate: 'Not recorded',
      isOlderThan180Days: true,
      isStale: true,
      daysAgo: null,
      label: 'Not recorded',
      status: 'missing',
    };
  }

  const now = nowInput ? (typeof nowInput === 'string' ? new Date(nowInput) : nowInput) : new Date();
  const diffMs = now.getTime() - date.getTime();
  const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysAgo < 0) {
    const formatted = formatDate(date);
    return {
      formattedDate: formatted,
      isOlderThan180Days: false,
      isStale: false,
      daysAgo,
      label: formatted,
      status: 'future',
    };
  }

  const formatted = formatDate(date);
  if (daysAgo > 180) {
    return {
      formattedDate: formatted,
      isOlderThan180Days: true,
      isStale: true,
      daysAgo,
      label: `${daysAgo}d ago (${formatted})`,
      status: 'stale',
    };
  }

  const label = daysAgo === 0 ? 'Today' : `${daysAgo}d ago`;
  return {
    formattedDate: formatted,
    isOlderThan180Days: false,
    isStale: false,
    daysAgo,
    label,
    status: 'current',
  };
}
