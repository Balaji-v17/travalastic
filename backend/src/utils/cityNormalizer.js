const EXTRA_FOLD_MAP = {
  ł: 'l',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ı: 'i',
  þ: 'th',
  '’': "'",
  '‘': "'",
};

const EXTRA_FOLD_REGEX = /[łøđðßæœıþ’‘]/g;

/**
 * Normalizes a city or region name into an accent-free, lowercase, trimmed search key.
 * Handles characters that Unicode NFD does not decompose (e.g. ł, ø, đ, ß, æ, œ, ı, þ).
 */
export function normalizeSearchKey(input) {
  if (input == null) return '';
  const str = String(input).trim();
  if (!str) return '';

  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(EXTRA_FOLD_REGEX, (ch) => EXTRA_FOLD_MAP[ch] || ch)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Escapes all RegExp metacharacters in user input so it is safe to compile into new RegExp(...).
 */
export function escapeRegex(str) {
  return String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Computes Levenshtein edit distance between two normalized strings.
 */
export function levenshtein(a, b) {
  const s = String(a ?? '');
  const t = String(b ?? '');
  if (s === t) return 0;
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;

  let prev = new Array(t.length + 1);
  let curr = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;

  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    const sc = s.charCodeAt(i - 1);
    for (let j = 1; j <= t.length; j++) {
      const cost = sc === t.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[t.length];
}

