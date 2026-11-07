import { useState, useReducer, useEffect, useRef, type FormEvent } from 'react';
import { useApp } from '../../store/AppContext';
import { useAuth } from '../../store/AuthContext';
import { formatMoney, formatLocalTime, formatDateLabel, formatDuration, type FlightOffer } from '../../lib/flightAdapter';
import { repriceOffer, createBooking, BookingApiError, type BookingResponse } from '../../lib/bookingApi';
import { listBookings } from '../../lib/bookingsApi';
import { toBookingView, findRecentBookingForOffer } from '../../lib/bookingView';
import {
  validateAllPassengers,
  bookingReducer,
  initialBookingState,
  type PassengerInput,
  type ContactInput,
  type Title,
  type Gender,
  type ValidationResult,
} from '../../lib/passengerValidation';
import { SHOW_SAMPLE_PAGES } from '../../config/features';
import FlightBookingFlow from './booking/FlightBookingFlow';
import SampleDataBanner from '../../components/common/SampleDataBanner';

const TITLES: { id: Title; label: string }[] = [
  { id: 'mr', label: 'Mr' },
  { id: 'ms', label: 'Ms' },
  { id: 'mrs', label: 'Mrs' },
  { id: 'miss', label: 'Miss' },
  { id: 'dr', label: 'Dr' },
];

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'm', label: 'Male' },
  { id: 'f', label: 'Female' },
];

export function LiveFlightBookingPage({ offer }: { offer: FlightOffer }) {
  const { navigate, searchQuery, journeys } = useApp();
  const { user } = useAuth();

  const adultCount = Math.max(1, searchQuery.travelers || 1);

  // Volatile component state only — never written to disk, localStorage, or query params
  const [passengers, setPassengers] = useState<PassengerInput[]>(() => {
    return Array.from({ length: adultCount }, (_, idx) => ({
      givenName: '',
      familyName: '',
      dateOfBirth: '1995-06-15',
      gender: 'm',
      title: 'mr',
    }));
  });

  const [contact, setContact] = useState<ContactInput>(() => ({
    email: user?.email || '',
    phone: '',
  }));

  const [itineraryId, setItineraryId] = useState<string>('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false);
  const [statusCheckResult, setStatusCheckResult] = useState<'not_found' | 'error' | null>(null);
  const [statusCheckError, setStatusCheckError] = useState<string | null>(null);

  const [state, dispatch] = useReducer(bookingReducer, initialBookingState);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    setStatusCheckResult(null);
    setStatusCheckError(null);
    try {
      const rawList = await listBookings();
      const views = rawList.map(toBookingView);
      const found = findRecentBookingForOffer(views, offer.id);
      if (found) {
        dispatch({
          type: 'BOOKING_SUCCESS',
          confirmation: {
            bookingReference: found.reference,
            orderId: found.orderId,
            bookingId: found.id,
            itineraryId: found.itineraryId,
            status: found.status,
            passengerNames: found.passengerNames,
            totalAmount: found.totalAmount,
            currency: found.currency,
            recovered: true,
          },
        });
      } else {
        setStatusCheckResult('not_found');
      }
    } catch (err: any) {
      setStatusCheckResult('error');
      setStatusCheckError(err?.message || 'Could not verify booking status. Please retry.');
    } finally {
      setCheckingStatus(false);
    }
  };

  // BeforeUnload protection during active submission or unconfirmed state
  useEffect(() => {
    if (state.status === 'submitting' || state.status === 'unknown') {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [state.status]);

  // When step 2 (repricing) begins, call repriceOffer
  useEffect(() => {
    if (state.status === 'repricing') {
      let cancelled = false;
      const controller = new AbortController();

      repriceOffer(offer.id, controller.signal)
        .then((fresh) => {
          if (cancelled) return;
          if (fresh.isValid && fresh.price) {
            dispatch({ type: 'REPRICE_SUCCESS', newPrice: fresh.price });
          } else {
            dispatch({
              type: 'REPRICE_FAILED',
              error: {
                status: 409,
                code: 'OFFER_EXPIRED',
                message: fresh.message || 'This fare is no longer available. Please search again.',
              },
            });
          }
        })
        .catch((err) => {
          if (cancelled) return;
          dispatch({
            type: 'REPRICE_FAILED',
            error: {
              status: err.status || 502,
              code: err.code || 'REPRICE_ERROR',
              message: err.message || 'Failed to re-verify offer pricing. Please try again.',
            },
          });
        });

      return () => {
        cancelled = true;
        controller.abort();
      };
    }
  }, [state.status, offer.id]);

  // Block flow if identity documents are required (not supported on web)
  if (offer.passengerIdentityDocumentsRequired) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div
          className="p-8 bg-[#FDF9F5] border border-[#E8E4DC]"
          style={{ borderRadius: '2px' }}
        >
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#FAF5EC] flex items-center justify-center text-[#C9A96E] text-2xl font-serif">
            !
          </div>
          <h2 className="text-xl font-bold text-[#111111] mb-2 font-serif">
            Travel Documents Required
          </h2>
          <p className="text-sm text-[#77736C] mb-6 leading-relaxed">
            This fare needs travel document details, which aren't supported on the web yet. Book in the mobile app or choose another fare.
          </p>
          <button
            onClick={() => navigate('search')}
            className="px-6 py-2.5 bg-[#111111] text-white text-sm font-semibold hover:bg-[#252525] transition-colors"
            style={{ borderRadius: '2px' }}
          >
            Back to flight search
          </button>
        </div>
      </div>
    );
  }

  const updatePassenger = (idx: number, field: keyof PassengerInput, val: string) => {
    setPassengers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
    if (validationResult) setValidationResult(null);
  };

  const handlePassengersSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateAllPassengers(passengers, contact);
    if (!result.isValid) {
      setValidationResult(result);
      setTimeout(() => {
        errorSummaryRef.current?.focus();
      }, 50);
      return;
    }
    setValidationResult(null);
    dispatch({
      type: 'START_REPRICE',
      passengers,
      contact,
      itineraryId: itineraryId || null,
      originalPrice: offer.totalPrice,
    });
  };

  const handleBook = async () => {
    dispatch({ type: 'SUBMIT_BOOKING' });

    try {
      const response = await createBooking({
        offerId: offer.id,
        passengers: state.passengers.map((p) => ({
          givenName: p.givenName.trim(),
          familyName: p.familyName.trim(),
          dateOfBirth: p.dateOfBirth.trim(),
          gender: p.gender,
          title: p.title,
          email: state.contact.email.trim(),
          phoneNumber: state.contact.phone.trim(),
        })),
        itineraryId: state.itineraryId || undefined,
      });

      // Purge volatile passenger form state in local React state
      setPassengers([]);
      setContact({ email: '', phone: '' });

      dispatch({ type: 'BOOKING_SUCCESS', confirmation: response });
    } catch (err: any) {
      const status = err?.status;
      const code = err?.code;
      const message = err?.message || 'An error occurred during booking.';
      dispatch({
        type: 'BOOKING_FAILURE',
        error: { status, code, message },
      });
    }
  };

  // Outcome: CONFIRMED
  if (state.status === 'confirmed' && state.confirmation) {
    const conf: BookingResponse = state.confirmation;
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div
          className="bg-white border border-[#E8E4DC] p-8 sm:p-10 shadow-sm"
          style={{ borderRadius: '2px' }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#F0FDF4] border border-[#DCFCE7] flex items-center justify-center text-[#16A34A] text-lg font-bold">
              ✓
            </div>
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#16A34A]">
                Booking Confirmed
              </span>
              <h1 className="text-2xl font-bold text-[#111111] font-serif">
                Your flight is booked
              </h1>
            </div>
          </div>

          {(conf as any).recovered && (
            <div
              className="mb-6 p-4 bg-[#F0FDF4] border border-[#DCFCE7] text-xs font-semibold text-[#16A34A] flex items-center gap-2"
              style={{ borderRadius: '2px' }}
            >
              <span className="font-bold">✓</span>
              <span>Your booking did go through.</span>
            </div>
          )}

          {offer.isTest && (
            <div
              className="mb-6 p-3 bg-[#F7F5F0] border border-[#E8E4DC] text-xs text-[#77736C] flex items-center gap-2"
              style={{ borderRadius: '2px' }}
            >
              <span className="font-semibold text-[#111111]">Test booking.</span>
              <span>No payment is taken and no real ticket is issued.</span>
            </div>
          )}

          <div className="space-y-4 py-4 border-y border-[#E8E4DC] text-sm">
            <div className="flex justify-between items-baseline">
              <span className="text-[#77736C]">Booking Reference (PNR)</span>
              <span className="font-mono text-base font-bold text-[#111111] tracking-wider">
                {conf.bookingReference}
              </span>
            </div>

            {conf.orderId && (
              <div className="flex justify-between items-baseline">
                <span className="text-[#77736C]">Duffel Order ID</span>
                <span className="font-mono text-xs text-[#77736C]">{conf.orderId}</span>
              </div>
            )}

            <div className="flex justify-between items-baseline">
              <span className="text-[#77736C]">Status</span>
              <span className="font-semibold text-[#16A34A] capitalize">{conf.status}</span>
            </div>

            <div className="flex justify-between items-baseline">
              <span className="text-[#77736C]">Route</span>
              <span className="font-semibold text-[#111111]">
                {offer.originIata} → {offer.destinationIata}
              </span>
            </div>

            <div className="flex justify-between items-baseline">
              <span className="text-[#77736C]">Departure</span>
              <span className="text-[#111111]">
                {formatDateLabel(offer.departureTime)} at {formatLocalTime(offer.departureTime)}
              </span>
            </div>

            <div className="flex justify-between items-baseline">
              <span className="text-[#77736C]">Passengers</span>
              <span className="font-medium text-[#111111] text-right">
                {conf.passengerNames && conf.passengerNames.length > 0
                  ? conf.passengerNames.join(', ')
                  : 'Confirmed traveler'}
              </span>
            </div>

            <div className="flex justify-between items-baseline pt-2 border-t border-[#E8E4DC]/60">
              <span className="font-semibold text-[#111111]">Total Paid</span>
              <span className="font-serif text-lg font-bold text-[#111111]">
                {formatMoney(conf.totalAmount, conf.currency)}
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('my-trips')}
              className="flex-1 px-6 py-3 bg-[#111111] text-white text-sm font-semibold hover:bg-[#252525] transition-colors text-center"
              style={{ borderRadius: '2px' }}
            >
              View my trips
            </button>
            <button
              onClick={() => navigate('search')}
              className="px-6 py-3 bg-white border border-[#E8E4DC] text-sm font-semibold text-[#111111] hover:bg-[#FAFAF8] transition-colors text-center"
              style={{ borderRadius: '2px' }}
            >
              Search more flights
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Outcome: UNKNOWN FAILURE
  if (state.status === 'unknown') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div
          className="bg-white border-2 border-[#E8E4DC] p-8 shadow-sm"
          style={{ borderRadius: '2px' }}
        >
          <div className="w-12 h-12 rounded-full bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center text-[#D97706] text-2xl font-serif mb-4">
            ?
          </div>
          <h2 className="text-xl font-bold text-[#111111] font-serif mb-2">
            We couldn't confirm your booking
          </h2>
          <p className="text-sm text-[#77736C] mb-6 leading-relaxed">
            Network communication was interrupted while confirming your booking with the airline. It may have gone through. Don't book again yet to avoid double charges.
          </p>

          {statusCheckResult === 'not_found' && (
            <div
              className="mb-6 p-4 bg-[#F7F5F0] border border-[#E8E4DC] text-xs text-[#111111] leading-relaxed"
              style={{ borderRadius: '2px' }}
            >
              <p className="font-semibold mb-1">No booking found yet.</p>
              <p className="text-[#77736C]">
                Wait a minute and check again, or look in My Bookings.
              </p>
            </div>
          )}

          {statusCheckResult === 'error' && (
            <div
              className="mb-6 p-4 bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#B91C1C] leading-relaxed"
              style={{ borderRadius: '2px' }}
            >
              <p className="font-semibold mb-1">Status check error</p>
              <p>{statusCheckError || 'Unable to check booking status. Please check your network and retry.'}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              disabled={checkingStatus}
              onClick={handleCheckStatus}
              className="px-6 py-3 bg-[#111111] text-white text-sm font-semibold hover:bg-[#252525] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ borderRadius: '2px' }}
            >
              {checkingStatus ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Checking status…</span>
                </>
              ) : (
                <span>{statusCheckResult === 'not_found' ? 'Check status again' : 'Check status'}</span>
              )}
            </button>

            {statusCheckResult === 'not_found' ? (
              <button
                onClick={() => navigate('my-bookings')}
                className="px-6 py-3 bg-white border border-[#E8E4DC] text-sm font-semibold text-[#111111] hover:bg-[#FAFAF8] transition-colors"
                style={{ borderRadius: '2px' }}
              >
                Go to My Bookings
              </button>
            ) : (
              <button
                onClick={() => navigate('search')}
                className="px-6 py-3 bg-white border border-[#E8E4DC] text-sm font-semibold text-[#111111] hover:bg-[#FAFAF8] transition-colors"
                style={{ borderRadius: '2px' }}
              >
                Back to search
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] py-8 sm:py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between text-xs text-[#77736C]">
          <button
            onClick={() => navigate('flight-detail')}
            className="hover:text-[#111111] transition-colors flex items-center gap-1 font-medium"
          >
            ← Back to flight details
          </button>
          <div className="flex items-center gap-2 font-mono uppercase tracking-wider">
            <span className={state.status === 'editing' ? 'text-[#111111] font-bold' : ''}>
              1. Passengers
            </span>
            <span>/</span>
            <span
              className={
                state.status === 'repricing' || state.status === 'review' || state.status === 'submitting'
                  ? 'text-[#111111] font-bold'
                  : ''
              }
            >
              2. Review & Book
            </span>
          </div>
        </div>

        {/* Flight summary banner */}
        <div
          className="bg-white border border-[#E8E4DC] p-5 mb-6"
          style={{ borderRadius: '2px' }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[#111111]">{offer.carrier.name}</span>
              {offer.flightNumbers.length > 0 && (
                <span className="text-xs font-mono text-[#77736C]">
                  {offer.flightNumbers.join(', ')}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="font-serif text-lg font-bold text-[#111111]">
                {formatMoney(
                  state.currentPrice ? state.currentPrice.amount : offer.totalPrice.amount,
                  state.currentPrice ? state.currentPrice.currency : offer.totalPrice.currency
                )}
              </span>
              <span className="text-xs text-[#77736C] ml-1">total</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#77736C]">
            <span className="font-bold text-[#111111] font-mono">
              {offer.originIata} → {offer.destinationIata}
            </span>
            <span>•</span>
            <span>{formatDateLabel(offer.departureTime)}</span>
            <span>•</span>
            <span>{formatDuration(offer.durationMinutes)}</span>
            <span>•</span>
            <span>{offer.stops === 0 ? 'Nonstop' : `${offer.stops} stop`}</span>
          </div>
        </div>

        {/* STEP 1: PASSENGERS FORM */}
        {state.status === 'editing' && (
          <form
            onSubmit={handlePassengersSubmit}
            noValidate
            className="bg-white border border-[#E8E4DC] p-6 sm:p-8"
            style={{ borderRadius: '2px' }}
          >
            <div className="mb-6">
              <h1 className="text-xl font-bold text-[#111111] font-serif mb-1">
                Passenger Details
              </h1>
              <p className="text-xs text-[#77736C]">
                Enter names exactly as on the travel document.
              </p>
            </div>

            {/* Error Summary */}
            {validationResult && !validationResult.isValid && (
              <div
                ref={errorSummaryRef}
                tabIndex={-1}
                role="alert"
                aria-label="Form validation errors"
                className="mb-6 p-4 bg-[#FEF2F2] border border-[#FCA5A5] focus:outline-none"
                style={{ borderRadius: '2px' }}
              >
                <p className="text-xs font-bold text-[#B91C1C] uppercase tracking-wider mb-2">
                  Please review the following errors:
                </p>
                <ul className="list-disc list-inside text-xs text-[#B91C1C] space-y-1">
                  {validationResult.allErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Passengers loop */}
            <div className="space-y-6">
              {passengers.map((p, idx) => {
                const pNum = idx + 1;
                const errs = validationResult?.passengerErrors[idx] || {};

                return (
                  <div
                    key={idx}
                    className="p-5 bg-[#FAFAF8] border border-[#E8E4DC]"
                    style={{ borderRadius: '2px' }}
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-4">
                      Passenger {pNum} (Adult)
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 mb-4">
                      {/* Title */}
                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`p_${idx}_title`}
                          className="block text-xs font-medium text-[#111111] mb-1"
                        >
                          Title
                        </label>
                        <select
                          id={`p_${idx}_title`}
                          value={p.title || 'mr'}
                          onChange={(e) => updatePassenger(idx, 'title', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#E8E4DC] text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
                          style={{ borderRadius: '2px' }}
                        >
                          {TITLES.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Gender */}
                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`p_${idx}_gender`}
                          className="block text-xs font-medium text-[#111111] mb-1"
                        >
                          Gender
                        </label>
                        <select
                          id={`p_${idx}_gender`}
                          value={p.gender || 'm'}
                          onChange={(e) => updatePassenger(idx, 'gender', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#E8E4DC] text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
                          style={{ borderRadius: '2px' }}
                        >
                          {GENDERS.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Date of Birth */}
                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`p_${idx}_dob`}
                          className="block text-xs font-medium text-[#111111] mb-1"
                        >
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          id={`p_${idx}_dob`}
                          value={p.dateOfBirth}
                          autoComplete={idx === 0 ? 'bday' : undefined}
                          onChange={(e) => updatePassenger(idx, 'dateOfBirth', e.target.value)}
                          className={`w-full px-3 py-2 bg-white border ${
                            errs.dateOfBirth ? 'border-[#EF4444]' : 'border-[#E8E4DC]'
                          } text-xs text-[#111111] focus:outline-none focus:border-[#111111]`}
                          style={{ borderRadius: '2px' }}
                        />
                        {errs.dateOfBirth && (
                          <p className="text-[11px] text-[#EF4444] mt-1">{errs.dateOfBirth}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Given Name */}
                      <div>
                        <label
                          htmlFor={`p_${idx}_given_name`}
                          className="block text-xs font-medium text-[#111111] mb-1"
                        >
                          Given Name (First Name)
                        </label>
                        <input
                          type="text"
                          id={`p_${idx}_given_name`}
                          value={p.givenName}
                          autoComplete={idx === 0 ? 'given-name' : undefined}
                          placeholder="e.g. Jean"
                          maxLength={40}
                          onChange={(e) => updatePassenger(idx, 'givenName', e.target.value)}
                          className={`w-full px-3 py-2 bg-white border ${
                            errs.givenName ? 'border-[#EF4444]' : 'border-[#E8E4DC]'
                          } text-xs text-[#111111] focus:outline-none focus:border-[#111111]`}
                          style={{ borderRadius: '2px' }}
                        />
                        {errs.givenName && (
                          <p className="text-[11px] text-[#EF4444] mt-1">{errs.givenName}</p>
                        )}
                      </div>

                      {/* Family Name */}
                      <div>
                        <label
                          htmlFor={`p_${idx}_family_name`}
                          className="block text-xs font-medium text-[#111111] mb-1"
                        >
                          Family Name (Last Name)
                        </label>
                        <input
                          type="text"
                          id={`p_${idx}_family_name`}
                          value={p.familyName}
                          autoComplete={idx === 0 ? 'family-name' : undefined}
                          placeholder="e.g. Dupont"
                          maxLength={40}
                          onChange={(e) => updatePassenger(idx, 'familyName', e.target.value)}
                          className={`w-full px-3 py-2 bg-white border ${
                            errs.familyName ? 'border-[#EF4444]' : 'border-[#E8E4DC]'
                          } text-xs text-[#111111] focus:outline-none focus:border-[#111111]`}
                          style={{ borderRadius: '2px' }}
                        />
                        {errs.familyName && (
                          <p className="text-[11px] text-[#EF4444] mt-1">{errs.familyName}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Contact details */}
            <div className="mt-8 pt-6 border-t border-[#E8E4DC]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-1">
                Contact Details
              </h3>
              <p className="text-xs text-[#77736C] mb-4">
                Booking confirmation and airline schedule notices will be sent here.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact_email" className="block text-xs font-medium text-[#111111] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="contact_email"
                    value={contact.email}
                    autoComplete="email"
                    placeholder="traveler@example.com"
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    className={`w-full px-3 py-2 bg-white border ${
                      validationResult?.contactErrors.email ? 'border-[#EF4444]' : 'border-[#E8E4DC]'
                    } text-xs text-[#111111] focus:outline-none focus:border-[#111111]`}
                    style={{ borderRadius: '2px' }}
                  />
                  {validationResult?.contactErrors.email && (
                    <p className="text-[11px] text-[#EF4444] mt-1">
                      {validationResult.contactErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="contact_phone" className="block text-xs font-medium text-[#111111] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="contact_phone"
                    value={contact.phone}
                    autoComplete="tel"
                    placeholder="+1 202 555 0199"
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    className={`w-full px-3 py-2 bg-white border ${
                      validationResult?.contactErrors.phone ? 'border-[#EF4444]' : 'border-[#E8E4DC]'
                    } text-xs text-[#111111] focus:outline-none focus:border-[#111111]`}
                    style={{ borderRadius: '2px' }}
                  />
                  {validationResult?.contactErrors.phone ? (
                    <p className="text-[11px] text-[#EF4444] mt-1">
                      {validationResult.contactErrors.phone}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#77736C] mt-1">
                      Include country code starting with '+' (e.g. +1...)
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Optional Attach to Trip */}
            <div className="mt-8 pt-6 border-t border-[#E8E4DC]">
              <label htmlFor="attach_trip" className="block text-xs font-bold uppercase tracking-wider text-[#111111] mb-1">
                Attach to a trip (optional)
              </label>
              <select
                id="attach_trip"
                value={itineraryId}
                onChange={(e) => setItineraryId(e.target.value)}
                className="w-full sm:w-80 px-3 py-2 bg-white border border-[#E8E4DC] text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
                style={{ borderRadius: '2px' }}
              >
                <option value="">No trip</option>
                {journeys.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.destination} ({j.startDate ? `${j.startDate} – ${j.endDate}` : 'Trip'})
                  </option>
                ))}
              </select>
              <p className="text-xs text-[#77736C] mt-1.5">
                Linking a flight to a trip lets us watch for airline schedule changes.
              </p>
            </div>

            {/* Privacy notice */}
            <p className="text-xs text-[#77736C] mt-8 pt-4 border-t border-[#E8E4DC]/60">
              Passenger details are sent to our flight partner and the airline to issue your ticket.{' '}
              <button
                type="button"
                onClick={() => navigate('privacy')}
                className="underline hover:text-[#111111] transition-colors"
              >
                See our privacy policy.
              </button>
            </p>

            {/* Continue Button */}
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3 bg-[#111111] text-white text-sm font-semibold hover:bg-[#252525] transition-colors"
                style={{ borderRadius: '2px' }}
              >
                Continue to review
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: REPRICING LOADER */}
        {state.status === 'repricing' && (
          <div
            className="bg-white border border-[#E8E4DC] p-12 text-center"
            style={{ borderRadius: '2px' }}
          >
            <div className="w-8 h-8 border-2 border-[#E8E4DC] border-t-[#111111] rounded-full animate-spin mx-auto mb-3" />
            <h2 className="text-base font-bold text-[#111111] mb-1">
              Checking real-time price & availability…
            </h2>
            <p className="text-xs text-[#77736C]">
              Re-verifying ticket availability directly with the airline before booking.
            </p>
          </div>
        )}

        {/* STEP 2: REVIEW & CONFIRM */}
        {(state.status === 'review' || state.status === 'submitting') && (
          <div
            className="bg-white border border-[#E8E4DC] p-6 sm:p-8"
            style={{ borderRadius: '2px' }}
          >
            <div className="mb-6 flex justify-between items-baseline">
              <h1 className="text-xl font-bold text-[#111111] font-serif">
                Review and Book
              </h1>
              <button
                type="button"
                disabled={state.status === 'submitting'}
                onClick={() => dispatch({ type: 'BACK_TO_EDIT' })}
                className="text-xs text-[#77736C] hover:text-[#111111] underline disabled:opacity-50"
              >
                Edit passenger details
              </button>
            </div>

            {/* Test Mode Banner */}
            {offer.isTest && (
              <div
                className="mb-6 p-3 bg-[#F7F5F0] border border-[#E8E4DC] text-xs text-[#77736C] flex items-center gap-2"
                style={{ borderRadius: '2px' }}
              >
                <span className="font-semibold text-[#111111]">Test booking.</span>
                <span>No payment is taken and no real ticket is issued.</span>
              </div>
            )}

            {/* Price change alert */}
            {state.priceComparison === 'higher' && (
              <div
                className="mb-6 p-4 bg-[#FEF3C7] border border-[#FDE68A]"
                style={{ borderRadius: '2px' }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-base font-bold text-[#D97706]">!</span>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#92400E] mb-1">
                      Price Changed
                    </h3>
                    <p className="text-xs text-[#78350F] mb-3 leading-relaxed">
                      The airline updated this fare from{' '}
                      <strong>{formatMoney(state.originalPrice?.amount, state.originalPrice?.currency)}</strong> to{' '}
                      <strong>{formatMoney(state.currentPrice?.amount, state.currentPrice?.currency)}</strong>.
                    </p>
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#78350F] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.priceAccepted}
                        onChange={() => dispatch({ type: 'ACCEPT_PRICE' })}
                        className="rounded border-[#D97706] text-[#111111] focus:ring-[#111111]"
                      />
                      <span>Accept new price and continue</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Passenger Summary (names and contact only — no DOB) */}
            <div className="mb-6 p-4 bg-[#FAFAF8] border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-2">
                Travelers
              </h3>
              <ul className="text-xs text-[#111111] space-y-1 mb-3">
                {state.passengers.map((p, i) => (
                  <li key={i} className="font-medium">
                    Passenger {i + 1}: {p.title ? `${p.title.toUpperCase()} ` : ''}{p.givenName} {p.familyName}
                  </li>
                ))}
              </ul>
              <div className="text-xs text-[#77736C] border-t border-[#E8E4DC] pt-2 flex flex-wrap gap-4">
                <span>Email: <strong>{state.contact.email}</strong></span>
                <span>Phone: <strong>{state.contact.phone}</strong></span>
              </div>
            </div>

            {/* Fare rules (baggage and refund) */}
            {(offer.baggage || offer.refundConditions || offer.changeConditions) && (
              <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {offer.baggage && (
                  <div className="p-3 bg-[#FAFAF8] border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>
                    <span className="font-semibold text-[#111111] block mb-0.5">Baggage</span>
                    <span className="text-[#77736C]">{offer.baggage}</span>
                  </div>
                )}
                {(offer.refundConditions || offer.changeConditions) && (
                  <div className="p-3 bg-[#FAFAF8] border border-[#E8E4DC]" style={{ borderRadius: '2px' }}>
                    <span className="font-semibold text-[#111111] block mb-0.5">Changes & Refunds</span>
                    <span className="text-[#77736C]">
                      {offer.refundConditions || offer.changeConditions}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Price Total */}
            <div className="py-4 border-t border-[#E8E4DC] flex justify-between items-baseline mb-6">
              <span className="text-sm font-semibold text-[#111111]">Total Amount</span>
              <span className="font-serif text-2xl font-bold text-[#111111]">
                {formatMoney(
                  state.currentPrice ? state.currentPrice.amount : offer.totalPrice.amount,
                  state.currentPrice ? state.currentPrice.currency : offer.totalPrice.currency
                )}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                disabled={state.status === 'submitting'}
                onClick={() => dispatch({ type: 'BACK_TO_EDIT' })}
                className="w-full sm:w-auto px-6 py-2.5 bg-white border border-[#E8E4DC] text-xs font-semibold text-[#111111] hover:bg-[#FAFAF8] transition-colors"
                style={{ borderRadius: '2px' }}
              >
                Back to edit details
              </button>

              <button
                type="button"
                aria-busy={state.status === 'submitting'}
                disabled={
                  state.status === 'submitting' ||
                  (state.priceComparison === 'higher' && !state.priceAccepted)
                }
                onClick={handleBook}
                className="w-full sm:w-auto px-8 py-3 bg-[#111111] text-white text-sm font-semibold hover:bg-[#252525] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ borderRadius: '2px' }}
              >
                {state.status === 'submitting' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Booking, please don't close this page…</span>
                  </>
                ) : (
                  <span>Book flight</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 / REPRICE OR SERVER FAILURE */}
        {state.status === 'failed' && (
          <div
            className="bg-white border border-[#E8E4DC] p-8 text-center"
            style={{ borderRadius: '2px' }}
          >
            <div className="w-12 h-12 rounded-full bg-[#FEF2F2] border border-[#FCA5A5] flex items-center justify-center text-[#B91C1C] text-xl font-bold mx-auto mb-4">
              ✕
            </div>
            <h2 className="text-lg font-bold text-[#111111] mb-2 font-serif">
              Unable to complete booking
            </h2>
            <p className="text-sm text-[#77736C] mb-6 leading-relaxed max-w-md mx-auto">
              {state.error?.message || 'The airline was unable to reserve this ticket.'}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => dispatch({ type: 'BACK_TO_EDIT' })}
                className="px-6 py-2.5 bg-white border border-[#E8E4DC] text-xs font-semibold text-[#111111] hover:bg-[#FAFAF8] transition-colors"
                style={{ borderRadius: '2px' }}
              >
                Back to edit details
              </button>
              <button
                onClick={() => navigate('search')}
                className="px-6 py-2.5 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] transition-colors"
                style={{ borderRadius: '2px' }}
              >
                Search fresh flights
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FlightBookingRouter() {
  const { selectedOffer, selectedFlightId, bookingFlow, navigate } = useApp();

  // If live Duffel offer is selected
  if (selectedOffer) {
    return <LiveFlightBookingPage offer={selectedOffer} />;
  }

  // If sample flag enabled and mock flight is active
  if (SHOW_SAMPLE_PAGES && (bookingFlow?.type === 'flight' || selectedFlightId)) {
    return (
      <>
        <SampleDataBanner />
        <FlightBookingFlow />
      </>
    );
  }

  // No flight selected (e.g. refreshed page)
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <h2 className="text-lg font-bold text-[#111111] mb-2 font-serif">
        No flight offer selected
      </h2>
      <p className="text-xs text-[#77736C] mb-6 max-w-sm">
        Your booking session may have refreshed or expired. Please search for flights to start a booking.
      </p>
      <button
        onClick={() => navigate('search')}
        className="px-6 py-2.5 bg-[#111111] text-white text-xs font-semibold hover:bg-[#252525] transition-colors"
        style={{ borderRadius: '2px' }}
      >
        Search flights
      </button>
    </div>
  );
}
