const express = require('express');
const router = express.Router();
const Order = require('../../models/Order');
const Cart = require('../../models/Cart');
const Product = require('../../models/Product');
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

    // Check stock availability and calculate total
    let total = 0;
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${item.product.name}. Available: ${item.product.stock}, Requested: ${item.quantity}` 
        });
      }
      total += item.product.price * item.quantity;
    }
    
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
    
    // Update product stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(
        item.product._id,
        { $inc: { stock: -item.quantity } }
      );
    }
    
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
    const orders = await Order.find({ userId: req.userId })
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
      userId: req.userId 
    });
    
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
      userId: req.userId 
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
      userId: req.userId 
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

// Create Cash on Delivery Order
router.post('/create-cod', authenticateToken, async (req, res) => {
  try {
    const { items, total_amount, shipping_details } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Items are required' 
      });
    }

    if (!total_amount || !shipping_details) {
      return res.status(400).json({ 
        success: false, 
        message: 'Total amount and shipping details are required' 
      });
    }

    // Check stock availability for all items
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product not found`,
        });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
        });
      }
    }

    // Create Cash on Delivery order
    const order = new Order({
      user: req.userId,
      items: items,
      total_amount: total_amount,
      payment_method: 'cash_on_delivery',
      payment_status: 'pending', // COD orders are pending until delivery
      shipping_details: shipping_details,
      order_status: 'confirmed',
    });

    await order.save();

    // Update product stock
    for (const item of items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: -item.quantity } }
      );
    }

    // Clear user's cart
    const Cart = require('../../models/Cart');
    await Cart.findOneAndUpdate(
      { user: req.userId },
      { $set: { items: [] } }
    );

    res.status(201).json({
      success: true,
      message: 'Cash on Delivery order placed successfully',
      order_id: order._id,
      order_status: 'confirmed',
      payment_method: 'cash_on_delivery',
    });

  } catch (error) {
    console.error('COD order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create COD order',
      error: error.message,
    });
  }
});

module.exports = router; 