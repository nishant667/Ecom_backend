require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    console.log('📡 MongoDB URI:', process.env.MONGO_URI ? 'Set' : 'Not set');
    console.log('🔑 JWT Secret:', process.env.JWT_SECRET ? 'Set' : 'Not set');
    console.log('💳 Stripe Secret Key:', process.env.STRIPE_SECRET_KEY ? 'Set' : 'Not set');
    
    if (!process.env.MONGO_URI) {
      console.error('❌ MONGO_URI environment variable is not set');
      process.exit(1);
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');

    // Test product count
    const productCount = await Product.countDocuments();
    console.log('📦 Products in database:', productCount);

    if (productCount === 0) {
      console.log('⚠️  No products found. Run the seed script to add sample products.');
    }

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Database connection test completed');
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    process.exit(1);
  }
}

testConnection(); 