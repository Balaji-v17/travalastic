/**
 * Pexels Photography Service
 * Integrates with Pexels API to fetch photography for destinations.
 */

// Curated high-resolution Pexels photos for the 18 fixed Indian destinations
// Used when PEXELS_API_KEY is unset or when rate limits / network errors occur.
const FALLBACK_PEXELS_PHOTOS = {
  'goa': {
    photoUrl: 'https://images.pexels.com/photos/4428289/pexels-photo-4428289.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Sumit Kapai',
    photographerUrl: 'https://www.pexels.com/@sumit-kapai-2051614',
  },
  'jaipur': {
    photoUrl: 'https://images.pexels.com/photos/3581368/pexels-photo-3581368.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Chitransh',
    photographerUrl: 'https://www.pexels.com/@chitransh-2014422',
  },
  'kerala backwaters': {
    photoUrl: 'https://images.pexels.com/photos/962464/pexels-photo-962464.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Ajay Thomas',
    photographerUrl: 'https://www.pexels.com/@ajaythomas',
  },
  'ladakh': {
    photoUrl: 'https://images.pexels.com/photos/1007427/pexels-photo-1007427.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Aman',
    photographerUrl: 'https://www.pexels.com/@aman',
  },
  'rishikesh': {
    photoUrl: 'https://images.pexels.com/photos/3889987/pexels-photo-3889987.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Rohit Tandon',
    photographerUrl: 'https://www.pexels.com/@rohit',
  },
  'udaipur': {
    photoUrl: 'https://images.pexels.com/photos/1603650/pexels-photo-1603650.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Fuzail Ahmad',
    photographerUrl: 'https://www.pexels.com/@fuzail',
  },
  'munnar': {
    photoUrl: 'https://images.pexels.com/photos/1366919/pexels-photo-1366919.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Ashok Kumar',
    photographerUrl: 'https://www.pexels.com/@ashok',
  },
  'varanasi': {
    photoUrl: 'https://images.pexels.com/photos/814499/pexels-photo-814499.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Martin',
    photographerUrl: 'https://www.pexels.com/@martin',
  },
  'manali': {
    photoUrl: 'https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Sanjay Sharma',
    photographerUrl: 'https://www.pexels.com/@sanjay',
  },
  'andaman islands': {
    photoUrl: 'https://images.pexels.com/photos/1450353/pexels-photo-1450353.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Traveler Explorer',
    photographerUrl: 'https://www.pexels.com',
  },
  'hampi': {
    photoUrl: 'https://images.pexels.com/photos/2444403/pexels-photo-2444403.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Hitesh Choudhary',
    photographerUrl: 'https://www.pexels.com/@hitesh',
  },
  'mysore': {
    photoUrl: 'https://images.pexels.com/photos/1007426/pexels-photo-1007426.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Vijay V',
    photographerUrl: 'https://www.pexels.com/@vijay',
  },
  'darjeeling': {
    photoUrl: 'https://images.pexels.com/photos/2440021/pexels-photo-2440021.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Abhishek Roy',
    photographerUrl: 'https://www.pexels.com/@abhi',
  },
  'puducherry': {
    photoUrl: 'https://images.pexels.com/photos/3278215/pexels-photo-3278215.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Rakesh Nair',
    photographerUrl: 'https://www.pexels.com/@rakesh',
  },
  'rann of kutch': {
    photoUrl: 'https://images.pexels.com/photos/2440024/pexels-photo-2440024.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Kunal Patel',
    photographerUrl: 'https://www.pexels.com/@kunal',
  },
  'meghalaya': {
    photoUrl: 'https://images.pexels.com/photos/2387873/pexels-photo-2387873.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Rahul Roy',
    photographerUrl: 'https://www.pexels.com/@rahul',
  },
  'coorg': {
    photoUrl: 'https://images.pexels.com/photos/1366913/pexels-photo-1366913.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Prashant',
    photographerUrl: 'https://www.pexels.com/@prashant',
  },
  'amritsar': {
    photoUrl: 'https://images.pexels.com/photos/1603650/pexels-photo-1603650.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Harpreet Singh',
    photographerUrl: 'https://www.pexels.com/@harpreet',
  },
};

function derivePexelsSourceUrl(photoUrl) {
  const match = String(photoUrl || '').match(/\/photos\/(\d+)\//);
  return match ? `https://www.pexels.com/photo/${match[1]}/` : 'https://www.pexels.com';
}

export function getCuratedPhotoForDestination(name) {
  const lowerKey = String(name || '').trim().toLowerCase();
  const entry = FALLBACK_PEXELS_PHOTOS[lowerKey];
  if (!entry) return null;
  return {
    photoUrl: entry.photoUrl,
    thumbUrl: entry.photoUrl,
    photographerName: entry.photographerName,
    photographerUrl: entry.photographerUrl,
    sourceUrl: derivePexelsSourceUrl(entry.photoUrl),
    curated: true,
  };
}

// Concurrency semaphore limiting in-flight Pexels HTTP requests to <= 3
const MAX_CONCURRENT_PEXELS = 3;
let activePexelsRequests = 0;
const pexelsWaitQueue = [];

function runWithPexelsConcurrency(fn) {
  return new Promise((resolve, reject) => {
    const start = () => {
      activePexelsRequests++;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          activePexelsRequests--;
          const next = pexelsWaitQueue.shift();
          if (next) next();
        });
    };

    if (activePexelsRequests < MAX_CONCURRENT_PEXELS) {
      start();
    } else {
      pexelsWaitQueue.push(start);
    }
  });
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch a photo for a given destination name from Pexels API.
 * Enforces concurrency <= 3 and bounded exponential backoff on HTTP 429.
 *
 * @param {string} name - Destination query name (e.g. "Goa", "Jaipur")
 * @param {object} [options]
 * @param {boolean} [options.fallback=true]
 * @param {boolean} [options.preferCurated=false]
 * @param {number} [options.maxRetries=2]
 * @param {number} [options.baseBackoffMs=400]
 * @param {Function} [options.sleepFn]
 * @returns {Promise<{ photoUrl: string, thumbUrl?: string, photographerName: string, photographerUrl: string, sourceUrl?: string, curated?: boolean } | null>}
 */
export async function getPhotoForDestination(
  name,
  {
    fallback = true,
    preferCurated = false,
    maxRetries = 2,
    baseBackoffMs = 400,
    sleepFn = defaultSleep,
  } = {}
) {
  const cleanName = (name || '').trim();
  const curated = getCuratedPhotoForDestination(cleanName);
  if (preferCurated && curated) {
    return curated;
  }

  const apiKey = process.env.PEXELS_API_KEY;

  if (cleanName && apiKey && apiKey !== 'your_pexels_api_key_here') {
    const endpoint = `https://api.pexels.com/v1/search?query=${encodeURIComponent(cleanName)}&per_page=1`;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await runWithPexelsConcurrency(() =>
          fetch(endpoint, {
            method: 'GET',
            headers: {
              Authorization: apiKey,
              Accept: 'application/json',
            },
          })
        );

        if (response.ok) {
          const data = await response.json();
          const firstPhoto = data?.photos?.[0];
          const bestUrl =
            firstPhoto?.src?.large2x ||
            firstPhoto?.src?.large ||
            firstPhoto?.src?.medium ||
            firstPhoto?.src?.original;
          const thumbUrl =
            firstPhoto?.src?.medium ||
            firstPhoto?.src?.large ||
            firstPhoto?.src?.original;
          if (firstPhoto && bestUrl) {
            return {
              photoUrl: bestUrl,
              thumbUrl: thumbUrl || bestUrl,
              photographerName: firstPhoto.photographer || 'Pexels Contributor',
              photographerUrl: firstPhoto.photographer_url || 'https://www.pexels.com',
              sourceUrl: firstPhoto.url || derivePexelsSourceUrl(bestUrl),
              curated: false,
            };
          }
          break; // 200 OK with empty photos -> do not retry
        }

        if (response.status === 429 && attempt < maxRetries) {
          const retryAfterHeader = response.headers?.get?.('retry-after');
          const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          const delayMs =
            Number.isFinite(retryAfterSec) && retryAfterSec > 0
              ? Math.min(2000, retryAfterSec * 1000)
              : baseBackoffMs * Math.pow(2, attempt);
          await sleepFn(delayMs);
          continue;
        }

        console.warn(`Pexels API response for "${cleanName}": ${response.status} ${response.statusText}`);
        break;
      } catch (err) {
        console.error(`Error querying Pexels API for "${cleanName}":`, err.message);
        break;
      }
    }
  }

  // Fallback to curated Pexels photo for this destination
  if (curated) {
    return curated;
  }

  if (!fallback) {
    return null;
  }

  // Generic fallback if not in the curated dictionary
  return {
    photoUrl: 'https://images.pexels.com/photos/1007427/pexels-photo-1007427.jpeg?auto=compress&cs=tinysrgb&h=350',
    thumbUrl: 'https://images.pexels.com/photos/1007427/pexels-photo-1007427.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Pexels Contributor',
    photographerUrl: 'https://www.pexels.com',
    sourceUrl: 'https://www.pexels.com/photo/1007427/',
    curated: false,
  };
}

export default {
  getPhotoForDestination,
  getCuratedPhotoForDestination,
};

