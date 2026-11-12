import type { PickItem } from './collectionEditor.ts';

export interface DiffPicksResult {
  added: string[];
  removed: string[];
  reordered: boolean;
  imageQueriesChanged: boolean;
  hasChanges: boolean;
  summary: string;
}

/**
 * Computes a human-readable diff and change detection between original and edited picks.
 */
export function diffPicks(
  originalPicks?: PickItem[] | null,
  editedPicks?: PickItem[] | null
): DiffPicksResult {
  const orig = originalPicks || [];
  const edit = editedPicks || [];

  const originalNames = orig.map((p) => (p.name || '').trim()).filter(Boolean);
  const editedNames = edit.map((p) => (p.name || '').trim()).filter(Boolean);

  const origSet = new Set(originalNames);
  const editSet = new Set(editedNames);

  const added = editedNames.filter((name) => !origSet.has(name));
  const removed = originalNames.filter((name) => !editSet.has(name));

  const commonOriginal = originalNames.filter((name) => editSet.has(name));
  const commonEdited = editedNames.filter((name) => origSet.has(name));

  const reordered =
    commonOriginal.length > 1 &&
    commonOriginal.some((name, idx) => name !== commonEdited[idx]);

  // Check if any search queries changed
  let imageQueriesChanged = false;
  if (orig.length === edit.length && added.length === 0 && removed.length === 0) {
    for (let i = 0; i < orig.length; i++) {
      const origQuery = (orig[i].imageQuery || '').trim();
      const editQuery = (edit[i].imageQuery || '').trim();
      if (origQuery !== editQuery) {
        imageQueriesChanged = true;
        break;
      }
    }
  } else {
    // If different set of items, check if any existing common item had query modified
    const origQueryMap = new Map(orig.map((p) => [(p.name || '').trim(), (p.imageQuery || '').trim()]));
    for (const p of edit) {
      const name = (p.name || '').trim();
      if (origQueryMap.has(name)) {
        if (origQueryMap.get(name) !== (p.imageQuery || '').trim()) {
          imageQueriesChanged = true;
          break;
        }
      }
    }
  }

  const hasChanges =
    added.length > 0 ||
    removed.length > 0 ||
    reordered ||
    imageQueriesChanged ||
    orig.length !== edit.length;

  if (!hasChanges) {
    return {
      added,
      removed,
      reordered,
      imageQueriesChanged,
      hasChanges: false,
      summary: 'No changes.',
    };
  }

  const parts: string[] = [];
  if (added.length > 0) {
    parts.push(`Added: ${added.join(', ')}`);
  }
  if (removed.length > 0) {
    parts.push(`Removed: ${removed.join(', ')}`);
  }
  if (reordered) {
    parts.push('Reordered');
  }
  if (imageQueriesChanged && added.length === 0 && removed.length === 0 && !reordered) {
    parts.push('Photo search terms updated');
  }

  let summary = parts.join('. ') + '.';
  if (summary.length > 200) {
    summary = `Updated picks: +${added.length}, -${removed.length}${reordered ? ', reordered' : ''}. (${summary.slice(0, 150)}...)`;
    if (summary.length > 200) {
      summary = summary.slice(0, 197) + '...';
    }
  }

  return {
    added,
    removed,
    reordered,
    imageQueriesChanged,
    hasChanges: true,
    summary,
  };
}

