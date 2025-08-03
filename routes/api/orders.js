const express = require('express');
const router = express.Router();
const Order = require('../../models/Order');
const Cart = require('../../models/Cart');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Create order and initiate payment
router.post('/checkout', authenticateToken, async (req, res) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;
    
    // Get user's cart
    const cart = await Cart.findOne({ user: req.userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    
    // Calculate total
    const total = cart.items.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);
    
    // Create order
    const order = new Order({
      user: req.userId,
      items: cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.product.price
      })),
      total,
      shippingAddress,
      paymentMethod,
      status: 'pending'
    });
    
    await order.save();
    
    // Clear cart
    cart.items = [];
    await cart.save();
    
    // Initialize payment (you can integrate with Razorpay/Stripe here)
    let paymentData = {};
    if (paymentMethod === 'razorpay') {
      // Initialize Razorpay payment
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
      
      const payment = await razorpay.orders.create({
        amount: total * 100, // Razorpay expects amount in paise
        currency: 'INR',
        receipt: order._id.toString()
      });
      
      paymentData = {
        orderId: payment.id,
        amount: payment.amount,
        currency: payment.currency
      };
    }
    
    res.json({
      success: true,
      order,
      paymentData
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get user's order history
router.get('/', authenticateToken, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.userId })
      .populate('items.product')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

// Get specific order
router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.orderId, 
      user: req.userId 
    }).populate('items.product');
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({ success: true, order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load order' });
  }
});

// Process payment success
router.post('/payment/success', authenticateToken, async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    
    const order = await Order.findOne({ 
      _id: orderId, 
      user: req.userId 
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Verify payment signature (for Razorpay)
    if (order.paymentMethod === 'razorpay') {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(orderId + '|' + paymentId)
        .digest('hex');
      
      if (expectedSignature !== signature) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }
    }
    
    // Update order status
    order.status = 'paid';
    order.paymentId = paymentId;
    order.paidAt = new Date();
    await order.save();
    
    res.json({ success: true, order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Process payment failure
router.post('/payment/failed', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.body;
    
    const order = await Order.findOne({ 
      _id: orderId, 
      user: req.userId 
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    order.status = 'payment_failed';
    await order.save();
    
    res.json({ success: true, order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process payment failure' });
  }
});

module.exports = router; 