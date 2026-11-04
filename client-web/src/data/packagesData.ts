// ─── Package Data Types ───────────────────────────────────────────────────────

export type PackageCategory =
  | 'private' | 'royal' | 'honeymoon' | 'wellness' | 'family'
  | 'adventure' | 'culinary' | 'culture' | 'beach' | 'safari' | 'celebration';

export type PackageRegion = 'india' | 'international';

export interface PackageStop {
  city: string;
  nights: number;
  hotel: string;
  roomType?: string;
}

export interface PackageDayActivity {
  time?: string;
  title: string;
  type: 'flight' | 'transfer' | 'hotel' | 'experience' | 'meal' | 'free' | 'check-in' | 'check-out';
  included: boolean;
  notes?: string;
}

export interface PackageDay {
  day: number;
  title: string;
  location: string;
  activities: PackageDayActivity[];
}

export interface PackageHighlight {
  title: string;
  description: string;
  imageUrl?: string;
}

export interface LuxuryPackage {
  id: string;
  region: PackageRegion;
  title: string;
  subtitle: string;
  destination: string;
  destinations: string[];
  route: string[];
  nights: number;
  days: number;
  categories: PackageCategory[];
  badge?: 'Private' | 'Signature' | 'Curated' | 'Family' | 'Honeymoon' | 'Exclusive' | 'Royal';
  pricePerPerson: number;
  currency: 'INR';
  accommodation: 'luxury' | 'ultra-luxury' | 'boutique';
  transport: 'private' | 'shared';
  experienceCount: number;
  visaRequired?: boolean;
  visaType?: 'e-visa' | 'on-arrival' | 'required' | 'not-required';
  bestSeason: string;
  pace: 'slow' | 'moderate' | 'active';
  imageUrl: string;
  galleryImages: string[];
  stops: PackageStop[];
  itinerary: PackageDay[];
  highlights: PackageHighlight[];
  inclusions: string[];
  exclusions: string[];
  tagline: string;
  travelStyle: string;
  visaNote?: string;
}

// ─── India Packages ───────────────────────────────────────────────────────────

export const indiaPackages: LuxuryPackage[] = [
  {
    id: 'pkg-rajasthan-royal',
    region: 'india',
    title: 'The Royal Rajasthan',
    subtitle: 'A private circuit through the golden cities',
    destination: 'Rajasthan, India',
    destinations: ['Jaipur', 'Jodhpur', 'Udaipur'],
    route: ['Delhi', 'Jaipur', 'Jodhpur', 'Udaipur', 'Delhi'],
    nights: 7,
    days: 8,
    categories: ['royal', 'culture', 'private'],
    badge: 'Royal',
    pricePerPerson: 185000,
    currency: 'INR',
    accommodation: 'ultra-luxury',
    transport: 'private',
    experienceCount: 6,
    visaRequired: false,
    bestSeason: 'Oct – Mar',
    pace: 'moderate',
    imageUrl: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [
      'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&h=600&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&h=600&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?w=800&h=600&fit=crop&auto=format',
    ],
    stops: [
      { city: 'Jaipur', nights: 2, hotel: 'Rambagh Palace', roomType: 'Heritage Suite' },
      { city: 'Jodhpur', nights: 2, hotel: 'RAAS Jodhpur', roomType: 'Haveli Suite' },
      { city: 'Udaipur', nights: 3, hotel: 'The Leela Palace Udaipur', roomType: 'Lake View Suite' },
    ],
    itinerary: [
      {
        day: 1, title: 'Arrival in Jaipur', location: 'Jaipur',
        activities: [
          { title: 'Private airport transfer', type: 'transfer', included: true },
          { title: 'Check-in at Rambagh Palace', type: 'check-in', included: true },
          { title: 'Welcome dinner at Suvarna Mahal', type: 'meal', included: true },
        ],
      },
      {
        day: 2, title: 'The Pink City', location: 'Jaipur',
        activities: [
          { title: 'Private Amber Fort experience at dawn', type: 'experience', included: true, notes: 'Exclusive early access before crowds' },
          { title: 'Hawa Mahal & City Palace heritage walk', type: 'experience', included: true },
          { title: 'Gem bazaar private tour with a jeweller', type: 'experience', included: true },
          { title: 'Rooftop dinner with Pink City views', type: 'meal', included: true },
        ],
      },
      {
        day: 3, title: 'Jaipur to Jodhpur', location: 'Jodhpur',
        activities: [
          { title: 'Private road transfer (5 hrs)', type: 'transfer', included: true },
          { title: 'En-route visit to Stepwell of Abhaneri', type: 'experience', included: true },
          { title: 'Check-in at RAAS Jodhpur', type: 'check-in', included: true },
          { title: 'Evening stroll in the Blue City', type: 'free', included: true },
        ],
      },
      {
        day: 4, title: 'Mehrangarh & Blue Lanes', location: 'Jodhpur',
        activities: [
          { title: 'Exclusive dawn access to Mehrangarh Fort', type: 'experience', included: true },
          { title: 'Culinary walk through the spice market', type: 'experience', included: true },
          { title: 'Traditional Rajasthani thali dinner', type: 'meal', included: true },
        ],
      },
      {
        day: 5, title: 'Journey to the Lake City', location: 'Udaipur',
        activities: [
          { title: 'Private road transfer (4.5 hrs)', type: 'transfer', included: true },
          { title: 'Check-in at The Leela Palace', type: 'check-in', included: true },
          { title: 'Sunset boat ride on Lake Pichola', type: 'experience', included: true },
        ],
      },
      {
        day: 6, title: 'Palaces & Lakes', location: 'Udaipur',
        activities: [
          { title: 'City Palace private heritage tour', type: 'experience', included: true },
          { title: 'Lake Palace lunch (weather permitting)', type: 'meal', included: true },
          { title: 'Bagore Ki Haveli classical dance performance', type: 'experience', included: true },
        ],
      },
      {
        day: 7, title: 'Vintage Udaipur', location: 'Udaipur',
        activities: [
          { title: 'Morning yoga at the Palace', type: 'experience', included: true },
          { title: 'Vintage car tour of old Udaipur', type: 'experience', included: true },
          { title: 'Farewell dinner on the lake terrace', type: 'meal', included: true },
        ],
      },
      {
        day: 8, title: 'Departure', location: 'Delhi',
        activities: [
          { title: 'Check-out and private transfer to airport', type: 'transfer', included: true },
          { title: 'Flight to Delhi (or home city)', type: 'flight', included: false, notes: 'Book separately or add to package' },
        ],
      },
    ],
    highlights: [
      { title: 'Dawn at Amber Fort', description: 'Exclusive early-morning access before other visitors arrive — the fort in near-silence.', imageUrl: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600&h=400&fit=crop&auto=format' },
      { title: 'Rambagh Palace', description: 'The former residence of the Maharaja of Jaipur. Unmatched grandeur in the heart of the Pink City.', imageUrl: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&h=400&fit=crop&auto=format' },
      { title: 'Lake Pichola at Sunset', description: 'A private boat journey as the Aravalli hills turn golden and the Lake Palace appears to float.', imageUrl: 'https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?w=600&h=400&fit=crop&auto=format' },
    ],
    inclusions: [
      'All accommodation (ultra-luxury heritage hotels)',
      'Daily breakfast and selected meals as per itinerary',
      'All private road transfers in an air-conditioned luxury vehicle',
      'Expert local guides at every destination',
      'Exclusive early-access fort experiences',
      'Welcome amenities and turn-down gifts',
      'Bottled water throughout the journey',
      '24/7 Travalastic concierge support',
    ],
    exclusions: [
      'Flights to and from Delhi',
      'Personal shopping, spa treatments',
      'Camera fee at monuments',
      'Alcoholic beverages unless specified',
      'Travel insurance',
    ],
    tagline: 'Forts, palaces and the quiet luxury of the Rajputana.',
    travelStyle: 'Royal Heritage',
  },

  {
    id: 'pkg-kerala-residence',
    region: 'india',
    title: 'Kerala in Residence',
    subtitle: 'Backwaters, spice gardens and an Ayurvedic awakening',
    destination: 'Kerala, India',
    destinations: ['Kochi', 'Munnar', 'Alleppey'],
    route: ['Kochi', 'Munnar', 'Alleppey', 'Kochi'],
    nights: 6,
    days: 7,
    categories: ['wellness', 'culture', 'private'],
    badge: 'Signature',
    pricePerPerson: 128000,
    currency: 'INR',
    accommodation: 'ultra-luxury',
    transport: 'private',
    experienceCount: 5,
    visaRequired: false,
    bestSeason: 'Oct – Feb',
    pace: 'slow',
    imageUrl: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [
      'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&h=600&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=800&h=600&fit=crop&auto=format',
    ],
    stops: [
      { city: 'Kochi', nights: 1, hotel: 'CGH Earth Old Harbour', roomType: 'Heritage Suite' },
      { city: 'Munnar', nights: 2, hotel: 'Windermere Estate', roomType: 'Planter\'s Bungalow' },
      { city: 'Alleppey', nights: 3, hotel: 'Private Houseboat (Luxury Ketuvallam)', roomType: 'Premium Cabin' },
    ],
    itinerary: [
      { day: 1, title: 'Arrival in Kochi', location: 'Kochi', activities: [
        { title: 'Private airport transfer to Fort Kochi', type: 'transfer', included: true },
        { title: 'Check-in at Old Harbour Hotel', type: 'check-in', included: true },
        { title: 'Evening walk: Chinese fishing nets & spice docks', type: 'experience', included: true },
      ]},
      { day: 2, title: 'Up to the Plantations', location: 'Munnar', activities: [
        { title: 'Scenic drive through the tea estates (3.5 hrs)', type: 'transfer', included: true },
        { title: 'Private tea factory experience', type: 'experience', included: true },
        { title: 'Check-in at Windermere Estate', type: 'check-in', included: true },
        { title: 'Dinner at the Planter\'s Table', type: 'meal', included: true },
      ]},
      { day: 3, title: 'Spice & Silence', location: 'Munnar', activities: [
        { title: 'Sunrise nature walk through Eravikulam', type: 'experience', included: true },
        { title: 'Private spice garden tour with a naturalist', type: 'experience', included: true },
        { title: 'Ayurvedic consultation and Abhyanga treatment', type: 'experience', included: true },
      ]},
      { day: 4, title: 'The Backwaters Await', location: 'Alleppey', activities: [
        { title: 'Private transfer to Alleppey jetty', type: 'transfer', included: true },
        { title: 'Board luxury private houseboat', type: 'hotel', included: true },
        { title: 'Slow cruise through Vembanad Lake', type: 'experience', included: true },
        { title: 'Dinner prepared by the on-board chef', type: 'meal', included: true },
      ]},
      { day: 5, title: 'Into the Waterways', location: 'Alleppey', activities: [
        { title: 'Dawn birdwatching from the boat', type: 'experience', included: true },
        { title: 'Village walk and toddy tasting', type: 'experience', included: true },
        { title: 'Sunset cruise with coconut lagoon views', type: 'free', included: true },
      ]},
      { day: 6, title: 'Slow Final Day', location: 'Alleppey', activities: [
        { title: 'Morning Ayurvedic yoga session', type: 'experience', included: true },
        { title: 'Transfer to Kochi airport', type: 'transfer', included: true },
      ]},
      { day: 7, title: 'Departure', location: 'Kochi', activities: [
        { title: 'International/domestic departure', type: 'flight', included: false },
      ]},
    ],
    highlights: [
      { title: 'Private Houseboat', description: 'Three nights aboard a luxury kettuvallam — the waterways as your home.' },
      { title: 'Planter\'s Life', description: 'Stay inside a working tea estate. Mist, silence and the scent of fresh tea leaves.' },
    ],
    inclusions: [
      'All accommodation including 3 nights on luxury private houseboat',
      'Daily breakfast + meals as per itinerary',
      'All private transfers',
      'Ayurvedic consultation and one signature treatment',
      'Private tea estate and spice garden experiences',
      '24/7 Travalastic concierge',
    ],
    exclusions: ['Flights to/from Kochi', 'Additional spa treatments', 'Alcoholic beverages'],
    tagline: 'The slow luxury of Kerala — felt, not rushed.',
    travelStyle: 'Wellness & Nature',
  },

  {
    id: 'pkg-kashmir-alpine',
    region: 'india',
    title: 'Kashmir Alpine Escape',
    subtitle: 'Dal Lake, Sonamarg and the silence of the Himalayas',
    destination: 'Kashmir, India',
    destinations: ['Srinagar', 'Gulmarg', 'Sonamarg'],
    route: ['Srinagar', 'Gulmarg', 'Sonamarg', 'Srinagar'],
    nights: 6,
    days: 7,
    categories: ['adventure', 'culture', 'private'],
    badge: 'Signature',
    pricePerPerson: 145000,
    currency: 'INR',
    accommodation: 'luxury',
    transport: 'private',
    experienceCount: 5,
    visaRequired: false,
    bestSeason: 'Apr – Jun & Sep – Nov',
    pace: 'moderate',
    imageUrl: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [
      'https://images.unsplash.com/photo-1548013146-72479768bada?w=800&h=600&fit=crop&auto=format',
    ],
    stops: [
      { city: 'Srinagar', nights: 3, hotel: 'The Lalit Grand Palace', roomType: 'Palace Suite' },
      { city: 'Gulmarg', nights: 2, hotel: 'Khyber Himalayan Resort', roomType: 'Deluxe Suite' },
      { city: 'Sonamarg', nights: 1, hotel: 'Glacier Heights', roomType: 'Suite' },
    ],
    itinerary: [
      { day: 1, title: 'Arrival in Srinagar', location: 'Srinagar', activities: [
        { title: 'Airport pick-up in luxury shikara boat', type: 'transfer', included: true },
        { title: 'Check-in at The Lalit Grand Palace', type: 'check-in', included: true },
        { title: 'Private sunset shikara on Dal Lake', type: 'experience', included: true },
        { title: 'Wazwan welcome dinner', type: 'meal', included: true },
      ]},
      { day: 2, title: 'The Old City', location: 'Srinagar', activities: [
        { title: 'Mughal Gardens (Shalimar, Nishat, Chashme Shahi)', type: 'experience', included: true },
        { title: 'Old city walk: Jama Masjid & artisan quarter', type: 'experience', included: true },
        { title: 'Papier-mâché workshop with master craftsman', type: 'experience', included: true },
      ]},
      { day: 3, title: 'Dal Lake at Dawn', location: 'Srinagar', activities: [
        { title: 'Floating vegetable market at dawn', type: 'experience', included: true },
        { title: 'Pampore saffron fields (seasonal)', type: 'experience', included: true },
        { title: 'Transfer to Gulmarg', type: 'transfer', included: true },
      ]},
      { day: 4, title: 'The Meadow', location: 'Gulmarg', activities: [
        { title: 'Check-in at Khyber Resort', type: 'check-in', included: true },
        { title: 'Gondola ride to Apharwat peak (phase I)', type: 'experience', included: true },
        { title: 'High altitude meadow walk', type: 'experience', included: true },
      ]},
      { day: 5, title: 'Sonamarg', location: 'Sonamarg', activities: [
        { title: 'Transfer to Sonamarg', type: 'transfer', included: true },
        { title: 'Thajiwas glacier excursion by pony', type: 'experience', included: true },
        { title: 'Picnic lunch by the Sindh River', type: 'meal', included: true },
      ]},
      { day: 6, title: 'Back to Srinagar', location: 'Srinagar', activities: [
        { title: 'Return transfer to Srinagar', type: 'transfer', included: true },
        { title: 'Evening at leisure on Dal Lake', type: 'free', included: true },
      ]},
      { day: 7, title: 'Departure', location: 'Srinagar', activities: [
        { title: 'Private airport transfer and departure', type: 'transfer', included: true },
      ]},
    ],
    highlights: [
      { title: 'Floating Market at Dawn', description: 'The vegetable market on Dal Lake comes alive before sunrise — an utterly otherworldly sight.' },
      { title: 'Khyber Resort, Gulmarg', description: 'Among the finest mountain resorts in Asia, set at 2,690m with Himalayan panoramas.' },
    ],
    inclusions: ['All accommodation', 'Daily breakfast + selected meals', 'All private transfers', 'Gondola tickets (Phase I)', 'Expert local guide throughout', '24/7 concierge'],
    exclusions: ['Flights to/from Srinagar', 'Optional gondola Phase II', 'Pony charges', 'Personal shopping'],
    tagline: 'Kashmir as it was always meant to be seen.',
    travelStyle: 'Mountain Escape',
  },

  {
    id: 'pkg-goa-beyond',
    region: 'india',
    title: 'Goa Beyond the Beach',
    subtitle: 'Portuguese heritage, spice trails and private villa living',
    destination: 'Goa, India',
    destinations: ['North Goa', 'Panjim', 'South Goa'],
    route: ['Goa Airport', 'North Goa', 'Panjim', 'South Goa', 'Goa Airport'],
    nights: 5,
    days: 6,
    categories: ['culture', 'culinary', 'wellness'],
    badge: 'Curated',
    pricePerPerson: 98000,
    currency: 'INR',
    accommodation: 'ultra-luxury',
    transport: 'private',
    experienceCount: 4,
    visaRequired: false,
    bestSeason: 'Nov – Feb',
    pace: 'slow',
    imageUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [],
    stops: [
      { city: 'North Goa', nights: 2, hotel: 'Park Hyatt Goa Resort', roomType: 'Pool Villa' },
      { city: 'South Goa', nights: 3, hotel: 'Taj Exotica Goa', roomType: 'Deluxe Lagoon Room' },
    ],
    itinerary: [
      { day: 1, title: 'Arrival', location: 'North Goa', activities: [
        { title: 'Private airport transfer', type: 'transfer', included: true },
        { title: 'Check-in at Park Hyatt Pool Villa', type: 'check-in', included: true },
      ]},
      { day: 2, title: 'Old Goa & Spice Trail', location: 'Panjim', activities: [
        { title: 'Old Goa Basilica private morning tour', type: 'experience', included: true },
        { title: 'Fontainhas heritage walk with a local historian', type: 'experience', included: true },
        { title: 'Spice plantation visit and traditional Goan lunch', type: 'meal', included: true },
      ]},
      { day: 3, title: 'Goa\'s Hidden Villages', location: 'North Goa', activities: [
        { title: 'Bicycle ride through rice paddies and coconut groves', type: 'experience', included: true },
        { title: 'Private Goan cooking class', type: 'experience', included: true },
      ]},
      { day: 4, title: 'South Goa', location: 'South Goa', activities: [
        { title: 'Private transfer to Taj Exotica', type: 'transfer', included: true },
        { title: 'Check-in and spa afternoon', type: 'check-in', included: true },
      ]},
      { day: 5, title: 'The Southern Coast', location: 'South Goa', activities: [
        { title: 'Sunrise beach yoga session', type: 'experience', included: true },
        { title: 'Dudhsagar Waterfall excursion', type: 'experience', included: true },
        { title: 'Farewell seafood dinner on the beach', type: 'meal', included: true },
      ]},
      { day: 6, title: 'Departure', location: 'Goa Airport', activities: [
        { title: 'Private airport transfer', type: 'transfer', included: true },
      ]},
    ],
    highlights: [
      { title: 'Pool Villa Living', description: 'Your private pool villa at Park Hyatt — not a room, an address.' },
      { title: 'Fontainhas Heritage Walk', description: 'The only Latin quarter in India, guided by someone who grew up here.' },
    ],
    inclusions: ['All accommodation', 'Daily breakfast + 2 dinners', 'All private transfers', 'Guided heritage and spice trail experiences', 'Yoga session', '24/7 concierge'],
    exclusions: ['Flights', 'Spa treatments', 'Personal shopping', 'Alcoholic beverages'],
    tagline: 'Goa without the crowds. With all the character.',
    travelStyle: 'Cultural & Culinary',
  },

  {
    id: 'pkg-ladakh-expedition',
    region: 'india',
    title: 'Ladakh Expedition',
    subtitle: 'The roof of the world, at a pace that lets you breathe it in',
    destination: 'Ladakh, India',
    destinations: ['Leh', 'Nubra Valley', 'Pangong Tso'],
    route: ['Leh', 'Khardung La', 'Nubra Valley', 'Pangong Lake', 'Leh'],
    nights: 7,
    days: 8,
    categories: ['adventure', 'culture'],
    badge: 'Exclusive',
    pricePerPerson: 155000,
    currency: 'INR',
    accommodation: 'luxury',
    transport: 'private',
    experienceCount: 6,
    visaRequired: false,
    bestSeason: 'Jun – Sep',
    pace: 'active',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [],
    stops: [
      { city: 'Leh', nights: 3, hotel: 'The Chamba Camp Thiksey', roomType: 'Luxury Tent' },
      { city: 'Nubra Valley', nights: 2, hotel: 'Desert Himalaya Resort', roomType: 'Premium Tent' },
      { city: 'Pangong Lake', nights: 2, hotel: 'Pangong Sarai Camp', roomType: 'Luxury Suite Tent' },
    ],
    itinerary: [
      { day: 1, title: 'Arrival & Acclimatisation', location: 'Leh', activities: [
        { title: 'Private airport pick-up', type: 'transfer', included: true },
        { title: 'Complete rest for altitude acclimatisation', type: 'free', included: true, notes: 'Mandatory for safety' },
        { title: 'Ayurvedic light dinner', type: 'meal', included: true },
      ]},
      { day: 2, title: 'Leh Palace & Monasteries', location: 'Leh', activities: [
        { title: 'Leh Palace and old town walk', type: 'experience', included: true },
        { title: 'Thiksey Monastery — monk breakfast ritual', type: 'experience', included: true },
        { title: 'Shanti Stupa at sunset', type: 'experience', included: true },
      ]},
      { day: 3, title: 'Into the Mountains', location: 'Leh', activities: [
        { title: 'Magnetic Hill and Hall of Fame museum', type: 'experience', included: true },
        { title: 'Rafting on the Zanskar River (moderate)', type: 'experience', included: true },
      ]},
      { day: 4, title: 'Nubra Valley', location: 'Nubra Valley', activities: [
        { title: 'Drive over Khardung La (world\'s highest motorable pass)', type: 'transfer', included: true },
        { title: 'Double-humped Bactrian camel safari at Hunder', type: 'experience', included: true },
        { title: 'Diskit Monastery', type: 'experience', included: true },
      ]},
      { day: 5, title: 'Desert Silence', location: 'Nubra Valley', activities: [
        { title: 'Early morning meditation in the sand dunes', type: 'experience', included: true },
        { title: 'Transfer to Pangong Lake via Shyok Valley', type: 'transfer', included: true },
        { title: 'First view of Pangong Tso', type: 'free', included: true },
      ]},
      { day: 6, title: 'Pangong at Sunrise', location: 'Pangong Lake', activities: [
        { title: 'Sunrise photography session by the lake', type: 'experience', included: true },
        { title: 'Walk along the lakeside in silence', type: 'free', included: true },
        { title: 'Picnic lunch by the blue-green water', type: 'meal', included: true },
      ]},
      { day: 7, title: 'Return to Leh', location: 'Leh', activities: [
        { title: 'Scenic drive back to Leh via Chang La', type: 'transfer', included: true },
        { title: 'Farewell dinner under the stars', type: 'meal', included: true },
      ]},
      { day: 8, title: 'Departure', location: 'Leh Airport', activities: [
        { title: 'Private airport transfer', type: 'transfer', included: true },
      ]},
    ],
    highlights: [
      { title: 'Pangong Tso at Dawn', description: 'One of the highest saltwater lakes in the world, changing color from turquoise to cobalt as the sun rises.' },
      { title: 'Khardung La', description: 'Crossing the world\'s highest motorable pass at 5,359m — the landscape beyond language.' },
    ],
    inclusions: ['All luxury tent accommodation', 'All meals', 'All private 4WD transfers', 'All experiences and monastery entry fees', 'Acclimatisation guidance from experienced local guide', 'Emergency oxygen and first-aid'],
    exclusions: ['Flights to/from Leh', 'Travel insurance (strongly recommended)', 'Porter charges', 'Personal photography gear'],
    tagline: 'Ladakh is not a destination. It is a state of mind.',
    travelStyle: 'High-Altitude Expedition',
  },

  {
    id: 'pkg-andaman-islands',
    region: 'india',
    title: 'Andaman Private Islands',
    subtitle: 'Glass-clear water, untouched reefs and island solitude',
    destination: 'Andaman Islands, India',
    destinations: ['Port Blair', 'Havelock Island', 'Neil Island'],
    route: ['Port Blair', 'Havelock Island', 'Neil Island', 'Port Blair'],
    nights: 6,
    days: 7,
    categories: ['beach', 'wellness', 'private'],
    badge: 'Private',
    pricePerPerson: 135000,
    currency: 'INR',
    accommodation: 'ultra-luxury',
    transport: 'private',
    experienceCount: 5,
    visaRequired: false,
    bestSeason: 'Nov – May',
    pace: 'slow',
    imageUrl: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [],
    stops: [
      { city: 'Havelock Island', nights: 4, hotel: 'Barefoot at Havelock', roomType: 'Beach Villa' },
      { city: 'Neil Island', nights: 2, hotel: 'Summer Sand Beach Resort', roomType: 'Ocean View Suite' },
    ],
    itinerary: [
      { day: 1, title: 'Arrival in Andaman', location: 'Port Blair', activities: [
        { title: 'Private airport transfer', type: 'transfer', included: true },
        { title: 'Cellular Jail evening light and sound show', type: 'experience', included: true },
      ]},
      { day: 2, title: 'Havelock', location: 'Havelock Island', activities: [
        { title: 'Private ferry to Havelock Island', type: 'transfer', included: true },
        { title: 'Check-in at Barefoot Resort beach villa', type: 'check-in', included: true },
        { title: 'Radhanagar Beach evening walk', type: 'free', included: true },
      ]},
      { day: 3, title: 'Beneath the Surface', location: 'Havelock Island', activities: [
        { title: 'Private guided scuba dive at Elephant Beach', type: 'experience', included: true },
        { title: 'Glass-bottom boat tour of coral gardens', type: 'experience', included: true },
      ]},
      { day: 4, title: 'Island Time', location: 'Havelock Island', activities: [
        { title: 'Sea kayaking through mangroves at dawn', type: 'experience', included: true },
        { title: 'Private beach picnic lunch', type: 'meal', included: true },
        { title: 'Sunset at Kalapathar Beach', type: 'free', included: true },
      ]},
      { day: 5, title: 'Neil Island', location: 'Neil Island', activities: [
        { title: 'Transfer to Neil Island by private speedboat', type: 'transfer', included: true },
        { title: 'Snorkelling at Bharatpur Beach', type: 'experience', included: true },
        { title: 'Sunset at Laxmanpur Beach', type: 'free', included: true },
      ]},
      { day: 6, title: 'Final Day', location: 'Neil Island', activities: [
        { title: 'Morning yoga on the beach', type: 'experience', included: true },
        { title: 'Leisurely last day', type: 'free', included: true },
      ]},
      { day: 7, title: 'Departure', location: 'Port Blair', activities: [
        { title: 'Transfer to Port Blair airport', type: 'transfer', included: true },
      ]},
    ],
    highlights: [
      { title: 'Elephant Beach Dive', description: 'Andaman\'s coral is among the most pristine in India. A private dive guide ensures you see the best of it.' },
      { title: 'Radhanagar Beach', description: 'Consistently ranked among Asia\'s finest beaches. In a beach villa that opens directly onto the sand.' },
    ],
    inclusions: ['All beach accommodation', 'Daily breakfast + beach picnic lunch (Day 4)', 'All private island transfers', 'Scuba dive with equipment', 'Kayaking and snorkelling', '24/7 concierge'],
    exclusions: ['Flights to/from Port Blair', 'Additional dive sessions', 'Water sports not included in package'],
    tagline: 'Islands where the water is clearer than glass and the silence is complete.',
    travelStyle: 'Island Escape',
  },
];

// ─── International Packages ───────────────────────────────────────────────────

export const internationalPackages: LuxuryPackage[] = [
  {
    id: 'pkg-maldives-reset',
    region: 'international',
    title: 'Maldives — Private Island Reset',
    subtitle: 'Overwater villas, coral atolls and deliberate disconnection',
    destination: 'Maldives',
    destinations: ['Malé', 'North Malé Atoll'],
    route: ['Malé', 'Seaplane', 'Resort Island'],
    nights: 5,
    days: 6,
    categories: ['beach', 'wellness', 'honeymoon'],
    badge: 'Private',
    pricePerPerson: 385000,
    currency: 'INR',
    accommodation: 'ultra-luxury',
    transport: 'private',
    experienceCount: 4,
    visaRequired: false,
    visaType: 'on-arrival',
    bestSeason: 'Nov – Apr',
    pace: 'slow',
    imageUrl: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [
      'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&h=600&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=800&h=600&fit=crop&auto=format',
    ],
    stops: [
      { city: 'North Malé Atoll', nights: 5, hotel: 'Four Seasons Resort Maldives at Landaa Giraavaru', roomType: 'Overwater Bungalow' },
    ],
    itinerary: [
      { day: 1, title: 'Arrival & Transfer', location: 'Malé', activities: [
        { title: 'Meet and greet at Velana International Airport', type: 'transfer', included: true },
        { title: 'Private seaplane transfer (approx. 35 min)', type: 'transfer', included: true, notes: 'Scenic low-altitude flight over the atolls' },
        { title: 'Check-in at your overwater bungalow', type: 'check-in', included: true },
        { title: 'Welcome dinner by the lagoon', type: 'meal', included: true },
      ]},
      { day: 2, title: 'The Lagoon', location: 'Maldives', activities: [
        { title: 'Guided snorkelling on the house reef', type: 'experience', included: true },
        { title: 'Sunset dolphin cruise by private dhoni', type: 'experience', included: true },
      ]},
      { day: 3, title: 'Spa & Sea', location: 'Maldives', activities: [
        { title: 'Private overwater spa session (2 hrs)', type: 'experience', included: true },
        { title: 'Marine biologist-led reef ecology tour', type: 'experience', included: true },
      ]},
      { day: 4, title: 'Discover the Atoll', location: 'Maldives', activities: [
        { title: 'Excursion to uninhabited sandbar for private picnic', type: 'experience', included: true },
        { title: 'Night snorkelling with bioluminescent plankton', type: 'experience', included: true },
      ]},
      { day: 5, title: 'Final Day', location: 'Maldives', activities: [
        { title: 'Sunrise yoga on the deck', type: 'experience', included: true },
        { title: 'Last afternoon at leisure', type: 'free', included: true },
      ]},
      { day: 6, title: 'Departure', location: 'Malé', activities: [
        { title: 'Seaplane back to Malé and international departure', type: 'transfer', included: true },
      ]},
    ],
    highlights: [
      { title: 'Overwater Bungalow', description: 'Glass-floor panels. Direct lagoon access from your deck. The Indian Ocean as your backdrop.' },
      { title: 'Sandbar Picnic', description: 'A private island, a table set by your butler, and nothing else for miles.' },
    ],
    inclusions: ['Overwater bungalow accommodation', 'Daily full board (all meals)', 'Return seaplane transfers from Malé', 'One overwater spa session (2 hrs)', 'All guided snorkelling and marine experiences', 'Non-motorised water sports', 'Butler service throughout'],
    exclusions: ['International flights to/from Malé', 'Motorised water sports', 'Diving courses', 'Alcohol (available at charge)', 'Personal shopping'],
    tagline: 'The Maldives you imagined. As close to that as the world gets.',
    travelStyle: 'Island Luxury',
    visaNote: 'Visa on arrival for Indian passport holders. Valid for 30 days. No prior application required.',
  },

  {
    id: 'pkg-japan-tokyo-kyoto',
    region: 'international',
    title: 'Japan — Tokyo to Kyoto',
    subtitle: 'The journey between Japan\'s two defining cities, at the right pace',
    destination: 'Japan',
    destinations: ['Tokyo', 'Hakone', 'Kyoto'],
    route: ['Tokyo', 'Hakone', 'Kyoto'],
    nights: 9,
    days: 10,
    categories: ['culture', 'culinary', 'private'],
    badge: 'Signature',
    pricePerPerson: 295000,
    currency: 'INR',
    accommodation: 'ultra-luxury',
    transport: 'private',
    experienceCount: 8,
    visaRequired: true,
    visaType: 'e-visa',
    bestSeason: 'Mar – May & Oct – Nov',
    pace: 'moderate',
    imageUrl: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [
      'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&h=600&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&h=600&fit=crop&auto=format',
    ],
    stops: [
      { city: 'Tokyo', nights: 4, hotel: 'Park Hyatt Tokyo', roomType: 'Park Room' },
      { city: 'Hakone', nights: 2, hotel: 'Gora Kadan Ryokan', roomType: 'Deluxe Japanese Suite' },
      { city: 'Kyoto', nights: 3, hotel: 'The Ritz-Carlton Kyoto', roomType: 'Premier Kamogawa River View' },
    ],
    itinerary: [
      { day: 1, title: 'Arrival in Tokyo', location: 'Tokyo', activities: [
        { title: 'Private airport transfer from Narita/Haneda', type: 'transfer', included: true },
        { title: 'Check-in at Park Hyatt Tokyo', type: 'check-in', included: true },
        { title: 'Welcome dinner at New York Bar with skyline views', type: 'meal', included: true },
      ]},
      { day: 2, title: 'Tokyo Modern', location: 'Tokyo', activities: [
        { title: 'Shibuya, Harajuku and Omotesando private walk', type: 'experience', included: true },
        { title: 'teamLab Borderless (pre-booked priority entry)', type: 'experience', included: true },
        { title: 'Omakase dinner at a Michelin-starred sushi counter', type: 'meal', included: true },
      ]},
      { day: 3, title: 'Tokyo Ancient', location: 'Tokyo', activities: [
        { title: 'Sensoji Temple at dawn — before the crowds', type: 'experience', included: true },
        { title: 'Tsukiji outer market breakfast tour', type: 'experience', included: true },
        { title: 'Yanaka old town walking tour', type: 'experience', included: true },
      ]},
      { day: 4, title: 'Tokyo Free Day', location: 'Tokyo', activities: [
        { title: 'Day at leisure to explore independently', type: 'free', included: true },
        { title: 'Optional: Nikko day trip (supplement applies)', type: 'free', included: false },
      ]},
      { day: 5, title: 'Hakone', location: 'Hakone', activities: [
        { title: 'Private transfer to Hakone', type: 'transfer', included: true },
        { title: 'Ryokan check-in and afternoon onsen', type: 'check-in', included: true },
        { title: 'Traditional kaiseki dinner', type: 'meal', included: true },
      ]},
      { day: 6, title: 'Fuji Views', location: 'Hakone', activities: [
        { title: 'Private tea ceremony with a certified master', type: 'experience', included: true },
        { title: 'Hakone Open-Air Museum', type: 'experience', included: true },
        { title: 'Morning onsen at the ryokan', type: 'free', included: true },
      ]},
      { day: 7, title: 'Kyoto — The Ancient Capital', location: 'Kyoto', activities: [
        { title: 'Shinkansen transfer Hakone → Kyoto', type: 'transfer', included: true },
        { title: 'Check-in at Ritz-Carlton Kyoto', type: 'check-in', included: true },
        { title: 'Evening stroll in Gion — lantern light and wooden machiya', type: 'free', included: true },
      ]},
      { day: 8, title: 'Arashiyama & Nishiki', location: 'Kyoto', activities: [
        { title: 'Bamboo grove at dawn — private guide', type: 'experience', included: true },
        { title: 'Tenryu-ji Zen garden', type: 'experience', included: true },
        { title: 'Nishiki Market food walk', type: 'experience', included: true },
      ]},
      { day: 9, title: 'Temples & Tea', location: 'Kyoto', activities: [
        { title: 'Fushimi Inari — early morning ascent', type: 'experience', included: true },
        { title: 'Uji — Matcha tea experience at source', type: 'experience', included: true },
        { title: 'Farewell kaiseki dinner', type: 'meal', included: true },
      ]},
      { day: 10, title: 'Departure', location: 'Osaka/Kyoto', activities: [
        { title: 'Transfer to Osaka KIX or Kyoto Station', type: 'transfer', included: true },
      ]},
    ],
    highlights: [
      { title: 'Gora Kadan Ryokan', description: 'One of Japan\'s finest traditional inns. Private onsen, kaiseki dinner, and views of the Hakone mountains.' },
      { title: 'Omakase Dinner', description: 'A pre-booked counter seat at a Michelin-starred sushi counter in Shinjuku. The chef decides what you eat — trust it.' },
    ],
    inclusions: ['All accommodation (ultra-luxury)', 'Omakase dinner in Tokyo', 'Kaiseki dinners at the ryokan and Kyoto farewell', 'All private transfers including Shinkansen', 'All guided cultural experiences', 'TeamLab priority entry', 'Tea ceremony', '24/7 concierge'],
    exclusions: ['International flights India → Tokyo / Osaka → India', 'Japan Tourist Visa (we assist with application)', 'Personal shopping', 'Additional meals', 'Nikko day trip'],
    tagline: 'Tokyo for contrast. Hakone for stillness. Kyoto for meaning.',
    travelStyle: 'Cultural Immersion',
    visaNote: 'Japan Tourist Visa required for Indian passport holders. e-Visa available. Processing: 5–7 working days. We assist with documentation.',
  },

  {
    id: 'pkg-italy-dolcevita',
    region: 'international',
    title: 'Italy — La Dolce Vita',
    subtitle: 'Rome, Tuscany and the Amalfi Coast — Italy\'s perfect arc',
    destination: 'Italy',
    destinations: ['Rome', 'Tuscany', 'Positano'],
    route: ['Rome', 'Florence', 'Siena', 'Positano'],
    nights: 10,
    days: 11,
    categories: ['culture', 'culinary', 'honeymoon'],
    badge: 'Curated',
    pricePerPerson: 345000,
    currency: 'INR',
    accommodation: 'ultra-luxury',
    transport: 'private',
    experienceCount: 7,
    visaRequired: true,
    visaType: 'required',
    bestSeason: 'Apr – Jun & Sep – Oct',
    pace: 'moderate',
    imageUrl: 'https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [],
    stops: [
      { city: 'Rome', nights: 3, hotel: 'Hotel de Russie', roomType: 'Deluxe Room' },
      { city: 'Tuscany', nights: 4, hotel: 'Borgo San Felice', roomType: 'Suite' },
      { city: 'Positano', nights: 3, hotel: 'Il San Pietro di Positano', roomType: 'Junior Suite Sea View' },
    ],
    itinerary: [
      { day: 1, title: 'Roma', location: 'Rome', activities: [
        { title: 'Private transfer from airport', type: 'transfer', included: true },
        { title: 'Check-in at Hotel de Russie', type: 'check-in', included: true },
        { title: 'Evening aperitivo and dinner in Trastevere', type: 'meal', included: true },
      ]},
      { day: 2, title: 'The Eternal City', location: 'Rome', activities: [
        { title: 'Private Vatican Museums with skip-the-line access', type: 'experience', included: true },
        { title: 'Colosseum and Roman Forum private tour', type: 'experience', included: true },
        { title: 'Dinner at a Via della Croce osteria', type: 'meal', included: true },
      ]},
      { day: 3, title: 'Rome at Own Pace', location: 'Rome', activities: [
        { title: 'Morning at leisure', type: 'free', included: true },
        { title: 'Transfer to Florence by private car', type: 'transfer', included: true },
        { title: 'Check-in at Borgo San Felice estate', type: 'check-in', included: true },
      ]},
      { day: 4, title: 'Tuscany', location: 'Tuscany', activities: [
        { title: 'Private winery tour and wine tasting at a Chianti estate', type: 'experience', included: true },
        { title: 'Cooking class with a Florentine chef', type: 'experience', included: true },
      ]},
      { day: 5, title: 'Florence', location: 'Florence', activities: [
        { title: 'Uffizi Gallery private morning tour', type: 'experience', included: true },
        { title: 'Oltrarno artisan quarter walk', type: 'experience', included: true },
      ]},
      { day: 6, title: 'Siena & San Gimignano', location: 'Tuscany', activities: [
        { title: 'Private day tour of Siena and San Gimignano', type: 'experience', included: true },
        { title: 'Piazza del Campo lunch', type: 'meal', included: true },
      ]},
      { day: 7, title: 'Tuscan Hills', location: 'Tuscany', activities: [
        { title: 'Truffle hunting with a local hunter and his dogs', type: 'experience', included: true },
        { title: 'Estate dinner using foraged ingredients', type: 'meal', included: true },
      ]},
      { day: 8, title: 'South to the Coast', location: 'Positano', activities: [
        { title: 'Private transfer to Positano (with Pompeii stop)', type: 'transfer', included: true },
        { title: 'Check-in at Il San Pietro', type: 'check-in', included: true },
      ]},
      { day: 9, title: 'Amalfi by Boat', location: 'Positano', activities: [
        { title: 'Private motorboat tour of the Amalfi Coast', type: 'experience', included: true },
        { title: 'Lunch in Ravello', type: 'meal', included: true },
      ]},
      { day: 10, title: 'Final Day', location: 'Positano', activities: [
        { title: 'Morning at leisure on the cliff terraces', type: 'free', included: true },
        { title: 'Farewell dinner with sea views', type: 'meal', included: true },
      ]},
      { day: 11, title: 'Departure', location: 'Naples', activities: [
        { title: 'Transfer to Naples airport', type: 'transfer', included: true },
      ]},
    ],
    highlights: [
      { title: 'Borgo San Felice', description: 'A medieval hamlet converted into a Relais & Châteaux property in the Chianti hills. Surrounded by olive groves and vineyards.' },
      { title: 'Truffle Hunting', description: 'Deep in the Tuscan woods with a local trufaraio and his trained dogs. Dinner that night uses what you find.' },
    ],
    inclusions: ['All accommodation', 'Selected meals as per itinerary', 'All private transfers', 'All guided experiences (Vatican, Uffizi, Colosseum)', 'Private boat tour, Amalfi Coast', 'Cooking class and truffle hunt', '24/7 concierge'],
    exclusions: ['International flights', 'Schengen Visa (we assist)', 'Personal shopping', 'Additional meals', 'Spa treatments'],
    tagline: 'Rome for history. Tuscany for the table. Positano for beauty.',
    travelStyle: 'Cultural & Culinary',
    visaNote: 'Schengen Visa required for Indian passport holders. Apply at the Italian Consulate. Processing: 10–15 working days.',
  },

  {
    id: 'pkg-switzerland-alpine',
    region: 'international',
    title: 'Switzerland — Alpine Grand Tour',
    subtitle: 'Zürich, the Bernese Oberland and the Glacier Express',
    destination: 'Switzerland',
    destinations: ['Zürich', 'Interlaken', 'Zermatt', 'St. Moritz'],
    route: ['Zürich', 'Interlaken', 'Zermatt', 'St. Moritz', 'Zürich'],
    nights: 8,
    days: 9,
    categories: ['adventure', 'wellness', 'private'],
    badge: 'Signature',
    pricePerPerson: 465000,
    currency: 'INR',
    accommodation: 'ultra-luxury',
    transport: 'private',
    experienceCount: 6,
    visaRequired: true,
    visaType: 'required',
    bestSeason: 'Dec – Mar & Jun – Sep',
    pace: 'moderate',
    imageUrl: 'https://images.unsplash.com/photo-1531168556467-80aace0d0144?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [],
    stops: [
      { city: 'Interlaken', nights: 2, hotel: 'Victoria-Jungfrau Grand Hotel', roomType: 'Grand Hotel Room' },
      { city: 'Zermatt', nights: 3, hotel: 'The Omnia', roomType: 'Matterhorn View Suite' },
      { city: 'St. Moritz', nights: 3, hotel: 'Badrutt\'s Palace Hotel', roomType: 'Superior Room' },
    ],
    itinerary: [
      { day: 1, title: 'Zürich Arrival', location: 'Zürich', activities: [
        { title: 'Private transfer from airport', type: 'transfer', included: true },
        { title: 'Day exploring Zürich city (own pace)', type: 'free', included: true },
        { title: 'Transfer to Interlaken by private car', type: 'transfer', included: true },
      ]},
      { day: 2, title: 'Jungfraujoch', location: 'Interlaken', activities: [
        { title: 'Jungfraujoch — Top of Europe excursion', type: 'experience', included: true },
        { title: 'Mountain lunch with panoramic views', type: 'meal', included: true },
      ]},
      { day: 3, title: 'Lakes of the Oberland', location: 'Interlaken', activities: [
        { title: 'Lake Brienz boat cruise', type: 'experience', included: true },
        { title: 'Transfer to Zermatt', type: 'transfer', included: true },
        { title: 'Check-in at The Omnia', type: 'check-in', included: true },
      ]},
      { day: 4, title: 'Matterhorn', location: 'Zermatt', activities: [
        { title: 'Klein Matterhorn — Glacier Paradise cable car', type: 'experience', included: true },
        { title: 'Glacier hike with a certified mountain guide', type: 'experience', included: true },
      ]},
      { day: 5, title: 'Zermatt at Leisure', location: 'Zermatt', activities: [
        { title: 'Morning spa at The Omnia', type: 'free', included: true },
        { title: 'Gorner Gorge walk', type: 'experience', included: true },
        { title: 'Fondue dinner at a mountain hut', type: 'meal', included: true },
      ]},
      { day: 6, title: 'Glacier Express', location: 'St. Moritz', activities: [
        { title: 'Private Glacier Express journey Zermatt → St. Moritz', type: 'transfer', included: true },
        { title: 'Check-in at Badrutt\'s Palace', type: 'check-in', included: true },
      ]},
      { day: 7, title: 'Engadin Valley', location: 'St. Moritz', activities: [
        { title: 'Lake St. Moritz walk and Segantini Museum', type: 'experience', included: true },
        { title: 'Helicopter tour over the Engadin (supplement)', type: 'free', included: false },
      ]},
      { day: 8, title: 'St. Moritz', location: 'St. Moritz', activities: [
        { title: 'Spa afternoon', type: 'free', included: true },
        { title: 'Farewell dinner at Badrutt\'s', type: 'meal', included: true },
      ]},
      { day: 9, title: 'Departure', location: 'Zürich', activities: [
        { title: 'Transfer to Zürich airport', type: 'transfer', included: true },
      ]},
    ],
    highlights: [
      { title: 'Glacier Express', description: 'Eight hours through 291 bridges and 91 tunnels. The most scenic rail journey in Europe, in a first-class panorama car.' },
      { title: 'The Omnia, Zermatt', description: 'Carved into the rock above Zermatt with unobstructed Matterhorn views. Reached by tunnel elevator from the village.' },
    ],
    inclusions: ['All accommodation', 'Daily breakfast + selected dinners', 'Private Glacier Express (first class)', 'Jungfraujoch excursion', 'Glacier hike', 'Mountain guide throughout', 'All private transfers', '24/7 concierge'],
    exclusions: ['International flights', 'Schengen Visa (we assist)', 'Helicopter excursion supplement', 'Personal shopping', 'Spa treatments'],
    tagline: 'The Alps, properly. One extraordinary journey across three of Switzerland\'s finest valleys.',
    travelStyle: 'Alpine Luxury',
    visaNote: 'Schengen Visa required. Apply at the Swiss Consulate. Processing: 10–15 working days.',
  },

  {
    id: 'pkg-greece-aegean',
    region: 'international',
    title: 'Greece — Aegean Summer',
    subtitle: 'Athens, Santorini and the turquoise Cyclades',
    destination: 'Greece',
    destinations: ['Athens', 'Santorini', 'Mykonos'],
    route: ['Athens', 'Santorini', 'Mykonos', 'Athens'],
    nights: 8,
    days: 9,
    categories: ['honeymoon', 'culture', 'beach'],
    badge: 'Honeymoon',
    pricePerPerson: 278000,
    currency: 'INR',
    accommodation: 'ultra-luxury',
    transport: 'private',
    experienceCount: 5,
    visaRequired: true,
    visaType: 'required',
    bestSeason: 'May – Oct',
    pace: 'slow',
    imageUrl: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [],
    stops: [
      { city: 'Athens', nights: 2, hotel: 'Hotel Grande Bretagne', roomType: 'Superior Room Acropolis View' },
      { city: 'Santorini', nights: 4, hotel: 'Grace Hotel Auberge Santorini', roomType: 'Grand Suite' },
      { city: 'Mykonos', nights: 2, hotel: 'Santa Marina Resort', roomType: 'Deluxe Bungalow' },
    ],
    itinerary: [
      { day: 1, title: 'Athens Arrival', location: 'Athens', activities: [
        { title: 'Private airport transfer', type: 'transfer', included: true },
        { title: 'Acropolis Museum private evening visit', type: 'experience', included: true },
        { title: 'Dinner with Acropolis views', type: 'meal', included: true },
      ]},
      { day: 2, title: 'The Acropolis', location: 'Athens', activities: [
        { title: 'Private guided Acropolis and Parthenon tour', type: 'experience', included: true },
        { title: 'Plaka neighbourhood walk', type: 'experience', included: true },
        { title: 'Ferry or flight to Santorini', type: 'transfer', included: true },
      ]},
      { day: 3, title: 'Oia Arrival', location: 'Santorini', activities: [
        { title: 'Check-in at Grace Hotel', type: 'check-in', included: true },
        { title: 'Champagne welcome', type: 'meal', included: true },
        { title: 'Oia sunset from the castle ruins', type: 'free', included: true },
      ]},
      { day: 4, title: 'Caldera Sailing', location: 'Santorini', activities: [
        { title: 'Private catamaran day around the caldera', type: 'experience', included: true },
        { title: 'Swim at the Red Beach and White Beach', type: 'free', included: true },
        { title: 'Lunch on board', type: 'meal', included: true },
      ]},
      { day: 5, title: 'Akrotiri & Wine', location: 'Santorini', activities: [
        { title: 'Akrotiri ruins private tour', type: 'experience', included: true },
        { title: 'Santo Wines tasting with vineyard views', type: 'experience', included: true },
      ]},
      { day: 6, title: 'Final Santorini Day', location: 'Santorini', activities: [
        { title: 'Fira to Oia coastal walk', type: 'experience', included: true },
        { title: 'Last sunset at the clifftop', type: 'free', included: true },
      ]},
      { day: 7, title: 'Mykonos', location: 'Mykonos', activities: [
        { title: 'Ferry to Mykonos', type: 'transfer', included: true },
        { title: 'Little Venice evening stroll', type: 'free', included: true },
        { title: 'Dinner at Nobu Mykonos', type: 'meal', included: true },
      ]},
      { day: 8, title: 'Mykonos at Leisure', location: 'Mykonos', activities: [
        { title: 'Morning at Psarou Beach', type: 'free', included: true },
        { title: 'Old Town walking tour', type: 'experience', included: true },
      ]},
      { day: 9, title: 'Departure', location: 'Athens', activities: [
        { title: 'Flight to Athens and international connection', type: 'transfer', included: true },
      ]},
    ],
    highlights: [
      { title: 'Caldera Sailing', description: 'A full day on a private catamaran inside the caldera. Swimming in volcanic water. Lunch at anchor.' },
      { title: 'Grace Hotel, Oia', description: 'The most photographed hotel on Santorini\'s caldera. Views that stop conversation.' },
    ],
    inclusions: ['All accommodation', 'Daily breakfast + selected meals', 'Private caldera sailing day', 'All guided cultural tours', 'All inter-island transfers', '24/7 concierge'],
    exclusions: ['International flights', 'Schengen Visa', 'Mykonos nightlife expenses', 'Spa treatments'],
    tagline: 'The Aegean at its most beautiful, without any of the chaos.',
    travelStyle: 'Mediterranean Romance',
    visaNote: 'Schengen Visa required for Indian passport holders.',
  },

  {
    id: 'pkg-bali-slow-island',
    region: 'international',
    title: 'Bali — The Slow Island',
    subtitle: 'Ubud rice terraces, Seminyak sunsets and a genuine pace of nothing',
    destination: 'Bali, Indonesia',
    destinations: ['Seminyak', 'Ubud', 'Nusa Dua'],
    route: ['Denpasar', 'Seminyak', 'Ubud', 'Nusa Dua', 'Denpasar'],
    nights: 7,
    days: 8,
    categories: ['wellness', 'culture', 'honeymoon'],
    badge: 'Curated',
    pricePerPerson: 145000,
    currency: 'INR',
    accommodation: 'ultra-luxury',
    transport: 'private',
    experienceCount: 6,
    visaRequired: false,
    visaType: 'on-arrival',
    bestSeason: 'Apr – Oct',
    pace: 'slow',
    imageUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [],
    stops: [
      { city: 'Seminyak', nights: 2, hotel: 'The Layar Private Villas', roomType: 'Two-Bedroom Pool Villa' },
      { city: 'Ubud', nights: 3, hotel: 'Komaneka at Bisma', roomType: 'Forest Valley Villa' },
      { city: 'Nusa Dua', nights: 2, hotel: 'Four Seasons Resort Bali at Jimbaran Bay', roomType: 'Jimbaran Pool Villa' },
    ],
    itinerary: [
      { day: 1, title: 'Arrival', location: 'Seminyak', activities: [
        { title: 'Private airport transfer', type: 'transfer', included: true },
        { title: 'Check-in at The Layar villa', type: 'check-in', included: true },
        { title: 'Seminyak beach sunset with cocktails', type: 'free', included: true },
      ]},
      { day: 2, title: 'Seminyak', location: 'Seminyak', activities: [
        { title: 'Private surf lesson (beginner-friendly)', type: 'experience', included: true },
        { title: 'Afternoon spa at Como Shambhala', type: 'experience', included: true },
      ]},
      { day: 3, title: 'Ubud', location: 'Ubud', activities: [
        { title: 'Transfer to Ubud through village roads', type: 'transfer', included: true },
        { title: 'Check-in at Komaneka at Bisma', type: 'check-in', included: true },
        { title: 'Sacred Monkey Forest at dusk', type: 'experience', included: true },
      ]},
      { day: 4, title: 'Tegallalang & Temple', location: 'Ubud', activities: [
        { title: 'Tegallalang rice terrace sunrise walk', type: 'experience', included: true },
        { title: 'Tirta Empul holy springs ritual', type: 'experience', included: true },
        { title: 'Private Balinese cooking class', type: 'experience', included: true },
      ]},
      { day: 5, title: 'Art & Wellness', location: 'Ubud', activities: [
        { title: 'Visit to Neka and ARMA art galleries', type: 'experience', included: true },
        { title: 'Komaneka spa afternoon', type: 'free', included: true },
        { title: 'Traditional Kecak fire dance performance', type: 'experience', included: true },
      ]},
      { day: 6, title: 'Jimbaran', location: 'Nusa Dua', activities: [
        { title: 'Transfer to Four Seasons Jimbaran Bay', type: 'transfer', included: true },
        { title: 'Afternoon at leisure by the ocean', type: 'free', included: true },
        { title: 'Jimbaran Bay seafood dinner on the beach', type: 'meal', included: true },
      ]},
      { day: 7, title: 'Final Day', location: 'Nusa Dua', activities: [
        { title: 'Morning yoga pavilion session', type: 'experience', included: true },
        { title: 'Afternoon at the pool', type: 'free', included: true },
      ]},
      { day: 8, title: 'Departure', location: 'Bali', activities: [
        { title: 'Private airport transfer', type: 'transfer', included: true },
      ]},
    ],
    highlights: [
      { title: 'Tegallalang at Dawn', description: 'The iconic rice terraces in the first light. Before the tour groups. With mist still rising from the valley.' },
      { title: 'Komaneka at Bisma', description: 'A boutique property on Bisma ridge, with jungle valley views from every villa. The pool seems to float in the canopy.' },
    ],
    inclusions: ['All villa accommodation', 'Daily breakfast + beach dinner', 'All private transfers', 'Surf lesson, cooking class, temple ritual', 'Kecak fire dance', '24/7 concierge'],
    exclusions: ['International flights', 'Spa treatments (beyond standard)', 'Personal shopping'],
    tagline: 'Bali as it should be experienced — slowly, privately, without the Instagram queue.',
    travelStyle: 'Island Wellness',
    visaNote: 'Visa on arrival for Indian passport holders. USD 35 fee. Valid 30 days.',
  },

  {
    id: 'pkg-dubai-arabian',
    region: 'international',
    title: 'Dubai — The Modern Arabian Escape',
    subtitle: 'Architecture, desert silence and world-class hospitality',
    destination: 'Dubai, UAE',
    destinations: ['Dubai', 'Desert'],
    route: ['Dubai Airport', 'Downtown', 'Desert Camp', 'Palm Jumeirah'],
    nights: 5,
    days: 6,
    categories: ['adventure', 'culture', 'private'],
    badge: 'Private',
    pricePerPerson: 175000,
    currency: 'INR',
    accommodation: 'ultra-luxury',
    transport: 'private',
    experienceCount: 5,
    visaRequired: true,
    visaType: 'e-visa',
    bestSeason: 'Nov – Mar',
    pace: 'moderate',
    imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [],
    stops: [
      { city: 'Downtown Dubai', nights: 2, hotel: 'Burj Al Arab', roomType: 'Panoramic Suite' },
      { city: 'Dubai Desert', nights: 1, hotel: 'Al Maha Desert Resort', roomType: 'Bedouin Suite' },
      { city: 'Palm Jumeirah', nights: 2, hotel: 'Atlantis The Royal', roomType: 'Signature Suite' },
    ],
    itinerary: [
      { day: 1, title: 'Dubai Arrival', location: 'Dubai', activities: [
        { title: 'VIP airport meet and greet', type: 'transfer', included: true },
        { title: 'Check-in at Burj Al Arab', type: 'check-in', included: true },
        { title: 'Welcome dinner at Al Muntaha restaurant (27th floor)', type: 'meal', included: true },
      ]},
      { day: 2, title: 'The City', location: 'Dubai', activities: [
        { title: 'Burj Khalifa At The Top (levels 124 & 148)', type: 'experience', included: true },
        { title: 'Old Dubai: Gold Souk and Spice Souk with a guide', type: 'experience', included: true },
        { title: 'Dubai Frame sunset visit', type: 'experience', included: true },
      ]},
      { day: 3, title: 'Desert', location: 'Dubai Desert', activities: [
        { title: 'Private transfer to Al Maha Desert Resort', type: 'transfer', included: true },
        { title: 'Camel trek at golden hour', type: 'experience', included: true },
        { title: 'Falconry experience with a master falconer', type: 'experience', included: true },
        { title: 'Dinner under the stars at camp', type: 'meal', included: true },
      ]},
      { day: 4, title: 'Palm', location: 'Palm Jumeirah', activities: [
        { title: 'Return to Dubai, check-in Atlantis The Royal', type: 'transfer', included: true },
        { title: 'Aquaventure Waterpark (included for guests)', type: 'free', included: true },
      ]},
      { day: 5, title: 'Leisure Day', location: 'Palm Jumeirah', activities: [
        { title: 'Private yacht experience in Dubai Marina', type: 'experience', included: true },
        { title: 'Farewell dinner at Heston Blumenthal\'s Dinner', type: 'meal', included: true },
      ]},
      { day: 6, title: 'Departure', location: 'Dubai', activities: [
        { title: 'Private airport transfer and departure', type: 'transfer', included: true },
      ]},
    ],
    highlights: [
      { title: 'Burj Al Arab', description: 'The most recognizable hotel in the world. Your welcome cocktail arrives in a gold-rimmed glass.' },
      { title: 'Al Maha Desert', description: 'A wildlife reserve resort in the heart of the Dubai Desert Conservation Reserve. No city visible. Only sand.' },
    ],
    inclusions: ['All accommodation', 'Daily breakfast + 3 dinners', 'Burj Khalifa priority entry', 'Camel trek and falconry', 'Private yacht', 'All private transfers', '24/7 concierge'],
    exclusions: ['International flights', 'UAE e-Visa (we assist, USD 35–65 approx.)', 'Personal shopping', 'Additional dining'],
    tagline: 'Dubai without the ordinary — the sail, the sands, and the skyline.',
    travelStyle: 'Urban Luxury',
    visaNote: 'UAE Tourist e-Visa required. Valid 30/60 days. We handle the application. Processing: 3–5 working days.',
  },

  {
    id: 'pkg-maldives-honeymoon',
    region: 'international',
    title: 'Maldives — Honeymoon in the Atoll',
    subtitle: 'Seven nights of absolute island privacy',
    destination: 'Maldives',
    destinations: ['South Malé Atoll'],
    route: ['Malé', 'Speedboat', 'Resort'],
    nights: 7,
    days: 8,
    categories: ['honeymoon', 'beach', 'wellness'],
    badge: 'Honeymoon',
    pricePerPerson: 420000,
    currency: 'INR',
    accommodation: 'ultra-luxury',
    transport: 'private',
    experienceCount: 5,
    visaRequired: false,
    visaType: 'on-arrival',
    bestSeason: 'Nov – Apr',
    pace: 'slow',
    imageUrl: 'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [],
    stops: [{ city: 'South Malé Atoll', nights: 7, hotel: 'Anantara Veli Maldives Resort', roomType: 'Over Water Bungalow' }],
    itinerary: [
      { day: 1, title: 'Arrival', location: 'Maldives', activities: [
        { title: 'Meet at Malé airport', type: 'transfer', included: true },
        { title: 'Speedboat transfer to Anantara Veli', type: 'transfer', included: true },
        { title: 'Honeymoon welcome — champagne, flowers, private turndown', type: 'meal', included: true },
      ]},
      { day: 2, title: 'The Lagoon', location: 'Maldives', activities: [
        { title: 'House reef snorkelling', type: 'experience', included: true },
        { title: 'Couples overwater spa journey (2.5 hrs)', type: 'experience', included: true },
      ]},
      { day: 3, title: 'Sandbank Day', location: 'Maldives', activities: [
        { title: 'Deserted sandbank picnic by private dhoni', type: 'experience', included: true },
        { title: 'Sunset dolphin cruise', type: 'experience', included: true },
      ]},
      { day: 4, title: 'Dive Day', location: 'Maldives', activities: [
        { title: 'Guided scuba dive on the outer reef (PADI certified)', type: 'experience', included: true },
        { title: 'Overwater dining — private candlelight dinner on your deck', type: 'meal', included: true },
      ]},
      { day: 5, title: 'Island Retreat', location: 'Maldives', activities: [
        { title: 'Breakfast on your deck in bed', type: 'meal', included: true },
        { title: 'Afternoon at complete leisure', type: 'free', included: true },
        { title: 'Couple\'s cooking class — Maldivian cuisine', type: 'experience', included: true },
      ]},
      { day: 6, title: 'Penultimate Day', location: 'Maldives', activities: [
        { title: 'Mangrove kayaking', type: 'experience', included: true },
        { title: 'Farewell private beach dinner', type: 'meal', included: true },
      ]},
      { day: 7, title: 'Last Morning', location: 'Maldives', activities: [
        { title: 'Final sunrise from your bungalow deck', type: 'free', included: true },
      ]},
      { day: 8, title: 'Departure', location: 'Malé', activities: [
        { title: 'Speedboat to Malé and international departure', type: 'transfer', included: true },
      ]},
    ],
    highlights: [
      { title: 'Private Overwater Bungalow', description: 'The water beneath you. The sky above. Your own steps into the lagoon.' },
      { title: 'Sandbank Picnic', description: 'A table, two chairs, the Indian Ocean and nothing else.' },
    ],
    inclusions: ['7 nights overwater bungalow', 'All meals full board', 'Speedboat transfers', 'Couples spa session', 'Sandbank picnic', 'Scuba dive', 'Private deck dinner', '24/7 concierge'],
    exclusions: ['Flights to Malé', 'Additional spa sessions', 'Water sports equipment rental'],
    tagline: 'A week with nowhere to be. Just each other and the Indian Ocean.',
    travelStyle: 'Honeymoon',
    visaNote: 'Visa on arrival, free for Indian passport holders.',
  },

  {
    id: 'pkg-thailand-andaman',
    region: 'international',
    title: 'Thailand — Andaman Private Escape',
    subtitle: 'Koh Lanta, Koh Yao Noi and the limestone karsts of Phang Nga',
    destination: 'Thailand',
    destinations: ['Phuket', 'Koh Yao Noi', 'Koh Lanta'],
    route: ['Phuket', 'Koh Yao Noi', 'Koh Lanta', 'Phuket'],
    nights: 7,
    days: 8,
    categories: ['beach', 'wellness', 'adventure'],
    badge: 'Private',
    pricePerPerson: 168000,
    currency: 'INR',
    accommodation: 'ultra-luxury',
    transport: 'private',
    experienceCount: 5,
    visaRequired: false,
    visaType: 'on-arrival',
    bestSeason: 'Nov – Apr',
    pace: 'slow',
    imageUrl: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1200&h=800&fit=crop&auto=format',
    galleryImages: [],
    stops: [
      { city: 'Koh Yao Noi', nights: 3, hotel: 'Six Senses Yao Noi', roomType: 'Pool Villa' },
      { city: 'Koh Lanta', nights: 4, hotel: 'Pimalai Resort', roomType: 'Villa Suite' },
    ],
    itinerary: [
      { day: 1, title: 'Arrival in Phuket', location: 'Phuket', activities: [
        { title: 'Airport transfer to the marina', type: 'transfer', included: true },
        { title: 'Private speedboat to Six Senses Yao Noi', type: 'transfer', included: true },
        { title: 'Check-in and welcome dinner', type: 'meal', included: true },
      ]},
      { day: 2, title: 'Phang Nga Bay', location: 'Koh Yao Noi', activities: [
        { title: 'Kayaking through limestone caves and lagoons', type: 'experience', included: true },
        { title: 'Private longtail tour of James Bond Island', type: 'experience', included: true },
      ]},
      { day: 3, title: 'Yao Noi', location: 'Koh Yao Noi', activities: [
        { title: 'Six Senses Spa signature treatment', type: 'experience', included: true },
        { title: 'Village cycling and local fish market', type: 'experience', included: true },
      ]},
      { day: 4, title: 'Koh Lanta', location: 'Koh Lanta', activities: [
        { title: 'Private speedboat transfer to Koh Lanta', type: 'transfer', included: true },
        { title: 'Check-in at Pimalai Resort', type: 'check-in', included: true },
      ]},
      { day: 5, title: 'Marine Park', location: 'Koh Lanta', activities: [
        { title: 'Koh Lanta Marine Park snorkelling excursion', type: 'experience', included: true },
        { title: 'Cave Beach picnic lunch', type: 'meal', included: true },
      ]},
      { day: 6, title: 'Island Life', location: 'Koh Lanta', activities: [
        { title: 'Muay Thai morning class', type: 'experience', included: true },
        { title: 'Old Town Lanta walk', type: 'experience', included: true },
        { title: 'Farewell dinner', type: 'meal', included: true },
      ]},
      { day: 7, title: 'Final Day', location: 'Koh Lanta', activities: [
        { title: 'Sunrise beach meditation', type: 'free', included: true },
        { title: 'Afternoon at leisure', type: 'free', included: true },
      ]},
      { day: 8, title: 'Departure', location: 'Phuket', activities: [
        { title: 'Speedboat back to Phuket and transfer to airport', type: 'transfer', included: true },
      ]},
    ],
    highlights: [
      { title: 'Six Senses Yao Noi', description: 'The finest resort in the Phang Nga Bay. Limestone karsts as the backdrop, and the Andaman stretching to the horizon.' },
      { title: 'Limestone Caves', description: 'Kayaking through sea caves and hidden lagoons accessible only at certain tide heights.' },
    ],
    inclusions: ['All accommodation', 'Daily breakfast + 2 dinners', 'All private speedboat transfers', 'Six Senses Spa treatment', 'Kayaking, snorkelling, Marine Park', '24/7 concierge'],
    exclusions: ['International flights', 'Additional spa sessions', 'Personal shopping'],
    tagline: 'The Thailand the guidebooks don\'t always find.',
    travelStyle: 'Island Discovery',
    visaNote: 'Visa on arrival for Indian passport holders. Free, valid 30 days.',
  },
];

// ─── Combined export + helpers ────────────────────────────────────────────────

export const allPackages: LuxuryPackage[] = [...indiaPackages, ...internationalPackages];

export function getPackageById(id: string): LuxuryPackage | undefined {
  return allPackages.find((p) => p.id === id);
}

export function getPackagesByCategory(category: PackageCategory): LuxuryPackage[] {
  return allPackages.filter((p) => p.categories.includes(category));
}

export function getPackagesByRegion(region: PackageRegion): LuxuryPackage[] {
  return allPackages.filter((p) => p.region === region);
}

export function formatPackagePrice(price: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(price);
}

// ─── Travel Style Collections ─────────────────────────────────────────────────

export interface TravelCollection {
  id: string;
  title: string;
  tagline: string;
  description: string;
  imageUrl: string;
  categories: PackageCategory[];
}

export const travelCollections: TravelCollection[] = [
  { id: 'private-escapes', title: 'Private Escapes', tagline: 'Space, silence, and unhurried discovery.', description: 'Journeys designed around privacy. Small groups or exclusive use. No shared tours, no compromises.', imageUrl: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&h=800&fit=crop&auto=format', categories: ['private'] },
  { id: 'royal-journeys', title: 'Royal Journeys', tagline: 'Palaces that were meant to be lived in.', description: 'India\'s finest royal properties. Maharaja suites, heritage forts and the grandeur of a vanished era.', imageUrl: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&h=800&fit=crop&auto=format', categories: ['royal'] },
  { id: 'honeymoons', title: 'Honeymoons', tagline: 'Designed for two.', description: 'Extraordinary beginnings. Every element of these journeys is curated for couples, with privacy and romance as the constant.', imageUrl: 'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=600&h=800&fit=crop&auto=format', categories: ['honeymoon'] },
  { id: 'wellness-retreats', title: 'Wellness Retreats', tagline: 'Return feeling restored.', description: 'Journeys built around physical and mental renewal. Ayurveda, spa, yoga and the restorative power of extraordinary places.', imageUrl: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=600&h=800&fit=crop&auto=format', categories: ['wellness'] },
  { id: 'family-luxury', title: 'Family Luxury', tagline: 'Journeys that become stories.', description: 'Premium family travel that works for everyone — enriching for children, genuinely restorative for parents.', imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=800&fit=crop&auto=format', categories: ['family'] },
  { id: 'adventure', title: 'Adventure', tagline: 'For those who require more than a view.', description: 'High-altitude treks, wilderness expeditions and experiences that remain with you. With the comfort to match.', imageUrl: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=600&h=800&fit=crop&auto=format', categories: ['adventure'] },
  { id: 'culinary', title: 'Culinary Journeys', tagline: 'Travel through taste.', description: 'The world\'s most interesting food cultures — explored through markets, kitchens, farms and Michelin-starred tables.', imageUrl: 'https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=600&h=800&fit=crop&auto=format', categories: ['culinary'] },
  { id: 'celebrations', title: 'Celebrations', tagline: 'Anniversaries, milestones, unforgettable occasions.', description: 'Private celebrations in extraordinary settings. From intimate dinners to destination events.', imageUrl: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=600&h=800&fit=crop&auto=format', categories: ['celebration'] },
];
