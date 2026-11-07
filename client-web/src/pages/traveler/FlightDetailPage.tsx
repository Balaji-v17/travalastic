import { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { flights } from '../../data/mockData';
import { SHOW_SAMPLE_PAGES, FLIGHTS_TEST_MODE } from '../../config/features';
import {
  flightDetailView,
  formatLocalTime,
  formatDateLabel,
  formatDuration,
  formatMoney,
  layoverMinutes,
  isExpired,
  type FlightOffer,
} from '../../lib/flightAdapter';
import SampleDataBanner from '../../components/common/SampleDataBanner';
import SampleFlightDetailPage from './SampleFlightDetailPage';

export function LiveFlightDetailPage({ offer }: { offer: FlightOffer }) {
  const { navigate } = useApp();
  const [checkedAt] = useState(() => {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  });

  const [expired, setExpired] = useState(() => isExpired(offer));

  // Periodically check expiry against offer.expiresAt if provided
  useEffect(() => {
    if (!offer.expiresAt) return;
    const interval = setInterval(() => {
      if (isExpired(offer)) {
        setExpired(true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [offer]);

  const showTestBanner = offer.isTest || FLIGHTS_TEST_MODE;

  return (
    <div className="min-h-screen bg-[#F7F5F0] py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation back */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('search')}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#77736C] hover:text-[#111111] transition-colors"
          >
            <span>←</span> Back to Search
          </button>
        </div>

        {/* Test Fares Notice */}
        {showTestBanner && (
          <div
            className="p-3.5 bg-[#FFF9F0] border border-[#C9A96E]/40 text-[#6B5324] text-xs font-medium flex items-center gap-2.5"
            style={{ borderRadius: '2px' }}
          >
            <span className="text-sm">🧪</span>
            <span>
              <strong>Test fares:</strong> These are sandbox fares from our test airline connection. No real tickets are issued.
            </span>
          </div>
        )}

        {/* Header Hero Card */}
        <div
          className="bg-white border border-[#E8E4DC] p-6 sm:p-8"
          style={{ borderRadius: '2px' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E8E4DC]">
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 bg-[#111111] text-[#C9A96E] font-bold text-sm flex items-center justify-center tracking-wider"
                style={{ borderRadius: '2px' }}
              >
                {offer.carrier.code || offer.carrier.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-display font-bold text-[#111111]">
                  {offer.carrier.name}
                </h1>
                {offer.flightNumbers.length > 0 && (
                  <p className="text-xs font-mono text-[#77736C] mt-0.5">
                    {offer.flightNumbers.join(' · ')}
                  </p>
                )}
              </div>
            </div>

            <div className="sm:text-right">
              <p className="text-2xl sm:text-3xl font-display font-bold text-[#111111]">
                {formatMoney(offer.totalPrice.amount, offer.totalPrice.currency)}
              </p>
              <p className="text-xs text-[#77736C] mt-0.5">
                {offer.perAdultApprox
                  ? `${formatMoney(offer.perAdultApprox.amount, offer.perAdultApprox.currency)} approx. per traveler`
                  : 'Total fare'}
              </p>
            </div>
          </div>

          {/* Slices & Segments Timeline */}
          <div className="pt-6 space-y-6">
            {offer.slices.map((slice, sIdx) => (
              <div key={slice.id || sIdx} className="space-y-4">
                <div className="flex items-center justify-between text-xs text-[#77736C]">
                  <span className="font-semibold uppercase tracking-wider text-[#111111]">
                    Flight Journey · {slice.stops === 0 ? 'Non-stop' : `${slice.stops} stop${slice.stops > 1 ? 's' : ''}`}
                  </span>
                  <span>Duration: {formatDuration(slice.durationMinutes)}</span>
                </div>

                <div className="space-y-3">
                  {slice.segments.map((seg, segIdx) => {
                    const depTime = formatLocalTime(seg.departingAt);
                    const arrTime = formatLocalTime(seg.arrivingAt);
                    const depDate = formatDateLabel(seg.departingAt);
                    const arrDate = formatDateLabel(seg.arrivingAt);
                    const nextSeg = slice.segments[segIdx + 1];

                    const layover = nextSeg
                      ? layoverMinutes(
                          seg.arrivingAt,
                          nextSeg.departingAt,
                          seg.destinationIata,
                          nextSeg.originIata
                        )
                      : null;

                    return (
                      <div key={seg.id || segIdx} className="space-y-3">
                        <div
                          className="bg-[#FAFAF8] border border-[#E8E4DC] p-4 sm:p-5"
                          style={{ borderRadius: '2px' }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="font-mono text-base font-bold text-[#111111]">
                                  {seg.originIata}
                                </span>
                                <span className="text-xs text-[#77736C]">
                                  {seg.originName || seg.originCity}
                                </span>
                              </div>
                              <p className="text-lg font-bold text-[#111111] mt-1">{depTime}</p>
                              {depDate && <p className="text-xs text-[#77736C]">{depDate}</p>}
                            </div>

                            <div className="flex flex-col items-center px-4">
                              <span className="text-[11px] text-[#77736C] font-medium mb-1">
                                {formatDuration(seg.durationMinutes)}
                              </span>
                              <div className="w-20 sm:w-28 flex items-center gap-1">
                                <div className="h-0.5 flex-1 bg-[#E8E4DC]" />
                                <span className="text-xs text-[#C9A96E]">✈</span>
                                <div className="h-0.5 flex-1 bg-[#E8E4DC]" />
                              </div>
                              {seg.flightNumber && (
                                <span className="text-[10px] font-mono text-[#77736C] mt-1">
                                  {seg.flightNumber}
                                </span>
                              )}
                            </div>

                            <div className="flex-1 text-right">
                              <div className="flex items-baseline justify-end gap-2">
                                <span className="text-xs text-[#77736C]">
                                  {seg.destinationName || seg.destinationCity}
                                </span>
                                <span className="font-mono text-base font-bold text-[#111111]">
                                  {seg.destinationIata}
                                </span>
                              </div>
                              <p className="text-lg font-bold text-[#111111] mt-1">{arrTime}</p>
                              {arrDate && <p className="text-xs text-[#77736C]">{arrDate}</p>}
                            </div>
                          </div>

                          {(seg.carrierName || seg.aircraftName) && (
                            <div className="mt-3 pt-3 border-t border-[#E8E4DC]/60 flex flex-wrap items-center gap-4 text-xs text-[#77736C]">
                              {seg.carrierName && <span>Operated by: <strong>{seg.carrierName}</strong></span>}
                              {seg.aircraftName && <span>Aircraft: <strong>{seg.aircraftName}</strong></span>}
                              {seg.baggageSummary && <span>Baggage: <strong>{seg.baggageSummary}</strong></span>}
                            </div>
                          )}
                        </div>

                        {/* Layover banner between segments */}
                        {layover != null && nextSeg && (
                          <div
                            className="bg-[#F7F5F0] border border-[#E8E4DC] px-4 py-2 text-xs text-[#77736C] flex items-center justify-between"
                            style={{ borderRadius: '2px' }}
                          >
                            <span>
                              Connection at <strong>{seg.destinationName || seg.destinationIata}</strong> ({seg.destinationIata})
                            </span>
                            <span className="font-medium text-[#111111]">
                              Layover: {formatDuration(layover)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Fare rules & Baggage details */}
          <div className="mt-6 pt-6 border-t border-[#E8E4DC] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className="p-4 bg-[#FAFAF8] border border-[#E8E4DC]"
              style={{ borderRadius: '2px' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-[#77736C] mb-1.5">
                Baggage Allowance
              </p>
              <p className="text-sm text-[#111111]">
                {offer.baggage || 'Check fare rules with airline'}
              </p>
            </div>

            <div
              className="p-4 bg-[#FAFAF8] border border-[#E8E4DC]"
              style={{ borderRadius: '2px' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-[#77736C] mb-1.5">
                Refund & Changes
              </p>
              <p className="text-sm text-[#111111]">
                {offer.refundConditions || 'Check fare rules'}
              </p>
              {offer.changeConditions && (
                <p className="text-xs text-[#77736C] mt-1">{offer.changeConditions}</p>
              )}
            </div>
          </div>

          {/* Expiry line */}
          <p className="text-xs text-[#77736C] mt-6 italic text-center">
            Fare checked at {checkedAt}. Prices can change; we re-check before booking.
          </p>

          {/* Action section */}
          <div className="mt-6 pt-6 border-t border-[#E8E4DC] flex flex-col items-center gap-2">
            {expired ? (
              <button
                onClick={() => navigate('search')}
                className="w-full sm:w-auto px-8 py-3 bg-[#111111] text-white text-sm font-semibold hover:bg-[#252525] transition-colors"
                style={{ borderRadius: '2px' }}
              >
                This fare expired. Search again.
              </button>
            ) : (
              <button
                onClick={() => navigate('flight-booking')}
                className="w-full sm:w-auto px-8 py-3 bg-[#111111] text-white text-sm font-semibold hover:bg-[#252525] transition-colors"
                style={{ borderRadius: '2px' }}
              >
                Continue to booking
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FlightDetailRouter() {
  const { selectedOffer, selectedFlightId, navigate } = useApp();
  const mockIds = flights.map((f) => f.id);

  const decision = flightDetailView({
    selectedOffer,
    selectedFlightId,
    mockIds,
    showSample: SHOW_SAMPLE_PAGES,
  });

  if (decision === 'live' && selectedOffer) {
    return <LiveFlightDetailPage offer={selectedOffer} />;
  }

  if (decision === 'sample') {
    return (
      <>
        <SampleDataBanner />
        <SampleFlightDetailPage />
      </>
    );
  }

  // Not found state: never fall back to mock
  return (
    <div className="min-h-screen bg-[#F7F5F0] py-20 px-4 flex items-center justify-center">
      <div
        className="max-w-md w-full bg-white p-8 sm:p-10 text-center border border-[#E8E4DC]"
        style={{ borderRadius: '2px' }}
      >
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#F7F5F0] border border-[#E8E4DC] flex items-center justify-center text-xl text-[#77736C]">
          ✈
        </div>
        <h2 className="font-display text-2xl font-bold text-[#111111] mb-2">Flight Not Found</h2>
        <p className="text-sm text-[#77736C] mb-8 leading-relaxed">
          We couldn't find that flight offer. Search again to see live fares.
        </p>
        <button
          onClick={() => navigate('search')}
          className="w-full py-3 bg-[#111111] text-white text-sm font-semibold hover:bg-[#252525] transition-colors"
          style={{ borderRadius: '2px' }}
        >
          Search Flights
        </button>
      </div>
    </div>
  );
}
