import embedText from '../embeddingService.js';
import DestinationContent from '../../models/DestinationContent.js';

/**
 * Personalization node for LangGraph.
 * Embeds joined interests via embeddingService and queries DestinationContent
 * using MongoDB Atlas $vectorSearch to retrieve the top 3 matching travel blurbs.
 * Writes { personalizedContent: [{ text, tags }] } to state.
 * @param {Object} state - Graph state containing interests
 * @returns {Promise<{personalizedContent: Array<{text: string, tags: string[]}>}>}
 */
export const personalizationNode = async (state) => {
  const interests = state?.interests;
  const interestsText =
    Array.isArray(interests) && interests.length > 0
      ? interests.join(' ')
      : typeof interests === 'string' && interests.trim()
      ? interests.trim()
      : 'travel leisure sightseeing experiences';

  try {
    const embedding = await embedText(interestsText);

    const matches = await DestinationContent.aggregate([
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: embedding,
          numCandidates: 15,
          limit: 3,
        },
      },
      {
        $project: {
          _id: 0,
          text: 1,
          tags: 1,
        },
      },
    ]);

    const formattedMatches = (Array.isArray(matches) ? matches : []).map((m) => ({
      text: m.text,
      tags: m.tags || [],
    }));

    return {
      personalizedContent: formattedMatches,
    };
  } catch (error) {
    console.warn('personalizationNode vector search failed, using fallback:', error.message);
    try {
      const fallbackDocs = await DestinationContent.find(
        Array.isArray(interests) && interests.length > 0 ? { tags: { $in: interests } } : {}
      )
        .limit(3)
        .select('text tags -_id')
        .lean();

      return {
        personalizedContent: (fallbackDocs || []).map((d) => ({
          text: d.text,
          tags: d.tags || [],
        })),
      };
    } catch (fallbackErr) {
      console.error('DestinationContent fallback failed:', fallbackErr.message);
      return {
        personalizedContent: [],
      };
    }
  }
};

export default personalizationNode;

