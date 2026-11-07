import { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import type { PlaceResult } from '../../lib/destinationView';
import {
  STYLE_COLLECTIONS,
  STYLE_KEYS,
  type StyleKey,
} from '../../data/styleCollections';
import {
  resolveDestinationPick,
  limitConcurrency,
  normalizeName,
  type TrendingDestinationRecord,
} from '../../lib/stylePicks';

interface ResolvedPick {
  pick: string;
  record: TrendingDestinationRecord;
  place: PlaceResult;
}

export default function StyleCollectionPage() {
  const { selectedStyle, navigate, openPlace, setPlannerDestination } = useApp();

  const activeKey: StyleKey =
    selectedStyle && STYLE_KEYS.includes(selectedStyle)
      ? selectedStyle
      : 'honeymoons';

  const collection = STYLE_COLLECTIONS[activeKey] ?? STYLE_COLLECTIONS.honeymoons;

  const [loading, setLoading] = useState(true);
  const [resolvedPicks, setResolvedPicks] = useState<ResolvedPick[]>([]);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadPicks() {
      setLoading(true);
      const currentPicks = collection.picks;

      const tasks = currentPicks.map((pick) => async () => {
        const record = await resolveDestinationPick(pick, { signal: controller.signal });
        return { pick, record };
      });

      const settled = await limitConcurrency(tasks, 3);

      if (!active || controller.signal.aborted) {
        return;
      }

      const successful: ResolvedPick[] = [];
      const debugRows: Array<{
        collection: string;
        'curated name': string;
        'resolved id or UNRESOLVED': string;
        'has image yes/no': 'yes' | 'no';
      }> = [];

      settled.forEach((result, idx) => {
        const pickName = currentPicks[idx];
        const record = result.status === 'fulfilled' ? result.value.record : null;

        debugRows.push({
          collection: activeKey,
          'curated name': pickName,
          'resolved id or UNRESOLVED': record
            ? (record.id || `dest-${normalizeName(record.name).replace(/\s+/g, '-')}`)
            : 'UNRESOLVED',
          'has image yes/no': record?.photoUrl ? 'yes' : 'no',
        });

        if (record) {
          const placeId = record.id || `dest-${normalizeName(record.name).replace(/\s+/g, '-')}`;
          const place: PlaceResult = {
            placeId,
            _id: placeId,
            name: record.name,
            photoUrl: record.photoUrl,
            image: record.photoUrl,
            imageUrl: record.photoUrl,
            city: record.name,
            state: record.state,
            country: record.country || 'India',
            type: record.type || 'Destination',
            category: record.category || 'Destination',
            isCurated: true,
          };
          successful.push({ pick: pickName, record, place });
        }
      });

      if (import.meta.env?.DEV) {
        console.table(debugRows);
      }

      setResolvedPicks(successful);
      setLoading(false);
    }

    loadPicks().catch((err) => {
      if (err?.name === 'AbortError' || controller.signal.aborted || !active) {
        return;
      }
      setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [activeKey, collection]);

  const handleImageError = (key: string) => {
    setImgErrors((prev) => ({ ...prev, [key]: true }));
  };

  const handlePlanTrip = (placeName: string) => {
    setPlannerDestination(placeName, '');
    navigate('ai-planner');
  };

  const hasPexelsImages = resolvedPicks.some(
    (p) => Boolean(p.place.photoUrl) && !imgErrors[p.place.placeId || p.place._id || p.pick]
  );

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      {/* ─── Hero Section ────────────────────────────────────────── */}
      <section className="relative bg-[#111111] text-white pt-24 pb-20 px-6 sm:px-10 lg:px-16 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb / Back to Home */}
          <div className="mb-8">
            <button
              onClick={() => navigate('home')}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-[#C9A96E] hover:text-white transition-colors cursor-pointer"
            >
              <span>←</span>
              <span>Back to Home</span>
            </button>
          </div>

          <div className="max-w-3xl">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight">
              {collection.label}
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-white/75 font-light leading-relaxed">
              {collection.tagline}
            </p>
            <p className="mt-5 text-[11px] sm:text-xs uppercase tracking-[0.2em] font-semibold text-[#C9A96E]">
              Our picks. Hand-selected, not ranked.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Content Section ─────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 py-14 sm:py-20">
        {loading ? (
          /* Loading skeleton */
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
            data-testid="style-collection-skeleton"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-white rounded-sm border border-[#E8E4DC] overflow-hidden shadow-xs animate-pulse"
              >
                <div className="h-56 bg-stone-200" />
                <div className="p-6 space-y-4">
                  <div className="h-6 bg-stone-200 rounded-sm w-3/4" />
                  <div className="h-4 bg-stone-100 rounded-sm w-1/2" />
                  <div className="pt-4 flex gap-3">
                    <div className="h-9 bg-stone-200 rounded-sm flex-1" />
                    <div className="h-9 bg-stone-100 rounded-sm flex-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : resolvedPicks.length === 0 ? (
          /* No picks matched */
          <div className="text-center py-20 px-4 bg-white border border-[#E8E4DC] rounded-sm max-w-lg mx-auto shadow-xs">
            <h2 className="font-display text-2xl text-[#252525] mb-2">
              More coming soon.
            </h2>
            <p className="text-sm text-[#77736C] mb-6">
              Our curated picks for this collection will appear here soon.
            </p>
            <button
              onClick={() => navigate('home')}
              className="px-6 py-2.5 bg-[#111111] hover:bg-black text-white text-xs font-semibold uppercase tracking-[0.1em] rounded-sm transition-colors cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        ) : (
          /* Cards grid */
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {resolvedPicks.map(({ pick, place }) => {
                const placeId = place.placeId || place._id || pick;
                const imgUrl = place.imageUrl || place.image || place.photoUrl;
                const hasImg = Boolean(imgUrl) && !imgErrors[placeId];

                const locationSubtitle =
                  [place.state, place.country].filter(Boolean).join(', ') ||
                  place.country ||
                  'India';

                const categoryBadge = place.category || place.type || 'Destination';

                return (
                  <div
                    key={placeId}
                    className="group bg-white rounded-sm border border-[#E8E4DC] overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
                  >
                    {/* Image / Fallback */}
                    <div className="relative h-60 w-full overflow-hidden bg-stone-900">
                      {hasImg ? (
                        <img
                          src={imgUrl}
                          alt={place.name}
                          onError={() => handleImageError(placeId)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#252525] to-[#111111] text-center">
                          <span className="font-display text-2xl text-white/80">
                            {place.name}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.15em] text-[#C9A96E] mt-1">
                            {categoryBadge}
                          </span>
                        </div>
                      )}

                      <div className="absolute top-3 left-3">
                        <span className="inline-block px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] bg-black/60 text-white backdrop-blur-xs rounded-xs">
                          {categoryBadge}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <h2 className="font-display text-2xl text-[#111111] group-hover:text-[#C9A96E] transition-colors leading-snug">
                          {place.name}
                        </h2>
                        <p className="text-xs text-[#77736C] mt-1.5 line-clamp-1">
                          {locationSubtitle}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="pt-6 mt-6 border-t border-[#E8E4DC] flex items-center gap-3">
                        <button
                          onClick={() => openPlace(place)}
                          className="flex-1 py-2.5 px-3 bg-[#111111] hover:bg-black text-white text-xs font-semibold uppercase tracking-[0.1em] rounded-sm transition-colors text-center cursor-pointer"
                        >
                          View details
                        </button>
                        <button
                          onClick={() => handlePlanTrip(place.name)}
                          className="flex-1 py-2.5 px-3 border border-[#E8E4DC] hover:border-[#111111] text-[#252525] text-xs font-semibold uppercase tracking-[0.1em] rounded-sm transition-colors text-center cursor-pointer"
                        >
                          Plan a trip here
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* If fewer than 3 cards resolved, show "More coming soon." */}
            {resolvedPicks.length < 3 && (
              <p className="text-center text-sm text-[#77736C] mt-8 italic">
                More coming soon.
              </p>
            )}

            {/* Pexels credit when displaying Pexels photos */}
            {hasPexelsImages && (
              <div className="mt-12 pt-6 border-t border-[#E8E4DC] flex items-center justify-center text-xs text-[#77736C]">
                <a
                  href="https://www.pexels.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-[#111111] transition-colors"
                >
                  <span>Photos via Pexels</span>
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
