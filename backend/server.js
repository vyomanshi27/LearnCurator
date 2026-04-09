/**
 * LearnCurator Backend Server
 * Main entry point for the Express application
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const searchRoutes = require('./routes/search');
const feedbackRoutes = require('./routes/feedback');
const errorHandler = require('./middleware/errorHandler');

// Initialize the app
const app = express();
//const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 5000;
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ LearnCurator backend running on port ${PORT}`);
});

// Middleware
app.use(express.json());

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'http://127.0.0.1:5501',
      'http://localhost:5501',
      'http://127.0.0.1:3000',
      'http://localhost:3000'
    ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  optionsSuccessStatus: 200,
  credentials: true,
};
app.use(cors(corsOptions));

// Routes
app.use('/api', searchRoutes);
app.use('/api', feedbackRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Basic root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'LearnCurator Backend API',
    version: '1.0.0',
    endpoints: {
      search: 'GET /api/search?q=query',
      feedback: 'POST /api/feedback',
      feedbackStats: 'GET /api/feedback/stats',
      health: 'GET /health',
    },
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start the server with intelligent port fallback if in use
function listenOnPort(port, triesLeft = 5) {
  const server = app.listen(port, () => {
    console.log(`✓ LearnCurator backend running on http://localhost:${port}`);
    console.log(`✓ CORS enabled for: ${process.env.FRONTEND_URL || 'all origins'}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && triesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`⚠️ Port ${port} busy, trying ${nextPort} ...`);
      setTimeout(() => listenOnPort(nextPort, triesLeft - 1), 500);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

//listenOnPort(DEFAULT_PORT);
