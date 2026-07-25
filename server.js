require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const path        = require('path');
const connectDB   = require('./src/config/db');

connectDB();

const authRoutes    = require('./src/routes/auth');
const schemesRoutes = require('./src/routes/schemes');
const usersRoutes   = require('./src/routes/users');
const adminRoutes   = require('./src/routes/admin');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(morgan('dev'));

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'https://enigial-frontend-7ybtfo0yw-anay.vercel.app',
  'http://localhost:3000',
  'http://localhost:4173',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use('/api/auth',    authRoutes);
app.use('/api/schemes', schemesRoutes);
app.use('/api/users',   usersRoutes);
app.use('/api/admin',   adminRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `${req.method} ${req.path} not found` });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('MongoDB Backend ready');
});

module.exports = app;