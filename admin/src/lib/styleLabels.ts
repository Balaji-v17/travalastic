/**
 * Friendly editorial labels and metadata for style collections.
 */

export const VALID_STYLE_KEYS = [
  'honeymoons',
  'wellness',
  'adventure',
  'family',
  'private-escapes',
  'celebrations',
] as const;

export type ValidStyleKey = (typeof VALID_STYLE_KEYS)[number];

export const STYLE_LABELS: Record<string, string> = {
  honeymoons: 'Honeymoons',
  wellness: 'Wellness',
  adventure: 'Adventure',
  family: 'Family',
  'private-escapes': 'Private escapes',
  celebrations: 'Celebrations',
};

/**
 * Returns the human-readable label for a style collection key.
 */
export function getStyleLabel(key?: string | null): string {
  if (!key) return '';
  return STYLE_LABELS[key] || key;
}

export function isValidStyleKey(key?: string | null): key is ValidStyleKey {
  if (!key) return false;
  return VALID_STYLE_KEYS.includes(key as ValidStyleKey);
}

