require('dotenv').config();
const mongoose = require('mongoose');

async function checkOrders() {
  try {
    console.log('🔍 Checking orders in database...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: 'ecommerce'
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Get the models
    const Order = require('../models/Order');
    const User = require('../models/User');
    
    // Count orders
    const orderCount = await Order.countDocuments();
    console.log(`📦 Total orders in database: ${orderCount}`);
    
    if (orderCount > 0) {
      const orders = await Order.find().populate('userId', 'email');
      console.log('\n📋 Orders found:');
      orders.forEach((order, index) => {
        console.log(`\n${index + 1}. Order ID: ${order._id}`);
        console.log(`   User: ${order.userId?.email || 'Unknown'}`);
        console.log(`   Total: ₹${order.totalAmount}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Payment ID: ${order.paymentId}`);
        console.log(`   Items: ${order.items.length}`);
        order.items.forEach(item => {
          console.log(`     - ${item.name} x${item.quantity} (₹${item.price})`);
        });
      });
    } else {
      console.log('❌ No orders found in database');
    }
    
  } catch (error) {
    console.error('❌ Error checking orders:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkOrders(); 