const mongoose = require('mongoose');
const Product = require('./models/Product');

async function clearTestProducts() {
  try {
    console.log('🗑️ Clearing test products...');
    
    // Delete test products by name
    const result = await Product.deleteMany({
      name: {
        $in: [
          'Bluetooth Speaker',
          'Gaming Mouse', 
          'Wireless Keyboard',
          'Laptop Stand',
          'USB-C Hub',
          'Phone Case',
          'Wireless Earbuds',
          'Smart Watch'
        ]
      }
    });
    
    console.log(`✅ Deleted ${result.deletedCount} test products`);
    
    // Check remaining products
    const remainingProducts = await Product.find({});
    console.log(`📦 Remaining products: ${remainingProducts.length}`);
    
    if (remainingProducts.length > 0) {
      console.log('📋 Real products found:');
      remainingProducts.forEach(product => {
        console.log(`   - ${product.name} (₹${product.price}) - Stock: ${product.stock}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Use the existing app connection
const app = require('./app');
clearTestProducts(); 