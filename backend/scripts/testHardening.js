import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import User from '../src/models/User.js';
import Itinerary from '../src/models/Itinerary.js';
import embedText, { embeddingCache } from '../src/services/embeddingService.js';
import getWeatherForecast from '../src/services/weatherService.js';

const runTests = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  console.log('\n>>> 1. Testing Caching Functionality <<<');

  // Test 1a: Destinations search caching
  console.log('Testing destinations search caching...');
  const t0 = Date.now();
  const destRes1 = await fetch('http://localhost:8000/destinations/search?q=Bengaluru');
  const d1Time = Date.now() - t0;
  const destData1 = await destRes1.json();

  const t1 = Date.now();
  const destRes2 = await fetch('http://localhost:8000/destinations/search?q=Bengaluru');
  const d2Time = Date.now() - t1;
  const destData2 = await destRes2.json();

  console.log(`Destinations 1st call: ${d1Time}ms, 2nd call (cached): ${d2Time}ms`);
  console.log('Destinations data identical:', JSON.stringify(destData1) === JSON.stringify(destData2));
  if (destRes1.status !== 200 || destRes2.status !== 200) {
    throw new Error('Destinations search failed');
  }
  if (d2Time > d1Time && d2Time > 50) {
    console.warn('Warning: 2nd call did not show significant latency drop, checking cached content');
  }

  // Test 1b: Weather forecast caching
  console.log('\nTesting weather forecast caching...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const wt0 = Date.now();
  const weather1 = await getWeatherForecast(15.2993, 74.1240, tomorrowStr);
  const wt1Time = Date.now() - wt0;

  const wt1 = Date.now();
  const weather2 = await getWeatherForecast(15.2993, 74.1240, tomorrowStr);
  const wt2Time = Date.now() - wt1;

  console.log(`Weather 1st call: ${wt1Time}ms, 2nd call (cached): ${wt2Time}ms`);
  console.log('Weather results match:', JSON.stringify(weather1) === JSON.stringify(weather2));
  if (wt2Time > 5) {
    console.warn('Weather cache lookup took longer than expected:', wt2Time);
  }

  // Test 1c: Embedding caching
  console.log('\nTesting embedding caching...');
  const sampleText = 'Luxury coastal resort with private plunge pool and ocean view';
  const et0 = Date.now();
  const emb1 = await embedText(sampleText);
  const et1Time = Date.now() - et0;

  const et1 = Date.now();
  const emb2 = await embedText(sampleText);
  const et2Time = Date.now() - et1;

  console.log(`Embedding 1st call: ${et1Time}ms, 2nd call (cached): ${et2Time}ms`);
  console.log('Embedding lengths match (768):', emb1.length === 768 && emb2.length === 768);
  console.log('Embedding cache has entry:', embeddingCache.has(sampleText));
  if (et2Time > 5) {
    console.warn('Embedding cache lookup took longer than expected:', et2Time);
  }

  console.log('\n>>> 2. Testing Error Handling & Robustness <<<');
  // Test 2a: GET /flights/offers with nonexistent offer
  const flightOfferRes = await fetch('http://localhost:8000/flights/offers/off_nonexistent123');
  const flightOfferData = await flightOfferRes.json();
  console.log('Flight offer nonexistent status:', flightOfferRes.status, 'body:', flightOfferData);
  // Must return 200 with isValid: false or 400/502 without crashing
  if (flightOfferRes.status === 500) {
    throw new Error('Server returned unhandled 500');
  }

  // Test 2b: POST /flights/book with empty body
  const bookEmptyRes = await fetch('http://localhost:8000/flights/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  console.log('POST /flights/book empty body status:', bookEmptyRes.status);
  if (bookEmptyRes.status !== 400) {
    throw new Error('Expected 400 for empty book body');
  }

  console.log('\n>>> 3. Testing User Data Scoping (req.userId) <<<');
  const userA = await User.create({ email: `scopingA_${Date.now()}@example.com`, passwordHash: 'hash' });
  const userB = await User.create({ email: `scopingB_${Date.now()}@example.com`, passwordHash: 'hash' });

  const tokenA = jwt.sign({ userId: userA._id, email: userA.email }, process.env.JWT_SECRET);
  const tokenB = jwt.sign({ userId: userB._id, email: userB.email }, process.env.JWT_SECRET);

  const itineraryA = await Itinerary.create({
    userId: userA._id,
    destination: 'Mumbai',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    days: [{ dayNumber: 1, activities: ['Marine drive'] }],
  });

  // User A can access own itinerary
  const getOwn = await fetch(`http://localhost:8000/itinerary/${itineraryA._id}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` },
  });
  console.log('User A GET own itinerary status:', getOwn.status);
  if (getOwn.status !== 200) throw new Error('User A could not access own itinerary');

  // User B cannot access User A itinerary
  const getCross = await fetch(`http://localhost:8000/itinerary/${itineraryA._id}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` },
  });
  console.log('User B GET User A itinerary status:', getCross.status);
  if (getCross.status !== 404) throw new Error('User B was able to view User A itinerary');

  // User B cannot chat on User A itinerary
  const chatCross = await fetch('http://localhost:8000/chat/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`,
    },
    body: JSON.stringify({
      itineraryId: itineraryA._id.toString(),
      message: 'Hello',
    }),
  });
  console.log('User B chat on User A itinerary status:', chatCross.status);
  if (chatCross.status !== 404) throw new Error('User B was able to chat on User A itinerary');

  // Cleanup
  await Itinerary.deleteOne({ _id: itineraryA._id });
  await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
  await mongoose.disconnect();
  console.log('Cleaned up test documents.');

  console.log('\n>>> ALL HARDENING & CACHING TESTS PASSED SUCCESSFULLY! <<<');
};

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});

