/**
 * Pure functions and types for editing Style Collection picks.
 */

export interface PickItem {
  name: string;
  imageQuery: string;
}

export interface PickFieldError {
  name?: string;
  imageQuery?: string;
}

export interface CollectionValidationResult {
  isValid: boolean;
  generalError?: string;
  fieldErrors: Record<number, PickFieldError>;
  duplicateIndices: Set<number>;
}

const HTML_TAG_REGEX = /<[^>]*>/;

/**
 * Normalizes destination name for duplicate detection (lowercase, trimmed, collapsed whitespace).
 */
export function normalizeName(s?: string | null): string {
  if (!s || typeof s !== 'string') return '';
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Validates an array of picks according to catalog rules.
 * - Max 12 picks.
 * - Empty collection is valid.
 * - Name: trimmed length 2-80, no HTML.
 * - imageQuery: optional, max 100, no HTML.
 * - Duplicates: flagged using normalized name comparison.
 */
export function validatePicks(picks: PickItem[]): CollectionValidationResult {
  const fieldErrors: Record<number, PickFieldError> = {};
  const duplicateIndices = new Set<number>();
  let hasErrors = false;
  let generalError: string | undefined;

  if (!Array.isArray(picks)) {
    return {
      isValid: false,
      generalError: 'Picks must be an array.',
      fieldErrors: {},
      duplicateIndices: new Set(),
    };
  }

  if (picks.length > 12) {
    generalError = 'A collection can hold at most 12 picks.';
    hasErrors = true;
  }

  const seenNormalized = new Map<string, number>();

  picks.forEach((pick, idx) => {
    const itemErrors: PickFieldError = {};

    // Validate Name
    const name = (pick.name || '').trim();
    if (!name) {
      itemErrors.name = 'Name is required.';
      hasErrors = true;
    } else if (name.length < 2) {
      itemErrors.name = 'Name must be at least 2 characters.';
      hasErrors = true;
    } else if (name.length > 80) {
      itemErrors.name = 'Name cannot exceed 80 characters.';
      hasErrors = true;
    } else if (HTML_TAG_REGEX.test(name)) {
      itemErrors.name = 'Name cannot contain HTML tags.';
      hasErrors = true;
    } else {
      // Check duplicates
      const norm = normalizeName(name);
      if (seenNormalized.has(norm)) {
        const prevIdx = seenNormalized.get(norm)!;
        duplicateIndices.add(prevIdx);
        duplicateIndices.add(idx);
        itemErrors.name = `Duplicate destination name "${name}" in collection.`;
        if (fieldErrors[prevIdx]) {
          fieldErrors[prevIdx].name = `Duplicate destination name in collection.`;
        } else {
          fieldErrors[prevIdx] = { name: `Duplicate destination name in collection.` };
        }
        hasErrors = true;
      } else {
        seenNormalized.set(norm, idx);
      }
    }

    // Validate Photo Search Term (optional)
    const imageQuery = (pick.imageQuery || '').trim();
    if (imageQuery) {
      if (imageQuery.length > 100) {
        itemErrors.imageQuery = 'Search term cannot exceed 100 characters.';
        hasErrors = true;
      } else if (HTML_TAG_REGEX.test(imageQuery)) {
        itemErrors.imageQuery = 'Search term cannot contain HTML tags.';
        hasErrors = true;
      }
    }

    if (itemErrors.name || itemErrors.imageQuery) {
      fieldErrors[idx] = { ...fieldErrors[idx], ...itemErrors };
    }
  });

  return {
    isValid: !hasErrors,
    generalError,
    fieldErrors,
    duplicateIndices,
  };
}

/**
 * Adds a new pick to the collection (capped at 12).
 */
export function addPick(
  picks: PickItem[],
  newPick: { name: string; imageQuery?: string }
): PickItem[] {
  if (picks.length >= 12) {
    return [...picks];
  }
  return [
    ...picks,
    {
      name: (newPick.name || '').trim(),
      imageQuery: (newPick.imageQuery || '').trim(),
    },
  ];
}

/**
 * Removes a pick at the given index.
 */
export function removePick(picks: PickItem[], index: number): PickItem[] {
  if (index < 0 || index >= picks.length) {
    return [...picks];
  }
  return picks.filter((_, idx) => idx !== index);
}

/**
 * Moves a pick up or down in the array, respecting boundaries.
 */
export function movePick(
  picks: PickItem[],
  index: number,
  direction: 'up' | 'down'
): PickItem[] {
  if (index < 0 || index >= picks.length) {
    return [...picks];
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= picks.length) {
    return [...picks];
  }

  const copy = [...picks];
  const item = copy[index];
  copy[index] = copy[targetIndex];
  copy[targetIndex] = item;
  return copy;
}

