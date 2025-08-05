const express = require('express');
const router = express.Router();
const Product = require('../../models/Product');

// Get all products (API version)
router.get('/', async (req, res) => {
  try {
    const { category, search, sort, page = 1, limit = 50 } = req.query;
    let filter = {};
    
    if (category) {
      filter.category = category;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    let query = Product.find(filter);
    
    // Sorting logic
    if (sort === 'price-asc') query = query.sort({ price: 1 });
    else if (sort === 'price-desc') query = query.sort({ price: -1 });
    else if (sort === 'newest') query = query.sort({ createdAt: -1 });
    else if (sort === 'rating') query = query.sort({ rating: -1 });
    else query = query.sort({ createdAt: -1 });
    
    // Pagination
    const skip = (page - 1) * limit;
    query = query.skip(skip).limit(parseInt(limit));
    
    const products = await query;
    const total = await Product.countDocuments(filter);
    
    console.log(`📦 Fetched ${products.length} products from database`);
    products.forEach(product => {
      console.log(`   - ${product.name} (₹${product.price}) - Stock: ${product.stock}`);
    });
    
    res.json({
      success: true,
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalProducts: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      },
      filters: { category, search, sort }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// Get single product by ID (API version)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true, product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load product' });
  }
});

// Get product categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json({ success: true, categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

module.exports = router; 