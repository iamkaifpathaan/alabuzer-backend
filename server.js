require("dotenv").config();

const Razorpay = require("razorpay");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const Product = require("./models/Product");
const User = require("./models/User");
const orderRoutes = require("./routes/orderRoutes");

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= DB CONNECT =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log(err));

// ================= RAZORPAY INIT =================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ================= ROUTES =================
app.use("/api/orders", orderRoutes);

// ================= TEST ROUTE =================
app.get("/", (req, res) => {
  res.send("🚀 Server is running");
});

// ================= PRODUCTS =================

// Add Product
app.post("/api/products", async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.json({ success: true, message: "Product added successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= BULK PRODUCT UPLOAD =================

app.post("/api/products/bulk", async (req, res) => {
  try {

    const products = req.body.products;

    if (!products || !products.length) {
      return res.status(400).json({
        success: false,
        message: "No products provided"
      });
    }

    await Product.insertMany(products);

    res.json({
      success: true,
      message: "Bulk upload successful"
    });

  } catch (err) {
    console.error("BULK ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Bulk upload failed"
    });
  }
});

// Get All Products
app.get("/api/products", async (req, res) => {
  try {

    const { category } = req.query;

    let filter = {};

    if (category) {
      filter.category = category;
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Update Product
app.put("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Product
app.delete("/api/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= AUTH =================

// Signup
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.json({ success: false, message: "Email already exists" });
    }

    const user = new User({ name, email, password, phone });
    await user.save();

    res.json({ success: true, message: "Signup successful", user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, password });
    if (!user) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    res.json({ success: true, message: "Login successful", user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================================
// 💳 CREATE RAZORPAY ORDER
// ================================

app.post("/api/payment/create-order", async (req, res) => {
  try {

    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount"
      });
    }

    const options = {
      amount: amount * 100, // convert ₹ → paisa
      currency: "INR",
      receipt: "receipt_" + Date.now()
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,              // ⭐ IMPORTANT
      amount: order.amount,
      key: process.env.RAZORPAY_KEY_ID  // ⭐ CRITICAL FIX
    });

  } catch (err) {
    console.error("RAZORPAY ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Payment order failed"
    });
  }
});

// ================= SERVER =================
app.listen(5000, () => {
  console.log("🔥 Server running on port 5000");
});