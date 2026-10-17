/**
 * Pure function: merges template items into the packing custom items
 * skipping duplicates against existingTexts (case-insensitive, trimmed)
 * and respecting slotsLeft up to cap.
 *
 * @param {string[]} existingTexts - Existing item texts (AI + custom)
 * @param {Array<{ text: string, category?: string }>} templateItems - Items from the template
 * @param {number} slotsLeft - Remaining custom item slots (out of 50)
 * @returns {{ added: number, skippedDuplicates: number, skippedOverCap: number, itemsToAdd: Array<{ text: string, category: string }> }}
 */
export function mergeTemplateItems(existingTexts = [], templateItems = [], slotsLeft = 50) {
  const existingSet = new Set(
    (existingTexts || []).map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
  );

  const itemsToAdd = [];
  let skippedDuplicates = 0;
  let skippedOverCap = 0;
  let remainingSlots = Math.max(0, typeof slotsLeft === 'number' ? slotsLeft : 0);

  for (const item of templateItems || []) {
    const rawText = typeof item === 'string' ? item : item?.text;
    if (!rawText || typeof rawText !== 'string') continue;
    const trimmed = rawText.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    if (existingSet.has(lower)) {
      skippedDuplicates++;
    } else {
      existingSet.add(lower);
      if (remainingSlots > 0) {
        remainingSlots--;
        const rawCat = typeof item === 'object' && item?.category;
        const category =
          typeof rawCat === 'string' && rawCat.trim()
            ? rawCat.trim()
            : 'My items';
        itemsToAdd.push({
          text: trimmed,
          category,
        });
      } else {
        skippedOverCap++;
      }
    }
  }

  return {
    added: itemsToAdd.length,
    skippedDuplicates,
    skippedOverCap,
    itemsToAdd,
  };
}

