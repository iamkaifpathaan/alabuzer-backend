require("dotenv").config();
const jwt = require("jsonwebtoken");
const axios = require("axios");
const crypto = require("crypto");
const { verifyToken, verifyAdmin } = require("./middleware/auth");
const Razorpay = require("razorpay");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Order = require("./models/Order");
const Product = require("./models/Product");
const User = require("./models/User");
const transporter = require("./utils/mailer");
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
  .then(() => {
    console.log("✅ MongoDB Connected");
    Product.collection.createIndex({ category: 1 });
  })
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

    const products = await Product.find(filter).select("-__v")
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

// Get Single Product by Slug
app.get("/api/products/:slug", async (req, res) => {
  try{

    const product = await Product.findOne({ slug: req.params.slug }).select("-__v");

    if(!product){
      return res.status(404).json({
        success:false,
        message:"Product not found"
      });
    }

    res.json({
      success:true,
      data: product
    });

  }catch(err){
    res.status(500).json({
      success:false,
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
app.post("/api/auth/send-login-otp", async (req,res)=>{

  try{

    const { phone } = req.body;

    if(!phone){
      return res.json({ success:false, message:"Phone required" });
    }

    let user = await User.findOne({ phone });
    if(!/^[6-9]\d{9}$/.test(phone)){
      return res.json({
        success:false,
        message:"Invalid phone number"
      });
    }    

    // ✅ auto signup
    if(!user){
      user = new User({
        phone,
        name: "User_" + phone.slice(-4)
      });
    }

    if(user.otpExpire && Date.now() < user.otpExpire){
    return res.json({
    success:false,
    message:"Wait before requesting OTP again"
    });
    }
    if(user.otpExpire && Date.now() > user.otpExpire){
      user.otp = null;
      user.otpExpire = null;
      await user.save();
    }
    const otp = String(Math.floor(100000 + Math.random()*900000));
    user.otp = otp;
    user.otpExpire = Date.now() + 5*60*1000;

    await user.save();

await axios.get("https://www.fast2sms.com/dev/bulkV2", {
  params: {
    authorization: process.env.FAST2SMS_KEY,  // 🔥 yaha daal
    route: "q",
    message: `Your OTP is ${otp}`,
    language: "english",
    numbers: phone
  }
});
    

    res.json({
      success:true,
      message:"OTP sent"
    });

}catch(err){

  console.log("OTP ERROR FULL:", err);
  console.log("OTP ERROR RESPONSE:", err.response?.data);

  res.status(500).json({
    success:false,
    message: err.response?.data?.message || err.message || "OTP failed"
  });
}

});

app.post("/api/auth/verify-login-otp", async (req,res)=>{

  try{

    const { phone, otp } = req.body;

    const user = await User.findOne({ phone });

    if(!user){
      return res.json({ success:false, message:"User not found" });
    }

    if(user.otp != otp){
      return res.json({ success:false, message:"Invalid OTP" });
    }

    if(Date.now() > user.otpExpire){
      return res.json({ success:false, message:"OTP expired" });
    }

    user.otp = null;
    user.otpExpire = null;

    await user.save();

    // 🔐 JWT
    const token = jwt.sign(
      { id:user._id, role:user.role },
      process.env.JWT_SECRET,
      { expiresIn:"7d" }
    );

    res.json({
      success:true,
      token,
      user:{
        _id:user._id,
        name:user.name,
        role:user.role
      }
    });

  }catch(err){
    res.status(500).json({ success:false });
  }

});

app.put("/api/user/update", verifyToken, async (req,res)=>{

  try{

    const { name } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name },
      { new:true }
    );

    res.json({
      success:true,
      user
    });

  }catch(err){
    res.status(500).json({ success:false });
  }

});

// ================================
// 💳 CREATE RAZORPAY ORDER
// ================================

app.post("/api/payment/create-order", verifyToken, async (req, res) => {

  try{

    const { items } = req.body;

    if(!items || !items.length){
      return res.status(400).json({
        success:false,
        message:"No items"
      });
    }

    let total = 0;

    for(const item of items){

        if(!item.slug || !item.qty || item.qty <= 0 || item.qty > 10){
        return res.status(400).json({
        success:false,
        message:"Invalid cart item"
      });
     }

      const product = await Product.findOne({ slug:item.slug });

      if(!product){
        return res.status(400).json({
          success:false,
          message:"Product not found"
        });
      }

      const price = product.discountPrice || product.price;

      total += price * item.qty;

    }

    const options = {
      amount: total * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now()
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success:true,
      orderId:order.id,
      amount:order.amount,
      key:process.env.RAZORPAY_KEY_ID
    });

  }catch(err){

    console.error("RAZORPAY ERROR:", err);

    res.status(500).json({
      success:false,
      message:"Payment order failed"
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

    // ================= STOCK VALIDATION =================

    for(const item of items){

      const product = await Product.findOne({ slug:item.slug });

      if(!product){
        return res.status(400).json({
          success:false,
          message:"Product not found"
        });
      }

      if(product.trackStock && !product.allowBackorder){

        if(product.stock < item.qty){
          return res.status(400).json({
            success:false,
            message:`${product.name} is out of stock`
          });
        }

      }

    }

    // ================= SIGNATURE VERIFY =================

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if(expectedSignature !== razorpay_signature){
      return res.status(400).json({
        success:false,
        message:"Payment verification failed"
      });
    }

    // ================= SAVE ORDER =================

const enrichedItems = [];

for(const item of items){

  const product = await Product.findOne({ slug:item.slug });

  enrichedItems.push({
    slug: item.slug,
    name: product.name,
    price: product.price,
    image: product.images?.[0],
    qty: item.qty
  });

}

const order = new Order({
  userId,
  items: enrichedItems,
  shippingAddress,
  paymentMethod:"Razorpay"
});

    await order.save();

    // ================= REDUCE STOCK =================

    for(const item of items){

      const product = await Product.findOne({ slug:item.slug });

      if(product && product.trackStock){

        product.stock = Math.max(0, product.stock - item.qty);

        await product.save();

      }

    }

    res.json({
      success:true,
      message:"Payment verified and order saved"
    });

  } catch(err){

    console.error("VERIFY ERROR:", err);

    res.status(500).json({
      success:false,
      message:"Verification failed"
    });

  }

});

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