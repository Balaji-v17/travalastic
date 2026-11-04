export interface CuratedHotelItem {
  _id?: string;
  id?: string;
  destination?: string;
  budgetTier?: 'budget' | 'mid' | 'luxury' | string;
  name: string;
  priceRangeINR?: string;
  rating?: number;
  stars?: number;
  area?: string;
  highlights?: string[];
  image?: string;
  imageUrl?: string;
  bookingUrl?: string;
}

export interface CuratedHotelCardProps {
  hotel: CuratedHotelItem;
  bookingUrl?: string;
}

/**
 * Checks if a given booking URL contains a non-empty affiliate ID (`aid`).
 */
export function isAffiliateUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    const aid = parsed.searchParams.get('aid');
    return Boolean(aid && aid.trim().length > 0);
  } catch {
    return false;
  }
}

export default function CuratedHotelCard({ hotel, bookingUrl }: CuratedHotelCardProps) {
  const effectiveUrl = hotel.bookingUrl || bookingUrl || '';
  const isAffiliate = isAffiliateUrl(effectiveUrl);

  const rawImage = hotel.imageUrl || hotel.image;
  const initial = (hotel.name || 'H').trim().charAt(0).toUpperCase();
  const starsValue = hotel.stars != null ? hotel.stars : hotel.rating;

  return (
    <div
      className="p-5 border border-[#E8E4DC] bg-white flex flex-col justify-between transition-all hover:border-[#C9A96E]/60 shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
      style={{ borderRadius: '2px' }}
    >
      <div>
        {/* Hotel Media / Initial placeholder */}
        <div
          className="w-full h-40 mb-4 overflow-hidden relative flex items-center justify-center bg-gradient-to-br from-[#2C2B29] to-[#1E1D1B]"
          style={{ borderRadius: '2px' }}
        >
          {rawImage ? (
            <img
              src={rawImage}
              alt={hotel.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center select-none text-center px-4">
              <span className="font-serif text-3xl font-light text-[#C9A96E]/80 tracking-widest">
                {initial}
              </span>
              <span className="text-[10px] tracking-[0.2em] uppercase text-white/50 mt-1 font-mono">
                Curated Stay
              </span>
            </div>
          )}
        </div>

        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] font-semibold tracking-wider text-[#C9A96E] uppercase">
            {hotel.budgetTier || 'Curated'}
          </span>
          {starsValue != null && !isNaN(Number(starsValue)) && (
            <span className="text-xs font-semibold text-[#252525] flex items-center gap-1">
              <span className="text-[#C9A96E]">★</span>
              <span>{starsValue}</span>
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-display font-bold text-base text-[#111111] mb-1">
          {hotel.name}
        </h3>

        {/* Area (only if given) */}
        {hotel.area && (
          <p className="text-xs text-[#77736C] mb-2 font-medium">
            📍 {hotel.area}
          </p>
        )}

        {/* Highlights (only if given) */}
        {Array.isArray(hotel.highlights) && hotel.highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {hotel.highlights.slice(0, 3).map((hl, idx) => (
              <span
                key={idx}
                className="inline-block text-[10px] uppercase tracking-wide bg-[#F7F5F0] text-[#77736C] px-2 py-0.5 rounded-sm"
              >
                {hl}
              </span>
            ))}
          </div>
        )}

        {/* Indicative Price (ONLY if given) */}
        {hotel.priceRangeINR ? (
          <div className="mt-2 pt-2 border-t border-[#E8E4DC]/50">
            <p className="text-xs font-semibold text-[#111111]">
              Approx. {hotel.priceRangeINR}
            </p>
            <p className="text-[10px] text-[#77736C] mt-0.5 leading-snug">
              Indicative price per night. Check Booking.com for live rates
            </p>
          </div>
        ) : null}
      </div>

      {/* Outbound Link to Booking.com */}
      {effectiveUrl ? (
        <a
          href={effectiveUrl}
          target="_blank"
          rel={isAffiliate ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}
          className="mt-4 block text-center py-2.5 px-3 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] transition-colors focus:outline-none focus:ring-1 focus:ring-[#C9A96E]"
          style={{ borderRadius: '2px' }}
        >
          Open on Booking.com ↗
        </a>
      ) : null}
    </div>
  );
}

