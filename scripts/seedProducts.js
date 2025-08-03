const mongoose = require('mongoose');
const Product = require('../models/Product');
const methodOverride = require('method-override');

// Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://nishant:nishu@cluster0.wrjbqsk.mongodb.net/ecommerce?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const sampleProducts = [
  // Electronics
  {
    name: "Wireless Bluetooth Headphones",
    description: "High-quality wireless headphones with noise cancellation and 30-hour battery life.",
    price: 1299,
    imageUrl: "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400",
    category: "Electronics",
    stock: 20
  },
  {
    name: "Smartphone",
    description: "Latest smartphone with 128GB storage, 6GB RAM, and 48MP camera.",
    price: 15999,
    imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400",
    category: "Electronics",
    stock: 15
  },
  {
    name: "Laptop",
    description: "15.6-inch laptop with Intel i7 processor, 16GB RAM, and 512GB SSD.",
    price: 45999,
    imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400",
    category: "Electronics",
    stock: 10
  },
  // Fashion - Kids
  {
    name: "Kids T-shirt",
    description: "100% cotton, fun print, available in multiple colors.",
    price: 399,
    imageUrl: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400",
    category: "Fashion",
    subcategory: "Kids",
    stock: 50
  },
  {
    name: "Kids Sneakers",
    description: "Comfortable and stylish sneakers for kids.",
    price: 799,
    imageUrl: "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?w=400",
    category: "Fashion",
    subcategory: "Kids",
    stock: 30
  },
  // Fashion - Men
  {
    name: "Men's Denim Jacket",
    description: "Classic fit, durable denim, perfect for all seasons.",
    price: 1999,
    imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
    category: "Fashion",
    subcategory: "Men",
    stock: 25
  },
  {
    name: "Men's Running Shoes",
    description: "Lightweight running shoes with breathable mesh.",
    price: 2499,
    imageUrl: "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?w=400",
    category: "Fashion",
    subcategory: "Men",
    stock: 40
  },
  // Fashion - Women
  {
    name: "Women's Summer Dress",
    description: "Floral print, knee-length, soft and comfortable fabric.",
    price: 1299,
    imageUrl: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=400",
    category: "Fashion",
    subcategory: "Women",
    stock: 60
  },
  {
    name: "Women's Handbag",
    description: "Elegant leather handbag with spacious compartments.",
    price: 1799,
    imageUrl: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=400",
    category: "Fashion",
    subcategory: "Women",
    stock: 55
  },
  // Home
  {
    name: "Ceramic Vase",
    description: "Handcrafted ceramic vase for home decor.",
    price: 599,
    imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400",
    category: "Home",
    stock: 100
  },
  {
    name: "LED Table Lamp",
    description: "Adjustable LED lamp with touch control.",
    price: 899,
    imageUrl: "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?w=400",
    category: "Home",
    stock: 80
  },
  // Books
  {
    name: "The Great Gatsby",
    description: "Classic novel by F. Scott Fitzgerald.",
    price: 299,
    imageUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400",
    category: "Books",
    stock: 200
  },
  {
    name: "Atomic Habits",
    description: "Bestselling self-help book by James Clear.",
    price: 499,
    imageUrl: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400",
    category: "Books",
    stock: 150
  },
  // Sports
  {
    name: "Football",
    description: "FIFA-approved size 5 football.",
    price: 699,
    imageUrl: "https://images.unsplash.com/photo-1508609349937-5ec4ae374ebf?w=400",
    category: "Sports",
    stock: 100
  },
  {
    name: "Yoga Mat",
    description: "Non-slip yoga mat, 6mm thick, perfect for all exercises.",
    price: 799,
    imageUrl: "https://images.unsplash.com/photo-1519864600265-abb23847ef2c?w=400",
    category: "Sports",
    stock: 120
  }
];

async function seedProducts() {
  try {
    let updated = 0, added = 0;
    for (const sample of sampleProducts) {
      const existing = await Product.findOne({ name: sample.name });
      if (existing) {
        // Only update stock, preserve all other fields including imageUrl
        existing.stock = sample.stock;
        await existing.save();
        updated++;
      } else {
        await Product.create(sample);
        added++;
      }
    }
    console.log(`Updated stock for ${updated} products, added ${added} new products.`);
    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding products:', error);
    mongoose.connection.close();
  }
}

seedProducts(); 