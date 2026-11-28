import embedText from '../services/embeddingService.js';

/**
 * Query used by the batch embedding job: strictly excludes hidden records so
 * unreviewed, rejected, and duplicate monuments are never sent to the embedding API.
 */
export const EMBED_UNEMBEDDED_QUERY = {
  hidden: { $ne: true },
  $or: [
    { embedding: { $exists: false } },
    { embedding: null },
    { embedding: { $size: 0 } },
    { embeddingStale: true },
  ],
};

/**
 * Builds descriptive text from name + type + significance + city + state.
 */
export function buildDescriptiveText(place) {
  const { name, type, significance, city, state } = place;

  const descriptors = [];
  if (type) descriptors.push(type);
  if (significance && (!type || !type.toLowerCase().includes(significance.toLowerCase()))) {
    descriptors.push(significance);
  }

  const descriptorPhrase =
    descriptors.length > 0 ? `a ${descriptors.join(' ')} site` : 'a destination';

  let text = `${name}, ${descriptorPhrase}`;
  if (city) {
    text += ` in ${city}`;
    if (state && state.toLowerCase() !== city.toLowerCase()) {
      text += `, ${state}`;
    }
  }

  return text;
}

/**
 * Best-effort single-document embedding upon admin Publish.
 * Never throws or blocks the publish response; leaves embeddingStale: true on failure so
 * the batch job can retry later.
 */
export async function tryEmbedPublishedPlace(place, { embedFn = embedText } = {}) {
  if (!place || place.hidden === true) {
    return { embedded: false, reason: 'hidden_or_missing' };
  }

  if (embedFn === embedText && !process.env.GEMINI_API_KEY) {
    return { embedded: false, reason: 'missing_api_key' };
  }

  try {
    const text = buildDescriptiveText(place);
    const vector = await embedFn(text);
    if (!Array.isArray(vector) || vector.length !== 768) {
      return { embedded: false, reason: 'invalid_vector_length' };
    }
    place.embedding = vector;
    place.embeddingStale = false;
    await place.save();
    return { embedded: true };
  } catch (err) {
    console.warn('[PlaceEmbedding] Best-effort publish embedding failed:', err?.message || err);
    return { embedded: false, reason: err?.message || 'embed_error' };
  }
}
