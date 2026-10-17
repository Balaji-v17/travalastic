import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import healthRoute from './src/routes/health.js';
import destinationsRoute from './src/routes/destinations.js';
import authRoute from './src/routes/auth.js';
import itineraryRoute from './src/routes/itinerary.js';
import flightsRoute from './src/routes/flights.js';
import hotelsRoute from './src/routes/hotels.js';
import routesRoute from './src/routes/routes.js';
import testRoute from './src/routes/test.js';
import chatRoute from './src/routes/chat.js';
import bookingsRoute from './src/routes/bookings.js';
import expensesRoute from './src/routes/expenses.js';
import fxRoute from './src/routes/fx.js';
import packingTemplatesRoute from './src/routes/packingTemplates.js';
import assistantRoute from './src/routes/assistant.js';
import { connectDB } from './src/config/db.js';
import CuratedHotel from './src/models/CuratedHotel.js';
import getWeatherForecast from './src/services/weatherService.js';

const app = express();
const PORT = process.env.PORT || 8000;

connectDB();

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
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
app.use('/itinerary', itineraryRoute);
app.use('/flights', flightsRoute);
app.use('/hotels', hotelsRoute);
app.use('/routes', routesRoute);
app.use('/test', testRoute);
app.use('/chat', chatRoute);
app.use('/bookings', bookingsRoute);
app.use('/expenses', expensesRoute);
app.use('/fx', fxRoute);
app.use('/packing-templates', packingTemplatesRoute);
app.use('/assistant', assistantRoute);

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

// Admin hotels route
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

