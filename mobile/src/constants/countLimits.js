export const PASSENGER_LIMITS = {
  minAdults: 1,
  minChildren: 0,
  minInfants: 0,
  maxTotal: 9,
  capHelperText:
    'Airlines allow up to 9 passengers per booking. For larger groups, make separate bookings.',
  infantsHelperText: 'Infants cannot exceed adults.',
};

export const HOTEL_LIMITS = {
  minGuests: 1,
  maxGuests: 9,
  minRooms: 1,
  maxRooms: 5,
  guestsCapHelperText: 'Up to 9 guests per hotel search.',
  roomsCapHelperText: 'Up to 5 rooms per hotel search.',
  roomsAdjustedNote: 'Rooms lowered to match guests.',
};

export function clampCount(value, min, max) {
  const safeMin = Math.floor(min);
  const safeMax = Math.max(safeMin, Math.floor(max));
  const num = Number.isFinite(value) ? Math.floor(value) : safeMin;
  return Math.max(safeMin, Math.min(safeMax, num));
}

export function stepCount(value, delta, min, max) {
  const current = clampCount(value, min, max);
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return clampCount(current + step, min, max);
}

export function stepFlightPassengers(counts, field, delta) {
  let adults = clampCount(counts.adults, PASSENGER_LIMITS.minAdults, PASSENGER_LIMITS.maxTotal);
  let children = clampCount(
    counts.children,
    PASSENGER_LIMITS.minChildren,
    PASSENGER_LIMITS.maxTotal - adults
  );
  let infants = clampCount(
    counts.infants,
    PASSENGER_LIMITS.minInfants,
    Math.min(adults, PASSENGER_LIMITS.maxTotal - adults - children)
  );

  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;

  if (field === 'adults') {
    const maxAdults = PASSENGER_LIMITS.maxTotal - children - infants;
    adults = stepCount(
      adults,
      step,
      PASSENGER_LIMITS.minAdults,
      Math.max(PASSENGER_LIMITS.minAdults, maxAdults)
    );
    if (infants > adults) {
      infants = adults;
    }
  } else if (field === 'children') {
    const maxChildren = PASSENGER_LIMITS.maxTotal - adults - infants;
    children = stepCount(children, step, PASSENGER_LIMITS.minChildren, Math.max(0, maxChildren));
  } else if (field === 'infants') {
    const maxInfants = Math.min(adults, PASSENGER_LIMITS.maxTotal - adults - children);
    infants = stepCount(infants, step, PASSENGER_LIMITS.minInfants, Math.max(0, maxInfants));
  }

  return { adults, children, infants };
}

export function stepHotelGuestsAndRooms(current, field, delta) {
  let guests = clampCount(current.guests, HOTEL_LIMITS.minGuests, HOTEL_LIMITS.maxGuests);
  let rooms = clampCount(
    current.rooms,
    HOTEL_LIMITS.minRooms,
    Math.min(HOTEL_LIMITS.maxRooms, guests)
  );
  let roomsAdjusted = false;

  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;

  if (field === 'guests') {
    guests = stepCount(guests, step, HOTEL_LIMITS.minGuests, HOTEL_LIMITS.maxGuests);
    if (rooms > guests) {
      rooms = guests;
      roomsAdjusted = true;
    }
  } else {
    const maxAllowedRooms = Math.min(HOTEL_LIMITS.maxRooms, guests);
    rooms = stepCount(rooms, step, HOTEL_LIMITS.minRooms, maxAllowedRooms);
  }

  return { guests, rooms, roomsAdjusted };
}

