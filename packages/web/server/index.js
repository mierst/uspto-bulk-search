require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const database = require('./database');
const { setupAuth } = require('./auth');
const errorHandler = require('./middleware/error-handler');
const rateLimiter = require('./middleware/rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');

// Initialize database
database.initDatabase(DATA_DIR);

// Middleware
app.use(express.json());
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}

// Auth
setupAuth(app);

// API routes (auth required)
const requireAuth = require('./middleware/auth');
app.use('/api/search', requireAuth, rateLimiter, require('./routes/search'));
app.use('/api/projects', requireAuth, rateLimiter, require('./routes/projects'));
app.use('/api/assignments', requireAuth, rateLimiter, require('./routes/assignments'));
app.use('/api/files', requireAuth, rateLimiter, require('./routes/files'));
app.use('/api/export', requireAuth, rateLimiter, require('./routes/export'));
app.use('/api/batch', requireAuth, rateLimiter, require('./routes/batch'));
app.use('/api/settings', requireAuth, rateLimiter, require('./routes/settings'));
app.use('/api/download', requireAuth, rateLimiter, require('./routes/files'));

// Serve SPA in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`USPTO Search web server running on port ${PORT}`);
});
