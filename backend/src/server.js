const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const { connectDB } = require('./config/db');
const healthRouter = require('./routes/health');
const destinationsRouter = require('./routes/destinations');

const app = express();

// Connect to MongoDB before app starts listening
connectDB();

app.use(cors());
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

// Mount routes
app.use('/health', healthRouter);
app.use('/destinations', destinationsRouter);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;