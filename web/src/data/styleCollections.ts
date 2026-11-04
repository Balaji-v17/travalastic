// Editorial picks written by hand. Not rankings. Place names must resolve through our destination search.
// DRAFT picks, to be approved

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
  picks: string[];
}

export const STYLE_COLLECTIONS: Record<StyleKey, StyleCollection> = {
  'private-escapes': {
    label: 'Private Escapes',
    tagline: 'Secluded retreats away from crowds',
    picks: ['Coorg', 'Chikmagalur', 'Wayanad', 'Kabini'],
  },
  honeymoons: {
    label: 'Honeymoons',
    tagline: 'Quiet places for two',
    picks: [
      'Munnar',
      'Udaipur',
      'Goa',
      'Havelock Island',
      'Coorg',
      'Gulmarg',
      'Alleppey',
      'Ooty',
    ],
  },
  wellness: {
    label: 'Wellness',
    tagline: 'Sanctuaries for rest and renewal',
    picks: [
      'Rishikesh',
      'Alleppey',
      'Coorg',
      'Wayanad',
      'Dharamshala',
      'Kovalam',
    ],
  },
  family: {
    label: 'Family',
    tagline: 'Spacious stays and ease of travel',
    picks: [
      'Mysore',
      'Jaipur',
      'Ooty',
      'Goa',
      'Pondicherry',
      'Kodaikanal',
    ],
  },
  adventure: {
    label: 'Adventure',
    tagline: 'Active landscapes and high terrain',
    picks: [
      'Manali',
      'Leh',
      'Rishikesh',
      'Auli',
      'Dandeli',
      'Spiti',
    ],
  },
  celebrations: {
    label: 'Celebrations',
    tagline: 'Memorable settings for milestones',
    picks: ['Goa', 'Jaipur', 'Udaipur', 'Pondicherry'],
  },
};

