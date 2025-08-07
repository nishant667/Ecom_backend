const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// API Registration
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    // Check if user already exists
    const User = require('../../models/User');
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const user = new User({
      username,
      email,
      password: hashedPassword
    });
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// API Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const User = require('../../models/User');
    const bcrypt = require('bcrypt');
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// API Logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// Google Sign-In
router.post('/google', async (req, res) => {
  try {
    const { uid, name, email, photoUrl } = req.body;
    
    console.log('Google Sign-In request received:', { uid, name, email, photoUrl });
    
    if (!uid || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const User = require('../../models/User');
    
    // Check if user already exists
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user
      user = new User({
        username: name || email.split('@')[0],
        email: email,
        googleId: uid,
        profileImage: photoUrl
      });
      await user.save();
      console.log('New Google user created:', user.email);
    } else {
      // Update existing user with Google info
      user.googleId = uid;
      if (photoUrl) user.profileImage = photoUrl;
      await user.save();
      console.log('Existing user updated with Google info:', user.email);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );
    
    console.log('Google Sign-In successful for:', user.email);
    
    res.json({
      success: true,
      message: 'Google Sign-In successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage
      }
    });
  } catch (err) {
    console.error('Google Sign-In error:', err);
    res.status(500).json({ error: 'Google Sign-In failed. Please try again.' });
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const User = require('../../models/User');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get current user (for session restoration)
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const User = require('../../models/User');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('✅ Session validation successful for user:', user.email);
    
    res.json({ 
      success: true, 
      user: {
        id: user._id,
        name: user.username,
        email: user.email,
        photoUrl: user.profileImage
      }
    });
  } catch (err) {
    console.error('❌ Session validation failed:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router; 
