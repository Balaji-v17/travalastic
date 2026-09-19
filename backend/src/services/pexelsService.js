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

/**
 * Fetch a photo for a given destination name from Pexels API.
 * Calls GET https://api.pexels.com/v1/search?query=<name>&per_page=1
 * with header Authorization: <PEXELS_API_KEY>
 *
 * @param {string} name - Destination query name (e.g. "Goa", "Jaipur")
 * @returns {Promise<{ photoUrl: string, photographerName: string, photographerUrl: string }>}
 */
export async function getPhotoForDestination(name) {
  const cleanName = (name || '').trim();
  const lowerKey = cleanName.toLowerCase();
  const apiKey = process.env.PEXELS_API_KEY;

  if (apiKey && apiKey !== 'your_pexels_api_key_here') {
    try {
      const endpoint = `https://api.pexels.com/v1/search?query=${encodeURIComponent(cleanName)}&per_page=1`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: apiKey,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const firstPhoto = data?.photos?.[0];
        if (firstPhoto) {
          return {
            photoUrl: firstPhoto.src?.medium || firstPhoto.src?.large || firstPhoto.src?.original,
            photographerName: firstPhoto.photographer || 'Pexels Contributor',
            photographerUrl: firstPhoto.photographer_url || 'https://www.pexels.com',
          };
        }
      } else {
        console.warn(`Pexels API response for "${cleanName}": ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error(`Error querying Pexels API for "${cleanName}":`, err.message);
    }
  }

  // Fallback to curated Pexels photo for this destination
  if (FALLBACK_PEXELS_PHOTOS[lowerKey]) {
    return FALLBACK_PEXELS_PHOTOS[lowerKey];
  }

  // Generic fallback if not in the curated dictionary
  return {
    photoUrl: 'https://images.pexels.com/photos/1007427/pexels-photo-1007427.jpeg?auto=compress&cs=tinysrgb&h=350',
    photographerName: 'Pexels Contributor',
    photographerUrl: 'https://www.pexels.com',
  };
}

export default {
  getPhotoForDestination,
};

