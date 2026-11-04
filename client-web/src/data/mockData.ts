// ─────────────────────────────────────────────────────────────────────────────
// Travalastic — shared data layer
// All pages consume from this single source of truth.
// ─────────────────────────────────────────────────────────────────────────────

export type Role = 'traveler' | 'partner' | 'corporate' | 'operations' | 'admin';
export type JourneyStatus = 'discovering' | 'planning' | 'booked' | 'pre-travel' | 'in-travel' | 'completed' | 'post-travel';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'processing' | 'successful' | 'failed' | 'refunded';
export type IncidentStatus = 'detected' | 'triaged' | 'investigating' | 'contained' | 'resolved' | 'closed';
export type FlightStatus = 'scheduled' | 'boarding' | 'departed' | 'delayed' | 'cancelled' | 'landed';
export type ItineraryItemStatus = 'unbooked' | 'booking' | 'booked' | 'modified' | 'cancelled';

// ─── INTERFACES ───────────────────────────────────────────────────────────────

export interface Destination {
  id: string;
  name: string;
  country: string;
  region: 'Asia' | 'Europe' | 'Middle East' | 'Indian Ocean' | 'Africa' | 'Americas' | 'Oceania' | 'South Asia';
  tagline: string;
  description: string;
  imageUrl: string;
  heroImageUrl: string;
  bestMonths: string[];
  budgetMin: number;
  budgetMax: number;
  suggestedDays?: number;
  travelStyles: string[];
  popularFor: string[];
  highlights: string[];
  travelTips?: string[];
  trending: boolean;
  demandChange: number;
  recommendedDays: number;
  areas: string[];
}

export interface RoomType {
  id: string;
  hotelId?: string;
  name: string;
  bedType: string;
  maxOccupancy: number;
  pricePerNight: number;
  imageUrl: string;
  amenities: string[];
  breakfastIncluded: boolean;
  cancellationPolicy: string;
  size: string;
  description?: string;
}

export interface Hotel {
  id: string;
  destinationId?: string;
  name: string;
  destination?: string;
  location: string;
  stars: number;
  rating: number;
  reviewCount: number;
  pricePerNight: number;
  imageUrl: string;
  images?: string[];
  galleryUrls?: string[];
  amenities: string[];
  category: string;
  address: string;
  description: string;
  rooms: RoomType[];
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy: string;
  nearbyAttractions: string[];
  availableRooms: number;
}

export interface ExperienceTimeSlot {
  id: string;
  time: string;
  availableSpots: number;
}

// ─── Experience / Activity ───────────────────────────────────

export interface Activity {
  id: string;
  destinationId?: string;
  destination?: string;
  name: string;
  category: string;
  duration: string;
  price: number;
  pricePerChild?: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  images: string[];
  description: string;
  longDescription: string;
  includedItems: string[];
  excludedItems: string[];
  meetingPoint: string;
  requirements: string;
  maxParticipants: number;
  minAge: number;
  timeSlots: ExperienceTimeSlot[];
  availableDays: string[];
  cancellationPolicy: string;
  highlights: string[];
}

export interface Flight {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  from: string;
  fromCode: string;
  to: string;
  toCode: string;
  destinationId: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  stopCity?: string;
  price: number;
  businessPrice?: number;
  status: FlightStatus;
  aircraft: string;
  class: string;
  seatsLeft: number;
  baggageIncluded: string;
  fareType: string;
  refundable: boolean;
}

// ─── Booking ─────────────────────────────────────────────────

export interface Booking {
  id: string;
  journeyId: string;
  travelerId: string;
  type: 'flight' | 'hotel' | 'activity' | 'package';
  status: BookingStatus;
  referenceId: string;
  supplierId: string;
  supplierName: string;
  itemName: string;
  itemDetails: string;
  checkIn?: string;
  checkOut?: string;
  departureDate?: string;
  totalAmount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  createdAt: string;
  passengers?: number;
  nights?: number;
  roomType?: string;
  experienceDate?: string;
  experienceTime?: string;
  participants?: number;
  meetingPoint?: string;
  seat?: string;
  baggage?: string;
  meal?: string;
  pnr?: string;
}

// ─── Itinerary item ──────────────────────────────────────────

export interface Payment {
  id: string;
  bookingId: string;
  journeyId: string;
  travelerId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string;
  last4?: string;
  transactionId: string;
  processedAt: string;
}

export interface ItineraryActivity {
  id: string;
  time: string;
  title: string;
  type: 'flight' | 'hotel' | 'activity' | 'transfer' | 'meal' | 'free';
  duration: string;
  notes?: string;
  cost?: number;
  status: ItineraryItemStatus;
  bookingId?: string;
  hotelId?: string;
  activityId?: string;
  flightId?: string;
}

export interface ItineraryDay {
  day: number;
  date: string;
  location: string;
  title: string;
  activities: ItineraryActivity[];
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'alert' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  journeyId?: string;
}

export interface Disruption {
  id: string;
  journeyId: string;
  type: 'flight-delay' | 'hotel-change' | 'weather' | 'cancellation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  status: IncidentStatus;
  affectedBookingId: string;
  detectedAt: string;
  impact: string;
  recommendation: string;
  resolvedAt?: string;
}

export interface Journey {
  id: string;
  travelerId: string;
  destination: string;
  destinationId: string;
  title: string;
  status: JourneyStatus;
  startDate: string;
  endDate: string;
  travelers: number;
  bookings: string[];
  totalBudget?: number;
  totalSpend: number;
  currency: string;
  imageUrl: string;
  itinerary: ItineraryDay[];
  notifications: Notification[];
  disruptions: Disruption[];
}

// ─── Traveler ─────────────────────────────────────────────────

export interface Traveler {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  passportNumber: string;
  nationality: string;
  loyaltyPoints: number;
  tier: 'standard' | 'silver' | 'gold' | 'platinum';
  totalTrips: number;
  preferredClass: string;
  journeyIds: string[];
}

export interface CuratedTrip {
  id: string;
  title: string;
  subtitle: string;
  destinations: string[];
  destinationIds: string[];
  duration: string;
  price: number;
  imageUrl: string;
  tag: string;
  highlights: string[];
  includes: string[];
}

export interface Deal {
  id: string;
  type: 'flight' | 'hotel' | 'activity' | 'package';
  title: string;
  subtitle: string;
  originalPrice: number;
  dealPrice: number;
  badge: string;
  badgeColor: string;
  imageUrl: string;
  destinationId: string;
  itemId: string;
  expiresIn: string;
}

export interface Supplier {
  id: string;
  name: string;
  type: 'airline' | 'hotel' | 'activity' | 'transport';
  verificationStatus: 'verified' | 'pending' | 'suspended' | 'restricted';
  qualityScore: number;
  fulfillmentRate: number;
  complaintRate: number;
  incidentRate: number;
  revenue: number;
  riskLevel: 'low' | 'medium' | 'high';
  country: string;
  activeBookings: number;
}

export interface CorporateAccount {
  id: string;
  name: string;
  industry: string;
  activeTravelers: number;
  monthlySpend: number;
  annualBudget: number;
  policyCompliance: number;
  pendingApprovals: number;
  upcomingTrips: number;
}

// ─── DESTINATIONS ─────────────────────────────────────────────────────────────

export const destinations: Destination[] = [
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    region: 'Asia',
    tagline: 'Where ancient temples meet neon skyscrapers',
    description: "Tokyo is a city of extraordinary contrasts — serene Shinto shrines standing metres from towering glass towers, world-class sushi next to ramen carts, and silence amid the bustle. Few cities reward the curious traveler quite like Japan's electric capital.",
    imageUrl: 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1604928141064-207cea6f571f?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['March', 'April', 'October', 'November'],
    budgetMin: 8000,
    budgetMax: 25000,
    travelStyles: ['Cultural', 'Food & Culinary', 'Urban', 'Photography'],
    popularFor: ['Shibuya Crossing', 'Tsukiji Market', 'Senso-ji Temple', 'Akihabara', 'TeamLab'],
    trending: true,
    demandChange: 22,
    recommendedDays: 7,
    highlights: ['Cherry blossom season in spring', "World's best sushi", 'Ultra-efficient transport', 'Pop culture capital'],
    areas: ['Shinjuku', 'Shibuya', 'Asakusa', 'Harajuku', 'Akihabara', 'Ginza'],
  },
  {
    id: 'kyoto',
    name: 'Kyoto',
    country: 'Japan',
    region: 'Asia',
    tagline: "Timeless Japan — temples, geisha and bamboo groves",
    description: "Kyoto is Japan's cultural soul — over 1,600 Buddhist temples, serene bamboo groves, traditional tea ceremonies and the last remaining geisha districts. The ancient capital rewards slow travel and quiet mornings.",
    imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['March', 'April', 'November'],
    budgetMin: 7000,
    budgetMax: 20000,
    travelStyles: ['Cultural', 'Romantic', 'Photography', 'Wellness'],
    popularFor: ['Fushimi Inari', 'Arashiyama Bamboo', 'Gion District', 'Kinkaku-ji', 'Tea Ceremony'],
    trending: true,
    demandChange: 19,
    recommendedDays: 4,
    highlights: ['Thousands of vermilion torii gates', 'Traditional ryokan stays', 'Zen garden meditation', 'Maiko encounters in Gion'],
    areas: ['Gion', 'Arashiyama', 'Fushimi', 'Higashiyama', 'Downtown'],
  },
  {
    id: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    region: 'Asia',
    tagline: 'Island of the Gods — beauty at every turn',
    description: 'Bali has long captured imaginations with its emerald rice terraces, ancient temples perched on cliff edges, world-famous sunsets and a warmth that stays with you long after you leave.',
    imageUrl: 'https://images.unsplash.com/photo-1571984405176-5958bd9ac31d?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1546484475-7f7bd55792da?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['April', 'May', 'June', 'July', 'August', 'September'],
    budgetMin: 4000,
    budgetMax: 18000,
    travelStyles: ['Beach & Relaxation', 'Wellness & Spa', 'Cultural', 'Adventure'],
    popularFor: ['Ubud Rice Terraces', 'Tanah Lot Temple', 'Seminyak Beach', 'Mount Batur Sunrise', 'Monkey Forest'],
    trending: true,
    demandChange: 18,
    recommendedDays: 10,
    highlights: ['UNESCO rice terraces', 'Balinese Hindu temples', 'World-class surf breaks', 'Luxury spa retreats'],
    areas: ['Ubud', 'Seminyak', 'Canggu', 'Nusa Dua', 'Kuta', 'Uluwatu'],
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'Singapore',
    region: 'Asia',
    tagline: "The Lion City — where Asia's future is being built",
    description: "Singapore is a marvel of modern urbanism — a city-state that compressed decades of development into years and turned a tropical island into one of Asia's most liveable, safest and most gastronomically exciting cities.",
    imageUrl: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['February', 'March', 'July', 'August'],
    budgetMin: 8000,
    budgetMax: 22000,
    travelStyles: ['Urban', 'Food & Culinary', 'Shopping', 'Family'],
    popularFor: ['Gardens by the Bay', 'Marina Bay Sands', 'Hawker Centres', 'Sentosa Island', 'Orchard Road'],
    trending: true,
    demandChange: 14,
    recommendedDays: 4,
    highlights: ['Gardens by the Bay light show', "World's best hawker food", 'Universal Studios', 'Multicultural neighborhoods'],
    areas: ['Marina Bay', 'Orchard', 'Sentosa', 'Chinatown', 'Little India', 'Clarke Quay'],
  },
  {
    id: 'bangkok',
    name: 'Bangkok',
    country: 'Thailand',
    region: 'Asia',
    tagline: 'Controlled chaos — temples, street food and nightlife',
    description: 'Bangkok is a city that assaults all the senses — golden temples rising above the smog, markets spilling onto sidewalks, tuk-tuks weaving through traffic, and the intoxicating smell of pad thai from every corner.',
    imageUrl: 'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1508009603885-50cf7c8dd0d5?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['November', 'December', 'January', 'February', 'March'],
    budgetMin: 3000,
    budgetMax: 12000,
    travelStyles: ['Food & Culinary', 'Cultural', 'Adventure', 'Budget'],
    popularFor: ['Grand Palace', 'Chatuchak Market', 'Khao San Road', 'Floating Markets', 'Wat Pho'],
    trending: false,
    demandChange: 9,
    recommendedDays: 5,
    highlights: ['Glittering royal temples', 'Night markets and street food', 'Rooftop bars', 'Chao Phraya river life'],
    areas: ['Sukhumvit', 'Silom', 'Rattanakosin', 'Khao San', 'Ari', 'Chatuchak'],
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    region: 'Europe',
    tagline: 'The city of light, romance and endless discovery',
    description: 'Paris remains one of the most visited destinations for good reason. Its art, architecture, cuisine and character are simply unmatched — and there is always a new corner to discover, a new cafe to sit in, and a new gallery to lose an afternoon in.',
    imageUrl: 'https://images.unsplash.com/photo-1570097703229-b195d6dd291f?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1439393161192-32360eb753f1?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['April', 'May', 'June', 'September', 'October'],
    budgetMin: 10000,
    budgetMax: 35000,
    travelStyles: ['Cultural', 'Food & Culinary', 'Romantic', 'Art & Museums'],
    popularFor: ['Eiffel Tower', 'Louvre Museum', 'Montmartre', 'Seine River Cruise', 'Palace of Versailles'],
    trending: false,
    demandChange: 8,
    recommendedDays: 5,
    highlights: ["World's most famous art collection", 'Michelin-starred dining', 'Iconic architecture at every turn', 'Fashion capital of the world'],
    areas: ['Marais', 'Montmartre', 'Saint-Germain', 'Champs-Élysées', 'Opera', 'Latin Quarter'],
  },
  {
    id: 'barcelona',
    name: 'Barcelona',
    country: 'Spain',
    region: 'Europe',
    tagline: 'Gaudí, beaches and the best tapas on earth',
    description: "Barcelona is a city where art and architecture burst from every surface. Gaudí's extraordinary buildings, the Gothic Quarter's medieval lanes, world-class beaches on the doorstep, and a food and nightlife scene that never seems to sleep.",
    imageUrl: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1464790719320-516ecd75af6c?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['April', 'May', 'June', 'September', 'October'],
    budgetMin: 8000,
    budgetMax: 28000,
    travelStyles: ['Cultural', 'Beach & Relaxation', 'Food & Culinary', 'Art & Museums'],
    popularFor: ['Sagrada Família', 'Park Güell', 'La Boqueria', 'Gothic Quarter', 'Barceloneta Beach'],
    trending: true,
    demandChange: 12,
    recommendedDays: 5,
    highlights: ["Gaudí's unfinished masterpiece Sagrada Família", 'Vibrant food market La Boqueria', 'Beach city unlike any other', 'Catalan architecture'],
    areas: ['Gothic Quarter', 'El Born', 'Eixample', 'Gràcia', 'Barceloneta', 'Montjuïc'],
  },
  {
    id: 'santorini',
    name: 'Santorini',
    country: 'Greece',
    region: 'Europe',
    tagline: 'Blue domes, white walls and the Aegean at its finest',
    description: 'Santorini is the Cyclades at their most dramatic — sheer volcanic cliffs dropping into the caldera, villages of sugar-cube houses clinging to the edge, sunsets so good they have become a travel cliché, and wine grown from ancient vines in volcanic soil.',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['May', 'June', 'September', 'October'],
    budgetMin: 12000,
    budgetMax: 45000,
    travelStyles: ['Romantic', 'Beach & Relaxation', 'Luxury', 'Photography'],
    popularFor: ['Oia Sunset', 'Caldera Views', 'Akrotiri Ruins', 'Black Sand Beaches', 'Volcano Hike'],
    trending: true,
    demandChange: 16,
    recommendedDays: 5,
    highlights: ["The world's most photographed sunset", 'Unique black-sand and red-sand beaches', 'Ancient Minoan ruins', 'Exceptional local wine'],
    areas: ['Oia', 'Fira', 'Imerovigli', 'Akrotiri', 'Perissa', 'Kamari'],
  },
  {
    id: 'amsterdam',
    name: 'Amsterdam',
    country: 'Netherlands',
    region: 'Europe',
    tagline: 'Canals, culture and cycling — the perfect city break',
    description: 'Amsterdam rewards the curious — its concentric canal ring hides world-class museums, centuries-old gabled houses, and a cycling culture that actually works. Small enough to walk, large enough to keep surprising you.',
    imageUrl: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['April', 'May', 'June', 'July', 'August', 'September'],
    budgetMin: 10000,
    budgetMax: 30000,
    travelStyles: ['Cultural', 'Art & Museums', 'Food & Culinary', 'Urban'],
    popularFor: ['Rijksmuseum', 'Van Gogh Museum', 'Anne Frank House', 'Keukenhof Gardens', 'Canal Ring'],
    trending: false,
    demandChange: 7,
    recommendedDays: 4,
    highlights: ['Rijksmuseum housing Rembrandt masterpieces', 'Spring tulip fields', 'Historic canal ring (UNESCO)', 'Thriving café culture'],
    areas: ['Centrum', 'Jordaan', 'De Pijp', 'Oud-Zuid', 'NDSM', 'Plantage'],
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'UAE',
    region: 'Middle East',
    tagline: 'Ambition made skyline — future built today',
    description: 'Dubai is a city that refuses to be ordinary. From the world\'s tallest building to underwater restaurants, it is a place where the impossible is merely tomorrow\'s plan. Desert tradition and hyper-modern luxury exist side by side.',
    imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['October', 'November', 'December', 'January', 'February', 'March'],
    budgetMin: 10000,
    budgetMax: 50000,
    travelStyles: ['Luxury', 'Shopping', 'Adventure', 'Business'],
    popularFor: ['Burj Khalifa', 'Dubai Mall', 'Palm Jumeirah', 'Desert Safari', 'Gold Souk'],
    trending: true,
    demandChange: 15,
    recommendedDays: 5,
    highlights: ["At the top of the world's tallest tower", 'Desert safari under the stars', 'Luxury shopping malls with indoor skiing', 'Private beach clubs'],
    areas: ['Downtown', 'Marina', 'Palm Jumeirah', 'Deira', 'JBR', 'Business Bay'],
  },
  {
    id: 'maldives',
    name: 'Maldives',
    country: 'Maldives',
    region: 'Indian Ocean',
    tagline: 'Overwater serenity — where time dissolves',
    description: "The Maldives is the definitive luxury escape — crystalline lagoons, powder-white sandbanks, and overwater villas where the ocean is literally your floor. The world's most threatened paradise is also its most photogenic.",
    imageUrl: 'https://images.unsplash.com/photo-1654593777128-d187ed9820e5?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1609779340167-207589f3f94f?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['November', 'December', 'January', 'February', 'March', 'April'],
    budgetMin: 30000,
    budgetMax: 150000,
    travelStyles: ['Luxury', 'Beach & Relaxation', 'Romantic', 'Diving & Snorkeling'],
    popularFor: ['Overwater Bungalows', 'Snorkeling', 'Dolphin Watching', 'Private Beaches', 'Manta Rays'],
    trending: true,
    demandChange: 28,
    recommendedDays: 7,
    highlights: ['Stay directly above the Indian Ocean', 'Bioluminescent beaches at night', "World's best coral reefs", 'Complete digital detox'],
    areas: ['North Malé Atoll', 'South Malé Atoll', 'Baa Atoll', 'Noonu Atoll', 'Ari Atoll'],
  },
  {
    id: 'srilanka',
    name: 'Sri Lanka',
    country: 'Sri Lanka',
    region: 'Indian Ocean',
    tagline: 'The pearl of the Indian Ocean — ancient and wild',
    description: 'Sri Lanka packs extraordinary variety into a small island — ancient kingdoms, elephant reserves, surf beaches, misty tea estates, whale-watching coasts and some of the most affordable luxury accommodation in Asia.',
    imageUrl: 'https://images.unsplash.com/photo-1588456750374-5b17e1dc6e11?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1586861203927-800a5acdcc4d?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['December', 'January', 'February', 'March', 'April'],
    budgetMin: 4000,
    budgetMax: 18000,
    travelStyles: ['Cultural', 'Adventure', 'Wildlife', 'Beach & Relaxation'],
    popularFor: ['Sigiriya Rock', 'Ella Train Ride', 'Yala Safari', 'Galle Fort', 'Temple of the Tooth'],
    trending: true,
    demandChange: 21,
    recommendedDays: 12,
    highlights: ['Sunrise over Sigiriya Lion Rock', 'Blue whale watching off Mirissa', 'Colonial Galle Fort', 'Tea country train journeys'],
    areas: ['Colombo', 'Kandy', 'Ella', 'Galle', 'Mirissa', 'Sigiriya'],
  },
  {
    id: 'newzealand',
    name: 'Queenstown',
    country: 'New Zealand',
    region: 'Oceania',
    tagline: 'Adventure capital of the world',
    description: 'Queenstown sits on the edge of a glacial lake surrounded by the Remarkables mountain range. It has built an entire economy around adrenaline — bungee jumping, skydiving, jet boating — but the scenery alone would justify the trip.',
    imageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['December', 'January', 'February', 'March', 'June', 'July', 'August'],
    budgetMin: 15000,
    budgetMax: 50000,
    travelStyles: ['Adventure', 'Nature', 'Luxury', 'Photography'],
    popularFor: ['Bungee Jumping', 'Milford Sound', 'Skiing', 'Jet Boating', 'Wine Trails'],
    trending: false,
    demandChange: 6,
    recommendedDays: 7,
    highlights: ['AJ Hackett original bungy site', 'Milford Sound fiord', 'Ski the Remarkables and Coronet Peak', 'Hobbiton film location nearby'],
    areas: ['Queenstown Town', 'Arrowtown', 'Glenorchy', 'Wanaka', 'Milford Sound'],
  },
  {
    id: 'marrakech',
    name: 'Marrakech',
    country: 'Morocco',
    region: 'Africa',
    tagline: 'The red city — souks, riads and Saharan gold',
    description: "Marrakech is a city that hasn't quite joined the 21st century — and that's entirely the point. Getting lost in the medina souks, sleeping in a candlelit riad, watching acrobats in Jemaa el-Fna square at dusk.",
    imageUrl: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['March', 'April', 'May', 'October', 'November'],
    budgetMin: 5000,
    budgetMax: 25000,
    travelStyles: ['Cultural', 'Food & Culinary', 'Luxury', 'Adventure'],
    popularFor: ['Jemaa el-Fna', 'Majorelle Garden', 'Medina Souks', 'Hammam', 'Atlas Mountains'],
    trending: false,
    demandChange: 10,
    recommendedDays: 5,
    highlights: ['Jemaa el-Fna at dusk — UNESCO cultural spectacle', "Yves Saint Laurent's Majorelle Garden", 'Medina spice and leather souks', 'Sahara desert excursion'],
    areas: ['Medina', 'Gueliz', 'Hivernage', 'Palmeraie', 'Atlas Mountains (nearby)'],
  },
  {
    id: 'capetown',
    name: 'Cape Town',
    country: 'South Africa',
    region: 'Africa',
    tagline: 'Where the Atlantic meets the vineyard and the mountain',
    description: "Cape Town is South Africa's crown — Table Mountain rising above a city of beaches, award-winning wineries, penguin colonies, and some of the continent's best restaurants.",
    imageUrl: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1540162875997-2e1bf08ece44?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['October', 'November', 'December', 'January', 'February', 'March', 'April'],
    budgetMin: 6000,
    budgetMax: 28000,
    travelStyles: ['Adventure', 'Food & Culinary', 'Nature', 'Cultural'],
    popularFor: ['Table Mountain', 'Boulders Beach Penguins', 'Cape Winelands', 'Robben Island', "Chapman's Peak"],
    trending: false,
    demandChange: 9,
    recommendedDays: 7,
    highlights: ['Table Mountain cable car and sunrise hike', 'African penguin colony at Boulders Beach', 'Stellenbosch wine estates', 'Robben Island historical tour'],
    areas: ['City Bowl', 'Waterfront', 'Sea Point', 'Camps Bay', 'Stellenbosch', "Simon's Town"],
  },
  {
    id: 'newyork',
    name: 'New York',
    country: 'USA',
    region: 'Americas',
    tagline: 'Eight million stories, one city',
    description: 'New York City is the world in miniature — every culture, every cuisine, every ambition, every creative endeavour compressed into five boroughs. The skyline is iconic, the museums are world-class, the food scene is extraordinary.',
    imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['April', 'May', 'June', 'September', 'October'],
    budgetMin: 18000,
    budgetMax: 80000,
    travelStyles: ['Urban', 'Cultural', 'Food & Culinary', 'Shopping'],
    popularFor: ['Central Park', 'Metropolitan Museum', 'Times Square', 'Brooklyn Bridge', 'High Line'],
    trending: false,
    demandChange: 8,
    recommendedDays: 6,
    highlights: ['The Metropolitan Museum of Art', 'Central Park — 843 acres of green in Manhattan', "World's greatest pizza and bagels", 'Broadway shows'],
    areas: ['Manhattan', 'Brooklyn', 'Queens', 'The Bronx', 'Staten Island'],
  },
  {
    id: 'iceland',
    name: 'Reykjavik',
    country: 'Iceland',
    region: 'Europe',
    tagline: 'Northern lights, geysers and glaciers',
    description: "Iceland is the planet's most dramatic landscape compressed into one island — active volcanoes, midnight-sun summers, aurora-lit winters, black-sand beaches, and Europe's last great wilderness.",
    imageUrl: 'https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1531168556467-80aace0d0144?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['June', 'July', 'August', 'September', 'February', 'March'],
    budgetMin: 20000,
    budgetMax: 70000,
    travelStyles: ['Adventure', 'Nature', 'Photography', 'Wellness'],
    popularFor: ['Northern Lights', 'Golden Circle', 'Blue Lagoon', 'Glacier Hiking', 'Whale Watching'],
    trending: true,
    demandChange: 17,
    recommendedDays: 8,
    highlights: ['Aurora borealis from September to March', 'Geothermal Blue Lagoon spa', 'Midnight sun in summer', "Vatnajökull glacier — Europe's largest"],
    areas: ['Reykjavik', 'Golden Circle', 'South Coast', 'Snæfellsnes', 'Westfjords'],
  },
  {
    id: 'rajasthan',
    name: 'Rajasthan',
    country: 'India',
    region: 'Asia',
    tagline: 'Land of maharajas — forts, palaces and desert gold',
    description: 'Rajasthan is India at its most cinematic — massive desert forts rising from sand dunes, palace hotels where maharajas once slept, camel safaris at sunset, and cities painted blue, pink and white against the Thar Desert sky.',
    imageUrl: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['October', 'November', 'December', 'January', 'February'],
    budgetMin: 5000,
    budgetMax: 30000,
    travelStyles: ['Cultural', 'Luxury', 'Photography', 'Adventure'],
    popularFor: ['Amber Fort', 'Lake Palace Udaipur', 'Camel Safari Jaisalmer', 'Holi Festival', 'Blue City Jodhpur'],
    trending: true,
    demandChange: 23,
    recommendedDays: 10,
    highlights: ['Amer Fort with elephant rides', 'Floating Lake Palace hotel', 'Camel safari into the Thar Desert', "Vibrant bazaars of Jaipur's Pink City"],
    areas: ['Jaipur', 'Jodhpur', 'Udaipur', 'Jaisalmer', 'Pushkar', 'Ranthambore'],
  },
  {
    id: 'kerala',
    name: 'Kerala',
    country: 'India',
    region: 'Asia',
    tagline: "God's Own Country — backwaters, spice and Ayurveda",
    description: "Kerala is South India's gentlest destination — a mosaic of coconut-fringed backwaters, emerald hill stations, spice plantations, ancient Ayurvedic traditions and some of the country's finest seafood.",
    imageUrl: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&h=500&fit=crop&auto=format',
    heroImageUrl: 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=1600&h=900&fit=crop&auto=format',
    bestMonths: ['October', 'November', 'December', 'January', 'February', 'March'],
    budgetMin: 4000,
    budgetMax: 20000,
    travelStyles: ['Wellness & Spa', 'Nature', 'Cultural', 'Food & Culinary'],
    popularFor: ['Alleppey Houseboat', 'Munnar Tea Estates', 'Kathakali Dance', 'Ayurveda Retreats', 'Periyar Wildlife'],
    trending: false,
    demandChange: 13,
    recommendedDays: 9,
    highlights: ['Overnight houseboat on the backwaters', 'Dawn tea-garden walks in Munnar', 'Traditional Kathakali performances', 'Authentic Ayurvedic treatment'],
    areas: ['Kochi', 'Alleppey', 'Munnar', 'Thekkady', 'Varkala', 'Kovalam'],
  },
];

// ─── HOTELS ───────────────────────────────────────────────────────────────────

const makeRooms = (base: number): RoomType[] => [
  {
    id: 'dlx',
    name: 'Deluxe Room',
    bedType: 'King Bed',
    maxOccupancy: 2,
    pricePerNight: base,
    imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop&auto=format',
    amenities: ['City View', 'Air Conditioning', 'Minibar', 'Safe', 'Flat-Screen TV'],
    breakfastIncluded: false,
    cancellationPolicy: 'Free cancellation up to 48 hours before check-in.',
    size: '32 m²',
  },
  {
    id: 'sup',
    name: 'Superior Suite',
    bedType: 'King Bed + Sofa',
    maxOccupancy: 3,
    pricePerNight: Math.round(base * 1.6),
    imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=600&fit=crop&auto=format',
    amenities: ['Panoramic View', 'Living Area', 'Walk-in Closet', 'Premium Minibar', 'Bathtub'],
    breakfastIncluded: true,
    cancellationPolicy: 'Free cancellation up to 72 hours before check-in.',
    size: '58 m²',
  },
];

export const hotels: Hotel[] = [
  // TOKYO
  {
    id: 'ht-001',
    destinationId: 'tokyo',
    name: 'Park Hyatt Tokyo',
    destination: 'tokyo',
    location: 'Shinjuku',
    stars: 5,
    rating: 4.8,
    reviewCount: 2847,
    pricePerNight: 32000,
    imageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&h=600&fit=crop&auto=format', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop&auto=format', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=600&fit=crop&auto=format', 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Infinity Pool', 'Spa', 'Gym', 'Fine Dining', 'Bar', 'Concierge', 'City View', 'Room Service'],
    category: 'Luxury',
    address: '3-7-1-2 Nishi-Shinjuku, Shinjuku, Tokyo 163-1055',
    availableRooms: 3,
    description: 'Occupying floors 39–52 of the Shinjuku Park Tower, the Park Hyatt Tokyo offers the most dramatic city views in Japan. Famously referenced in Lost in Translation, every room gazes over Tokyo\'s endless neon horizon.',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Free cancellation up to 72 hours before check-in. Within 72 hours: 1 night charge.',
    nearbyAttractions: ['Shinjuku Gyoen Garden (10 min)', 'Kabukicho Entertainment (5 min)', 'Tokyo Metropolitan Government Building (5 min)', 'Omoide Yokocho (8 min)'],
    rooms: makeRooms(32000),
  },
  {
    id: 'ht-002',
    destinationId: 'tokyo',
    name: 'Aman Tokyo',
    destination: 'tokyo',
    location: 'Otemachi',
    stars: 5,
    rating: 4.9,
    reviewCount: 1204,
    pricePerNight: 68000,
    imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop&auto=format', 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Indoor Pool', 'Aman Spa', 'Gym', 'Arva Restaurant', 'Bar', 'Butler Service', 'Library', 'Meditation Room'],
    category: 'Ultra-Luxury',
    address: 'The Otemachi Tower, 1-5-6 Otemachi, Chiyoda, Tokyo 100-0004',
    availableRooms: 1,
    description: 'Aman Tokyo occupies the top six floors of The Otemachi Tower. The aesthetic is a serene study in washi paper, dark timber and river stone. The 33-metre indoor swimming pool alone is worth the journey.',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Non-refundable. Rate includes daily breakfast.',
    nearbyAttractions: ['Imperial Palace Gardens (5 min)', 'Tokyo Station (7 min)', 'Nihonbashi (10 min)', 'Akihabara (12 min)'],
    rooms: [
      { id: 'dlx', name: 'Aman Suite', bedType: 'King Bed', maxOccupancy: 2, pricePerNight: 68000, imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop&auto=format', amenities: ['Sky View', 'Deep Soaking Tub', 'Private Dining Area', 'Butler Service'], breakfastIncluded: true, cancellationPolicy: 'Non-refundable.', size: '74 m²' },
      { id: 'pnt', name: 'Panoramic Suite', bedType: 'King Bed', maxOccupancy: 2, pricePerNight: 95000, imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=600&fit=crop&auto=format', amenities: ['360° Tokyo Views', 'Dining Room', 'Full Bar Setup', 'Dedicated Butler'], breakfastIncluded: true, cancellationPolicy: 'Non-refundable.', size: '120 m²' },
    ],
  },
  // KYOTO
  {
    id: 'ht-003',
    name: 'The Ritz-Carlton Kyoto',
    destination: 'kyoto',
    location: 'Nakagyo',
    stars: 5,
    rating: 4.85,
    reviewCount: 1876,
    pricePerNight: 55000,
    imageUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop&auto=format', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Outdoor Pool', 'Spa', 'Tea Ceremony Room', 'Japanese Garden', 'Sushi Bar', 'Gym', 'Concierge', 'Butler'],
    category: 'Luxury',
    address: 'Nakagawa-cho 543, Kamogawa Nijo Bridge, Nakagyo, Kyoto 604-0902',
    availableRooms: 4,
    description: 'Poised on the banks of the Kamogawa River, The Ritz-Carlton Kyoto blends the international luxury standard with deep Kyoto cultural sensibility. The indoor-outdoor pool faces a traditional Japanese garden.',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Free cancellation up to 7 days before check-in.',
    nearbyAttractions: ['Nijo Castle (12 min)', 'Gion District (15 min)', 'Nishiki Market (8 min)', 'Kamo Shrine (5 min)'],
    rooms: makeRooms(55000),
  },
  {
    id: 'ht-004',
    name: 'Hoshinoya Kyoto',
    destination: 'kyoto',
    location: 'Arashiyama',
    stars: 5,
    rating: 4.92,
    reviewCount: 842,
    pricePerNight: 72000,
    imageUrl: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Private Boat Access', 'Onsen', 'Meditation Room', 'Fine Dining', 'Zen Garden', 'Library', 'Forest Bath'],
    category: 'Ultra-Luxury',
    address: 'Arashiyama, Nishikyo-ku, Kyoto',
    availableRooms: 2,
    description: 'Accessible only by boat along the Oi River, Hoshinoya Kyoto sits in a forest clearing surrounded by mountains. The resort is a ryokan-inspired sanctuary with private onsen, traditional kaiseki dining, and morning yoga in the bamboo grove.',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    cancellationPolicy: 'Non-refundable. Rate includes two meals daily.',
    nearbyAttractions: ['Arashiyama Bamboo Grove (adjacent)', 'Tenryu-ji Temple (5 min by boat)', 'Monkey Park (10 min)', 'Togetsukyo Bridge (5 min by boat)'],
    rooms: [{ id: 'frst', name: 'Forest Room', bedType: 'Futon on Tatami', maxOccupancy: 2, pricePerNight: 72000, imageUrl: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&h=600&fit=crop&auto=format', amenities: ['Private Onsen', 'Forest View', 'Tatami Floor', 'Kimono Provided'], breakfastIncluded: true, cancellationPolicy: 'Non-refundable.', size: '50 m²' }],
  },
  // BALI
  {
    id: 'ht-005',
    name: 'Four Seasons Bali at Sayan',
    destination: 'bali',
    location: 'Ubud',
    stars: 5,
    rating: 4.9,
    reviewCount: 3126,
    pricePerNight: 45000,
    imageUrl: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&h=600&fit=crop&auto=format', 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop&auto=format', 'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Infinity Pool', 'Spa', 'Yoga Pavilion', 'Rice Terrace Views', 'Private Villas', 'Cooking Classes', 'Cultural Tours'],
    category: 'Ultra-Luxury',
    address: 'Sayan, Ubud, Bali 80571',
    availableRooms: 5,
    description: 'Perched above the Ayung River gorge in Ubud\'s rice-terrace heartland, Four Seasons Bali at Sayan consistently ranks among the world\'s best hotels. The elliptical lotus pond on the rooftop arrival structure has become one of Bali\'s most photographed images.',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Free cancellation up to 72 hours before check-in.',
    nearbyAttractions: ['Tegallalang Rice Terraces (20 min)', 'Sacred Monkey Forest (15 min)', 'Tirta Empul Temple (20 min)', 'Ubud Art Market (15 min)'],
    rooms: [
      { id: 'grdn', name: 'Garden Villa', bedType: 'King Bed', maxOccupancy: 2, pricePerNight: 45000, imageUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop&auto=format', amenities: ['Private Pool', 'Garden', 'Outdoor Shower', 'Day Bed'], breakfastIncluded: true, cancellationPolicy: 'Free cancellation 72h prior.', size: '120 m²' },
      { id: 'rvr', name: 'River Valley Suite', bedType: 'King Bed', maxOccupancy: 3, pricePerNight: 72000, imageUrl: 'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=800&h=600&fit=crop&auto=format', amenities: ['Private Pool', 'River Views', 'Outdoor Lounge', 'Butler Service'], breakfastIncluded: true, cancellationPolicy: 'Free cancellation 72h prior.', size: '180 m²' },
    ],
  },
  {
    id: 'ht-006',
    name: 'Alaya Resort Ubud',
    destination: 'bali',
    location: 'Ubud',
    stars: 4,
    rating: 4.6,
    reviewCount: 2341,
    pricePerNight: 18000,
    imageUrl: 'https://images.unsplash.com/photo-1510414696678-2415ad8474aa?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1510414696678-2415ad8474aa?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Pool', 'Spa', 'Yoga', 'Cooking Class', 'Bicycle Rental', 'Restaurant', 'Library'],
    category: 'Boutique',
    address: 'Jl. Hanoman, Ubud, Bali 80571',
    availableRooms: 8,
    description: 'Alaya Resort Ubud is a lovingly crafted boutique hotel in the heart of Ubud\'s cultural district. The architecture draws on traditional Balinese design, with hand-carved wooden doors, rattan furnishings and an open-air restaurant overlooking a rice paddy.',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    cancellationPolicy: 'Free cancellation up to 48 hours before check-in.',
    nearbyAttractions: ['Ubud Palace (5 min)', 'Sacred Monkey Forest (10 min)', 'Art Market (5 min)', 'Yoga Barn (8 min)'],
    rooms: makeRooms(18000),
  },
  // SINGAPORE
  {
    id: 'ht-007',
    name: 'Marina Bay Sands',
    destination: 'singapore',
    location: 'Marina Bay',
    stars: 5,
    rating: 4.7,
    reviewCount: 28400,
    pricePerNight: 42000,
    imageUrl: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Infinity Pool (55th Floor)', 'Casino', 'Spa', 'Gym', 'Celebrity Restaurants', 'Art Science Museum', 'Shopping Mall'],
    category: 'Luxury',
    address: '10 Bayfront Avenue, Singapore 018956',
    availableRooms: 12,
    description: 'Marina Bay Sands is Singapore\'s defining icon — three 55-storey towers topped by a 340-metre SkyPark with the world\'s most photographed infinity pool. The views across Marina Bay and the city are extraordinary.',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    cancellationPolicy: 'Free cancellation up to 48 hours before check-in.',
    nearbyAttractions: ['Gardens by the Bay (5 min)', 'Merlion Park (10 min)', 'Chinatown (15 min)', 'Orchard Road (20 min)'],
    rooms: makeRooms(42000),
  },
  // PARIS
  {
    id: 'ht-008',
    name: 'Hôtel Plaza Athénée',
    destination: 'paris',
    location: 'Avenue Montaigne, 8th Arr.',
    stars: 5,
    rating: 4.85,
    reviewCount: 4217,
    pricePerNight: 85000,
    imageUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Dior Institut Spa', 'Alain Ducasse Restaurant', 'Bar', 'Gym', 'Concierge', 'Butler', 'Eiffel Tower View', 'Limousine'],
    category: 'Ultra-Luxury',
    address: '25 Avenue Montaigne, 75008 Paris',
    availableRooms: 2,
    description: 'The Plaza Athénée on Avenue Montaigne has been Paris\'s fashion-district grande dame since 1911. Red geraniums cascade from balconies with Eiffel Tower views; Alain Ducasse\'s three-Michelin-starred restaurant occupies the ground floor.',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Non-refundable.',
    nearbyAttractions: ['Eiffel Tower (12 min)', 'Champs-Élysées (5 min)', "Musée d'Art Moderne (10 min)", "Pont de l'Alma (5 min)"],
    rooms: makeRooms(85000),
  },
  {
    id: 'ht-009',
    name: 'Le Marais Boutique Hotel',
    destination: 'paris',
    location: 'Le Marais, 4th Arr.',
    stars: 4,
    rating: 4.5,
    reviewCount: 1823,
    pricePerNight: 18000,
    imageUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Café', 'Bar', 'Courtyard Garden', 'Concierge', 'Bike Rental', 'Luggage Storage'],
    category: 'Boutique',
    address: '12 Rue de Bretagne, 75003 Paris',
    availableRooms: 7,
    description: 'Tucked into a 17th-century townhouse in the heart of Le Marais, this design-forward boutique hotel offers intimate Parisian character without the palace-hotel price. Steps from the Pompidou Centre and the best falafel in Paris.',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    cancellationPolicy: 'Free cancellation up to 48 hours before check-in.',
    nearbyAttractions: ['Place des Vosges (8 min)', 'Pompidou Centre (5 min)', 'Musée Picasso (10 min)', 'Rue de Bretagne Market (2 min)'],
    rooms: makeRooms(18000),
  },
  // BARCELONA
  {
    id: 'ht-010',
    name: 'Hotel Arts Barcelona',
    destination: 'barcelona',
    location: 'Barceloneta',
    stars: 5,
    rating: 4.75,
    reviewCount: 6341,
    pricePerNight: 38000,
    imageUrl: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Outdoor Pool', 'Beach Access', 'Spa', 'Multiple Restaurants', 'Bar', 'Gym', 'Concierge'],
    category: 'Luxury',
    address: 'Carrer de la Marina, 19-21, 08005 Barcelona',
    availableRooms: 6,
    description: 'Hotel Arts rises 44 storeys above Barceloneta beach — the only five-star hotel directly on the Barcelona seafront. The Michelin-starred Enoteca Paco Pérez anchors the dining; the sixth-floor outdoor pool has panoramic Mediterranean views.',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Free cancellation up to 72 hours before check-in.',
    nearbyAttractions: ['Barceloneta Beach (adjacent)', 'Barcelona Aquarium (10 min)', 'Gothic Quarter (20 min)', 'Camp Nou (25 min)'],
    rooms: makeRooms(38000),
  },
  // SANTORINI
  {
    id: 'ht-011',
    name: 'Katikies Hotel',
    destination: 'santorini',
    location: 'Oia',
    stars: 5,
    rating: 4.88,
    reviewCount: 2109,
    pricePerNight: 62000,
    imageUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Caldera-View Pools', 'Spa', 'Fine Dining', 'Sunset Bar', 'Private Plunge Pools', 'Butler Service'],
    category: 'Ultra-Luxury',
    address: 'Oia, 847 02, Santorini',
    availableRooms: 3,
    description: 'Katikies Hotel is the definitive Oia experience — carved into the volcanic caldera cliff, its three tiered infinity pools cascade toward the Aegean. Every room and suite faces the iconic Oia sunset.',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    cancellationPolicy: 'Non-refundable from 14 days prior.',
    nearbyAttractions: ['Oia Sunset Point (2 min)', 'Ammoudi Bay (10 min)', 'Fira Caldera Walk (45 min)', 'Akrotiri Ruins (30 min)'],
    rooms: [{ id: 'clv', name: 'Caldera View Suite', bedType: 'King Bed', maxOccupancy: 2, pricePerNight: 62000, imageUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&h=600&fit=crop&auto=format', amenities: ['Private Plunge Pool', 'Caldera View', 'Outdoor Terrace', 'Outdoor Shower'], breakfastIncluded: true, cancellationPolicy: 'Non-refundable.', size: '65 m²' }],
  },
  // DUBAI
  {
    id: 'ht-012',
    name: 'Burj Al Arab Jumeirah',
    destination: 'dubai',
    location: 'Jumeirah Beach',
    stars: 5,
    rating: 4.7,
    reviewCount: 5891,
    pricePerNight: 180000,
    imageUrl: 'https://images.unsplash.com/photo-1578646750801-b5e45fd48c17?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1578646750801-b5e45fd48c17?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Private Beach', 'Helipad', 'Butler Service', 'Multiple Michelin Restaurants', 'Spa', 'Private Pool', 'Rolls-Royce Transfer'],
    category: 'Ultra-Luxury',
    address: 'Jumeirah Beach Road, Dubai',
    availableRooms: 2,
    description: "The world's most recognisable hotel, Burj Al Arab occupies its own man-made island offshore from Jumeirah Beach. Every accommodation is a two-floor suite. The underwater restaurant Al Mahara and helipad afternoon tea are the stuff of legend.",
    checkInTime: '15:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Non-refundable.',
    nearbyAttractions: ['Wild Wadi Waterpark (adjacent)', 'Jumeirah Mosque (15 min)', 'Dubai Mall (20 min)', 'The Palm (15 min)'],
    rooms: [{ id: 'dplx', name: 'Deluxe Suite', bedType: 'King Bed', maxOccupancy: 2, pricePerNight: 180000, imageUrl: 'https://images.unsplash.com/photo-1578646750801-b5e45fd48c17?w=800&h=600&fit=crop&auto=format', amenities: ['Two Floors', 'Private Butler', 'Sea Views', 'In-Room Jacuzzi'], breakfastIncluded: true, cancellationPolicy: 'Non-refundable.', size: '170 m²' }],
  },
  {
    id: 'ht-013',
    name: 'Atlantis The Palm',
    destination: 'dubai',
    location: 'Palm Jumeirah',
    stars: 5,
    rating: 4.5,
    reviewCount: 18230,
    pricePerNight: 28000,
    imageUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Aquaventure Waterpark', 'Private Beach', 'Aquarium', 'Multiple Pools', 'Spa', 'Nobu Restaurant', '22 Restaurants total'],
    category: 'Luxury',
    address: 'Crescent Road, The Palm, Dubai',
    availableRooms: 15,
    description: 'Atlantis The Palm is a resort-city on the iconic Palm Jumeirah — 1,548 rooms, 22 restaurants, a 17-million-litre aquarium and the Aquaventure waterpark all in one complex. Nobu and Gordon Ramsay\'s Bread Street Kitchen are dining highlights.',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Free cancellation up to 72 hours before check-in.',
    nearbyAttractions: ['Palm Monorail (adjacent)', 'Burj Al Arab (15 min)', 'Dubai Marina (20 min)', 'The Palm Beach (adjacent)'],
    rooms: makeRooms(28000),
  },
  // MALDIVES
  {
    id: 'ht-014',
    name: 'Soneva Jani',
    destination: 'maldives',
    location: 'Noonu Atoll',
    stars: 5,
    rating: 4.95,
    reviewCount: 892,
    pricePerNight: 220000,
    imageUrl: 'https://images.unsplash.com/photo-1502301103665-0b95cc738daf?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1502301103665-0b95cc738daf?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Overwater Villa', 'Private Pool', 'Slide into Ocean', 'Stargazing Dome', 'Dive Centre', 'Organic Farm', 'Cinema'],
    category: 'Ultra-Luxury',
    address: '60/1 Moo 6, Nai Thon Beach, Sakoo, Thalang, Phuket',
    description: 'Trisara sits on its own private bay in the most unspoiled corner of Phuket. Its own Michelin-starred farm-to-table restaurant, PRU, grows ingredients on the resort\'s farm and procures from local sustainable fishermen.',
    checkInTime: '14:00', checkOutTime: '12:00',
    cancellationPolicy: 'moderate',
    nearbyAttractions: ['Nai Thon Beach (private)', 'Nai Yang Beach', 'Sirinath National Park', 'Phuket Airport (15 mins)'],
    availableRooms: 4,
    rooms: [
      { id: 'rm-012-a', hotelId: 'ht-012', name: 'Ocean Pool Villa', bedType: 'King', maxOccupancy: 2, size: '180 sqm', pricePerNight: 55000, imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop&auto=format', amenities: ['Private Infinity Pool', 'Andaman Sea View', 'Outdoor Sala', 'Beach Access', 'Butler'], breakfastIncluded: true, cancellationPolicy: 'moderate', description: 'A standalone villa with a private infinity pool positioned to maximise Andaman sunset views. The outdoor sala has a daybed for afternoon napping to the sound of the ocean.' },
    ],
  },
  {
    id: 'ht-013',
    destinationId: 'santorini',
    name: 'Grace Santorini',
    location: 'Imerovigli',
    stars: 5, rating: 4.9, reviewCount: 1842,
    pricePerNight: 62000,
    imageUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&h=600&fit=crop&auto=format',
    galleryUrls: ['https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Caldera View Infinity Pool', 'Grace Spa', 'Sunset Terrace Dining', 'Yoga', 'Cocktail Bar', 'Concierge Experiences'],
    category: 'Luxury',
    address: 'Imerovigli, Santorini, Greece',
    description: 'Perched at the highest point of the caldera rim in Imerovigli, Grace Santorini commands uninterrupted 180-degree views of the volcanic caldera and sunset panorama.',
    checkInTime: '15:00', checkOutTime: '11:00',
    cancellationPolicy: 'moderate',
    nearbyAttractions: ['Skaros Rock Walk', 'Oia Village (3km)', 'Fira Waterfront', 'Caldera Boat Tours'],
    availableRooms: 5,
    rooms: [
      { id: 'rm-013-a', hotelId: 'ht-013', name: 'Adronis Suite with Pool', bedType: 'King', maxOccupancy: 2, size: '55 sqm', pricePerNight: 62000, imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop&auto=format', amenities: ['Private Plunge Pool', 'Caldera View', 'Outdoor Terrace', 'Champagne Welcome'], breakfastIncluded: true, cancellationPolicy: 'moderate', description: 'A cave suite carved into the caldera cliff, with a private plunge pool terrace that frames the classic Santorini sunset view.' },
      { id: 'rm-013-b', hotelId: 'ht-013', name: 'Grand Cliff Infinity Suite', bedType: 'King', maxOccupancy: 2, size: '80 sqm', pricePerNight: 110000, imageUrl: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&h=600&fit=crop&auto=format', amenities: ['Private Infinity Pool', '180 Degree Caldera View', 'Outdoor Rain Shower', 'Butler Service'], breakfastIncluded: true, cancellationPolicy: 'strict', description: 'The signature suite: a private infinity pool extending to the cliff edge, with the whole caldera panorama as your backdrop.' },
    ],
  },
  {
    id: 'ht-014',
    destinationId: 'paris',
    name: 'Le Bristol Paris',
    location: '8th Arrondissement',
    stars: 5, rating: 4.8, reviewCount: 4217,
    pricePerNight: 75000,
    imageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&h=600&fit=crop&auto=format',
    galleryUrls: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Garden Courtyard Pool', 'Spa', 'Epicure (3 Michelin Stars)', 'Bar du Bristol', 'Rooftop View', 'Butler', 'Concierge'],
    category: 'Palace',
    address: '112 Rue du Faubourg Saint-Honore, 75008 Paris',
    description: "One of only five Palace-designation hotels in Paris, Le Bristol sits on the most prestigious shopping street in the world. Epicure restaurant is one of only three three-Michelin-starred hotel restaurants in France.",
    checkInTime: '15:00', checkOutTime: '12:00',
    cancellationPolicy: 'strict',
    nearbyAttractions: ['Champs-Elysees (5 mins walk)', 'Arc de Triomphe', "Palais de l'Elysee", 'Musee Jacquemart-Andre'],
    availableRooms: 4,
    rooms: [
      { id: 'rm-014-a', hotelId: 'ht-014', name: 'Deluxe Room Courtyard', bedType: 'King', maxOccupancy: 2, size: '40 sqm', pricePerNight: 75000, imageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&h=600&fit=crop&auto=format', amenities: ['Marble Bathroom', 'Garden View', 'Butler Service', 'Nespresso'], breakfastIncluded: false, cancellationPolicy: 'strict', description: 'A classic Parisian room overlooking the manicured courtyard garden.' },
      { id: 'rm-014-b', hotelId: 'ht-014', name: 'Suite Premiere', bedType: 'King', maxOccupancy: 2, size: '70 sqm', pricePerNight: 145000, imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=600&fit=crop&auto=format', amenities: ['Separate Living Room', 'Bespoke Furniture', 'Full Butler', 'Rooftop Access'], breakfastIncluded: true, cancellationPolicy: 'strict', description: 'Refined Parisian luxury with a dedicated living salon, hand-picked antiques, and full butler service.' },
    ],
  },
  {
    id: 'ht-015',
    name: 'Gili Lankanfushi',
    destination: 'maldives',
    location: 'North Malé Atoll',
    stars: 5,
    rating: 4.88,
    reviewCount: 1204,
    pricePerNight: 145000,
    imageUrl: 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Overwater Villas', 'Private Pool', 'Spa', 'Diving School', 'Organic Garden', 'No-News Policy', 'Sunset Bar'],
    category: 'Ultra-Luxury',
    address: 'North Malé Atoll, Maldives',
    availableRooms: 3,
    description: 'Gili Lankanfushi enforces a famous "no news" policy — no newspaper, no TV news — designed to create complete disconnection from the world. The overwater villas sit on stilts above the clearest water on the planet.',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Non-refundable within 21 days.',
    nearbyAttractions: ['House Reef (adjacent)', 'Malé (20 min by speedboat)', 'Sandbank Excursion', 'Whale Shark Season (June–Nov)'],
    rooms: makeRooms(145000),
  },
  // MARRAKECH
  {
    id: 'ht-016',
    name: 'La Mamounia',
    destination: 'marrakech',
    location: 'Medina',
    stars: 5,
    rating: 4.8,
    reviewCount: 3847,
    pricePerNight: 52000,
    imageUrl: 'https://images.unsplash.com/photo-1548391350-968f58dedaed?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1548391350-968f58dedaed?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Hammam', 'Outdoor Pool', 'Spa', 'Restaurant', 'Bar', 'Gardens', 'Casino', 'Tennis Courts'],
    category: 'Luxury',
    address: 'Avenue Bab Jdid, Medina, Marrakech 40040',
    availableRooms: 6,
    description: 'La Mamounia has been the grande dame of Marrakech since 1923 — Winston Churchill painted here. Eight hectares of Andalusian gardens, a legendary hammam, and a location steps from Jemaa el-Fna square.',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Free cancellation up to 7 days before check-in.',
    nearbyAttractions: ['Jemaa el-Fna (5 min)', 'Medina Souks (10 min)', 'Majorelle Garden (20 min)', 'Bahia Palace (15 min)'],
    rooms: makeRooms(52000),
  },
  // RAJASTHAN
  {
    id: 'ht-017',
    name: 'Taj Lake Palace',
    destination: 'rajasthan',
    location: 'Pichola Lake, Udaipur',
    stars: 5,
    rating: 4.82,
    reviewCount: 4129,
    pricePerNight: 38000,
    imageUrl: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Lakeside Pool', 'Spa', 'Jiva Spa', 'Neel Kamal Restaurant', 'Sunset Bar', 'Heritage Walks', 'Cultural Performances'],
    category: 'Heritage Luxury',
    address: 'Pichola Lake, Udaipur, Rajasthan 313001',
    availableRooms: 5,
    description: 'Built in 1746 as a royal summer palace, Taj Lake Palace appears to float on Lake Pichola — accessible only by boat, with the Aravalli mountains as a backdrop. Nominated as one of the most romantic hotels in the world.',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Free cancellation up to 72 hours before check-in.',
    nearbyAttractions: ['City Palace (by boat, 10 min)', 'Jag Mandir (by boat)', 'Vintage Car Museum (20 min)', 'Sajjangarh Fort (30 min)'],
    rooms: makeRooms(38000),
  },
  {
    id: 'ht-018',
    name: 'Umaid Bhawan Palace',
    destination: 'rajasthan',
    location: 'Jodhpur',
    stars: 5,
    rating: 4.78,
    reviewCount: 2847,
    pricePerNight: 42000,
    imageUrl: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Museum', 'Pool', 'Spa', 'Multiple Restaurants', 'Palace Grounds', 'Vintage Car Collection', 'Heritage Suites'],
    category: 'Heritage Luxury',
    address: 'Circuit House Road, Jodhpur, Rajasthan 342006',
    availableRooms: 4,
    description: 'Part palace, part museum, part hotel — Umaid Bhawan is still a royal residence. The golden-sandstone Indo-Saracenic palace contains 347 rooms, a museum of vintage cars, and some of Rajasthan\'s most magnificent interiors.',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Free cancellation up to 7 days before check-in.',
    nearbyAttractions: ['Mehrangarh Fort (15 min)', 'Jodhpur Blue City (20 min)', 'Jaswant Thada (15 min)', 'Mandore Gardens (10 min)'],
    rooms: makeRooms(42000),
  },
  // KERALA
  {
    id: 'ht-019',
    name: 'Kumarakom Lake Resort',
    destination: 'kerala',
    location: 'Kumarakom, Backwaters',
    stars: 5,
    rating: 4.72,
    reviewCount: 1893,
    pricePerNight: 22000,
    imageUrl: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Backwater Views', 'Ayurveda Centre', 'Pool', 'Cultural Performances', 'Private Houseboat', 'Yoga Pavilion', 'Toddy Bar'],
    category: 'Heritage Luxury',
    address: 'Kumarakom, Kottayam, Kerala 686563',
    availableRooms: 7,
    description: 'Spread across 26 acres on the banks of Vembanad Lake, Kumarakom Lake Resort recreates a traditional Kerala heritage village — thatched villas, backwater views, and one of the most authentic Ayurveda centres in India.',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Free cancellation up to 72 hours before check-in.',
    nearbyAttractions: ['Vembanad Lake (adjacent)', 'Kumarakom Bird Sanctuary (5 min)', 'Alleppey Backwaters (30 min)', 'Kochi (80 min)'],
    rooms: makeRooms(22000),
  },
  // CAPE TOWN
  {
    id: 'ht-020',
    name: 'Ellerman House',
    destination: 'capetown',
    location: 'Bantry Bay',
    stars: 5,
    rating: 4.91,
    reviewCount: 743,
    pricePerNight: 95000,
    imageUrl: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Wine Cellar (8,000 bottles)', 'Pool', 'Spa', 'Private Art Collection', 'Ocean Views', 'Butler', 'Private Chauffeur'],
    category: 'Ultra-Luxury',
    address: '180 Kloof Road, Bantry Bay, Cape Town 8005',
    availableRooms: 2,
    description: 'Ellerman House is Cape Town\'s most discreet luxury property — 13 rooms and suites in an Edwardian mansion above Bantry Bay, with one of South Africa\'s finest private art collections and an 8,000-bottle wine cellar.',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    cancellationPolicy: 'Non-refundable.',
    nearbyAttractions: ['Camps Bay Beach (5 min)', 'Table Mountain Aerial Cableway (15 min)', 'V&A Waterfront (20 min)', 'Boulders Penguin Colony (45 min)'],
    rooms: makeRooms(95000),
  },
  // REYKJAVIK
  {
    id: 'ht-021',
    name: 'ION Adventure Hotel',
    destination: 'iceland',
    location: 'Nesjavellir',
    stars: 4,
    rating: 4.65,
    reviewCount: 1234,
    pricePerNight: 35000,
    imageUrl: 'https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1476610182048-b716b8518aae?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Northern Lights Bar', 'Geothermal Pool', 'Restaurant', 'Lava Fields', 'Aurora Viewing Deck', 'Glacier Tours'],
    category: 'Boutique',
    address: 'Nesjavellir, Golden Circle, Iceland',
    availableRooms: 5,
    description: 'ION Adventure Hotel is a design-forward property balanced on a lava field beside a geothermal lake in Iceland\'s Golden Circle. The Northern Lights Bar has panoramic glass walls designed specifically for aurora viewing.',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    cancellationPolicy: 'Free cancellation up to 7 days before check-in.',
    nearbyAttractions: ['Þingvellir National Park (15 min)', 'Geysir Geothermal Area (20 min)', 'Gullfoss Waterfall (25 min)', 'Blue Lagoon (45 min)'],
    rooms: makeRooms(35000),
  },
  // AMSTERDAM
  {
    id: 'ht-022',
    name: 'Waldorf Astoria Amsterdam',
    destination: 'amsterdam',
    location: 'Herengracht Canal',
    stars: 5,
    rating: 4.78,
    reviewCount: 2341,
    pricePerNight: 48000,
    imageUrl: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Spa', 'Canal Views', 'Fine Dining', 'Bar', 'Concierge', 'Boat Tours', 'Private Garden'],
    category: 'Luxury',
    address: 'Herengracht 542-556, 1017 CG Amsterdam',
    availableRooms: 4,
    description: 'Six 17th-century canal houses on the Herengracht\'s "Golden Bend" have been united into one of Amsterdam\'s most distinguished hotels. The spa occupies a vault below the canal waterline.',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Free cancellation up to 72 hours before check-in.',
    nearbyAttractions: ['Rijksmuseum (15 min)', 'Van Gogh Museum (15 min)', 'Anne Frank House (10 min)', 'Jordaan District (5 min)'],
    rooms: makeRooms(48000),
  },
  // BANGKOK
  {
    id: 'ht-023',
    name: 'Mandarin Oriental Bangkok',
    destination: 'bangkok',
    location: 'Riverside, Charoenkrung',
    stars: 5,
    rating: 4.82,
    reviewCount: 8234,
    pricePerNight: 32000,
    imageUrl: 'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Chao Phraya River Views', 'Pool', 'Spa', 'Thai Cooking School', "Authors' Lounge", 'Multiple Restaurants', 'Private Boat'],
    category: 'Luxury',
    address: '48 Oriental Avenue, Bang Rak, Bangkok 10500',
    availableRooms: 9,
    description: 'The Mandarin Oriental Bangkok has been the city\'s finest hotel since 1876, host to Joseph Conrad and Somerset Maugham. The Authors\' Lounge afternoon tea under the fans is a Bangkok institution.',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Free cancellation up to 72 hours before check-in.',
    nearbyAttractions: ['Wat Pho (15 min)', 'Grand Palace (20 min)', 'Chinatown Yaowarat (10 min)', 'ICONSIAM Mall (5 min by boat)'],
    rooms: makeRooms(32000),
  },
  // SRI LANKA
  {
    id: 'ht-024',
    name: 'Amanwella',
    destination: 'srilanka',
    location: 'Tangalle',
    stars: 5,
    rating: 4.87,
    reviewCount: 934,
    pricePerNight: 65000,
    imageUrl: 'https://images.unsplash.com/photo-1588456750374-5b17e1dc6e11?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1588456750374-5b17e1dc6e11?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Private Beach', 'Infinity Pool', 'Spa', 'Water Sports', 'Whale Watching Excursions', 'Yoga', 'Cooking Classes'],
    category: 'Ultra-Luxury',
    address: 'Bodhi Mawatha, Tangalle, Southern Province, Sri Lanka',
    availableRooms: 3,
    description: "Aman's Sri Lanka outpost is set in a coconut grove above a sheltered cove on the island's southern coast. 30 private pool suites face the Indian Ocean. Whale-watching season runs November to April.",
    checkInTime: '14:00',
    checkOutTime: '11:00',
    cancellationPolicy: 'Non-refundable within 14 days.',
    nearbyAttractions: ['Mirissa Whale Watching (60 min)', 'Yala National Park (90 min)', 'Tangalle Beach (adjacent)', 'Mulkirigala Temple (20 min)'],
    rooms: makeRooms(65000),
  },
  // NEW YORK
  {
    id: 'ht-025',
    name: 'The Plaza Hotel',
    destination: 'newyork',
    location: 'Midtown Manhattan, 5th Avenue',
    stars: 5,
    rating: 4.6,
    reviewCount: 12840,
    pricePerNight: 58000,
    imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&h=600&fit=crop&auto=format'],
    amenities: ['The Palm Court', 'Spa', 'Todd English Food Hall', 'Central Park Access', 'Concierge', 'Luxury Retail'],
    category: 'Landmark Luxury',
    address: '768 5th Ave, New York, NY 10019',
    availableRooms: 8,
    description: 'The Plaza has defined luxury accommodation in New York since 1907. Overlooking Central Park\'s south-east corner, it has been the backdrop to countless films and novels. The Palm Court afternoon tea is a Manhattan ritual.',
    checkInTime: '16:00',
    checkOutTime: '12:00',
    cancellationPolicy: 'Free cancellation up to 72 hours before check-in.',
    nearbyAttractions: ['Central Park (adjacent)', 'Metropolitan Museum (20 min)', 'Fifth Avenue Shopping (adjacent)', 'Carnegie Hall (10 min)'],
    rooms: makeRooms(58000),
  },
  // QUEENSTOWN
  {
    id: 'ht-026',
    name: "Eichardt's Private Hotel",
    destination: 'newzealand',
    location: 'Queenstown Lakefront',
    stars: 5,
    rating: 4.83,
    reviewCount: 1124,
    pricePerNight: 42000,
    imageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=600&fit=crop&auto=format'],
    amenities: ['Lake Views', 'Bar & Restaurant', 'Fireplace', 'Adventure Concierge', 'Private Beach', 'Helicopter Transfers'],
    category: 'Boutique Luxury',
    address: 'Marine Parade, Queenstown 9300, New Zealand',
    availableRooms: 4,
    description: "Eichardt's Private Hotel commands the finest position in Queenstown — directly on the lakefront, gazing across Lake Wakatipu to the Remarkables. The five suites are individually designed; the bar is the town's best.",
    checkInTime: '14:00',
    checkOutTime: '11:00',
    cancellationPolicy: 'Free cancellation up to 7 days before check-in.',
    nearbyAttractions: ['Queenstown Gardens (5 min)', 'Skyline Gondola (10 min)', 'AJ Hackett Bungy (15 min)', 'Arrowtown (25 min)'],
    rooms: makeRooms(42000),
  },
];

// ─── ACTIVITIES / EXPERIENCES ─────────────────────────────────────────────────

const defaultSlots = (): ExperienceTimeSlot[] => [
  { id: 'ts-1', time: '08:00', availableSpots: 8 },
  { id: 'ts-2', time: '10:30', availableSpots: 12 },
  { id: 'ts-3', time: '14:00', availableSpots: 6 },
];

export const activities: Activity[] = [
  {
    id: 'ac-001',
    destinationId: 'tokyo',
    name: 'Shibuya & Harajuku Culture Walk',
    category: 'Cultural Tour',
    duration: '4 hours',
    price: 3200,
    pricePerChild: 1800,
    rating: 4.8,
    reviewCount: 1284,
    imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&h=600&fit=crop&auto=format'],
    description: "Immerse in Tokyo's iconic fashion and pop culture districts with a local expert guide.",
    longDescription: "Explore Harajuku's Takeshita Street and the elegance of Omotesando Avenue before crossing to Shibuya's scramble crossing and the best vintage shops in the city. Your guide is a Tokyo local who grew up in these neighbourhoods.",
    includedItems: ['Expert local guide', 'Metro pass for duration', 'Harajuku crepe tasting', 'Audio headsets'],
    excludedItems: ['Lunch', 'Personal shopping', 'Tips'],
    meetingPoint: 'Exit 3, Harajuku Station (JR Yamanote Line)',
    requirements: 'Comfortable walking shoes. Suitable for all ages.',
    maxParticipants: 12,
    minAge: 0,
    timeSlots: defaultSlots(),
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 48 hours in advance.',
    highlights: ['Takeshita Street — teenage fashion paradise', "Omotesando — Tokyo's Champs-Élysées", 'Shibuya 109 building', 'The famous scramble crossing'],
  },
  {
    id: 'ac-002',
    destinationId: 'tokyo',
    name: 'Tsukiji Outer Market Food Tour',
    category: 'Food & Culinary',
    duration: '3 hours',
    price: 4500,
    pricePerChild: 2500,
    rating: 4.9,
    reviewCount: 2167,
    imageUrl: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&h=600&fit=crop&auto=format'],
    description: "Taste your way through Japan's most famous food market with 8 curated stops.",
    longDescription: 'The Tsukiji Outer Market remains one of Tokyo\'s great gastronomic experiences. Visit eight hand-selected stalls for tamagoyaki, fresh sashimi, dashi broth, premium mochi, matcha soft-serve and more.',
    includedItems: ['8 food tastings', 'Expert foodie guide', 'Japanese coffee', 'Market map to keep'],
    excludedItems: ['Additional food purchases', 'Alcohol', 'Tips'],
    meetingPoint: 'The large stone lantern at the Tsukiji Market main gate, Harumi-dori entrance',
    requirements: 'Please inform of dietary restrictions in advance.',
    maxParticipants: 10,
    minAge: 5,
    timeSlots: [{ id: 'ts-1', time: '07:30', availableSpots: 10 }, { id: 'ts-2', time: '09:00', availableSpots: 8 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    cancellationPolicy: 'Full refund if cancelled 48 hours in advance.',
    highlights: ['Premium tuna sashimi tasting', 'Fresh tamagoyaki', 'Japanese breakfast experience', 'Insights into Japanese food culture'],
  },
  {
    id: 'ac-003',
    name: 'Tea Ceremony & Kimono Experience',
    destination: 'kyoto',
    category: 'Cultural',
    duration: '2.5 hours',
    price: 5500,
    pricePerChild: 3000,
    rating: 4.85,
    reviewCount: 3421,
    imageUrl: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&h=600&fit=crop&auto=format'],
    description: 'Dress in a kimono, participate in a traditional tea ceremony and walk through Gion.',
    longDescription: 'Begin with professional kimono dressing at our studio in Gion. Then participate in an authentic matcha tea ceremony led by a certified tea master, learning the philosophy and precise movements of chado (the way of tea).',
    includedItems: ['Kimono rental and dressing', 'Tea ceremony with certified master', 'Matcha and wagashi sweets', 'Gion walking tour', 'Kimono-wearing photography session'],
    excludedItems: ['Tips', 'Hair accessories (available to rent)', 'Professional photos'],
    meetingPoint: 'Studio Yuzen, 240 Gion-machi Minamigawa, Higashiyama-ku, Kyoto',
    requirements: 'Available in all sizes including children.',
    maxParticipants: 8,
    minAge: 6,
    timeSlots: [{ id: 'ts-1', time: '09:00', availableSpots: 8 }, { id: 'ts-2', time: '13:00', availableSpots: 8 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 72 hours in advance.',
    highlights: ['Wear a genuine silk kimono', 'Learn chado (the way of tea)', "Walk Gion's 17th-century streets", 'Professional photographs in historic setting'],
  },
  {
    id: 'ac-004',
    name: 'Arashiyama Bamboo Dawn Walk',
    destination: 'kyoto',
    category: 'Nature & Photography',
    duration: '3 hours',
    price: 4200,
    pricePerChild: 2100,
    rating: 4.92,
    reviewCount: 1872,
    imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=600&fit=crop&auto=format'],
    description: "Experience Arashiyama's bamboo grove at dawn, before the crowds arrive.",
    longDescription: "Meet before sunrise to walk the towering bamboo grove in near-silence. Visit Tenryu-ji Zen garden as its gates open, walk the riverside monkey park trail, and finish with a riverside breakfast.",
    includedItems: ['Expert guide', 'Bamboo grove dawn access', 'Tenryu-ji temple entry', 'Japanese breakfast'],
    excludedItems: ['Transport to Arashiyama', 'Tips'],
    meetingPoint: 'Arashiyama Station (Randen Line), main exit, lantern marker',
    requirements: 'Comfortable shoes. Light layers for early morning. Not suitable for under 8s.',
    maxParticipants: 8,
    minAge: 8,
    timeSlots: [{ id: 'ts-1', time: '05:30', availableSpots: 8 }],
    availableDays: ['Monday', 'Wednesday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 48 hours in advance.',
    highlights: ['Bamboo grove with no crowds', 'Tenryu-ji Zen garden opening ritual', 'Monkey park trail', 'Traditional Japanese breakfast riverside'],
  },
  {
    id: 'ac-005',
    name: 'Mount Batur Sunrise Trek',
    category: 'Adventure',
    duration: '7 hours',
    price: 2800,
    pricePerChild: 1800,
    rating: 4.7,
    reviewCount: 3892,
    imageUrl: 'https://images.unsplash.com/photo-1604549944348-dc8474b50b5d?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1604549944348-dc8474b50b5d?w=800&h=600&fit=crop&auto=format'],
    description: 'Trek to the volcanic summit before dawn and watch the sunrise above the clouds.',
    longDescription: 'Depart at 02:00 for the base camp. The 2-hour ascent brings you to Mount Batur summit (1,717m) just before first light. Watch the sunrise over Bali\'s neighbouring volcanoes, then descend for a hot breakfast cooked using volcanic steam.',
    includedItems: ['Hotel pickup and drop-off', 'Experienced guide', 'Torch/headlamp', 'Breakfast cooked by volcanic steam', 'Water and snacks'],
    excludedItems: ['Tips', 'Walking poles (available to rent)', 'Entrance fees'],
    meetingPoint: 'Hotel pickup (all Ubud hotels included)',
    requirements: 'Moderate fitness required. Sturdy closed-toe shoes essential. Not suitable for under 10s.',
    maxParticipants: 10,
    minAge: 10,
    timeSlots: [{ id: 'ts-1', time: '02:00', availableSpots: 10 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 48 hours in advance.',
    highlights: ['Sunrise above the clouds', 'Active volcano landscape', 'Steam-cooked breakfast', 'Panoramic views of Agung and Abang'],
  },
  {
    id: 'ac-006',
    name: 'Ubud Rice Terrace Cycling Tour',
    destination: 'bali',
    category: 'Adventure',
    duration: '5 hours',
    price: 2200,
    pricePerChild: 1400,
    rating: 4.75,
    reviewCount: 2841,
    imageUrl: 'https://images.unsplash.com/photo-1571984405176-5958bd9ac31d?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1571984405176-5958bd9ac31d?w=800&h=600&fit=crop&auto=format'],
    description: "Cycle through Ubud's emerald rice terraces, villages and jungle paths.",
    longDescription: 'Begin at the summit of Kintamani with views of Mount Batur, then glide 18km downhill through terraced rice paddies, bamboo forests, traditional Balinese villages and local temples.',
    includedItems: ['Mountain bike and helmet', 'Guide', 'Traditional Balinese lunch', 'Hotel pickup', 'Accident insurance'],
    excludedItems: ['Tips', 'Personal snacks'],
    meetingPoint: 'Hotel pickup (all Ubud and Kuta hotels)',
    requirements: 'Suitable for all fitness levels. Must be able to control a bicycle. Minimum age 8.',
    maxParticipants: 15,
    minAge: 8,
    timeSlots: [{ id: 'ts-1', time: '07:30', availableSpots: 15 }, { id: 'ts-2', time: '12:30', availableSpots: 10 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 24 hours in advance.',
    highlights: ['Mostly downhill 18km route', 'Tegallalang Rice Terrace views', 'Traditional village stops', 'Balinese lunch with local family'],
  },
  {
    id: 'ac-007',
    name: 'Desert Safari & Dune Bashing',
    category: 'Adventure',
    duration: '6 hours',
    price: 5500,
    pricePerChild: 3200,
    rating: 4.6,
    reviewCount: 8241,
    imageUrl: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&h=600&fit=crop&auto=format'],
    description: 'Dune bashing, camel riding, sandboarding and a BBQ dinner under the stars.',
    longDescription: 'After hotel pickup, your 4WD convoy heads into the Arabian Desert for an adrenaline-charged dune bashing session. Then: camel riding, sandboarding, falconry demonstration, henna art, shisha, and a lavish BBQ buffet dinner in a traditional Bedouin camp.',
    includedItems: ['Hotel pickup and drop-off', '4WD dune bashing', 'Camel ride', 'Sandboarding', 'BBQ dinner', 'Henna painting', 'Soft drinks and water', 'Falconry display'],
    excludedItems: ['Alcohol', 'Premium activities at extra cost', 'Tips'],
    meetingPoint: 'Hotel pickup (all Dubai hotels)',
    requirements: 'Not recommended for pregnant women, back/neck conditions, or under 4s.',
    maxParticipants: 20,
    minAge: 4,
    timeSlots: [{ id: 'ts-1', time: '15:30', availableSpots: 20 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 24 hours in advance.',
    highlights: ['Heart-racing dune bashing in 4WDs', 'Camel riding at sunset', 'Traditional Bedouin camp', 'Starlit BBQ dinner'],
  },
  {
    id: 'ac-008',
    name: 'Burj Khalifa At the Top Experience',
    destination: 'dubai',
    category: 'Attraction',
    duration: '2 hours',
    price: 4800,
    pricePerChild: 3000,
    rating: 4.7,
    reviewCount: 15820,
    imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&h=600&fit=crop&auto=format'],
    description: "Skip-the-line access to the world's tallest observation deck on floors 124 and 125.",
    longDescription: "Take the world's fastest elevator (64 km/h) to the 124th and 125th floors of the Burj Khalifa — 452 metres above ground. Enjoy 360-degree views across Dubai, the Gulf, and on clear days to the mountains of Iran.",
    includedItems: ['Skip-the-line access', 'Expert host', 'Complimentary welcome drink', 'Souvenir photo'],
    excludedItems: ['Transport to Burj Khalifa', 'Additional photos', 'Dubai Mall activities'],
    meetingPoint: 'Burj Khalifa At the Top entrance, Dubai Mall (Lower Ground Floor)',
    requirements: 'No restrictions. Lift experience.',
    maxParticipants: 25,
    minAge: 0,
    timeSlots: [{ id: 'ts-1', time: '10:00', availableSpots: 25 }, { id: 'ts-2', time: '14:00', availableSpots: 20 }, { id: 'ts-3', time: '17:30', availableSpots: 18 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 48 hours in advance.',
    highlights: ['452m observation deck', "World's fastest elevator", '360° views of Dubai and Arabian Gulf', 'Sunset views across the desert'],
  },
  {
    id: 'ac-009',
    name: 'Paris Highlights Walking Tour',
    destination: 'paris',
    category: 'Cultural Tour',
    duration: '4 hours',
    price: 3800,
    pricePerChild: 2200,
    rating: 4.82,
    reviewCount: 4127,
    imageUrl: 'https://images.unsplash.com/photo-1570097703229-b195d6dd291f?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1570097703229-b195d6dd291f?w=800&h=600&fit=crop&auto=format'],
    description: "Walk Paris's iconic landmarks with an expert historian guide, including Louvre and Notre Dame.",
    longDescription: 'A carefully paced walking tour covering the essential Paris — crossing Pont Neuf, pausing on Île de la Cité beneath Notre Dame\'s rebuilt towers, exploring the Louvre courtyard, walking the Champs-Élysées to the Arc de Triomphe.',
    includedItems: ['Expert historian guide', 'Paris Museum Pass (2-day)', 'Seine bridge crossing', 'Croissant and café au lait at a traditional café'],
    excludedItems: ['Louvre interior entry (museum pass required)', 'Lunch', 'Transport'],
    meetingPoint: 'Notre Dame Cathedral forecourt (Parvis Notre-Dame)',
    requirements: 'Comfortable walking shoes. 6+ km total distance.',
    maxParticipants: 15,
    minAge: 6,
    timeSlots: [{ id: 'ts-1', time: '09:30', availableSpots: 15 }, { id: 'ts-2', time: '14:00', availableSpots: 12 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 48 hours in advance.',
    highlights: ['Notre Dame Cathedral — rebuilt after 2019 fire', 'Louvre pyramid courtyard', 'Eiffel Tower at dusk', 'Classic Parisian café experience'],
  },
  {
    id: 'ac-010',
    name: 'Barcelona Gaudí Architecture Tour',
    destination: 'barcelona',
    category: 'Cultural Tour',
    duration: '5 hours',
    price: 5200,
    pricePerChild: 3000,
    rating: 4.87,
    reviewCount: 5341,
    imageUrl: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&h=600&fit=crop&auto=format'],
    description: "Skip-the-line entry to Sagrada Família, Casa Batlló and Park Güell with an architecture guide.",
    longDescription: "An architecture-focused tour through Antoni Gaudí's greatest works in Barcelona. Skip the queues at Sagrada Família's towers and nave, spend time in Casa Batlló's extraordinary rooms, and walk the terraces of Park Güell.",
    includedItems: ['Skip-the-line Sagrada Família entry', 'Park Güell entry', 'Casa Batlló guided access', 'Architecture expert guide', 'Audio headsets', 'Metro travel between sites'],
    excludedItems: ['Lunch', 'Sagrada Família tower lift (bookable separately)', 'Tips'],
    meetingPoint: 'Outside Sagrada Família main entrance (Eixample facade), Carrer de Mallorca',
    requirements: 'Significant walking (7km). Comfortable shoes essential.',
    maxParticipants: 12,
    minAge: 8,
    timeSlots: [{ id: 'ts-1', time: '09:00', availableSpots: 12 }, { id: 'ts-2', time: '14:30', availableSpots: 10 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 72 hours in advance.',
    highlights: ['Sagrada Família interior and towers', 'Casa Batlló rooftop dragon terrace', 'Park Güell mosaic terrace', 'Expert architectural commentary'],
  },
  {
    id: 'ac-011',
    name: 'Santorini Caldera Sailing Cruise',
    destination: 'santorini',
    category: 'Water & Sailing',
    duration: '8 hours',
    price: 9800,
    pricePerChild: 6000,
    rating: 4.88,
    reviewCount: 2847,
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop&auto=format'],
    description: 'Full-day catamaran sail around the caldera, hot springs, red beach and Oia sunset.',
    longDescription: 'Board a luxury catamaran from Ammoudi Bay for a full circumnavigation of the Santorini caldera. Swim in the geothermal hot springs of Nea Kameni volcano, anchor at the dramatic Red Beach, snorkel pristine waters, and position for the famous Oia sunset from the water.',
    includedItems: ['Luxury catamaran', 'Captain and crew', 'BBQ lunch on deck', 'Open bar (wine, beer, soft drinks)', 'Snorkelling equipment', 'Towels'],
    excludedItems: ['Port transfers', 'Tips', 'Seasickness medication'],
    meetingPoint: 'Ammoudi Bay port, Oia — steps below Oia village',
    requirements: 'Swimming ability for hot springs and snorkelling sections.',
    maxParticipants: 16,
    minAge: 6,
    timeSlots: [{ id: 'ts-1', time: '10:00', availableSpots: 16 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 72 hours in advance. Weather cancellations refunded in full.',
    highlights: ['Geothermal hot springs swimming', 'Dramatic Red Beach', 'BBQ lunch on deck', 'Oia sunset from the water'],
  },
  {
    id: 'ac-012',
    name: 'Rajasthan Camel Safari & Desert Camp',
    destination: 'rajasthan',
    category: 'Adventure',
    duration: '2 days / 1 night',
    price: 12000,
    pricePerChild: 7000,
    rating: 4.78,
    reviewCount: 1842,
    imageUrl: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&h=600&fit=crop&auto=format'],
    description: 'Overnight camel safari into the Thar Desert sand dunes with a luxury tented camp.',
    longDescription: 'From Jaisalmer, mount your camel at Sam Sand Dunes for a 3-hour sunset ride through the Thar Desert. Arrive at a luxury tented camp as darkness falls, with a Rajasthani folk music and dance performance by firelight.',
    includedItems: ['Camel and experienced mahout', '2 meals (dinner and breakfast)', 'Luxury tented accommodation', 'Folk music and dance performance', 'Star-gazing session', 'Jaisalmer pickup and drop-off'],
    excludedItems: ['Jaisalmer hotel', 'Alcohol', 'Personal items', 'Tips'],
    meetingPoint: 'Jaisalmer Fort Gate, Jaisalmer, Rajasthan',
    requirements: 'Moderate level of fitness. Desert nights can be cold October–February.',
    maxParticipants: 12,
    minAge: 6,
    timeSlots: [{ id: 'ts-1', time: '15:00', availableSpots: 12 }],
    availableDays: ['Tuesday', 'Thursday', 'Saturday'],
    cancellationPolicy: 'Full refund if cancelled 72 hours in advance.',
    highlights: ['Sunset dune ride on camelback', 'Rajasthani folk performance by firelight', 'Sleep under Thar Desert stars', 'Sunrise camel return'],
  },
  {
    id: 'ac-013',
    name: 'Kerala Backwater Houseboat Cruise',
    destination: 'kerala',
    category: 'Nature & Relaxation',
    duration: 'Full day (8 hours)',
    price: 8500,
    pricePerChild: 5000,
    rating: 4.82,
    reviewCount: 2341,
    imageUrl: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&h=600&fit=crop&auto=format'],
    description: 'Glide through the Kerala backwaters on a traditional kettuvallam rice boat, with Kerala lunch.',
    longDescription: 'Board a traditional kettuvallam (converted rice barge) at Alleppey for an 8-hour journey through the labyrinthine Kerala backwaters. A dedicated crew cooks authentic Kerala seafood lunch on board.',
    includedItems: ['Private kettuvallam houseboat', 'Captain and cook', 'Kerala lunch (fish curry, appam, payasam)', 'Non-alcoholic beverages', 'Pickup from Alleppey hotels'],
    excludedItems: ['Alleppey hotel accommodation', 'Alcohol', 'Tips'],
    meetingPoint: 'ATDC Boat Jetty, Alleppey (Alappuzha) — or hotel pickup',
    requirements: 'No special fitness required. Life jackets provided.',
    maxParticipants: 8,
    minAge: 0,
    timeSlots: [{ id: 'ts-1', time: '09:00', availableSpots: 8 }, { id: 'ts-2', time: '11:00', availableSpots: 6 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 48 hours in advance.',
    highlights: ['Traditional kettuvallam rice boat', 'Coconut-lined canal network', 'Authentic Kerala seafood lunch', 'Village life along the waterways'],
  },
  {
    id: 'ac-014',
    name: 'Northern Lights Hunt & Photography',
    destination: 'iceland',
    category: 'Nature & Photography',
    duration: '4 hours',
    price: 11500,
    pricePerChild: 7000,
    rating: 4.71,
    reviewCount: 1284,
    imageUrl: 'https://images.unsplash.com/photo-1531168556467-80aace0d0144?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1531168556467-80aace0d0144?w=800&h=600&fit=crop&auto=format'],
    description: 'Expert-guided minibus tour to find the northern lights, with photography coaching.',
    longDescription: 'Our guides use live aurora forecasting data and 20 years of local knowledge to track the northern lights across Iceland\'s countryside. Travel by small minibus to multiple dark-sky locations. A professional photographer accompanies every tour.',
    includedItems: ['Small-group minibus (max 8)', 'Expert aurora guide', 'Professional photographer', 'Hot chocolate and snacks', 'Aurora re-run voucher if lights appear'],
    excludedItems: ['Camera equipment (bring your own)', 'Transport from accommodation to meeting point'],
    meetingPoint: 'BSÍ Bus Terminal, Vatnsmýrarvegur 10, Reykjavík 101',
    requirements: 'Warm clothing essential (gloves, hat, waterproof outer layer). Suitable for all fitness levels.',
    maxParticipants: 8,
    minAge: 5,
    timeSlots: [{ id: 'ts-1', time: '20:00', availableSpots: 8 }, { id: 'ts-2', time: '22:00', availableSpots: 8 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: "Full refund if lights don't appear (re-run tour guaranteed). Full refund if cancelled 48 hours in advance.",
    highlights: ['Live aurora tracking technology', 'Professional photography coaching', 'Guaranteed re-run if lights show', 'Dark-sky countryside locations'],
  },
  {
    id: 'ac-015',
    name: 'Marrakech Medina Souk Food Tour',
    destination: 'marrakech',
    category: 'Food & Culinary',
    duration: '4 hours',
    price: 4200,
    pricePerChild: 2500,
    rating: 4.79,
    reviewCount: 2183,
    imageUrl: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=800&h=600&fit=crop&auto=format'],
    description: 'Navigate the medina souks with a local guide, tasting Moroccan street food.',
    longDescription: 'Enter the labyrinthine medina with a native Marrakchi guide. Taste cooked snails, beef tagine, msmen (Moroccan flatbread with honey), fresh orange juice, and pastilla. Navigate spice, leather and textile souks.',
    includedItems: ['Expert local guide', '10 food tastings', 'Mint tea ceremony', 'Spice souk visit with samples', 'Medina orientation map'],
    excludedItems: ['Souvenir purchases', 'Tips'],
    meetingPoint: 'Café de France entrance, Jemaa el-Fna square, Marrakech Medina',
    requirements: 'Comfortable shoes for cobblestone walking. Vegetarian version available on request.',
    maxParticipants: 10,
    minAge: 8,
    timeSlots: [{ id: 'ts-1', time: '10:00', availableSpots: 10 }, { id: 'ts-2', time: '16:00', availableSpots: 10 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    cancellationPolicy: 'Full refund if cancelled 48 hours in advance.',
    highlights: ['Off-the-beaten-path medina routes', 'Cooked snail stalls on Jemaa el-Fna', 'Authentic Moroccan mint tea ceremony', 'Traditional spice souk immersion'],
  },
  {
    id: 'ac-016',
    name: 'Cape Town Table Mountain Guided Hike',
    destination: 'capetown',
    category: 'Adventure',
    duration: '5 hours',
    price: 6800,
    pricePerChild: 4000,
    rating: 4.84,
    reviewCount: 1742,
    imageUrl: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800&h=600&fit=crop&auto=format'],
    description: 'Guided hike up Table Mountain via Platteklip Gorge with a naturalist guide.',
    longDescription: "Ascend Cape Town's iconic flat-topped mountain via Platteklip Gorge with a certified guide-naturalist. The 3km climb offers views of Robben Island, Lion's Head and the Cape Peninsula.",
    includedItems: ['Certified mountain guide', 'First aid equipment', 'Snacks and water', 'Cable car descent ticket'],
    excludedItems: ['Transport to Table Mountain', 'Lunch', 'Tips'],
    meetingPoint: 'Table Mountain Lower Cable Station, Tafelberg Road, Cape Town',
    requirements: 'Moderate fitness required. 600m elevation gain over 3km. Sturdy hiking shoes. Not suitable for under 10s.',
    maxParticipants: 8,
    minAge: 10,
    timeSlots: [{ id: 'ts-1', time: '07:30', availableSpots: 8 }, { id: 'ts-2', time: '09:30', availableSpots: 8 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 48 hours in advance. Weather cancellations refunded.',
    highlights: ['360° view from summit plateau', 'Table Mountain fynbos flora', 'Robben Island and Lion\'s Head views', 'Cable car descent'],
  },
  {
    id: 'ac-017',
    name: 'Amsterdam Canal Evening Cruise',
    destination: 'amsterdam',
    category: 'Nature & Relaxation',
    duration: '2.5 hours',
    price: 3200,
    pricePerChild: 1800,
    rating: 4.76,
    reviewCount: 5841,
    imageUrl: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?w=800&h=600&fit=crop&auto=format'],
    description: 'Glass-boat evening canal cruise with Dutch cheese, stroopwafel and wines.',
    longDescription: "As Amsterdam's bridges and canal houses illuminate after dark, explore the UNESCO-listed canal ring by glass-topped electric boat. Sip Dutch wine and beer, nibble aged Gouda and stroopwafels.",
    includedItems: ['2.5-hour glass-boat cruise', 'Dutch cheese and stroopwafels', 'Wine, beer and soft drinks', 'Canal history audio narration', 'Blankets for cool evenings'],
    excludedItems: ['Hotel transfer', 'Tips', 'Dinner'],
    meetingPoint: 'Amsterdam Centraal Station, west side pier',
    requirements: 'No restrictions. Glass-sided boat.',
    maxParticipants: 20,
    minAge: 0,
    timeSlots: [{ id: 'ts-1', time: '19:00', availableSpots: 20 }, { id: 'ts-2', time: '21:00', availableSpots: 20 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 24 hours in advance.',
    highlights: ['Illuminated canal bridges at night', 'UNESCO canal ring from water level', 'Dutch cheese and wine pairing', 'Cozy glass-topped electric boat'],
  },
  {
    id: 'ac-018',
    name: 'Bangkok Street Food Night Tour',
    destination: 'bangkok',
    category: 'Food & Culinary',
    duration: '4 hours',
    price: 2800,
    pricePerChild: 1600,
    rating: 4.85,
    reviewCount: 6243,
    imageUrl: 'https://images.unsplash.com/photo-1508009603885-50cf7c8dd0d5?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1508009603885-50cf7c8dd0d5?w=800&h=600&fit=crop&auto=format'],
    description: "Explore Bangkok's legendary street food scene by tuk-tuk at night with 10 tastings.",
    longDescription: "Climb into a tuk-tuk and venture into Bangkok's most authentic street-food neighbourhoods — Chinatown's Yaowarat Road, Bangrak's night markets and hidden alleyway vendors known only to locals.",
    includedItems: ['Private tuk-tuk hire', 'Expert street food guide', '10 tastings', 'Bottled water', 'Night market orientation'],
    excludedItems: ['Tips', 'Additional food', 'Alcohol'],
    meetingPoint: 'Silom Road, entrance to Patpong Night Market',
    requirements: 'Modest dress for some temple-adjacent areas. Vegetarian version available.',
    maxParticipants: 6,
    minAge: 6,
    timeSlots: [{ id: 'ts-1', time: '18:30', availableSpots: 6 }, { id: 'ts-2', time: '20:00', availableSpots: 6 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 24 hours in advance.',
    highlights: ['Yaowarat Chinatown by night', 'Tuk-tuk city navigation', 'Mango sticky rice from a legendary vendor', 'Hidden alleyway street food'],
  },
  {
    id: 'ac-019',
    name: 'Sigiriya Rock Fortress Guided Climb',
    destination: 'srilanka',
    category: 'Historical & Adventure',
    duration: '4 hours',
    price: 3800,
    pricePerChild: 2200,
    rating: 4.81,
    reviewCount: 2184,
    imageUrl: 'https://images.unsplash.com/photo-1588456750374-5b17e1dc6e11?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1588456750374-5b17e1dc6e11?w=800&h=600&fit=crop&auto=format'],
    description: "Climb Sri Lanka's UNESCO ancient rock fortress with a heritage guide.",
    longDescription: "The 5th-century Lion Rock fortress of Sigiriya is Sri Lanka's crown jewel. Ascend 1,200 steps through terraced water gardens, past the famous frescoed Ladies of Sigiriya, beneath the Lion's Paw platform.",
    includedItems: ['Sigiriya entry ticket', 'Heritage guide', 'Fresco and archaeology briefing', 'Water', 'Hotel pickup (Sigiriya area)'],
    excludedItems: ['National Museum entry', 'Dambulla Cave Temple', 'Tips'],
    meetingPoint: 'Sigiriya Rock main ticket office, Sigiriya, Central Province',
    requirements: 'Moderate to high fitness. 1,200 steps, some steep. Not suitable for cardiac conditions or severe vertigo.',
    maxParticipants: 10,
    minAge: 8,
    timeSlots: [{ id: 'ts-1', time: '06:00', availableSpots: 10 }, { id: 'ts-2', time: '14:00', availableSpots: 10 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 48 hours in advance.',
    highlights: ['5th-century royal palace ruins', 'Ancient frescoes of Ladies of Sigiriya', "Lion's Paw rock platform", 'Panoramic Cultural Triangle views'],
  },
  {
    id: 'ac-020',
    name: 'New York Highlights Helicopter Tour',
    destination: 'newyork',
    category: 'Air & Adventure',
    duration: '15 minutes',
    price: 18500,
    pricePerChild: 14000,
    rating: 4.8,
    reviewCount: 3824,
    imageUrl: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=800&h=600&fit=crop&auto=format'],
    description: 'Helicopter flight over Manhattan, Central Park and the Statue of Liberty.',
    longDescription: "Board a 6-seat helicopter at Downtown Manhattan Heliport for a 15-minute flight over New York's most iconic skyline. Bank over the Statue of Liberty, cruise above Central Park, and see the Brooklyn Bridge from 1,000 feet.",
    includedItems: ['15-minute helicopter flight', 'Noise-cancelling headset and pilot commentary', 'Video of your flight'],
    excludedItems: ['Tips', 'Transport to heliport'],
    meetingPoint: 'Downtown Manhattan Heliport, 6 East River Piers, Lower Manhattan',
    requirements: 'Weight limit 250lbs per passenger. ID required. Minimum age 2.',
    maxParticipants: 6,
    minAge: 2,
    timeSlots: defaultSlots(),
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 72 hours in advance. Weather cancellations refunded.',
    highlights: ['Statue of Liberty from the air', "Central Park bird's-eye view", 'Manhattan skyline panorama', 'Optional doors-off photography flight'],
  },
  {
    id: 'ac-021',
    name: 'Queenstown AJ Hackett Bungy Jump',
    destination: 'newzealand',
    category: 'Extreme Adventure',
    duration: '3 hours',
    price: 15000,
    rating: 4.85,
    reviewCount: 12841,
    imageUrl: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=800&h=600&fit=crop&auto=format'],
    description: 'The original bungy jump — 43m from the historic Kawarau Bridge.',
    longDescription: "The Kawarau Bridge is where commercial bungee jumping was born in 1988. A 43-metre plunge toward the turquoise Kawarau River, with optional water touch or full immersion. AJ Hackett's site has launched over 500,000 jumps.",
    includedItems: ['Bungy jump', 'Professional supervision', 'Certificate of achievement', 'T-shirt', 'Video and photo package'],
    excludedItems: ['Transport from Queenstown (shuttle available)', 'Tips'],
    meetingPoint: 'Kawarau Bridge Bungy Centre, SH6, Queenstown',
    requirements: 'Min. weight 35kg, max. 200kg. Must be in good health. Min. age 10.',
    maxParticipants: 1,
    minAge: 10,
    timeSlots: defaultSlots(),
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 48 hours in advance.',
    highlights: ['The original commercial bungee site', '43m plunge to the Kawarau River', 'Optional water touch', 'Certificate and commemorative video'],
  },
  {
    id: 'ac-022',
    name: 'Singapore Gardens by the Bay Night Experience',
    destination: 'singapore',
    category: 'Nature & Culture',
    duration: '3 hours',
    price: 3500,
    pricePerChild: 2000,
    rating: 4.74,
    reviewCount: 8241,
    imageUrl: 'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=800&h=600&fit=crop&auto=format',
    images: ['https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=800&h=600&fit=crop&auto=format'],
    description: 'Guide-led evening through Gardens by the Bay, Cloud Forest and Supertree Grove light show.',
    longDescription: "Explore Singapore's futuristic Gardens by the Bay with a guide as the temperature drops and the Supertrees illuminate. Visit the Cloud Forest waterfall dome and watch the Garden Rhapsody light-and-music show.",
    includedItems: ['Expert guide', 'Cloud Forest dome entry', 'Flower Dome entry', 'OCBC Skyway walkway', 'Garden Rhapsody show viewing'],
    excludedItems: ['Transport to Gardens by the Bay', 'Dinner'],
    meetingPoint: 'Gardens by the Bay main entrance, Supertree Grove side, Bayfront',
    requirements: 'Suitable for all ages and fitness levels.',
    maxParticipants: 15,
    minAge: 0,
    timeSlots: [{ id: 'ts-1', time: '19:00', availableSpots: 15 }],
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cancellationPolicy: 'Full refund if cancelled 24 hours in advance.',
    highlights: ['Cloud Forest indoor waterfall dome', 'Supertree Grove light show', 'OCBC Skyway bridge walk', 'Night sky over Marina Bay'],
  },
];

// ─── FLIGHTS ─────────────────────────────────────────────────────────────────

export const flights: Flight[] = [
  { id: 'fl-001', airline: 'IndiGo', airlineCode: '6E', flightNumber: '6E-812', from: 'Mumbai', fromCode: 'BOM', to: 'Tokyo', toCode: 'NRT', destinationId: 'tokyo', departureTime: '2025-03-15T02:30:00', arrivalTime: '2025-03-15T14:45:00', duration: '9h 15m', stops: 0, price: 48500, businessPrice: 142000, status: 'delayed', aircraft: 'Boeing 787-9', class: 'Economy', seatsLeft: 14, baggageIncluded: '15 kg + 7 kg cabin', fareType: 'Flexi', refundable: true },
  { id: 'fl-002', airline: 'Air India', airlineCode: 'AI', flightNumber: 'AI-307', from: 'Mumbai', fromCode: 'BOM', to: 'Tokyo', toCode: 'NRT', destinationId: 'tokyo', departureTime: '2025-03-15T08:00:00', arrivalTime: '2025-03-15T21:30:00', duration: '10h 30m', stops: 1, stopCity: 'Bangkok', price: 38200, businessPrice: 115000, status: 'scheduled', aircraft: 'Airbus A350', class: 'Economy', seatsLeft: 42, baggageIncluded: '25 kg + 8 kg cabin', fareType: 'Saver', refundable: false },
  { id: 'fl-003', airline: 'Emirates', airlineCode: 'EK', flightNumber: 'EK-506', from: 'Mumbai', fromCode: 'BOM', to: 'Dubai', toCode: 'DXB', destinationId: 'dubai', departureTime: '2025-04-10T06:15:00', arrivalTime: '2025-04-10T09:00:00', duration: '2h 45m', stops: 0, price: 18900, businessPrice: 68000, status: 'scheduled', aircraft: 'Boeing 777-300ER', class: 'Economy', seatsLeft: 67, baggageIncluded: '30 kg + 7 kg cabin', fareType: 'Flex Plus', refundable: true },
  { id: 'fl-004', airline: 'Singapore Airlines', airlineCode: 'SQ', flightNumber: 'SQ-428', from: 'Mumbai', fromCode: 'BOM', to: 'Bali', toCode: 'DPS', destinationId: 'bali', departureTime: '2025-05-20T23:45:00', arrivalTime: '2025-05-21T12:20:00', duration: '9h 35m', stops: 1, stopCity: 'Singapore', price: 42800, businessPrice: 128000, status: 'scheduled', aircraft: 'Airbus A380', class: 'Economy', seatsLeft: 8, baggageIncluded: '20 kg + 7 kg cabin', fareType: 'Economy Lite', refundable: false },
  { id: 'fl-005', airline: 'IndiGo', airlineCode: '6E', flightNumber: '6E-1204', from: 'Mumbai', fromCode: 'BOM', to: 'Singapore', toCode: 'SIN', destinationId: 'singapore', departureTime: '2025-04-18T07:30:00', arrivalTime: '2025-04-18T18:15:00', duration: '5h 45m', stops: 0, price: 24600, businessPrice: 78000, status: 'scheduled', aircraft: 'Airbus A320neo', class: 'Economy', seatsLeft: 31, baggageIncluded: '15 kg + 7 kg cabin', fareType: 'Value', refundable: false },
  { id: 'fl-006', airline: 'Thai Airways', airlineCode: 'TG', flightNumber: 'TG-317', from: 'Mumbai', fromCode: 'BOM', to: 'Bangkok', toCode: 'BKK', destinationId: 'bangkok', departureTime: '2025-05-05T22:00:00', arrivalTime: '2025-05-06T05:30:00', duration: '4h 30m', stops: 0, price: 19800, businessPrice: 62000, status: 'scheduled', aircraft: 'Boeing 777', class: 'Economy', seatsLeft: 22, baggageIncluded: '20 kg + 7 kg cabin', fareType: 'Saver', refundable: false },
  { id: 'fl-007', airline: 'Air France', airlineCode: 'AF', flightNumber: 'AF-218', from: 'Mumbai', fromCode: 'BOM', to: 'Paris', toCode: 'CDG', destinationId: 'paris', departureTime: '2025-06-12T01:30:00', arrivalTime: '2025-06-12T08:45:00', duration: '9h 15m', stops: 0, price: 58400, businessPrice: 195000, status: 'scheduled', aircraft: 'Airbus A350-900', class: 'Economy', seatsLeft: 17, baggageIncluded: '23 kg + 12 kg cabin', fareType: 'Voyageur', refundable: true },
  { id: 'fl-008', airline: 'Iberia', airlineCode: 'IB', flightNumber: 'IB-6850', from: 'Mumbai', fromCode: 'BOM', to: 'Barcelona', toCode: 'BCN', destinationId: 'barcelona', departureTime: '2025-07-04T00:45:00', arrivalTime: '2025-07-04T09:30:00', duration: '10h 45m', stops: 1, stopCity: 'Madrid', price: 52800, businessPrice: 172000, status: 'scheduled', aircraft: 'Airbus A330', class: 'Economy', seatsLeft: 29, baggageIncluded: '23 kg + 10 kg cabin', fareType: 'Economy Flex', refundable: true },
  { id: 'fl-009', airline: 'Air India', airlineCode: 'AI', flightNumber: 'AI-101', from: 'Delhi', fromCode: 'DEL', to: 'Tokyo', toCode: 'NRT', destinationId: 'tokyo', departureTime: '2025-03-20T04:00:00', arrivalTime: '2025-03-20T17:15:00', duration: '10h 15m', stops: 0, price: 44200, businessPrice: 132000, status: 'scheduled', aircraft: 'Boeing 787-8', class: 'Economy', seatsLeft: 38, baggageIncluded: '25 kg + 8 kg cabin', fareType: 'Flexi Saver', refundable: true },
  { id: 'fl-010', airline: 'Emirates', airlineCode: 'EK', flightNumber: 'EK-524', from: 'Delhi', fromCode: 'DEL', to: 'Dubai', toCode: 'DXB', destinationId: 'dubai', departureTime: '2025-04-15T03:30:00', arrivalTime: '2025-04-15T06:30:00', duration: '3h 00m', stops: 0, price: 16500, businessPrice: 58000, status: 'scheduled', aircraft: 'Airbus A380', class: 'Economy', seatsLeft: 82, baggageIncluded: '30 kg + 7 kg cabin', fareType: 'Saver', refundable: false },
  { id: 'fl-011', airline: 'Vistara', airlineCode: 'UK', flightNumber: 'UK-183', from: 'Delhi', fromCode: 'DEL', to: 'Singapore', toCode: 'SIN', destinationId: 'singapore', departureTime: '2025-04-22T07:00:00', arrivalTime: '2025-04-22T18:30:00', duration: '5h 30m', stops: 0, price: 26800, businessPrice: 82000, status: 'scheduled', aircraft: 'Boeing 787-9', class: 'Economy', seatsLeft: 19, baggageIncluded: '15 kg + 7 kg cabin', fareType: 'Economy Flex', refundable: true },
  { id: 'fl-012', airline: 'British Airways', airlineCode: 'BA', flightNumber: 'BA-117', from: 'Delhi', fromCode: 'DEL', to: 'Paris', toCode: 'CDG', destinationId: 'paris', departureTime: '2025-06-20T21:00:00', arrivalTime: '2025-06-21T05:30:00', duration: '8h 30m', stops: 0, price: 54900, businessPrice: 185000, status: 'scheduled', aircraft: 'Boeing 777-200ER', class: 'Economy', seatsLeft: 25, baggageIncluded: '23 kg + 12 kg cabin', fareType: 'Plus', refundable: true },
  { id: 'fl-013', airline: 'IndiGo', airlineCode: '6E', flightNumber: '6E-1816', from: 'Bangalore', fromCode: 'BLR', to: 'Bangkok', toCode: 'BKK', destinationId: 'bangkok', departureTime: '2025-05-10T04:30:00', arrivalTime: '2025-05-10T12:00:00', duration: '4h 30m', stops: 0, price: 18200, businessPrice: 54000, status: 'scheduled', aircraft: 'Airbus A321', class: 'Economy', seatsLeft: 34, baggageIncluded: '15 kg + 7 kg cabin', fareType: 'Value', refundable: false },
  { id: 'fl-014', airline: 'Singapore Airlines', airlineCode: 'SQ', flightNumber: 'SQ-514', from: 'Bangalore', fromCode: 'BLR', to: 'Singapore', toCode: 'SIN', destinationId: 'singapore', departureTime: '2025-04-28T10:15:00', arrivalTime: '2025-04-28T19:45:00', duration: '4h 30m', stops: 0, price: 22400, businessPrice: 72000, status: 'scheduled', aircraft: 'Airbus A350', class: 'Economy', seatsLeft: 41, baggageIncluded: '20 kg + 7 kg cabin', fareType: 'Economy Classic', refundable: false },
  { id: 'fl-015', airline: 'Qatar Airways', airlineCode: 'QR', flightNumber: 'QR-569', from: 'Mumbai', fromCode: 'BOM', to: 'Maldives', toCode: 'MLE', destinationId: 'maldives', departureTime: '2025-12-05T13:00:00', arrivalTime: '2025-12-05T17:30:00', duration: '3h 30m', stops: 0, price: 28500, businessPrice: 92000, status: 'scheduled', aircraft: 'Boeing 787', class: 'Economy', seatsLeft: 12, baggageIncluded: '23 kg + 7 kg cabin', fareType: 'Economy', refundable: true },
  { id: 'fl-016', airline: 'SriLankan Airlines', airlineCode: 'UL', flightNumber: 'UL-223', from: 'Mumbai', fromCode: 'BOM', to: 'Colombo', toCode: 'CMB', destinationId: 'srilanka', departureTime: '2025-11-12T15:45:00', arrivalTime: '2025-11-12T19:15:00', duration: '2h 30m', stops: 0, price: 12800, businessPrice: 42000, status: 'scheduled', aircraft: 'Airbus A330', class: 'Economy', seatsLeft: 47, baggageIncluded: '30 kg + 7 kg cabin', fareType: 'Saver', refundable: false },
  { id: 'fl-017', airline: 'Lufthansa', airlineCode: 'LH', flightNumber: 'LH-762', from: 'Mumbai', fromCode: 'BOM', to: 'Amsterdam', toCode: 'AMS', destinationId: 'amsterdam', departureTime: '2025-07-15T01:30:00', arrivalTime: '2025-07-15T09:00:00', duration: '9h 30m', stops: 0, price: 56200, businessPrice: 188000, status: 'scheduled', aircraft: 'Airbus A340', class: 'Economy', seatsLeft: 21, baggageIncluded: '23 kg + 8 kg cabin', fareType: 'Economy Classic', refundable: true },
  { id: 'fl-018', airline: 'Air India', airlineCode: 'AI', flightNumber: 'AI-919', from: 'Delhi', fromCode: 'DEL', to: 'Jaipur', toCode: 'JAI', destinationId: 'rajasthan', departureTime: '2025-10-15T07:30:00', arrivalTime: '2025-10-15T09:00:00', duration: '1h 30m', stops: 0, price: 5400, businessPrice: 18000, status: 'scheduled', aircraft: 'Airbus A319', class: 'Economy', seatsLeft: 68, baggageIncluded: '25 kg + 8 kg cabin', fareType: 'Flexi', refundable: true },
  { id: 'fl-019', airline: 'IndiGo', airlineCode: '6E', flightNumber: '6E-4412', from: 'Mumbai', fromCode: 'BOM', to: 'Kochi', toCode: 'COK', destinationId: 'kerala', departureTime: '2025-10-20T09:00:00', arrivalTime: '2025-10-20T11:00:00', duration: '2h 00m', stops: 0, price: 4800, businessPrice: 14000, status: 'scheduled', aircraft: 'Airbus A320', class: 'Economy', seatsLeft: 53, baggageIncluded: '15 kg + 7 kg cabin', fareType: 'Value', refundable: false },
  { id: 'fl-020', airline: 'Royal Air Maroc', airlineCode: 'AT', flightNumber: 'AT-604', from: 'Mumbai', fromCode: 'BOM', to: 'Marrakech', toCode: 'RAK', destinationId: 'marrakech', departureTime: '2025-03-28T03:00:00', arrivalTime: '2025-03-28T11:30:00', duration: '10h 30m', stops: 1, stopCity: 'Casablanca', price: 48200, businessPrice: 148000, status: 'scheduled', aircraft: 'Boeing 787', class: 'Economy', seatsLeft: 18, baggageIncluded: '23 kg + 10 kg cabin', fareType: 'Economy', refundable: false },
  { id: 'fl-021', airline: 'Ethiopian Airlines', airlineCode: 'ET', flightNumber: 'ET-685', from: 'Mumbai', fromCode: 'BOM', to: 'Cape Town', toCode: 'CPT', destinationId: 'capetown', departureTime: '2025-04-05T23:30:00', arrivalTime: '2025-04-06T17:00:00', duration: '14h 30m', stops: 1, stopCity: 'Addis Ababa', price: 64500, businessPrice: 198000, status: 'scheduled', aircraft: 'Boeing 787-9', class: 'Economy', seatsLeft: 9, baggageIncluded: '23 kg + 7 kg cabin', fareType: 'Economy', refundable: false },
  { id: 'fl-022', airline: 'Japan Airlines', airlineCode: 'JL', flightNumber: 'JL-404', from: 'Tokyo', fromCode: 'NRT', to: 'Osaka (Kyoto)', toCode: 'KIX', destinationId: 'kyoto', departureTime: '2025-03-22T14:00:00', arrivalTime: '2025-03-22T15:15:00', duration: '1h 15m', stops: 0, price: 8200, businessPrice: 24000, status: 'scheduled', aircraft: 'Embraer E190', class: 'Economy', seatsLeft: 28, baggageIncluded: '20 kg + 7 kg cabin', fareType: 'Standard', refundable: true },
];

// ─── CURATED TRIPS ────────────────────────────────────────────────────────────

export const curatedTrips: CuratedTrip[] = [
  { id: 'ct-001', title: 'Cherry Blossom Season — Japan', subtitle: '10 nights · March–April', destinations: ['Tokyo', 'Kyoto'], destinationIds: ['tokyo', 'kyoto'], duration: '10 nights', price: 124000, imageUrl: 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=800&h=500&fit=crop&auto=format', tag: 'Seasonal', highlights: ['Cherry blossom viewing in Maruyama Park', 'Arashiyama bamboo dawn walk', 'Tsukiji food tour', 'Traditional ryokan stay'], includes: ['Flights from Mumbai', '5 nights Tokyo', '5 nights Kyoto', 'Bullet train pass', '3 guided experiences'] },
  { id: 'ct-002', title: 'Bali Wellness & Culture', subtitle: '7 nights · Year-round', destinations: ['Bali'], destinationIds: ['bali'], duration: '7 nights', price: 78000, imageUrl: 'https://images.unsplash.com/photo-1571984405176-5958bd9ac31d?w=800&h=500&fit=crop&auto=format', tag: 'Best Seller', highlights: ['Sunrise Mount Batur trek', 'Tegallalang rice terraces', 'Balinese cooking class', 'Temple sunset ceremonies'], includes: ['Flights from Delhi', '7 nights Ubud pool villa', '3 guided experiences', 'Daily breakfast'] },
  { id: 'ct-003', title: 'Dubai Luxury Weekend', subtitle: '4 nights · Oct–Mar', destinations: ['Dubai'], destinationIds: ['dubai'], duration: '4 nights', price: 95000, imageUrl: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&h=500&fit=crop&auto=format', tag: 'Premium', highlights: ['Burj Khalifa At the Top', 'Desert safari BBQ dinner', 'Dhow dinner cruise', 'Palm Jumeirah beach club'], includes: ['Flights from Mumbai', '4 nights 5-star hotel', '2 experiences', 'Airport transfers'] },
  { id: 'ct-004', title: 'Maldives Overwater Escape', subtitle: '7 nights · Nov–Apr', destinations: ['Maldives'], destinationIds: ['maldives'], duration: '7 nights', price: 285000, imageUrl: 'https://images.unsplash.com/photo-1654593777128-d187ed9820e5?w=800&h=500&fit=crop&auto=format', tag: 'Romantic', highlights: ['Overwater villa with direct ocean access', 'Snorkelling with manta rays', 'Private sandbank picnic', 'Sunset dolphin cruise'], includes: ['Flights from Bangalore', '7 nights overwater villa', 'All-inclusive dining', 'Seaplane transfer'] },
  { id: 'ct-005', title: 'Rajasthan Heritage Circuit', subtitle: '10 nights · Oct–Mar', destinations: ['Rajasthan'], destinationIds: ['rajasthan'], duration: '10 nights', price: 92000, imageUrl: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&h=500&fit=crop&auto=format', tag: 'Cultural', highlights: ['Amer Fort elephant ride', 'Lake Palace Udaipur', 'Thar Desert camel safari', 'Jodhpur Blue City streets'], includes: ['Flights from Chennai', '10 nights palace hotels', 'Private car and driver', 'Camel safari experience'] },
  { id: 'ct-006', title: 'Greek Island Hopper', subtitle: '8 nights · May–Oct', destinations: ['Santorini'], destinationIds: ['santorini'], duration: '8 nights', price: 168000, imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=500&fit=crop&auto=format', tag: 'Trending', highlights: ['Oia caldera sunset', 'Catamaran sailing cruise', 'Akrotiri Minoan ruins', 'Volcano hot springs'], includes: ['Flights from Delhi', '4 nights Santorini', '4 nights Mykonos', 'Ferry between islands', 'Daily breakfast'] },
];

// ─── DEALS ────────────────────────────────────────────────────────────────────

export const deals: Deal[] = [
  { id: 'd-001', type: 'flight', title: 'Mumbai to Tokyo', subtitle: 'IndiGo · Non-stop · Economy', originalPrice: 62000, dealPrice: 48500, badge: 'Flash Sale', badgeColor: 'bg-red-500', imageUrl: 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=800&h=500&fit=crop&auto=format', destinationId: 'tokyo', itemId: 'fl-001', expiresIn: '4h 32m' },
  { id: 'd-002', type: 'hotel', title: 'Four Seasons Bali at Sayan', subtitle: 'Garden Villa · Ubud · 5★', originalPrice: 58000, dealPrice: 45000, badge: 'Best Value', badgeColor: 'bg-emerald-500', imageUrl: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&h=500&fit=crop&auto=format', destinationId: 'bali', itemId: 'ht-005', expiresIn: '2 days' },
  { id: 'd-003', type: 'flight', title: 'Mumbai to Dubai', subtitle: 'Emirates · Non-stop · Economy', originalPrice: 24500, dealPrice: 18900, badge: 'Limited Seats', badgeColor: 'bg-amber-500', imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&h=500&fit=crop&auto=format', destinationId: 'dubai', itemId: 'fl-003', expiresIn: '12h 15m' },
  { id: 'd-004', type: 'activity', title: 'Tsukiji Market Food Tour', subtitle: 'Tokyo · 3 hours · 8 tastings', originalPrice: 6000, dealPrice: 4500, badge: 'Top Rated', badgeColor: 'bg-violet-500', imageUrl: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&h=500&fit=crop&auto=format', destinationId: 'tokyo', itemId: 'ac-002', expiresIn: '3 days' },
  { id: 'd-005', type: 'hotel', title: 'Park Hyatt Tokyo', subtitle: 'Deluxe King · Shinjuku · 5★', originalPrice: 42000, dealPrice: 32000, badge: 'Early Bird', badgeColor: 'bg-blue-500', imageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&h=500&fit=crop&auto=format', destinationId: 'tokyo', itemId: 'ht-001', expiresIn: '5 days' },
  { id: 'd-006', type: 'activity', title: 'Desert Safari & Dune Bashing', subtitle: 'Dubai · 6 hours · BBQ dinner', originalPrice: 7500, dealPrice: 5500, badge: 'Popular', badgeColor: 'bg-orange-500', imageUrl: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&h=500&fit=crop&auto=format', destinationId: 'dubai', itemId: 'ac-007', expiresIn: '1 day' },
  { id: 'd-007', type: 'hotel', title: 'Katikies Hotel, Oia', subtitle: 'Caldera View Suite · Santorini · 5★', originalPrice: 82000, dealPrice: 62000, badge: 'Honeymoon Pick', badgeColor: 'bg-pink-500', imageUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&h=500&fit=crop&auto=format', destinationId: 'santorini', itemId: 'ht-011', expiresIn: '6 days' },
  { id: 'd-008', type: 'hotel', title: 'Soneva Jani', subtitle: '1-Bedroom Water Retreat · Maldives', originalPrice: 280000, dealPrice: 220000, badge: 'Luxury Deal', badgeColor: 'bg-teal-500', imageUrl: 'https://images.unsplash.com/photo-1502301103665-0b95cc738daf?w=800&h=500&fit=crop&auto=format', destinationId: 'maldives', itemId: 'ht-014', expiresIn: '18h 44m' },
  { id: 'd-009', type: 'flight', title: 'Delhi to Singapore', subtitle: 'Vistara · Non-stop · Economy', originalPrice: 34000, dealPrice: 26800, badge: 'New Route', badgeColor: 'bg-indigo-500', imageUrl: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&h=500&fit=crop&auto=format', destinationId: 'singapore', itemId: 'fl-011', expiresIn: '2 days' },
  { id: 'd-010', type: 'activity', title: 'Santorini Caldera Sailing', subtitle: 'Full-day catamaran · BBQ lunch', originalPrice: 13000, dealPrice: 9800, badge: 'Summer Hit', badgeColor: 'bg-cyan-500', imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=500&fit=crop&auto=format', destinationId: 'santorini', itemId: 'ac-011', expiresIn: '4 days' },
];

// ─── BOOKINGS ─────────────────────────────────────────────────────────────────

export const bookings: Booking[] = [
  {
    id: 'bk-001',
    journeyId: 'jrn-001',
    travelerId: 'trv-001',
    type: 'flight',
    status: 'confirmed',
    referenceId: 'TRV-FL-2847',
    supplierId: 'sup-001',
    supplierName: 'IndiGo',
    itemName: '6E-812: Mumbai to Tokyo',
    itemDetails: 'Non-stop · Economy · Boeing 787-9',
    departureDate: '2025-03-15',
    totalAmount: 48500,
    currency: 'INR',
    paymentStatus: 'successful',
    createdAt: '2025-01-22T10:30:00',
    passengers: 2,
    seat: '24A, 24B',
    pnr: 'TRVABC',
    baggage: '15 kg each',
    meal: 'Vegetarian',
  },
  {
    id: 'bk-002',
    journeyId: 'jrn-001',
    travelerId: 'trv-001',
    type: 'hotel',
    status: 'confirmed',
    referenceId: 'TRV-HT-1924',
    supplierId: 'sup-002',
    supplierName: 'Park Hyatt Tokyo',
    itemName: 'Park Hyatt Tokyo — Deluxe King',
    itemDetails: '5★ · Shinjuku · City View',
    checkIn: '2025-03-15',
    checkOut: '2025-03-22',
    totalAmount: 224000,
    currency: 'INR',
    paymentStatus: 'successful',
    createdAt: '2025-01-22T10:45:00',
    nights: 7,
    roomType: 'Deluxe King Room',
  },
  {
    id: 'bk-003',
    journeyId: 'jrn-001',
    travelerId: 'trv-001',
    type: 'activity',
    status: 'confirmed',
    referenceId: 'TRV-AC-0821',
    supplierId: 'sup-003',
    supplierName: 'Tokyo Local Experiences',
    itemName: 'Tsukiji Food Tour',
    itemDetails: '3 hours · Small group · Includes tasting',
    departureDate: '2025-03-17',
    totalAmount: 9000,
    currency: 'INR',
    paymentStatus: 'successful',
    createdAt: '2025-01-23T14:20:00',
    participants: 2,
    experienceDate: '2025-03-17',
    experienceTime: '08:00',
    meetingPoint: 'Tsukiji Market main gate',
  },
  {
    id: 'bk-004',
    journeyId: 'jrn-002',
    travelerId: 'trv-001',
    type: 'hotel',
    status: 'confirmed',
    referenceId: 'TRV-HT-2041',
    supplierId: 'sup-004',
    supplierName: 'Four Seasons Bali',
    itemName: 'Four Seasons Bali at Sayan — Garden Villa',
    itemDetails: '5★ · Ubud · Rice Terrace View',
    checkIn: '2025-05-21',
    checkOut: '2025-05-28',
    totalAmount: 315000,
    currency: 'INR',
    paymentStatus: 'pending',
    createdAt: '2025-02-10T09:15:00',
    nights: 7,
    roomType: 'Garden Villa with Private Pool',
  },
];

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

export const payments: Payment[] = [
  { id: 'pay-001', bookingId: 'bk-001', journeyId: 'jrn-001', travelerId: 'trv-001', amount: 48500, currency: 'INR', status: 'successful', method: 'Credit Card', last4: '4242', transactionId: 'TXN-4829-ABCD', processedAt: '2025-01-22T10:35:00' },
  { id: 'pay-002', bookingId: 'bk-002', journeyId: 'jrn-001', travelerId: 'trv-001', amount: 224000, currency: 'INR', status: 'successful', method: 'UPI', transactionId: 'TXN-5841-EFGH', processedAt: '2025-01-22T10:48:00' },
  { id: 'pay-003', bookingId: 'bk-004', journeyId: 'jrn-002', travelerId: 'trv-001', amount: 315000, currency: 'INR', status: 'pending', method: 'Credit Card', last4: '4242', transactionId: 'TXN-6192-IJKL', processedAt: '2025-02-10T09:20:00' },
];

// ─── JOURNEYS ─────────────────────────────────────────────────────────────────

export const initialJourneys: Journey[] = [
  {
    id: 'jrn-001',
    travelerId: 'trv-001',
    destination: 'Tokyo',
    destinationId: 'tokyo',
    title: 'Tokyo Spring Escape',
    status: 'in-travel',
    startDate: '2025-03-15',
    endDate: '2025-03-22',
    travelers: 2,
    bookings: ['bk-001', 'bk-002', 'bk-003'],
    totalSpend: 281500,
    currency: 'INR',
    imageUrl: 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=800&h=500&fit=crop&auto=format',
    itinerary: [
      {
        day: 1,
        date: '2025-03-15',
        location: 'Mumbai to Tokyo',
        title: 'Arrival Day',
        activities: [
          { id: 'it-001', time: '02:30', title: 'Depart Mumbai (BOM)', type: 'flight', duration: '9h 15m', status: 'booked', bookingId: 'bk-001', flightId: 'fl-001', cost: 48500 },
          { id: 'it-002', time: '14:45', title: 'Arrive Narita (NRT)', type: 'flight', duration: '30m', status: 'booked', bookingId: 'bk-001' },
          { id: 'it-003', time: '16:00', title: 'Airport Transfer to Park Hyatt', type: 'transfer', duration: '1h 30m', status: 'booked', cost: 4200 },
          { id: 'it-004', time: '17:30', title: 'Check-in: Park Hyatt Tokyo', type: 'hotel', duration: '', status: 'booked', bookingId: 'bk-002', hotelId: 'ht-001' },
          { id: 'it-005', time: '20:00', title: 'Dinner at New York Bar', type: 'meal', duration: '2h', status: 'unbooked' },
        ],
      },
      {
        day: 2, date: '2025-03-16', location: 'Tokyo', title: 'Shinjuku & Akihabara',
        activities: [
          { id: 'it-006', time: '09:00', title: 'Breakfast at hotel', type: 'meal', duration: '1h', status: 'unbooked' },
          { id: 'it-007', time: '10:30', title: 'Shinjuku Gyoen Garden', type: 'activity', duration: '2h', status: 'unbooked', activityId: 'ac-001', cost: 1000 },
          { id: 'it-008', time: '14:00', title: 'Akihabara Electronics & Anime District', type: 'activity', duration: '3h', status: 'unbooked' },
          { id: 'it-009', time: '19:00', title: 'Ramen Dinner in Shinjuku', type: 'meal', duration: '1h', status: 'unbooked' },
        ],
      },
      {
        day: 3, date: '2025-03-17', location: 'Tokyo', title: 'Tsukiji & Shibuya',
        activities: [
          { id: 'it-010', time: '08:00', title: 'Tsukiji Outer Market Food Tour', type: 'activity', duration: '3h', status: 'booked', bookingId: 'bk-003', activityId: 'ac-002', cost: 9000 },
          { id: 'it-011', time: '13:00', title: 'Harajuku Takeshita Street', type: 'activity', duration: '2h', status: 'unbooked', activityId: 'ac-001' },
          { id: 'it-012', time: '18:00', title: 'Shibuya Crossing at dusk', type: 'activity', duration: '1h', status: 'unbooked' },
          { id: 'it-013', time: '20:00', title: 'Dinner at Narisawa', type: 'meal', duration: '2h 30m', status: 'unbooked', cost: 32000 },
        ],
      },
    ],
    notifications: [
      { id: 'notif-001', type: 'alert', title: 'Flight Delay — 6E-812', message: 'Your IndiGo flight 6E-812 from Mumbai has been delayed by 45 minutes. New departure: 03:15.', timestamp: '2025-03-15T01:40:00', read: false, journeyId: 'jrn-001' },
      { id: 'notif-002', type: 'info', title: 'Check-in reminder', message: 'Online check-in for 6E-812 is now open. Check in before departure to select your seats.', timestamp: '2025-03-13T09:00:00', read: true, journeyId: 'jrn-001' },
    ],
    disruptions: [
      { id: 'dis-001', journeyId: 'jrn-001', type: 'flight-delay', severity: 'medium', title: 'Flight 6E-812 Delayed — 45 Minutes', description: 'IndiGo 6E-812 Mumbai to Tokyo has been delayed by 45 minutes due to late inbound aircraft. New departure time: 03:15 IST.', status: 'investigating', affectedBookingId: 'bk-001', detectedAt: '2025-03-15T01:30:00', impact: 'Airport transfer window reduced. Hotel check-in impact evaluated — within standard window.', recommendation: 'No immediate action required. Transfer has been adjusted.' },
    ],
  },
  {
    id: 'jrn-002',
    travelerId: 'trv-001',
    destination: 'Bali',
    destinationId: 'bali',
    title: 'Bali Wellness Retreat',
    status: 'booked',
    startDate: '2025-05-21',
    endDate: '2025-05-28',
    travelers: 2,
    bookings: ['bk-004'],
    totalSpend: 315000,
    currency: 'INR',
    imageUrl: 'https://images.unsplash.com/photo-1571984405176-5958bd9ac31d?w=800&h=500&fit=crop&auto=format',
    itinerary: [
      {
        day: 1,
        date: '2025-05-21',
        location: 'Denpasar to Ubud',
        title: 'Arrival & Check-in',
        activities: [
          { id: 'it-b-001', time: '12:20', title: 'Arrive Denpasar (DPS)', type: 'flight', duration: '30m', status: 'booked', flightId: 'fl-004' },
          { id: 'it-b-002', time: '14:00', title: 'Transfer to Ubud', type: 'transfer', duration: '1h 30m', status: 'unbooked' },
          { id: 'it-b-003', time: '15:30', title: 'Check-in: Four Seasons Bali at Sayan', type: 'hotel', duration: '', status: 'booked', bookingId: 'bk-004', hotelId: 'ht-005' },
          { id: 'it-b-004', time: '19:00', title: 'Welcome dinner by rice terraces', type: 'meal', duration: '2h', status: 'unbooked' },
        ],
      },
      {
        day: 2,
        date: '2025-05-22',
        location: 'Ubud',
        title: 'Temples & Rice Terraces',
        activities: [
          { id: 'it-b-005', time: '07:00', title: 'Sunrise yoga at resort', type: 'activity', duration: '1.5h', status: 'unbooked' },
          { id: 'it-b-006', time: '10:00', title: 'Tegallalang Rice Terraces walk', type: 'activity', duration: '3h', status: 'unbooked' },
          { id: 'it-b-007', time: '14:00', title: 'Ubud cycling tour', type: 'activity', duration: '5h', status: 'unbooked', activityId: 'ac-006' },
          { id: 'it-b-008', time: '20:00', title: 'Dinner at Locavore', type: 'meal', duration: '2h', status: 'unbooked' },
        ],
      },
      {
        day: 3, date: '2025-05-23', location: 'Bali', title: 'Mount Batur Sunrise Trek',
        activities: [
          { id: 'it-b-005', time: '03:00', title: 'Mount Batur Sunrise Trek', type: 'activity', duration: '7h', status: 'unbooked', activityId: 'ac-003', cost: 2800 },
          { id: 'it-b-006', time: '12:00', title: 'Spa & recovery at hotel', type: 'activity', duration: '2h', status: 'unbooked' },
        ],
      },
    ],
    notifications: [],
    disruptions: [],
  },
  {
    id: 'jrn-003',
    travelerId: 'trv-001',
    destination: 'Paris',
    destinationId: 'paris',
    title: 'Paris Long Weekend',
    status: 'completed',
    startDate: '2024-11-08',
    endDate: '2024-11-12',
    travelers: 2,
    bookings: [],
    totalSpend: 186000,
    currency: 'INR',
    imageUrl: 'https://images.unsplash.com/photo-1570097703229-b195d6dd291f?w=800&h=500&fit=crop&auto=format',
    itinerary: [],
    notifications: [],
    disruptions: [],
  },
];

// ─── TRAVELER ─────────────────────────────────────────────────────────────────

export const currentTraveler: Traveler = {
  id: 'trv-001',
  name: 'Arjun Mehta',
  email: 'arjun.mehta@example.com',
  phone: '+91 98765 43210',
  avatar: 'AM',
  passportNumber: 'P1234567',
  nationality: 'Indian',
  loyaltyPoints: 24850,
  tier: 'gold',
  totalTrips: 18,
  preferredClass: 'Economy',
  journeyIds: ['jrn-001', 'jrn-002', 'jrn-003'],
};

// ─── SUPPLIERS (internal) ─────────────────────────────────────────────────────

export const suppliers: Supplier[] = [
  { id: 'sup-001', name: 'IndiGo', type: 'airline', verificationStatus: 'verified', qualityScore: 82, fulfillmentRate: 94.2, complaintRate: 3.1, incidentRate: 0.8, revenue: 48500000, riskLevel: 'low', country: 'India', activeBookings: 2847 },
  { id: 'sup-002', name: 'Park Hyatt Tokyo', type: 'hotel', verificationStatus: 'verified', qualityScore: 96, fulfillmentRate: 99.1, complaintRate: 0.4, incidentRate: 0.1, revenue: 224000000, riskLevel: 'low', country: 'Japan', activeBookings: 142 },
  { id: 'sup-003', name: 'Tokyo Local Experiences', type: 'activity', verificationStatus: 'verified', qualityScore: 91, fulfillmentRate: 97.8, complaintRate: 0.9, incidentRate: 0.2, revenue: 9000000, riskLevel: 'low', country: 'Japan', activeBookings: 84 },
  { id: 'sup-004', name: 'Four Seasons Bali', type: 'hotel', verificationStatus: 'verified', qualityScore: 98, fulfillmentRate: 99.8, complaintRate: 0.1, incidentRate: 0.0, revenue: 315000000, riskLevel: 'low', country: 'Indonesia', activeBookings: 61 },
];

export const corporateAccounts: CorporateAccount[] = [
  { id: 'corp-001', name: 'Infosys Limited', industry: 'Technology', activeTravelers: 47, monthlySpend: 4200000, annualBudget: 60000000, policyCompliance: 91, pendingApprovals: 8, upcomingTrips: 23 },
];

export const operationsMetrics = { activeJourneys: 1284, atRiskJourneys: 23, criticalAlerts: 4, resolvedToday: 18, bookingsToday: 847, revenueToday: 42800000, supplierAlerts: 7, supportCases: 31 };
export const recentAlerts = [{ id: 'alert-001', type: 'flight-delay', severity: 'high', message: 'IndiGo 6E-812 delayed 45min — 2 journeys affected', journeyId: 'jrn-001', timestamp: '2025-03-15T01:30:00', status: 'investigating' }];
export const controlTowerJourneys = [{ id: 'jrn-001', traveler: 'Arjun Mehta', destination: 'Tokyo', status: 'in-travel', risk: 'medium', disruption: 'Flight delay 45m', lastUpdate: '2025-03-15T01:35:00' }];

// ─── Visa Types ──────────────────────────────────────────────────────────────

export type VisaStatus = 'draft' | 'submitted' | 'document-check' | 'appointment-scheduled' | 'under-review' | 'decision-pending' | 'approved' | 'rejected' | 'collection-ready' | 'collected';

export interface VisaDocument {
  id: string;
  type: string;
  name: string;
  status: 'verified' | 'pending' | 'missing' | 'auto-detected';
  source?: 'profile' | 'journey' | 'uploaded';
  notes?: string;
}

export interface VisaApplication {
  id: string;
  destinationId: string;
  country: string;
  journeyId?: string;
  visaTypeId: string;
  visaTypeName: string;
  status: VisaStatus;
  referenceNumber?: string;
  submittedAt?: string;
  appointmentDate?: string;
  appointmentLocation?: string;
  decisionDate?: string;
  collectionDate?: string;
  expiryDate?: string;
  documents: VisaDocument[];
  fee: number;
  processingDays: number;
  notes?: string;
}

export interface VisaRequirement {
  destinationId: string;
  country: string;
  flag: string;
  fromNationality: string;
  requiresVisa: boolean;
  visaType: 'required' | 'on-arrival' | 'e-visa' | 'visa-free';
  fee?: number;
  processingDays?: number;
  maxStay?: string;
  notes?: string;
  requiredDocuments: string[];
  types: {
    id: string;
    name: string;
    fee: number;
    processingDays: number;
    maxStay: string;
    validity: string;
    description: string;
  }[];
}

export const visaRequirements: VisaRequirement[] = [
  {
    destinationId: 'tokyo',
    country: 'Japan',
    flag: '🇯🇵',
    fromNationality: 'Indian',
    requiresVisa: true,
    visaType: 'required',
    fee: 8200,
    processingDays: 10,
    maxStay: '30 days',
    notes: 'Japan requires a visa for Indian passport holders. Applications must be submitted through the Japanese Embassy or authorised travel agents.',
    requiredDocuments: ['Passport copy', 'Passport-size photograph', 'Flight confirmation', 'Hotel booking confirmation', 'Bank statements (3 months)', 'Cover letter', 'Income tax returns'],
    types: [
      { id: 'jp-tourist-single', name: 'Tourist (Single Entry)', fee: 8200, processingDays: 10, maxStay: '30 days', validity: '3 months', description: 'For tourism, sightseeing, and leisure travel. Single entry only.' },
      { id: 'jp-tourist-multiple', name: 'Tourist (Multiple Entry)', fee: 12500, processingDays: 14, maxStay: '30 days per visit', validity: '5 years', description: 'Multiple entries within 5 years. Ideal for frequent visitors.' },
      { id: 'jp-business', name: 'Business Visa', fee: 9500, processingDays: 7, maxStay: '90 days', validity: '1 year', description: 'For attending meetings, conferences, and business negotiations.' },
    ],
  },
  {
    destinationId: 'bali',
    country: 'Indonesia (Bali)',
    flag: '🇮🇩',
    fromNationality: 'Indian',
    requiresVisa: true,
    visaType: 'on-arrival',
    fee: 2100,
    processingDays: 0,
    maxStay: '30 days',
    notes: 'Indian citizens can obtain a Visa on Arrival at Ngurah Rai International Airport. Extendable once for 30 more days.',
    requiredDocuments: ['Passport copy', 'Return flight ticket', 'Hotel booking confirmation', 'USD 35 cash (fee)'],
    types: [
      { id: 'id-voa', name: 'Visa on Arrival', fee: 2100, processingDays: 0, maxStay: '30 days', validity: 'Single entry', description: 'Obtained at the airport on arrival. Extendable once.' },
      { id: 'id-evisa', name: 'e-Visa (B211A)', fee: 3500, processingDays: 3, maxStay: '60 days', validity: '60 days', description: 'Apply online before travel for a more convenient experience.' },
    ],
  },
  {
    destinationId: 'dubai',
    country: 'UAE (Dubai)',
    flag: '🇦🇪',
    fromNationality: 'Indian',
    requiresVisa: true,
    visaType: 'e-visa',
    fee: 4500,
    processingDays: 3,
    maxStay: '30 days',
    notes: 'Indian passport holders can apply for a UAE tourist e-visa online. Processing typically takes 2-4 business days.',
    requiredDocuments: ['Passport copy', 'Passport-size photograph', 'Flight confirmation', 'Hotel booking confirmation', 'Bank statements (3 months)'],
    types: [
      { id: 'ae-tourist-30', name: 'Tourist Visa (30 days)', fee: 4500, processingDays: 3, maxStay: '30 days', validity: '60 days', description: 'Standard tourist visa. Apply online through UAE ICP portal.' },
      { id: 'ae-tourist-90', name: 'Tourist Visa (90 days)', fee: 9200, processingDays: 5, maxStay: '90 days', validity: '6 months', description: 'Long-stay tourist visa for extended visits.' },
      { id: 'ae-transit', name: 'Transit Visa (96 hours)', fee: 1800, processingDays: 1, maxStay: '96 hours', validity: '14 days', description: 'For short layovers and transit through Dubai.' },
    ],
  },
  {
    destinationId: 'singapore',
    country: 'Singapore',
    flag: '🇸🇬',
    fromNationality: 'Indian',
    requiresVisa: true,
    visaType: 'e-visa',
    fee: 3800,
    processingDays: 5,
    maxStay: '30 days',
    notes: 'Indian citizens require a visa for Singapore. Applications are processed online or through accredited agents.',
    requiredDocuments: ['Passport copy', 'Passport-size photograph', 'Flight confirmation', 'Hotel booking confirmation', 'Bank statements (3 months)', 'Cover letter'],
    types: [
      { id: 'sg-tourist', name: 'Tourist Visa', fee: 3800, processingDays: 5, maxStay: '30 days', validity: '2 months', description: 'For leisure travel and tourism.' },
      { id: 'sg-business', name: 'Business Visa', fee: 5200, processingDays: 7, maxStay: '30 days', validity: '2 months', description: 'For attending meetings, seminars, and trade shows.' },
    ],
  },
  {
    destinationId: 'thailand',
    country: 'Thailand',
    flag: '🇹🇭',
    fromNationality: 'Indian',
    requiresVisa: false,
    visaType: 'visa-free',
    fee: 0,
    processingDays: 0,
    maxStay: '30 days',
    notes: 'Indian passport holders can visit Thailand visa-free for up to 30 days for tourism purposes.',
    requiredDocuments: ['Valid passport', 'Return flight ticket', 'Hotel booking confirmation', 'Sufficient funds proof'],
    types: [
      { id: 'th-free', name: 'Visa Exemption', fee: 0, processingDays: 0, maxStay: '30 days', validity: 'Per visit', description: 'No visa required. Stamp granted on arrival at immigration.' },
    ],
  },
  {
    destinationId: 'maldives',
    country: 'Maldives',
    flag: '🇲🇻',
    fromNationality: 'Indian',
    requiresVisa: false,
    visaType: 'on-arrival',
    fee: 0,
    processingDays: 0,
    maxStay: '30 days',
    notes: 'All nationalities including Indians get a free visa on arrival in the Maldives for up to 30 days.',
    requiredDocuments: ['Valid passport', 'Return flight ticket', 'Hotel booking confirmation', 'Sufficient funds (USD 100/day)'],
    types: [
      { id: 'mv-voa', name: 'Free Visa on Arrival', fee: 0, processingDays: 0, maxStay: '30 days', validity: 'Per visit', description: 'Free tourist visa granted on arrival for all passport holders.' },
    ],
  },
];
