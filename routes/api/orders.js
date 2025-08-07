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
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
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
      userId: req.userId,
      items: cart.items.map(item => ({
        productId: item.product._id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        imageUrl: item.product.imageUrl
      })),
      totalAmount: total,
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
    
    // Initialize payment with Stripe
    let paymentData = {};
    if (paymentMethod === 'stripe') {
      try {
        // Import Stripe
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        // Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(total * 100), // Convert to paise
          currency: 'inr',
          metadata: {
            order_id: order._id.toString(),
            user_id: req.userId
          }
        });
        
        paymentData = {
          client_secret: paymentIntent.client_secret,
          payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency
        };
      } catch (stripeError) {
        console.error('Stripe payment intent creation failed:', stripeError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create Stripe payment intent',
          details: stripeError.message
        });
      }
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
    const { orderId, paymentIntentId } = req.body;
    
    const order = await Order.findOne({ 
      _id: orderId, 
      userId: req.userId 
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Verify payment with Stripe
    if (order.paymentMethod === 'stripe' && paymentIntentId) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
          return res.status(400).json({ error: 'Payment not completed' });
        }
      } catch (stripeError) {
        console.error('Stripe payment verification failed:', stripeError);
        return res.status(400).json({ error: 'Payment verification failed' });
      }
    }
    
    // Update order status
    order.status = 'paid';
    order.paymentId = paymentIntentId;
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
      userId: req.userId,
      items: items.map(item => ({
        productId: item.product,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        imageUrl: item.imageUrl
      })),
      totalAmount: total_amount,
      paymentMethod: 'cash_on_delivery',
      status: 'confirmed',
      shippingAddress: shipping_details,
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
      { userId: req.userId },
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
