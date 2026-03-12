require("dotenv").config();
const crypto = require("crypto");
const { verifyToken, verifyAdmin } = require("./middleware/auth");
const Razorpay = require("razorpay");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Order = require("./models/Order");
const Product = require("./models/Product");
const User = require("./models/User");
const orderRoutes = require("./routes/orderRoutes");

const app = express();
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100
});

app.use(limiter);

// ================= MIDDLEWARE =================
app.use(cors({
  origin: "*"
}));
const helmet = require("helmet");
app.use(helmet());
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
app.post("/api/products", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.json({ success: true, message: "Product added successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= BULK PRODUCT UPLOAD =================

app.post("/api/products/bulk", verifyToken, verifyAdmin, async (req, res) => {
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
app.put("/api/products/:id", verifyToken, verifyAdmin, async (req, res) => {
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
app.delete("/api/products/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= AUTH =================

// Signup
const bcrypt = require("bcryptjs");

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone
    });

    await user.save();

    res.json({ success: true, message: "Signup successful" });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Login
const jwt = require("jsonwebtoken");

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const bcrypt = require("bcryptjs");
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    // 🔐 TOKEN GENERATE
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= SEND RESET OTP =================

app.post("/api/auth/send-otp", async (req,res)=>{

try{

const {email} = req.body;

const user = await User.findOne({email});

if(!user){
return res.json({
success:false,
message:"Email not registered"
});
}

const otp = Math.floor(100000 + Math.random()*900000);

user.resetOtp = otp;
user.resetOtpExpire = Date.now() + 10*60*1000;

await user.save();

await transporter.sendMail({

from:process.env.EMAIL_USER,
to:email,
subject:"Password Reset OTP",

text:`Your OTP is ${otp}. It expires in 10 minutes.`

});

res.json({
success:true,
message:"OTP sent to email"
});

}catch(err){

console.log(err);

res.status(500).json({
success:false,
message:"OTP send failed"
});

}

});

// ================= RESET PASSWORD =================

app.post("/api/auth/reset-password", async (req,res)=>{

try{

const {email,otp,newPassword} = req.body;

const user = await User.findOne({email});

if(!user){
return res.json({
success:false,
message:"User not found"
});
}

if(user.resetOtp != otp){
return res.json({
success:false,
message:"Invalid OTP"
});
}

if(Date.now() > user.resetOtpExpire){
return res.json({
success:false,
message:"OTP expired"
});
}

const hashed = await bcrypt.hash(newPassword,10);

user.password = hashed;

user.resetOtp = null;
user.resetOtpExpire = null;

await user.save();

res.json({
success:true,
message:"Password reset successful"
});

}catch(err){

console.log(err);

res.status(500).json({
success:false,
message:"Reset failed"
});

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

// ================================
// 🔐 VERIFY RAZORPAY PAYMENT
// ================================

app.post("/api/payment/verify", verifyToken, async (req, res) => {
  try {

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items,
      shippingAddress
    } = req.body;

    const userId = req.user.id;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed"
      });
    }

    // ✅ PAYMENT VERIFIED — NOW SAVE ORDER

    const order = new Order({
      userId,
      items,
      shippingAddress,
      paymentMethod: "Razorpay"
    });

    await order.save();

    res.json({
      success: true,
      message: "Payment verified and order saved"
    });

  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Verification failed"
    });
  }
});

const transporter = require("./utils/mailer");

app.get("/test-email", async (req,res)=>{

try{

await transporter.sendMail({

from:process.env.EMAIL_USER,
to:process.env.EMAIL_USER,
subject:"Test Email",

text:"Email system working."

});

res.send("Email sent successfully");

}catch(err){

console.log(err);
res.send("Email failed");

}

});

// ================= SERVER =================
app.listen(5000, () => {
  console.log("🔥 Server running on port 5000");
});