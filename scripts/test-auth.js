require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

async function testAuth() {
  try {
    console.log('🔍 Testing authentication...');
    
    // Create a test token
    const testUserId = 'test-user-id';
    const token = jwt.sign(
      { userId: testUserId, email: 'test@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('🔑 Test token created');
    console.log('Token:', token.substring(0, 50) + '...');
    
    // Test the payment verification endpoint
    const response = await fetch('http://localhost:3000/api/payments/verify-stripe/test-session', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Response status:', response.status);
    const responseText = await response.text();
    console.log('📡 Response body:', responseText);
    
  } catch (error) {
    console.error('❌ Error testing auth:', error);
  }
}

testAuth(); 