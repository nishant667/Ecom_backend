require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');

const app = express();

// Connect to MongoDB
connectDB();

// CORS Setup: Allow requests from Flutter web
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:8080', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
}));

// Middleware for JSON and forms
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes for Flutter Web
const apiAuthRoutes = require('./routes/api/auth');
const apiProductRoutes = require('./routes/api/products');
const apiCartRoutes = require('./routes/api/cart');
const apiOrderRoutes = require('./routes/api/orders');
const apiPaymentRoutes = require('./routes/api/payments');

app.use('/api/auth', apiAuthRoutes);
app.use('/api/products', apiProductRoutes);
app.use('/api/cart', apiCartRoutes);
app.use('/api/orders', apiOrderRoutes);
app.use('/api/payments', apiPaymentRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'E-commerce API is running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      cart: '/api/cart',
      orders: '/api/orders'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 Server running on port', PORT);
  console.log('📡 API endpoints:');
  console.log('   - Auth: http://localhost:$PORT/api/auth');
  console.log('   - Products: http://localhost:$PORT/api/products');
  console.log('   - Cart: http://localhost:$PORT/api/cart');
  console.log('   - Orders: http://localhost:$PORT/api/orders');
  console.log('   - Payments: http://localhost:$PORT/api/payments');
});
