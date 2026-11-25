import type { TripCoverImage } from '../data/mockData.ts';
import { hasRealCoverImage } from './journeyAdapter.ts';

export interface CoverBackfillCandidate {
  id: string;
  destination?: string;
  imageUrl?: string;
  coverImage?: TripCoverImage | null;
}

export function shouldAttemptCoverBackfill(
  journey: CoverBackfillCandidate | null | undefined,
  attemptedIds: Set<string>
): boolean {
  if (!journey || !journey.id) return false;
  if (!journey.destination || !journey.destination.trim()) return false;
  if (hasRealCoverImage(journey)) return false;
  if (attemptedIds.has(journey.id)) return false;
  return true;
}

/**
 * Lazily fills missing cover images for visible trips once per session,
 * strictly skipping trips that already have a real cover and capping
 * concurrent requests at `concurrency` (default 3).
 */
export async function backfillMissingTripCovers(options: {
  journeys: readonly CoverBackfillCandidate[];
  attemptedIds: Set<string>;
  fetchCover: (tripId: string) => Promise<TripCoverImage | null>;
  onCoverResolved: (tripId: string, coverImage: TripCoverImage) => void;
  concurrency?: number;
  isCancelled?: () => boolean;
}): Promise<number> {
  const {
    journeys,
    attemptedIds,
    fetchCover,
    onCoverResolved,
    concurrency = 3,
    isCancelled = () => false,
  } = options;

  const queue = journeys.filter((j) => shouldAttemptCoverBackfill(j, attemptedIds));
  if (queue.length === 0) return 0;

  for (const item of queue) {
    attemptedIds.add(item.id);
  }

  let cursor = 0;
  let fetchedCount = 0;
  const workersCount = Math.min(Math.max(1, concurrency), queue.length);

  async function worker() {
    while (!isCancelled()) {
      const idx = cursor++;
      if (idx >= queue.length) break;
      const trip = queue[idx];
      try {
        const cover = await fetchCover(trip.id);
        fetchedCount++;
        if (!isCancelled() && cover && cover.url) {
          onCoverResolved(trip.id, cover);
        }
      } catch {
        // Best-effort only; never interrupt UI or retry storm
      }
    }
  }

  await Promise.all(Array.from({ length: workersCount }, () => worker()));
  return fetchedCount;
}

