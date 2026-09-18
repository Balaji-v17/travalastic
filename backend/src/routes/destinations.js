const express = require('express');
const router = express.Router();

router.get('/search', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: "Missing required query parameter 'q'" });
  }

  try {
    // OpenStreetMap Nominatim API endpoint
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=10`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // Must be a unique email, not a placeholder
        'User-Agent': 'Travalastic-MVP/1.0 (put-your-real-email@gmail.com)', 
        'Referer': 'http://localhost:8000',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Nominatim API Error:', response.status, errorText);
      return res.status(502).json({ error: "Failed to fetch data from OpenStreetMap API" });
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return res.json([]);
    }

    // Map Nominatim fields to match our expected frontend shape
    const trimmedPlaces = data.map(place => ({
      name: place.name || place.display_name.split(',')[0],
      address: place.display_name || null,
      latitude: parseFloat(place.lat) || null,
      longitude: parseFloat(place.lon) || null,
      // OpenStreetMap does not have user ratings, so we set it to null
      rating: null 
    }));

    res.json(trimmedPlaces);
  } catch (error) {
    console.error('Destination search error:', error);
    res.status(502).json({ error: "Failed to communicate with OpenStreetMap API" });
  }
});

module.exports = router;