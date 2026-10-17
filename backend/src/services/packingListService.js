import 'dotenv/config';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';

/**
 * Zod schema for packing list category and items.
 */
export const PackingCategoryZodSchema = z.object({
  category: z
    .string()
    .describe('Category name, e.g. "Clothing", "Documents", "Electronics", "Toiletries & Health", "Activity-Specific"'),
  items: z
    .array(z.string())
    .describe('Array of specific, practical packing items belonging to this category'),
});

export const PackingListOutputSchema = z.object({
  packingList: z
    .array(PackingCategoryZodSchema)
    .describe('Array of categorized packing list objects with category and items'),
});

/**
 * Intelligent activity-aware fallback packing list generator.
 * Used when LLM is unavailable or offline, inspecting destination, season, and actual activities.
 *
 * @param {Object} itinerary 
 * @returns {Array<{ category: string, items: string[] }>}
 */
export const generateFallbackPackingList = (itinerary) => {
  const destination = itinerary?.destination || 'Destination';
  const interests = Array.isArray(itinerary?.interests)
    ? itinerary.interests.join(' ').toLowerCase()
    : (itinerary?.interests || '').toLowerCase();

  // Aggregate all planned activities across days into a single lowercase string for matching
  const activityTexts = [];
  if (Array.isArray(itinerary?.days)) {
    itinerary.days.forEach((day) => {
      if (Array.isArray(day.activities)) {
        day.activities.forEach((act) => {
          if (typeof act === 'string') {
            activityTexts.push(act);
          } else if (act && typeof act === 'object') {
            activityTexts.push([act.name, act.description].filter(Boolean).join(' '));
          }
        });
      }
    });
  }
  const combinedActivities = activityTexts.join(' ').toLowerCase() + ' ' + interests + ' ' + destination.toLowerCase();

  // 1. Core Clothing
  const clothingItems = [
    'Comfortable cotton t-shirts & tops',
    'Breathable pants / shorts',
    'Undergarments & moisture-wicking socks',
    'Comfortable walking sneakers / shoes',
    'Lightweight evening jacket or cardigan',
    'Sleepwear / loungewear',
  ];

  // 2. Documents
  const documentItems = [
    'Government-issued photo ID / Passport',
    'Flight & transit booking tickets (printed & digital)',
    'Hotel & accommodation confirmation vouchers',
    'Credit / Debit cards and local currency cash',
    'Travel insurance details & emergency contacts',
  ];

  // 3. Electronics
  const electronicItems = [
    'Smartphone with offline maps downloaded',
    'Phone charging cables & fast wall charger',
    'Portable power bank (10,000+ mAh)',
    'Universal travel power adapter',
    'Noise-canceling earphones or headphones',
  ];

  // 4. Toiletries & Health
  const toiletriesItems = [
    'Travel-sized toothbrush & toothpaste',
    'Shampoo, conditioner & body wash',
    'Personal daily medications & vitamins',
    'Basic first-aid kit (band-aids, antiseptic wipes, pain relievers)',
    'Hand sanitizer & pocket wet wipes',
    'Deodorant & lip balm',
  ];

  // 5. Activity-Specific Items
  const activitySpecificItems = [];

  // Beach / Water detection
  if (
    combinedActivities.includes('beach') ||
    combinedActivities.includes('swim') ||
    combinedActivities.includes('snork') ||
    combinedActivities.includes('scuba') ||
    combinedActivities.includes('water') ||
    combinedActivities.includes('surf') ||
    combinedActivities.includes('island') ||
    combinedActivities.includes('pool')
  ) {
    clothingItems.push('Swimwear / swim trunks', 'Flip-flops or water sandals');
    toiletriesItems.push('Reef-safe broad-spectrum sunscreen (SPF 50+)');
    activitySpecificItems.push(
      'Quick-dry microfiber beach towel',
      'Waterproof phone dry bag / pouch',
      'UV protection sunglasses & wide-brim sun hat'
    );
  }

  // Temple / Religious / Heritage detection
  if (
    combinedActivities.includes('temple') ||
    combinedActivities.includes('shrine') ||
    combinedActivities.includes('mosque') ||
    combinedActivities.includes('church') ||
    combinedActivities.includes('monastery') ||
    combinedActivities.includes('ashram') ||
    combinedActivities.includes('heritage') ||
    combinedActivities.includes('spiritual')
  ) {
    clothingItems.push('Modest clothing (covering shoulders & knees)', 'Light scarf or shawl');
    activitySpecificItems.push(
      'Slip-on shoes / socks for easy removal at places of worship',
      'Hand wipes for temple grounds'
    );
  }

  // Trekking / Hiking / Nature / Wildlife detection
  if (
    combinedActivities.includes('trek') ||
    combinedActivities.includes('hike') ||
    combinedActivities.includes('trail') ||
    combinedActivities.includes('mountain') ||
    combinedActivities.includes('safari') ||
    combinedActivities.includes('camp') ||
    combinedActivities.includes('wildlife') ||
    combinedActivities.includes('forest')
  ) {
    clothingItems.push('Sturdy hiking / trail shoes with grip', 'Moisture-wicking athletic socks');
    toiletriesItems.push('DEET or natural insect / mosquito repellent spray');
    activitySpecificItems.push(
      'Lightweight daypack / backpack (20-30L)',
      'Reusable insulated water bottle / hydration pack',
      'Compact rain poncho or waterproof jacket',
      'Small blister prevention pads'
    );
  }

  // Nightlife / Upscale Dining detection
  if (
    combinedActivities.includes('nightlife') ||
    combinedActivities.includes('club') ||
    combinedActivities.includes('bar') ||
    combinedActivities.includes('pub') ||
    combinedActivities.includes('cocktail') ||
    combinedActivities.includes('fine dining') ||
    combinedActivities.includes('luxury')
  ) {
    clothingItems.push('Smart-casual evening outfit or dress', 'Formal dress shoes / loafers');
    activitySpecificItems.push('Travel-size perfume / cologne');
  }

  // Cold / Winter / Hill Station detection
  if (
    combinedActivities.includes('snow') ||
    combinedActivities.includes('winter') ||
    combinedActivities.includes('cold') ||
    combinedActivities.includes('hill station') ||
    combinedActivities.includes('manali') ||
    combinedActivities.includes('shimla') ||
    combinedActivities.includes('kashmir') ||
    combinedActivities.includes('ladakh')
  ) {
    clothingItems.push('Thermal base layers (tops & bottoms)', 'Heavy woolen fleece or down jacket', 'Warm beanie & insulated gloves');
    toiletriesItems.push('Intensive skin moisturizer & cold cream');
  }

  // Fallback default activity items if none triggered
  if (activitySpecificItems.length === 0) {
    activitySpecificItems.push(
      'Compact foldable umbrella',
      'Lightweight tote bag for local shopping',
      'UV sunglasses'
    );
  }

  return [
    {
      category: 'Clothing',
      items: Array.from(new Set(clothingItems)),
    },
    {
      category: 'Documents',
      items: Array.from(new Set(documentItems)),
    },
    {
      category: 'Electronics',
      items: Array.from(new Set(electronicItems)),
    },
    {
      category: 'Toiletries & Health',
      items: Array.from(new Set(toiletriesItems)),
    },
    {
      category: 'Activity-Specific',
      items: Array.from(new Set(activitySpecificItems)),
    },
  ];
};

/**
 * Builds the Groq structured output model and invokes it with context.
 *
 * @param {Object} itinerary 
 * @returns {Promise<Array<{ category: string, items: string[] }>>}
 */
export async function generatePackingList(itinerary) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.warn('GROQ_API_KEY not defined, utilizing activity-aware fallback packing list generator');
    return generateFallbackPackingList(itinerary);
  }

  const destination = itinerary?.destination || 'Destination';
  const startDate = itinerary?.startDate || 'Upcoming';
  const endDate = itinerary?.endDate || '';
  const budgetTier = itinerary?.budgetTier || 'mid';
  const interests = Array.isArray(itinerary?.interests) && itinerary.interests.length > 0
    ? itinerary.interests.join(', ')
    : 'Sightseeing, local cuisine, and culture';

  // Extract all daily activities
  const dailyActivities = [];
  if (Array.isArray(itinerary?.days)) {
    itinerary.days.forEach((day) => {
      const dayNum = day.dayNumber || '?';
      if (Array.isArray(day.activities) && day.activities.length > 0) {
        const acts = day.activities
          .map((a) =>
            typeof a === 'string'
              ? a
              : `${a.name || ''}${a.description ? `: ${a.description}` : ''}`
          )
          .map((activity) => {
            if (typeof activity === 'string') return activity;
            const name = activity?.name || '';
            const desc = activity?.description;
            return desc && desc !== name ? `${name} (${desc})` : name;
          })
          .filter(Boolean)
          .join('; ');
        dailyActivities.push(`Day ${dayNum}: ${acts}`);
        if (acts) {
          dailyActivities.push(`Day ${dayNum}: ${acts}`);
        }
      }
    });
  }

  const activitiesSummary = dailyActivities.length > 0
    ? dailyActivities.join('\n')
    : 'General exploration, walking tours, and cultural sightseeing.';

  const systemPrompt = `You are an expert travel packing advisor.
Your task is to generate a comprehensive, highly practical, categorized packing list tailored precisely to the user's specific trip.

RULES:
1. SPECIFIC ACTIVITY FOCUS:
   - Carefully inspect the actual activities listed across each day of the itinerary.
   - Tailor the items specifically to those activities. For example:
     * Beach, swimming, or coastal activities imply swimwear, rashguards, reef-safe sunscreen, beach towels, water shoes.
     * Temples, shrines, mosques, or religious sites imply modest clothing (covering shoulders and knees), slip-on shoes for easy removal, and light scarves.
     * Trekking, trails, or nature adventures imply sturdy hiking shoes, moisture-wicking socks, daypack, insect repellent, and rain gear.
     * Nightlife, luxury resorts, or upscale dining imply smart evening wear and dress shoes.
2. CATEGORIES:
   - Organize items into distinct categories, such as:
     * "Clothing"
     * "Documents"
     * "Electronics"
     * "Toiletries & Health"
     * "Activity-Specific"
3. Output strictly structured JSON conforming to the schema with an array of { category: string, items: string[] }.`;

  const userPrompt = `Here are the trip details:
- Destination: ${destination}
- Dates: ${startDate} to ${endDate}
- Budget Tier: ${budgetTier}
- Travel Interests: ${interests}

Daily Itinerary & Activities:
${activitiesSummary}

Please generate an organized, activity-tailored packing list as structured output.`;

  const primaryModelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  try {
    const chat = new ChatGroq({
      apiKey,
      model: primaryModelName,
      temperature: 0.2,
    }).withStructuredOutput(PackingListOutputSchema);

    const result = await chat.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const list = result?.packingList || result?.categories || (Array.isArray(result) ? result : null);
    if (Array.isArray(list) && list.length > 0) {
      return list.map((cat) => ({
        category: cat.category || 'General',
        items: Array.isArray(cat.items) ? cat.items : [],
      }));
    }
  } catch (err) {
    console.warn(`ChatGroq primary model (${primaryModelName}) failed for packing list:`, err.message);

    // Secondary model attempt
    if (primaryModelName !== 'openai/gpt-oss-20b') {
      try {
        const secondaryChat = new ChatGroq({
          apiKey,
          model: 'openai/gpt-oss-20b',
          temperature: 0.2,
        }).withStructuredOutput(PackingListOutputSchema);

        const secResult = await secondaryChat.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);

        const secList = secResult?.packingList || secResult?.categories || (Array.isArray(secResult) ? secResult : null);
        if (Array.isArray(secList) && secList.length > 0) {
          return secList.map((cat) => ({
            category: cat.category || 'General',
            items: Array.isArray(cat.items) ? cat.items : [],
          }));
        }
      } catch (secErr) {
        console.warn('ChatGroq secondary model also failed:', secErr.message);
      }
    }
  }

  // Graceful fallback to heuristic activity-aware packing list
  return generateFallbackPackingList(itinerary);
}

export default generatePackingList;
