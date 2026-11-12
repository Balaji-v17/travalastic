// Static style collection definitions (labels and taglines).
// Picks are dynamically loaded from MongoDB via GET /styles/:key.

export const STYLE_KEYS = [
  'private-escapes',
  'honeymoons',
  'wellness',
  'family',
  'adventure',
  'celebrations',
] as const;

export type StyleKey = (typeof STYLE_KEYS)[number];

export interface StyleCollection {
  label: string;
  tagline: string;
}

export const STYLE_COLLECTIONS: Record<StyleKey, StyleCollection> = {
  'private-escapes': {
    label: 'Private Escapes',
    tagline: 'Secluded retreats away from crowds',
  },
  honeymoons: {
    label: 'Honeymoons',
    tagline: 'Quiet places for two',
  },
  wellness: {
    label: 'Wellness',
    tagline: 'Sanctuaries for rest and renewal',
  },
  family: {
    label: 'Family',
    tagline: 'Spacious stays and ease of travel',
  },
  adventure: {
    label: 'Adventure',
    tagline: 'Active landscapes and high terrain',
  },
  celebrations: {
    label: 'Celebrations',
    tagline: 'Memorable settings for milestones',
  },
};
