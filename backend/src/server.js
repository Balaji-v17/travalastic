import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import healthRoute from './routes/health.js';
import destinationsRoute from './routes/destinations.js';
import authRoute from './routes/auth.js';
import itineraryRoute from './routes/itinerary.js';
import flightsRoute from './routes/flights.js';
import hotelsRoute from './routes/hotels.js';
import carsRoute from './routes/cars.js';
import routesRoute from './routes/routes.js';
import testRoute from './routes/test.js';
import chatRoute from './routes/chat.js';
import bookingsRoute from './routes/bookings.js';
import expensesRoute from './routes/expenses.js';
import fxRoute from './routes/fx.js';
import packingTemplatesRoute from './routes/packingTemplates.js';
import assistantRoute from './routes/assistant.js';
import duffelWebhookRoute from './routes/duffelWebhook.js';
import disruptionsRoute from './routes/disruptions.js';
import { connectDB } from './config/db.js'; 
import getWeatherForecast from './services/weatherService.js';
import CuratedHotel from './models/CuratedHotel.js';

const app = express();
const PORT = process.env.PORT || 8000;

connectDB(); // Now active

const allowedOrigins = (process.env.WEB_ORIGINS || 'http://localhost:8443,http://localhost:5173,https://travalastic.vercel.app')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

if (!allowedOrigins.includes('https://travalastic.vercel.app')) {
  allowedOrigins.push('https://travalastic.vercel.app');
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  })
);
app.use(helmet());
app.use(morgan('dev'));

// Duffel webhook: raw body parsing mounted BEFORE express.json() for exact signature verification
app.use(
  '/webhooks/duffel',
  express.raw({ type: 'application/json', limit: '256kb' }),
  duffelWebhookRoute
);

app.use(express.json());

// GET /health/db reports current Mongoose connection state
app.get('/health/db', (req, res) => {
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const state = stateMap[mongoose.connection.readyState] || 'disconnected';
  res.json({
    status: state,
    db: state,
    state: state,
    readyState: mongoose.connection.readyState,
  });
});

app.use('/health', healthRoute);
app.use('/destinations', destinationsRoute);
app.use('/auth', authRoute);
app.use(['/itinerary', '/itineraries'], itineraryRoute);
app.use('/flights', flightsRoute);
app.use('/hotels', hotelsRoute);
app.use('/cars', carsRoute);
app.use('/routes', routesRoute);
app.use('/test', testRoute);
app.use('/chat', chatRoute);
app.use('/bookings', bookingsRoute);
app.use('/expenses', expensesRoute);
app.use('/fx', fxRoute);
app.use('/packing-templates', packingTemplatesRoute);
app.use('/assistant', assistantRoute);
app.use('/disruptions', disruptionsRoute);

app.get('/weather', async (req, res, next) => {
  try {
    const { lat, lon, latitude, longitude, date } = req.query;
    const targetLat = lat || latitude;
    const targetLon = lon || longitude;
    if (targetLat == null || targetLon == null) {
      return res.status(200).json({ description: 'Weather data unavailable', temperature: 'N/A' });
    }
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const forecast = await getWeatherForecast(targetLat, targetLon, targetDate);
    return res.status(200).json(forecast);
  } catch (error) {
    next(error);
  }
});

// Temporary dev-only route to confirm seeded hotel data
app.get('/admin/hotels', async (req, res) => {
  try {
    const { destination } = req.query;
    const filter = destination
      ? { destination: new RegExp(`^${destination.trim()}$`, 'i') }
      : {};

    const hotels = await CuratedHotel.find(filter);
    return res.status(200).json(hotels);
  } catch (error) {
    console.error('Error fetching admin hotels:', error.message);
    return res.status(500).json({ error: 'Failed to fetch curated hotels' });
  }
});

// Not Found handler
app.use((req, res, next) => {
  res.status(404).json({ error: { message: `Not Found - ${req.originalUrl}` } });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: { message: err.message || 'Internal Server Error' } });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;
export { app };