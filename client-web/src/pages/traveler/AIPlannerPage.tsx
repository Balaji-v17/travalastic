import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { hotels, activities, flights, type ItineraryDay as StoredItineraryDay } from '../../data/mockData';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JourneyDNA {
  destination: string;
  destinationId: string;
  origin: string;
  startDate: string;
  nights: number;
  travelers: number;
  budget: number;
  pace: 'relaxed' | 'balanced' | 'packed';
  comfort: 'smart' | 'comfortable' | 'premium' | 'luxury';
  interests: string[];
  mustHave: string;
  avoid: string;
  notes: string;
}

interface JourneyItem {
  id: string;
  time: string;
  title: string;
  type: 'flight' | 'hotel' | 'activity' | 'transfer' | 'meal' | 'free';
  duration: string;
  cost: number;
  entityId?: string;
  entityType?: 'hotel' | 'activity' | 'flight';
  status: 'planned' | 'booked';
  bookingId?: string;
  note?: string;
  aiReason?: string;
}

interface JourneyDay {
  day: number;
  date: string;
  location: string;
  title: string;
  items: JourneyItem[];
}

interface HealthScore {
  overall: number;
  budget: number;
  pace: number;
  interests: number;
  convenience: number;
  travelTime: number;
  hotels: number;
  weakNote?: string;
}

interface BudgetBreakdown {
  flights: number;
  hotels: number;
  transport: number;
  experiences: number;
  food: number;
  buffer: number;
  total: number;
}

interface GeneratedJourney {
  dna: JourneyDNA;
  title: string;
  route: string[];
  days: JourneyDay[];
  budget: BudgetBreakdown;
  health: HealthScore;
  primaryHotelId: string;
  primaryFlightId: string;
  version: number;
  savedJourneyId?: string;
  aiMessage?: string;
  alternativeVersion?: Omit<GeneratedJourney, 'alternativeVersion'>;
}

// ─── Japan journey template (references real entity IDs) ─────────────────────

function buildJapanJourney(dna: JourneyDNA, comfort: string): GeneratedJourney {
  const hotelTokyoId = comfort === 'luxury' ? 'ht-002' : 'ht-001';
  const hotelKyotoId = comfort === 'luxury' ? 'ht-004' : 'ht-003';
  const flightId = comfort === 'luxury' ? 'fl-001' : 'fl-002';

  const tokyoHotel = hotels.find((h) => h.id === hotelTokyoId)!;
  const kyotoHotel = hotels.find((h) => h.id === hotelKyotoId)!;
  const flight = flights.find((f) => f.id === flightId)!;
  const domesticFlight = flights.find((f) => f.id === 'fl-022')!;

  const hotelNightsPerCity = Math.floor(dna.nights / 2);

  const flightCost = (flight?.price ?? 48500) * dna.travelers;
  const domFltCost = (domesticFlight?.price ?? 8200) * dna.travelers;
  const tokyoHotelCost = (tokyoHotel?.pricePerNight ?? 32000) * hotelNightsPerCity;
  const kyotoHotelCost = (kyotoHotel?.pricePerNight ?? 55000) * hotelNightsPerCity;
  const expCost = 4500 * dna.travelers + 3200 * dna.travelers + 5500 * dna.travelers;
  const transportCost = 12000;
  const foodCost = 3000 * dna.nights;
  const bufferCost = Math.round((flightCost + tokyoHotelCost + kyotoHotelCost + expCost + transportCost + foodCost) * 0.05);
  const total = flightCost + tokyoHotelCost + kyotoHotelCost + domFltCost + expCost + transportCost + foodCost + bufferCost;

  const startDate = new Date(dna.startDate);
  const fmt = (offset: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };

  const hasFood = dna.interests.includes('Food');
  const hasCulture = dna.interests.includes('Culture');
  const extraActivity: JourneyItem | null = hasFood ? {
    id: 'food-extra',
    time: '13:00',
    title: 'Ramen Tasting Walk — Shinjuku & Shibuya',
    type: 'meal',
    duration: '2h',
    cost: 2500 * dna.travelers,
    status: 'planned',
    aiReason: "Added because Food is in your Journey DNA. Covers three regional ramen styles in a single walk.",
  } : hasCulture ? {
    id: 'culture-extra',
    time: '15:00',
    title: 'Harajuku & Takeshita Street Culture Walk',
    type: 'activity',
    duration: '2h',
    cost: 2000 * dna.travelers,
    entityId: 'ac-001',
    entityType: 'activity',
    status: 'planned',
    aiReason: "Added because Culture is in your Journey DNA.",
  } : null;

  const day2Items: JourneyItem[] = [
    { id: 'd2-1', time: '08:00', title: 'Tsukiji Outer Market Food Tour', type: 'activity', duration: '3h', cost: 4500 * dna.travelers, entityId: 'ac-002', entityType: 'activity', status: 'planned', aiReason: "Top-rated food experience that directly matches your Food & Culture interests. Rated 4.9/5 across 2,167 reviews." },
    { id: 'd2-2', time: '12:30', title: 'Ramen lunch — Fuunji, Shinjuku', type: 'meal', duration: '1h', cost: 1200 * dna.travelers, status: 'planned' },
    { id: 'd2-3', time: '14:00', title: 'Shibuya & Harajuku Culture Walk', type: 'activity', duration: '4h', cost: 3200 * dna.travelers, entityId: 'ac-001', entityType: 'activity', status: 'planned', aiReason: "Covers Harajuku Takeshita Street, Omotesando and the Shibuya crossing — the core Tokyo cultural circuit." },
  ];
  if (extraActivity) day2Items.push(extraActivity);

  const days: JourneyDay[] = [
    {
      day: 1, date: fmt(0), location: 'Tokyo', title: 'Arrival & Shinjuku',
      items: [
        { id: 'd1-1', time: '02:30', title: `${flight?.airline ?? 'IndiGo'} ${flight?.flightNumber ?? '6E-812'} · Mumbai → Tokyo`, type: 'flight', duration: flight?.duration ?? '9h 15m', cost: flightCost, entityId: flightId, entityType: 'flight', status: 'planned', aiReason: `Non-stop Mumbai to Tokyo. Chosen for direct routing and ${dna.comfort === 'luxury' ? 'business class upgrade availability' : 'best price-to-quality ratio'}.` },
        { id: 'd1-2', time: '14:45', title: 'Airport Transfer to Hotel', type: 'transfer', duration: '1h 30m', cost: 4500, status: 'planned' },
        { id: 'd1-3', time: '16:30', title: `Check-in: ${tokyoHotel?.name ?? 'Park Hyatt Tokyo'}`, type: 'hotel', duration: '', cost: tokyoHotelCost, entityId: hotelTokyoId, entityType: 'hotel', status: 'planned', aiReason: `${tokyoHotel?.description?.split('.')[0] ?? 'Selected for its central Shinjuku location and premium amenities'}. Matches your ${dna.comfort} comfort preference.` },
        { id: 'd1-4', time: '20:00', title: 'Welcome dinner — Kozue Restaurant', type: 'meal', duration: '2h', cost: 8000 * dna.travelers, status: 'planned' },
      ],
    },
    {
      day: 2, date: fmt(1), location: 'Tokyo', title: 'Food & Culture',
      items: day2Items,
    },
    {
      day: 3, date: fmt(2), location: 'Tokyo', title: 'Imperial & Traditional',
      items: [
        { id: 'd3-1', time: '09:00', title: 'Senso-ji Temple, Asakusa', type: 'activity', duration: '2h', cost: 0, status: 'planned', aiReason: "Free entry. Asakusa is Tokyo's oldest district — placed on Day 3 so you have a relaxed morning after the cultural day." },
        { id: 'd3-2', time: '11:30', title: 'Nakamise Shopping Street & lunch', type: 'meal', duration: '2h', cost: 2000 * dna.travelers, status: 'planned' },
        { id: 'd3-3', time: '14:30', title: 'Tokyo National Museum, Ueno', type: 'activity', duration: '3h', cost: 1000 * dna.travelers, status: 'planned' },
        { id: 'd3-4', time: '20:00', title: 'Yakitori Alley dinner — Shinjuku', type: 'meal', duration: '2h', cost: 3000 * dna.travelers, status: 'planned' },
      ],
    },
    {
      day: 4, date: fmt(3), location: 'Kyoto', title: 'Tokyo → Kyoto · Gion Evening',
      items: [
        { id: 'd4-1', time: '11:00', title: 'Hotel checkout', type: 'hotel', duration: '', cost: 0, status: 'planned' },
        { id: 'd4-2', time: '14:00', title: `${domesticFlight?.airline ?? 'Japan Airlines'} ${domesticFlight?.flightNumber ?? 'JL-404'} · Tokyo → Osaka (Kyoto)`, type: 'flight', duration: domesticFlight?.duration ?? '1h 15m', cost: domFltCost, entityId: 'fl-022', entityType: 'flight', status: 'planned', aiReason: "Domestic flight reduces Tokyo-Kyoto travel to 1h 15m vs 2h 30m by Shinkansen at a similar price point, freeing your afternoon." },
        { id: 'd4-3', time: '17:00', title: `Check-in: ${kyotoHotel?.name ?? 'The Ritz-Carlton Kyoto'}`, type: 'hotel', duration: '', cost: kyotoHotelCost, entityId: hotelKyotoId, entityType: 'hotel', status: 'planned', aiReason: `${kyotoHotel?.description?.split('.')[0] ?? "On the banks of the Kamogawa River"}. Placed before Osaka so cultural experiences are grouped together, reducing backtracking.` },
        { id: 'd4-4', time: '19:30', title: 'Gion district evening walk', type: 'activity', duration: '2h', cost: 0, status: 'planned' },
      ],
    },
    {
      day: 5, date: fmt(4), location: 'Kyoto', title: 'Culture Deep Dive',
      items: [
        { id: 'd5-1', time: '09:00', title: 'Tea Ceremony & Kimono Experience', type: 'activity', duration: '2.5h', cost: 5500 * dna.travelers, entityId: 'ac-003', entityType: 'activity', status: 'planned', aiReason: "Placed in the morning for authentic lighting and less crowded studios. Matches your Culture and Photography interests." },
        { id: 'd5-2', time: '13:00', title: 'Nishiki Market lunch — local street food', type: 'meal', duration: '1.5h', cost: 3000 * dna.travelers, status: 'planned' },
        { id: 'd5-3', time: '15:30', title: 'Arashiyama Bamboo Dawn Walk', type: 'activity', duration: '3h', cost: 4200 * dna.travelers, entityId: 'ac-004', entityType: 'activity', status: 'planned', aiReason: "Afternoon visit is quieter than early morning and catches better light for Photography." },
        { id: 'd5-4', time: '19:00', title: 'Kaiseki dinner — Kikunoi', type: 'meal', duration: '2h 30m', cost: 12000 * dna.travelers, status: 'planned' },
      ],
    },
    {
      day: 6, date: fmt(5), location: 'Kyoto', title: 'Nijo Castle & Free Afternoon',
      items: [
        { id: 'd6-1', time: '10:00', title: 'Nijo Castle & Imperial Palace', type: 'activity', duration: '3h', cost: 1200 * dna.travelers, status: 'planned' },
        { id: 'd6-2', time: '14:00', title: 'Free afternoon — shopping or Philosopher\'s Path', type: 'free', duration: '4h', cost: 0, status: 'planned', note: dna.pace === 'relaxed' ? 'Kept free to match your relaxed pace.' : undefined },
        { id: 'd6-3', time: '19:30', title: 'Pontocho alley dinner', type: 'meal', duration: '2h', cost: 4000 * dna.travelers, status: 'planned' },
      ],
    },
    {
      day: 7, date: fmt(6), location: 'Tokyo', title: 'Return to Tokyo · Last Morning',
      items: [
        { id: 'd7-1', time: '11:00', title: 'Hotel checkout & transfer to airport', type: 'transfer', duration: '2h', cost: 5000, status: 'planned' },
        { id: 'd7-2', time: '14:00', title: 'Meiji Shrine & Yoyogi Park', type: 'activity', duration: '2h', cost: 0, status: 'planned', note: 'If time allows before departure' },
      ],
    },
    {
      day: dna.nights, date: fmt(dna.nights - 1), location: 'Mumbai', title: 'Departure',
      items: [
        { id: 'd8-1', time: '02:30', title: `Return flight · Tokyo → Mumbai`, type: 'flight', duration: '9h 15m', cost: 0, status: 'planned', note: 'Return included in outbound flight cost' },
      ],
    },
  ];

  const budget: BudgetBreakdown = {
    flights: flightCost + domFltCost,
    hotels: tokyoHotelCost + kyotoHotelCost,
    transport: transportCost,
    experiences: expCost,
    food: foodCost,
    buffer: bufferCost,
    total,
  };

  const budgetFit = Math.min(100, Math.round(90 + (dna.budget - total) / dna.budget * 20));
  const paceScore = dna.pace === 'relaxed' ? 94 : dna.pace === 'packed' ? 78 : 88;
  const interestScore = dna.interests.length > 0 ? Math.min(99, 82 + dna.interests.length * 4) : 80;
  const travelTimeScore = 84;
  const hotelScore = comfort === 'luxury' ? 97 : comfort === 'premium' ? 93 : 87;
  const convenienceScore = 96;
  const overall = Math.round((budgetFit + paceScore + interestScore + travelTimeScore + hotelScore + convenienceScore) / 6);

  return {
    dna,
    title: `Your Japan Journey`,
    route: [dna.origin, 'Tokyo', 'Kyoto', dna.origin],
    days,
    budget,
    health: {
      overall,
      budget: budgetFit,
      pace: paceScore,
      interests: interestScore,
      convenience: convenienceScore,
      travelTime: travelTimeScore,
      hotels: hotelScore,
      weakNote: travelTimeScore < 87 ? 'Day 4 contains 4h 20m of intercity travel. Domestic flight reduces this vs Shinkansen.' : undefined,
    },
    primaryHotelId: hotelTokyoId,
    primaryFlightId: flightId,
    version: 1,
  };
}

function buildGenericJourney(dna: JourneyDNA): GeneratedJourney {
  const destHotel = hotels.find((h) => h.destinationId === dna.destinationId || h.destination === dna.destinationId);
  const destActivity = activities.find((a) => a.destinationId === dna.destinationId || a.destination === dna.destinationId);
  const destFlight = flights.find((f) => f.destinationId === dna.destinationId);

  const hotelCost = (destHotel?.pricePerNight ?? 25000) * dna.nights;
  const flightCost = (destFlight?.price ?? 35000) * dna.travelers;
  const expCost = (destActivity?.price ?? 4000) * dna.travelers * 3;
  const transportCost = 10000;
  const foodCost = 2500 * dna.nights;
  const bufferCost = Math.round((hotelCost + flightCost + expCost + transportCost + foodCost) * 0.05);
  const total = hotelCost + flightCost + expCost + transportCost + foodCost + bufferCost;

  const startDate = new Date(dna.startDate);
  const fmt = (offset: number) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };

  const days: JourneyDay[] = Array.from({ length: dna.nights }, (_, i) => ({
    day: i + 1,
    date: fmt(i),
    location: dna.destination,
    title: i === 0 ? 'Arrival Day' : i === dna.nights - 1 ? 'Departure Day' : `Day ${i + 1} — ${dna.destination}`,
    items: i === 0 ? [
      { id: `d${i}-1`, time: '14:00', title: destFlight ? `${destFlight.airline} ${destFlight.flightNumber} · ${destFlight.from} → ${destFlight.to}` : `Flight to ${dna.destination}`, type: 'flight' as const, duration: destFlight?.duration ?? '5h', cost: flightCost, entityId: destFlight?.id, entityType: 'flight' as const, status: 'planned' as const },
      { id: `d${i}-2`, time: '18:00', title: `Check-in: ${destHotel?.name ?? dna.destination + ' Hotel'}`, type: 'hotel' as const, duration: '', cost: hotelCost, entityId: destHotel?.id, entityType: 'hotel' as const, status: 'planned' as const },
    ] : i === dna.nights - 1 ? [
      { id: `d${i}-1`, time: '12:00', title: 'Hotel checkout & transfer', type: 'transfer' as const, duration: '2h', cost: 3000, status: 'planned' as const },
      { id: `d${i}-2`, time: '15:00', title: `Return flight to ${dna.origin}`, type: 'flight' as const, duration: '5h', cost: 0, status: 'planned' as const, note: 'Return included in outbound fare' },
    ] : [
      { id: `d${i}-1`, time: '10:00', title: destActivity?.name ?? `Explore ${dna.destination}`, type: 'activity' as const, duration: destActivity?.duration ?? '4h', cost: (destActivity?.price ?? 4000) * dna.travelers, entityId: destActivity?.id, entityType: 'activity' as const, status: 'planned' as const },
      { id: `d${i}-2`, time: '19:00', title: 'Dinner — local restaurant', type: 'meal' as const, duration: '2h', cost: 2000 * dna.travelers, status: 'planned' as const },
    ],
  }));

  const budget: BudgetBreakdown = { flights: flightCost, hotels: hotelCost, transport: transportCost, experiences: expCost, food: foodCost, buffer: bufferCost, total };
  const budgetFit = Math.min(100, Math.round(90 + (dna.budget - total) / dna.budget * 20));
  const overall = Math.round((budgetFit + 88 + 86 + 90 + 84 + 88) / 6);

  return {
    dna, title: `Your ${dna.destination} Journey`, route: [dna.origin, dna.destination, dna.origin], days, budget,
    health: { overall, budget: budgetFit, pace: 88, interests: 86, convenience: 90, travelTime: 84, hotels: 88 },
    primaryHotelId: destHotel?.id ?? '', primaryFlightId: destFlight?.id ?? '', version: 1,
  };
}

function generateJourney(dna: JourneyDNA): GeneratedJourney {
  const dest = dna.destinationId || dna.destination.toLowerCase();
  if (dest.includes('japan') || dest.includes('tokyo') || dest.includes('kyoto') || dest === 'japan') {
    return buildJapanJourney(dna, dna.comfort);
  }
  return buildGenericJourney(dna);
}

// ─── Apply AI controls ────────────────────────────────────────────────────────

function applyControl(journey: GeneratedJourney, control: string): GeneratedJourney {
  const j = { ...journey, days: journey.days.map((d) => ({ ...d, items: [...d.items] })), budget: { ...journey.budget } };

  if (control === 'cheaper') {
    // Switch to cheaper flight & reduce hotel tier
    const cheaper = flights.find((f) => f.id === 'fl-002');
    const saving = cheaper ? (j.budget.flights - cheaper.price * j.dna.travelers * 2) : 0;
    j.budget.flights = Math.max(0, j.budget.flights - Math.round(j.budget.flights * 0.22));
    j.budget.hotels = Math.max(0, j.budget.hotels - Math.round(j.budget.hotels * 0.15));
    j.budget.total = j.budget.flights + j.budget.hotels + j.budget.transport + j.budget.experiences + j.budget.food + j.budget.buffer;
    const saved = journey.budget.total - j.budget.total;
    j.version = (j.version || 1) + 1;
    j.aiMessage = `Journey is now ${Math.round(saved / 1000)}k cheaper — switched to Air India (saves ₹${Math.round(saving / 1000)}k on flights) and reduced hotel tier for Tokyo (2 nights).`;
    j.health = { ...j.health, budget: Math.min(99, j.health.budget + 4), hotels: Math.max(60, j.health.hotels - 6), overall: Math.round(((j.health.budget + 4) + j.health.pace + j.health.interests + j.health.convenience + j.health.travelTime + Math.max(60, j.health.hotels - 6)) / 6) };
  } else if (control === 'luxurious') {
    j.budget.hotels = Math.round(j.budget.hotels * 1.35);
    j.budget.flights = Math.round(j.budget.flights * 1.48); // business class
    j.budget.total = j.budget.flights + j.budget.hotels + j.budget.transport + j.budget.experiences + j.budget.food + j.budget.buffer;
    j.aiMessage = "Upgraded to Aman Tokyo and Hoshinoya Kyoto. Outbound flight upgraded to Business Class on IndiGo.";
    j.health = { ...j.health, hotels: Math.min(99, j.health.hotels + 4), budget: Math.max(60, j.health.budget - 8), overall: Math.round((j.health.budget - 8 + j.health.pace + j.health.interests + j.health.convenience + j.health.travelTime + (j.health.hotels + 4)) / 6) };
    j.primaryHotelId = 'ht-002';
  } else if (control === 'slowpace') {
    j.days = j.days.map((day) => {
      const activities = day.items.filter((it) => it.type === 'activity');
      if (activities.length > 1) {
        const removed = activities[activities.length - 1];
        j.budget.experiences = Math.max(0, j.budget.experiences - removed.cost);
        return { ...day, items: day.items.filter((it) => it !== removed) };
      }
      return day;
    });
    j.budget.total = j.budget.flights + j.budget.hotels + j.budget.transport + j.budget.experiences + j.budget.food + j.budget.buffer;
    j.aiMessage = "Removed one activity per busy day. Each day now has space for spontaneous exploration.";
    j.health = { ...j.health, pace: Math.min(99, j.health.pace + 7), overall: Math.round((j.health.budget + (j.health.pace + 7) + j.health.interests + j.health.convenience + j.health.travelTime + j.health.hotels) / 6) };
  } else if (control === 'morefood') {
    const foodActivity: JourneyItem = {
      id: 'extra-food-' + Date.now(),
      time: '12:00', title: 'Street Food Deep Dive — Dotonbori Market', type: 'meal',
      duration: '2h', cost: 3000 * j.dna.travelers, status: 'planned',
      note: 'Added by Journey AI based on your Food interest.',
    };
    const dayIdx = j.days.findIndex((d) => d.day === 3);
    if (dayIdx >= 0) j.days[dayIdx].items = [...j.days[dayIdx].items, foodActivity];
    j.budget.food += foodActivity.cost;
    j.budget.total += foodActivity.cost;
    j.aiMessage = "Added a street food deep dive on Day 3. Covers 5 regional specialties in one session.";
    j.health = { ...j.health, interests: Math.min(99, j.health.interests + 2), overall: Math.round((j.health.budget + j.health.pace + (j.health.interests + 2) + j.health.convenience + j.health.travelTime + j.health.hotels) / 6) };
  } else if (control === 'moreculture') {
    const cultureItem: JourneyItem = {
      id: 'extra-culture-' + Date.now(),
      time: '15:00', title: 'Traditional Sake Brewery Tour & Tasting', type: 'activity',
      duration: '2.5h', cost: 4000 * j.dna.travelers, entityId: 'ac-003', entityType: 'activity', status: 'planned',
      note: 'Added by Journey AI based on your Culture interest.',
    };
    const dayIdx = j.days.findIndex((d) => d.day === 6);
    if (dayIdx >= 0) j.days[dayIdx].items = [...j.days[dayIdx].items, cultureItem];
    j.budget.experiences += cultureItem.cost;
    j.budget.total += cultureItem.cost;
    j.aiMessage = "Added a sake brewery cultural experience on Day 6. Pairs well with your already relaxed afternoon.";
    j.health = { ...j.health, interests: Math.min(99, j.health.interests + 2) };
  } else if (control === 'add2days') {
    const lastDay = j.days[j.days.length - 1];
    const newDay1: JourneyDay = {
      day: lastDay.day, date: lastDay.date, location: 'Osaka',
      title: 'Day Trip — Osaka & Dotonbori',
      items: [
        { id: 'new-d1-1', time: '09:00', title: 'Shinkansen to Osaka', type: 'transfer', duration: '1h', cost: 3000, status: 'planned' },
        { id: 'new-d1-2', time: '10:30', title: 'Dotonbori & Namba street food', type: 'meal', duration: '3h', cost: 3500 * j.dna.travelers, status: 'planned' },
        { id: 'new-d1-3', time: '15:00', title: 'Osaka Castle & Museum', type: 'activity', duration: '2.5h', cost: 1800 * j.dna.travelers, status: 'planned' },
        { id: 'new-d1-4', time: '19:00', title: 'Return to Kyoto', type: 'transfer', duration: '1h', cost: 3000, status: 'planned' },
      ],
    };
    const newDay2: JourneyDay = {
      day: lastDay.day + 1, date: '', location: 'Tokyo', title: 'Back to Tokyo · Last Day',
      items: [
        { id: 'new-d2-1', time: '10:00', title: 'Hotel checkout', type: 'hotel', duration: '', cost: 0, status: 'planned' },
        { id: 'new-d2-2', time: '12:00', title: 'Akihabara electronics & culture', type: 'activity', duration: '3h', cost: 1000 * j.dna.travelers, status: 'planned' },
        { id: 'new-d2-3', time: '18:00', title: 'Final dinner — Omoide Yokocho', type: 'meal', duration: '2h', cost: 3000 * j.dna.travelers, status: 'planned' },
      ],
    };
    j.days = [
      ...j.days.slice(0, -1),
      { ...newDay1, day: j.days.length - 1 },
      { ...newDay2, day: j.days.length },
      { ...lastDay, day: j.days.length + 1 },
    ];
    const extraCost = 18000;
    j.budget.transport += 6000;
    j.budget.experiences += 6000;
    j.budget.food += 4000;
    j.budget.buffer += 2000;
    j.budget.total += extraCost;
    j.dna = { ...j.dna, nights: j.dna.nights + 2 };
    j.aiMessage = "Added 2 days: Osaka day trip + extra Tokyo day. Osaka is placed to avoid backtracking.";
    j.health = { ...j.health, travelTime: Math.max(70, j.health.travelTime - 3), interests: Math.min(99, j.health.interests + 2) };
  } else if (control === 'reducetransit') {
    j.days = j.days.map((day) => ({
      ...day,
      items: day.items.filter((it) => !(it.id === 'fl-022' || it.type === 'transfer' && it.cost > 4000)),
    }));
    j.budget.transport = Math.round(j.budget.transport * 0.65);
    j.budget.total = j.budget.flights + j.budget.hotels + j.budget.transport + j.budget.experiences + j.budget.food + j.budget.buffer;
    j.aiMessage = "Reduced intercity transfers. Consolidated Tokyo and Kyoto hotels for a more relaxed travel experience.";
    j.health = { ...j.health, travelTime: Math.min(99, j.health.travelTime + 8), convenience: Math.min(99, j.health.convenience + 3) };
  }

  j.health = { ...j.health, overall: Math.round((j.health.budget + j.health.pace + j.health.interests + j.health.convenience + j.health.travelTime + j.health.hotels) / 6) };
  return j;
}

// ─── Generate What-if alternative ────────────────────────────────────────────

function generateAlternative(journey: GeneratedJourney, scenario: string): Omit<GeneratedJourney, 'alternativeVersion'> {
  const alt = applyControl(journey, scenario === 'reduceBudget' ? 'cheaper' : scenario === 'add2days' ? 'add2days' : 'luxurious');
  return { ...alt, version: 99 };
}

// ─── Convert to storable ItineraryDay format ──────────────────────────────────

function toStoredItinerary(days: JourneyDay[]): StoredItineraryDay[] {
  return days.slice(0, 3).map((day) => ({
    day: day.day,
    date: day.date,
    location: day.location,
    title: day.title,
    activities: day.items.map((item, idx) => ({
      id: `ai-${day.day}-${idx}`,
      time: item.time,
      title: item.title,
      type: item.type === 'free' ? 'activity' : item.type,
      duration: item.duration,
      notes: item.note,
      cost: item.cost,
      status: item.status === 'booked' ? 'booked' : 'unbooked',
      bookingId: item.bookingId,
      hotelId: item.entityType === 'hotel' ? item.entityId : undefined,
      activityId: item.entityType === 'activity' ? item.entityId : undefined,
      flightId: item.entityType === 'flight' ? item.entityId : undefined,
    })),
  })) as StoredItineraryDay[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HealthBar({ score, label }: { score: number; label: string }) {
  const color = score >= 90 ? 'bg-emerald-500' : score >= 80 ? 'bg-blue-500' : score >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-6 text-right">{score}</span>
    </div>
  );
}

const itemTypeColors: Record<string, string> = {
  flight: 'bg-sky-50 text-sky-700 border-sky-100',
  hotel: 'bg-blue-50 text-blue-700 border-blue-100',
  activity: 'bg-violet-50 text-violet-700 border-violet-100',
  transfer: 'bg-slate-50 text-slate-500 border-slate-200',
  meal: 'bg-amber-50 text-amber-700 border-amber-100',
  free: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const itemTypeIcons: Record<string, string> = {
  flight: '✈', hotel: '🏨', activity: '⭐', transfer: '🚗', meal: '🍽', free: '☀',
};

const INTERESTS = ['Food', 'Culture', 'Nature', 'Adventure', 'Shopping', 'Photography', 'Nightlife', 'Wellness', 'History'];

const BUILD_MSGS = [
  'Analysing your Journey DNA...',
  'Matching destinations to your interests...',
  'Selecting hotels by comfort preference...',
  'Building your daily schedule...',
  'Calculating Journey Health score...',
  'Optimising route for minimal transit...',
  'Adding local hidden gems...',
  'Finalising your complete journey...',
];

// ─── Main page ────────────────────────────────────────────────────────────────

type Phase = 'dna' | 'building' | 'result';

export default function AIPlannerPage() {
  const { navigate, createJourney, plannerDestination, plannerDestinationId, navigateToHotel, navigateToExperience, startBookingFlow } = useApp();

  const [phase, setPhase] = useState<Phase>('dna');
  const [buildMsgIdx, setBuildMsgIdx] = useState(0);
  const [journey, setJourney] = useState<GeneratedJourney | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [showWhyId, setShowWhyId] = useState<string | null>(null);
  const [controlMsg, setControlMsg] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonScenario, setComparisonScenario] = useState<string>('reduceBudget');
  const [savedJourneyId, setSavedJourneyId] = useState<string | null>(null);
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());
  const [addActivityDayId, setAddActivityDayId] = useState<number | null>(null);

  const isJapan = (dest: string) => ['japan', 'tokyo', 'kyoto', 'osaka'].some((k) => dest.toLowerCase().includes(k));

  const [dna, setDna] = useState<JourneyDNA>({
    destination: plannerDestination || 'Tokyo, Japan',
    destinationId: plannerDestinationId || (isJapan(plannerDestination) ? 'tokyo' : plannerDestination.toLowerCase()) || 'tokyo',
    origin: 'Mumbai',
    startDate: '2025-03-15',
    nights: 8,
    travelers: 2,
    budget: 350000,
    pace: 'relaxed',
    comfort: 'premium',
    interests: ['Food', 'Culture', 'Photography'],
    mustHave: '',
    avoid: '',
    notes: '',
  });

  useEffect(() => {
    if (plannerDestination) {
      setDna((prev) => ({
        ...prev,
        destination: plannerDestination,
        destinationId: plannerDestinationId || plannerDestination.toLowerCase().replace(/[^a-z]/g, ''),
      }));
    }
  }, [plannerDestination, plannerDestinationId]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleBuildJourney = () => {
    setPhase('building');
    setBuildMsgIdx(0);
    intervalRef.current = setInterval(() => setBuildMsgIdx((i) => (i + 1) % BUILD_MSGS.length), 380);
    timerRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const generated = generateJourney(dna);
      setJourney(generated);
      setExpandedDay(1);
      setControlMsg(null);
      setShowComparison(false);
      setSavedJourneyId(null);
      setPhase('result');
    }, 3200);
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const applyAIControl = (control: string) => {
    if (!journey) return;
    const updated = applyControl(journey, control);
    setJourney(updated);
    setControlMsg(updated.aiMessage ?? null);
    setShowComparison(false);
  };

  const handleSaveJourney = () => {
    if (!journey) return;
    const id = createJourney({
      travelerId: 'trv-001',
      destination: journey.route[1],
      destinationId: journey.dna.destinationId,
      title: journey.title,
      status: 'planning',
      startDate: journey.dna.startDate,
      endDate: (() => {
        const d = new Date(journey.dna.startDate);
        d.setDate(d.getDate() + journey.dna.nights);
        return d.toISOString().split('T')[0];
      })(),
      travelers: journey.dna.travelers,
      bookings: [],
      totalBudget: journey.dna.budget,
      totalSpend: 0,
      currency: 'INR',
      imageUrl: 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=800&h=500&fit=crop&auto=format',
      itinerary: toStoredItinerary(journey.days),
      notifications: [],
      disruptions: [],
    });
    setSavedJourneyId(id);
    setJourney({ ...journey, savedJourneyId: id });
  };

  const handleAddDay = () => {
    if (!journey) return;
    const last = journey.days[journey.days.length - 1];
    const prevDate = last.date ? new Date(last.date) : new Date();
    prevDate.setDate(prevDate.getDate() + 1);
    const newDayDate = prevDate.toISOString().split('T')[0];
    const newDay: JourneyDay = {
      day: last.day + 1,
      date: newDayDate,
      location: last.location,
      title: `Day ${last.day + 1} — Free Day`,
      items: [],
    };
    setJourney({ ...journey, days: [...journey.days, newDay], dna: { ...journey.dna, nights: journey.dna.nights + 1 } });
    setControlMsg('Added a new day to your journey. Expand it to add activities.');
  };

  const handleRemoveDay = () => {
    if (!journey || journey.days.length <= 1) return;
    setJourney({ ...journey, days: journey.days.slice(0, -1), dna: { ...journey.dna, nights: Math.max(1, journey.dna.nights - 1) } });
    setControlMsg('Removed the last day from your journey.');
  };

  const toggleInterest = (interest: string) => {
    setDna((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  if (phase === 'dna') return <DNAForm dna={dna} setDna={setDna} onBuild={handleBuildJourney} toggleInterest={toggleInterest} />;
  if (phase === 'building') return <BuildingScreen msgIdx={buildMsgIdx} destination={dna.destination} />;

  if (!journey) return null;

  const hotelRecs = journey.days.flatMap((d) => d.items).filter((it) => it.entityType === 'hotel' && it.entityId);
  const expRecs = journey.days.flatMap((d) => d.items).filter((it) => it.entityType === 'activity' && it.entityId);
  const uniqueHotels = hotelRecs.filter((h, i) => hotelRecs.findIndex((x) => x.entityId === h.entityId) === i);
  const uniqueExps = expRecs.filter((e, i) => expRecs.findIndex((x) => x.entityId === e.entityId) === i);

  const altJourney = showComparison ? generateAlternative(journey, comparisonScenario) : null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">J</span>
            </div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Journey AI</span>
          </div>
          <h1 className="font-display text-3xl text-slate-900 mb-0.5">{journey.title}</h1>
          <p className="text-slate-500 text-sm">{journey.dna.nights} nights · {journey.dna.travelers} travelers · {journey.route.join(' → ')}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => { setPhase('dna'); setJourney(null); }} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            Rebuild
          </button>
          {savedJourneyId ? (
            <button onClick={() => navigate('my-trips')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Open in My Trips
            </button>
          ) : (
            <button onClick={handleSaveJourney} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
              Save Journey
            </button>
          )}
        </div>
      </div>

      {/* AI control message */}
      {controlMsg && (
        <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">J</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-blue-800 mb-0.5">Journey AI</p>
            <p className="text-sm text-blue-900 leading-relaxed">{controlMsg}</p>
          </div>
          <button onClick={() => setControlMsg(null)} className="text-blue-400 hover:text-blue-600 flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round"/></svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Journey Health */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Journey Health</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-4xl text-slate-900">{journey.health.overall}</span>
                  <span className="text-slate-400 text-lg">/100</span>
                </div>
              </div>
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${journey.health.overall >= 90 ? 'bg-emerald-50' : journey.health.overall >= 80 ? 'bg-blue-50' : 'bg-amber-50'}`}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M14 4l2.5 5.5L22 11l-5.5 2.5L14 19l-2.5-5.5L6 11l5.5-2.5L14 4z" fill={journey.health.overall >= 90 ? '#10b981' : journey.health.overall >= 80 ? '#3b82f6' : '#f59e0b'} opacity="0.8"/>
                </svg>
              </div>
            </div>
            <div className="space-y-2.5">
              <HealthBar score={journey.health.budget} label="Budget fit" />
              <HealthBar score={journey.health.pace} label="Pace" />
              <HealthBar score={journey.health.interests} label="Interests" />
              <HealthBar score={journey.health.convenience} label="Convenience" />
              <HealthBar score={journey.health.travelTime} label="Travel time" />
              <HealthBar score={journey.health.hotels} label="Hotels" />
            </div>
            {journey.health.weakNote && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
                <span className="text-amber-500 text-sm flex-shrink-0">⚡</span>
                <div className="flex-1">
                  <p className="text-xs text-amber-800">{journey.health.weakNote}</p>
                </div>
                <button onClick={() => applyAIControl('reducetransit')} className="text-xs font-semibold text-amber-700 border border-amber-300 px-2 py-0.5 rounded-lg hover:bg-amber-100 transition-colors flex-shrink-0">
                  Optimise
                </button>
              </div>
            )}
          </div>

          {/* Daily Itinerary */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Daily Itinerary</h2>
              <p className="text-xs text-slate-400 mt-0.5">{journey.dna.nights} days · {journey.days.flatMap((d) => d.items).length} planned items</p>
            </div>
            <div className="divide-y divide-slate-50">
              {journey.days.map((day) => {
                const isOpen = expandedDay === day.day;
                const visibleItems = day.items.filter((it) => !removedItems.has(it.id));
                const dayCost = visibleItems.reduce((s, it) => s + it.cost, 0);
                return (
                  <div key={day.day}>
                    <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                      <button
                        onClick={() => setExpandedDay(isOpen ? null : day.day)}
                        className="flex items-center gap-3 flex-1 text-left min-w-0"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${isOpen ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {day.day}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{day.title}</p>
                          <p className="text-xs text-slate-400">{day.location} · {day.date}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {dayCost > 0 && <span className="text-xs text-slate-500">₹{dayCost.toLocaleString()}</span>}
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setAddActivityDayId(addActivityDayId === day.day ? null : day.day); }}
                            className="flex items-center gap-0.5 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-md transition-colors"
                          >
                            <span className="text-sm leading-none">+</span> Add
                          </button>
                          {addActivityDayId === day.day && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
                              {['Flight', 'Hotel', 'Experience', 'Note'].map((type) => (
                                <button
                                  key={type}
                                  onClick={() => { alert('Feature in development'); setAddActivityDayId(null); }}
                                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  Add {type}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button onClick={() => setExpandedDay(isOpen ? null : day.day)} className="p-1">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                            <path d="M3 5l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="divide-y divide-slate-50 bg-slate-50/30">
                        {visibleItems.length === 0 && (
                          <p className="px-5 py-4 text-xs text-slate-400 italic">No items — use + Add to plan this day.</p>
                        )}
                        {visibleItems.map((item) => {
                          const hotel = item.entityType === 'hotel' ? hotels.find((h) => h.id === item.entityId) : null;
                          const activity = item.entityType === 'activity' ? activities.find((a) => a.id === item.entityId) : null;
                          const isBooked = item.status === 'booked';
                          return (
                            <div key={item.id} className="flex items-start gap-3 px-5 py-3 group">
                              <span className="text-xs font-mono text-slate-400 w-10 flex-shrink-0 pt-0.5">{item.time}</span>
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 bg-white border border-slate-100">
                                {itemTypeIcons[item.type] || '•'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border capitalize ${itemTypeColors[item.type] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                    {item.type}
                                  </span>
                                  {isBooked && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-emerald-50 text-emerald-700 border-emerald-100">✓ Booked</span>
                                  )}
                                </div>
                                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                                {item.duration && <p className="text-xs text-slate-400">{item.duration}</p>}
                                {item.note && <p className="text-xs text-slate-500 italic mt-0.5">{item.note}</p>}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {item.cost > 0 && <span className="text-xs text-slate-500">₹{item.cost.toLocaleString()}</span>}
                                {item.cost === 0 && item.type !== 'flight' && <span className="text-xs text-emerald-600 font-medium">Free</span>}
                                {item.aiReason && (
                                  <button
                                    onClick={() => setShowWhyId(showWhyId === item.id ? null : item.id)}
                                    className="text-xs text-slate-400 hover:text-blue-600 transition-colors border border-slate-200 hover:border-blue-200 px-1.5 py-0.5 rounded-md"
                                  >
                                    Why?
                                  </button>
                                )}
                                {hotel && !isBooked && (
                                  <button onClick={() => navigateToHotel(hotel.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-all">
                                    View →
                                  </button>
                                )}
                                {activity && !isBooked && (
                                  <button onClick={() => navigateToExperience(activity.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-all">
                                    View →
                                  </button>
                                )}
                                {/* Book buttons */}
                                {!isBooked && item.type === 'flight' && item.entityId && (
                                  <button
                                    onClick={() => startBookingFlow({ type: 'flight', itemId: item.entityId!, source: savedJourneyId ? 'journey' : 'ai-planner', journeyId: savedJourneyId ?? undefined, itineraryItemId: item.id })}
                                    className="px-2.5 py-1 bg-blue-600 text-white text-[10px] font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                                  >
                                    Book Flight
                                  </button>
                                )}
                                {!isBooked && item.type === 'hotel' && item.entityId && (
                                  <button
                                    onClick={() => navigateToHotel(item.entityId!, { journeyId: savedJourneyId ?? undefined, itineraryItemId: item.id })}
                                    className="px-2.5 py-1 bg-blue-600 text-white text-[10px] font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                                  >
                                    Book Hotel
                                  </button>
                                )}
                                {!isBooked && item.type === 'activity' && item.entityId && (
                                  <button
                                    onClick={() => navigateToExperience(item.entityId!, { journeyId: savedJourneyId ?? undefined, itineraryItemId: item.id })}
                                    className="px-2.5 py-1 bg-violet-600 text-white text-[10px] font-semibold rounded-lg hover:bg-violet-700 transition-colors whitespace-nowrap"
                                  >
                                    Book
                                  </button>
                                )}
                                {!isBooked && !['flight', 'hotel', 'activity', 'experience'].includes(item.type) && (
                                  <span className="px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-200 rounded-md">Keep</span>
                                )}
                                {/* Remove button */}
                                <button
                                  onClick={() => setRemovedItems((prev) => { const n = new Set(prev); n.add(item.id); return n; })}
                                  title="Remove from itinerary"
                                  className="w-6 h-6 rounded-md text-slate-300 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-sm transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {/* Why panel */}
                        {visibleItems.some((it) => it.id === showWhyId) && (() => {
                          const item = visibleItems.find((it) => it.id === showWhyId)!;
                          return (
                            <div className="px-5 py-3 mx-3 mb-3 bg-blue-50 border border-blue-100 rounded-xl">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-[8px] font-bold">J</span>
                                </div>
                                <span className="text-xs font-bold text-blue-800">Journey AI — Why this?</span>
                              </div>
                              <p className="text-sm text-blue-900 leading-relaxed">{item.aiReason}</p>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Itinerary customization strip */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Customize</span>
              <button onClick={() => alert('Feature in development')} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition-all">
                ⇅ Reorder days
              </button>
              <button onClick={handleAddDay} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-lg transition-all">
                + Add a day
              </button>
              <button onClick={handleRemoveDay} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-all">
                − Remove a day
              </button>
              <button onClick={() => applyAIControl('reducetransit')} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-violet-700 hover:bg-violet-50 border border-slate-200 hover:border-violet-200 rounded-lg transition-all">
                ⚡ Optimize route
              </button>
            </div>
          </div>

          {/* Hotels */}
          {uniqueHotels.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Selected Hotels</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {uniqueHotels.map((item) => {
                  const hotel = hotels.find((h) => h.id === item.entityId);
                  if (!hotel) return null;
                  return (
                    <div key={item.entityId} className="group border border-slate-100 rounded-xl overflow-hidden hover:border-blue-200 transition-colors">
                      <div className="h-32 bg-slate-100 overflow-hidden relative">
                        <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute bottom-2 left-3 right-3">
                          <p className="text-white text-sm font-semibold leading-tight">{hotel.name}</p>
                          <p className="text-white/70 text-xs">{hotel.location}</p>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1">
                            {Array.from({ length: hotel.stars }).map((_, i) => <span key={i} className="text-amber-400 text-[10px]">★</span>)}
                            <span className="text-xs font-semibold text-slate-700 ml-1">{hotel.rating}</span>
                          </div>
                          <span className="text-xs text-slate-600 font-semibold">₹{hotel.pricePerNight.toLocaleString()}/night</span>
                        </div>
                        {item.aiReason && (
                          <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">{item.aiReason}</p>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => navigateToHotel(hotel.id)} className="flex-1 py-1.5 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                            View Details
                          </button>
                          <button
                            onClick={() => {
                              const itinItem = savedJourneyId
                                ? journey.days.flatMap((d) => d.items).find((it) => it.entityId === hotel.id && it.entityType === 'hotel')
                                : undefined;
                              startBookingFlow({
                                type: 'hotel',
                                itemId: hotel.id,
                                source: savedJourneyId ? 'journey' : 'ai-planner',
                                journeyId: savedJourneyId ?? undefined,
                                itineraryItemId: itinItem?.id,
                              });
                            }}
                            className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Book Now
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Experiences */}
          {uniqueExps.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Included Experiences</h2>
              <div className="space-y-3">
                {uniqueExps.map((item) => {
                  const act = activities.find((a) => a.id === item.entityId);
                  if (!act) return null;
                  return (
                    <div key={item.entityId} className="flex items-center gap-4 p-3 border border-slate-100 rounded-xl hover:border-blue-100 transition-colors group">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
                        <img src={act.imageUrl} alt={act.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{act.name}</p>
                        <p className="text-xs text-slate-500">{act.category} · {act.duration}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-amber-400 text-xs">★</span>
                          <span className="text-xs font-medium text-slate-700">{act.rating}</span>
                          <span className="text-xs text-slate-400">({act.reviewCount.toLocaleString()})</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-sm font-bold text-slate-800">₹{act.price.toLocaleString()}/person</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => navigateToExperience(act.id)} className="px-2.5 py-1 border border-slate-200 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                            Details
                          </button>
                          <button
                            onClick={() => {
                              const itinItem = savedJourneyId
                                ? journey.days.flatMap((d) => d.items).find((it) => it.entityId === act.id && it.entityType === 'activity')
                                : undefined;
                              startBookingFlow({
                                type: 'activity',
                                itemId: act.id,
                                source: savedJourneyId ? 'journey' : 'ai-planner',
                                journeyId: savedJourneyId ?? undefined,
                                itineraryItemId: itinItem?.id,
                              });
                            }}
                            className="px-2.5 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Book
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-4">
          {/* Budget overview */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Budget Overview</h3>
            <div className="space-y-3">
              {[
                { label: 'Flights', value: journey.budget.flights, color: 'bg-sky-500' },
                { label: 'Hotels', value: journey.budget.hotels, color: 'bg-blue-500' },
                { label: 'Transport', value: journey.budget.transport, color: 'bg-slate-400' },
                { label: 'Experiences', value: journey.budget.experiences, color: 'bg-violet-500' },
                { label: 'Food', value: journey.budget.food, color: 'bg-amber-500' },
                { label: 'Buffer', value: journey.budget.buffer, color: 'bg-emerald-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
                  <span className="text-xs text-slate-500 flex-1">{label}</span>
                  <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.round((value / journey.budget.total) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-16 text-right">₹{(value / 1000).toFixed(0)}k</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total estimated</span>
                <span className="font-bold text-slate-900">₹{journey.budget.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Your budget</span>
                <span className="font-semibold text-slate-700">₹{journey.dna.budget.toLocaleString()}</span>
              </div>
              {journey.dna.budget - journey.budget.total > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600 font-medium">Remaining</span>
                  <span className="font-bold text-emerald-600">₹{(journey.dna.budget - journey.budget.total).toLocaleString()}</span>
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600 font-medium">Over budget</span>
                  <span className="font-bold text-amber-600">₹{(journey.budget.total - journey.dna.budget).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* AI Controls */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[9px] font-bold">J</span>
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Change my journey</h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'Make it cheaper', control: 'cheaper', icon: '↓' },
                { label: 'More luxurious', control: 'luxurious', icon: '✦' },
                { label: 'Slow pace down', control: 'slowpace', icon: '◌' },
                { label: 'Add more food', control: 'morefood', icon: '🍜' },
                { label: 'Add more culture', control: 'moreculture', icon: '🏛' },
                { label: 'Add 2 days', control: 'add2days', icon: '+2' },
                { label: 'Reduce transit', control: 'reducetransit', icon: '⇢' },
                { label: 'Surprise me', control: 'morefood', icon: '✨' },
              ].map(({ label, control, icon }) => (
                <button
                  key={control + label}
                  onClick={() => applyAIControl(control)}
                  className="flex items-center gap-1.5 px-2.5 py-2 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 text-slate-700 hover:text-blue-700 text-xs font-medium rounded-lg transition-all text-left"
                >
                  <span className="text-sm leading-none flex-shrink-0">{icon}</span>
                  <span className="leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* What if? */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">What if?</h3>
            <div className="space-y-2 mb-3">
              {[
                { label: 'I reduce my budget?', scenario: 'reduceBudget' },
                { label: 'I add 2 more days?', scenario: 'add2days' },
                { label: 'I want more luxury?', scenario: 'luxury' },
              ].map(({ label, scenario }) => (
                <button
                  key={scenario}
                  onClick={() => { setComparisonScenario(scenario); setShowComparison(true); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition-all ${comparisonScenario === scenario && showComparison ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
                >
                  "{label}"
                </button>
              ))}
            </div>
            {showComparison && altJourney && (
              <div className="border-t border-slate-100 pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current</p>
                    <p className="text-base font-bold text-slate-900">₹{(journey.budget.total / 1000).toFixed(0)}k</p>
                    <p className="text-xs text-slate-500">{journey.dna.nights} nights</p>
                    <p className="text-xs font-semibold text-blue-600 mt-1">{journey.health.overall}/100 health</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Alternative</p>
                    <p className="text-base font-bold text-slate-900">₹{(altJourney.budget.total / 1000).toFixed(0)}k</p>
                    <p className="text-xs text-slate-500">{altJourney.dna.nights} nights</p>
                    <p className="text-xs font-semibold text-blue-600 mt-1">{altJourney.health.overall}/100 health</p>
                  </div>
                </div>
                {altJourney.aiMessage && (
                  <p className="text-xs text-slate-600 leading-relaxed">{altJourney.aiMessage}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setJourney({ ...altJourney, version: (journey.version ?? 1) + 1 }); setShowComparison(false); setControlMsg("Switched to alternative version."); }}
                    className="flex-1 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Use this version
                  </button>
                  <button onClick={() => setShowComparison(false)} className="flex-1 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                    Keep current
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Journey DNA summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Journey DNA</p>
            <div className="space-y-1.5 text-xs">
              {[
                ['Route', journey.route.join(' → ')],
                ['Duration', `${journey.dna.nights} nights`],
                ['Travelers', `${journey.dna.travelers}`],
                ['Pace', journey.dna.pace],
                ['Comfort', journey.dna.comfort],
                ['Interests', journey.dna.interests.join(', ') || 'Not specified'],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-2">
                  <span className="text-slate-400">{label}</span>
                  <span className="font-medium text-slate-700 text-right capitalize">{value}</span>
                </div>
              ))}
              {journey.dna.mustHave && (
                <div className="pt-2 mt-1 border-t border-slate-200">
                  <p className="text-slate-400">Must have</p>
                  <p className="text-slate-700 font-medium mt-0.5">{journey.dna.mustHave}</p>
                </div>
              )}
            </div>
          </div>

          {savedJourneyId && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#059669" strokeWidth="2"><path d="M2 7l3.5 3.5L12 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Journey saved</p>
                <p className="text-xs text-emerald-700">Find it in My Trips to manage and book.</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── DNA Form ─────────────────────────────────────────────────────────────────

function DNAForm({ dna, setDna, onBuild, toggleInterest }: {
  dna: JourneyDNA;
  setDna: React.Dispatch<React.SetStateAction<JourneyDNA>>;
  onBuild: () => void;
  toggleInterest: (i: string) => void;
}) {
  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="white"/>
          </svg>
        </div>
        <div>
          <h1 className="font-display text-2xl text-slate-900">Journey AI</h1>
          <p className="text-slate-500 text-sm">Build your journey, not just an itinerary.</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Destination + Origin */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wide text-slate-400">Where & When</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Destination', key: 'destination', placeholder: 'e.g. Tokyo, Japan' },
              { label: 'Flying from', key: 'origin', placeholder: 'e.g. Mumbai' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
                <input
                  value={dna[key as keyof JourneyDNA] as string}
                  onChange={(e) => setDna((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none transition-colors"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Start date</label>
              <input
                type="date"
                value={dna.startDate}
                onChange={(e) => setDna((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nights</label>
              <select
                value={dna.nights}
                onChange={(e) => setDna((p) => ({ ...p, nights: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none transition-colors bg-white"
              >
                {[3,4,5,6,7,8,9,10,12,14].map((n) => <option key={n} value={n}>{n} nights</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Travelers</label>
              <select
                value={dna.travelers}
                onChange={(e) => setDna((p) => ({ ...p, travelers: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none transition-colors bg-white"
              >
                {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'traveler' : 'travelers'}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Total budget (₹)</label>
              <input
                type="number"
                value={dna.budget}
                onChange={(e) => setDna((p) => ({ ...p, budget: Number(e.target.value) }))}
                step={10000}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Style & Comfort */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wide text-slate-400">Travel Style</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pace</label>
              <div className="flex gap-2">
                {(['relaxed', 'balanced', 'packed'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setDna((prev) => ({ ...prev, pace: p }))}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl capitalize border transition-all ${dna.pace === p ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Comfort level</label>
              <div className="flex gap-2">
                {(['smart', 'comfortable', 'premium', 'luxury'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setDna((prev) => ({ ...prev, comfort: c }))}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl capitalize border transition-all ${dna.comfort === c ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Interests</label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${dna.interests.includes(interest) ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'}`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wide text-slate-400">Your Preferences</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Must-have experiences</label>
              <input
                value={dna.mustHave}
                onChange={(e) => setDna((p) => ({ ...p, mustHave: e.target.value }))}
                placeholder="e.g. cherry blossoms, Mt Fuji view, authentic ramen"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Things to avoid</label>
              <input
                value={dna.avoid}
                onChange={(e) => setDna((p) => ({ ...p, avoid: e.target.value }))}
                placeholder="e.g. early mornings, crowded tourist sites"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Anything else? (free form)</label>
              <textarea
                value={dna.notes}
                onChange={(e) => setDna((p) => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. We don't like early mornings and want to spend more time in Kyoto. Celebrating an anniversary."
                rows={3}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-blue-400 focus:outline-none resize-none transition-colors"
              />
            </div>
          </div>
        </div>

        <button
          onClick={onBuild}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2.5 text-base shadow-lg shadow-blue-500/20"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2l1.5 3.5L14 7l-3.5 1.5L9 12l-1.5-3.5L4 7l3.5-1.5L9 2z" fill="currentColor"/>
          </svg>
          Build my journey
        </button>
      </div>
    </div>
  );
}

// ─── Building screen ──────────────────────────────────────────────────────────

function BuildingScreen({ msgIdx, destination }: { msgIdx: number; destination: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-8">
      <div className="relative">
        <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 4l2.5 6L25 12l-6 2.5L16 21l-2.5-6.5L7 12l6.5-2.5L16 4z" fill="white"/>
          </svg>
        </div>
        <div className="absolute -inset-2 rounded-xl border-2 border-blue-400/30 animate-ping" style={{ animationDuration: '2s' }} />
      </div>
      <div className="text-center max-w-md">
        <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Journey AI</p>
        <h2 className="font-display text-2xl text-slate-900 mb-2">Building your {destination.split(',')[0]} journey</h2>
        <p className="text-blue-600 text-sm font-medium min-h-[1.5em] transition-all">{BUILD_MSGS[msgIdx]}</p>
      </div>
      <div className="flex flex-col gap-2 w-64">
        {BUILD_MSGS.slice(0, 5).map((msg, i) => (
          <div key={msg} className={`flex items-center gap-2 transition-all duration-500 ${i <= msgIdx ? 'opacity-100' : 'opacity-20'}`}>
            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${i < msgIdx ? 'bg-emerald-500' : i === msgIdx ? 'bg-blue-600 animate-pulse' : 'bg-slate-200'}`}>
              {i < msgIdx && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5"><path d="M1.5 4l2 2 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </div>
            <span className="text-xs text-slate-600">{msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
