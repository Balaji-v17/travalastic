import type { TripCoverImage } from '../../data/mockData';
import { hasRealCoverImage } from '../../lib/journeyAdapter';

interface TripCoverVisualProps {
  journey: {
    destination: string;
    imageUrl?: string;
    coverImage?: TripCoverImage | null;
  };
  width?: number;
  height?: number;
  imgClassName?: string;
  creditPosition?: 'top-right' | 'bottom-right';
  showFallbackLabel?: boolean;
}

export default function TripCoverVisual({
  journey,
  width = 800,
  height = 450,
  imgClassName = '',
  creditPosition = 'top-right',
  showFallbackLabel = true,
}: TripCoverVisualProps) {
  const hasReal = hasRealCoverImage(journey);
  const srcUrl = journey.coverImage?.url || journey.imageUrl || '';
  const photographer = journey.coverImage?.photographer?.trim();
  const sourceLink =
    journey.coverImage?.sourceUrl ||
    journey.coverImage?.photographerUrl ||
    'https://www.pexels.com';

  if (!hasReal || !srcUrl) {
    return (
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center p-4"
        data-testid="trip-cover-fallback"
      >
        {showFallbackLabel && (
          <span className="font-display text-lg sm:text-2xl text-white/25 tracking-wider uppercase text-center select-none line-clamp-2">
            {journey.destination || 'Trip'}
          </span>
        )}
      </div>
    );
  }

  const posClass =
    creditPosition === 'bottom-right' ? 'bottom-2.5 right-2.5' : 'top-3 right-3';

  return (
    <>
      <img
        src={srcUrl}
        alt={`${journey.destination || 'Destination'} photo`}
        loading="lazy"
        width={width}
        height={height}
        className={`absolute inset-0 w-full h-full object-cover ${imgClassName}`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/15" />
      {photographer && (
        <a
          href={sourceLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${posClass} z-10 px-2 py-0.5 rounded bg-black/55 hover:bg-black/75 text-white/95 text-[10px] font-medium backdrop-blur-sm transition-colors`}
        >
          Photo: {photographer} / Pexels
        </a>
      )}
    </>
  );
}

