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
  console.error("ERROR:", err);
  res.status(500).json({ 
    success:false,
    message: err.message
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
const bcrypt = require("bcrypt");
app.post("/api/auth/login", async (req,res)=>{

  try{

    const { email, password } = req.body;

    // email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailPattern.test(email)){
      return res.json({
        success:false,
        message:"Invalid email"
      });
    }

    const user = await User.findOne({ email });

    if(!user || !user.password){
      return res.json({
        success:false,
        message:"User not found"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if(!isMatch){
      return res.json({
        success:false,
        message:"Wrong password"
      });
    }

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
        email:user.email,
        emailVerified:user.emailVerified,
        role:user.role
      }
    });

  }catch(err){
  console.error("ERROR:", err);
  res.status(500).json({ 
    success:false,
    message: err.message
  });
}

});

app.post("/api/auth/signup", async (req,res)=>{

  try{

    const { name, email, password, confirmPassword } = req.body;

    // validations
    if(!name || !email || !password){
      return res.json({
        success:false,
        message:"All fields required"
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailPattern.test(email)){
      return res.json({
        success:false,
        message:"Invalid email"
      });
    }

    if(password.length < 8){
      return res.json({
        success:false,
        message:"Password must be at least 8 characters"
      });
    }

    if(confirmPassword !== undefined && password !== confirmPassword){
      return res.json({
        success:false,
        message:"Passwords do not match"
      });
    }

    // check existing user
    const existing = await User.findOne({ email });

    if(existing){
      return res.json({
        success:false,
        message:"Email already registered"
      });
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashed
    });

    await user.save();

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
        email:user.email,
        emailVerified:user.emailVerified,
        role:user.role
      }
    });

  }catch(err){
  console.error("ERROR:", err);
  res.status(500).json({ 
    success:false,
    message: err.message
  });
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
      user:{
  _id:user._id,
  name:user.name,
  email:user.email,
  role:user.role
}
    });

  }catch(err){
  console.error("ERROR:", err);
  res.status(500).json({ 
    success:false,
    message: err.message
  });
}

});

app.post("/api/auth/send-phone-otp", verifyToken, async (req,res)=>{

  try{

    const { phone } = req.body;

    const user = await User.findById(req.user.id);

    if(user.phoneVerified){
    return res.json({
    success:true,
    message:"Already verified"
    });
    }  
    
    if(!/^[6-9]\d{9}$/.test(phone)){
      return res.json({ success:false, message:"Invalid phone" });
    }    

    const otp = String(Math.floor(100000 + Math.random()*900000));

    user.otp = otp;
    user.otpExpire = Date.now() + 5*60*1000;

    await user.save();

    await axios.get("https://www.fast2sms.com/dev/bulkV2", {
      params: {
        authorization: process.env.FAST2SMS_KEY,
        route: "q",
        message: `Your OTP is ${otp}`,
        language: "english",
        numbers: phone
      }
    });

    res.json({ success:true });

  }catch(err){
  console.error("ERROR:", err);
  res.status(500).json({ 
    success:false,
    message: err.message
  });
}

});

app.post("/api/auth/verify-phone-otp", verifyToken, async (req,res)=>{

  try{

    const { phone, otp } = req.body;

    const user = await User.findById(req.user.id);

    if(!user.otp || user.otp != otp){
      return res.json({ success:false, message:"Invalid OTP" });
    }

    if(Date.now() > user.otpExpire){
      return res.json({ success:false, message:"OTP expired" });
    }

    user.phone = phone;
    user.phoneVerified = true; 
    user.otp = null;
    user.otpExpire = null;

    await user.save();

    res.json({ success:true });

  }catch(err){
  console.error("ERROR:", err);
  res.status(500).json({ 
    success:false,
    message: err.message
  });
}

});

app.post("/api/auth/send-otp", async (req,res)=>{

  try{

    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";

    if(!email){
      return res.json({ success:false, message:"Email required" });
    }

    const emailPattern = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{1,63}$/;
    if(!emailPattern.test(email)){
      return res.json({ success:false, message:"Invalid email" });
    }

    const user = await User.findOne({ email: email });

    if(!user){
      return res.json({ success:false, message:"User not found" });
    }

    const otp = String(Math.floor(100000 + Math.random()*900000));

    user.emailOtp = otp;
    user.emailOtpExpire = Date.now() + 10*60*1000;

    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "AL ABUZER - Password Reset OTP",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#1a1a2e;color:#fff;border-radius:12px;">
          <h2 style="color:#d4af37;text-align:center;">AL ABUZER PERFUMES</h2>
          <h3 style="color:#fff;text-align:center;">Password Reset</h3>
          <p style="color:#ccc;">Your OTP for password reset is:</p>
          <div style="background:#d4af37;color:#1a1a2e;font-size:32px;font-weight:bold;text-align:center;padding:16px;border-radius:8px;letter-spacing:8px;">
            ${otp}
          </div>
          <p style="color:#ccc;font-size:13px;margin-top:16px;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
        </div>
      `
    });

    res.json({ success:true, message:"OTP sent to email" });

  }catch(err){
  console.error("ERROR:", err);
  res.status(500).json({ 
    success:false,
    message: err.message
  });
}

});

app.post("/api/auth/verify-otp", async (req,res)=>{

  try{

    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
    const { otp } = req.body;

    if(!email || !otp){
      return res.json({ success:false, message:"All fields required" });
    }

    const emailPattern = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{1,63}$/;
    if(!emailPattern.test(email)){
      return res.json({ success:false, message:"Invalid email" });
    }

    const user = await User.findOne({ email: email });

    if(!user){
      return res.json({ success:false, message:"User not found" });
    }

    if(!user.emailOtp || user.emailOtp !== otp){
      return res.json({ success:false, message:"Invalid OTP" });
    }

    if(Date.now() > user.emailOtpExpire){
      return res.json({ success:false, message:"OTP expired" });
    }

    res.json({ success:true, message:"OTP verified" });

  }catch(err){
  console.error("ERROR:", err);
  res.status(500).json({ 
    success:false,
    message: err.message
  });
}

});

app.post("/api/auth/reset-password", async (req,res)=>{

  try{

    const { email, otp, password, confirmPassword } = req.body;

    if(!email || !otp || !password){
      return res.json({
        success:false,
        message:"All fields required"
      });
    }

    // email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailPattern.test(email)){
      return res.json({
        success:false,
        message:"Invalid email"
      });
    }

    if(password.length < 8){
      return res.json({
        success:false,
        message:"Password must be at least 8 characters"
      });
    }

    if(confirmPassword !== undefined && password !== confirmPassword){
      return res.json({
        success:false,
        message:"Passwords do not match"
      });
    }

    const user = await User.findOne({ email });

    if(!user){
      return res.json({
        success:false,
        message:"User not found"
      });
    }

    if(!user.emailOtp || user.emailOtp !== otp){
      return res.json({
        success:false,
        message:"Invalid OTP"
      });
    }

    if(Date.now() > user.emailOtpExpire){
      return res.json({
        success:false,
        message:"OTP expired"
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    user.password = hashed;
    user.emailOtp = null;
    user.emailOtpExpire = null;
    await user.save();

    res.json({
      success:true,
      message:"Password updated"
    });

  }catch(err){
  console.error("ERROR:", err);
  res.status(500).json({ 
    success:false,
    message: err.message
  });
}

});

app.post("/api/auth/forgot-password", async (req,res)=>{

  try{

    const { email } = req.body;

    if(!email){
      return res.json({ success:false, message:"Email required" });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailPattern.test(email)){
      return res.json({ success:false, message:"Invalid email" });
    }

    const user = await User.findOne({ email });

    if(!user){
      return res.json({ success:false, message:"User not found" });
    }

    const otp = String(Math.floor(100000 + Math.random()*900000));

    user.emailOtp = otp;
    user.emailOtpExpire = Date.now() + 10*60*1000;

    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "AL ABUZER - Password Reset OTP",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#1a1a2e;color:#fff;border-radius:12px;">
          <h2 style="color:#d4af37;text-align:center;">AL ABUZER PERFUMES</h2>
          <h3 style="color:#fff;text-align:center;">Password Reset</h3>
          <p style="color:#ccc;">Your OTP for password reset is:</p>
          <div style="background:#d4af37;color:#1a1a2e;font-size:32px;font-weight:bold;text-align:center;padding:16px;border-radius:8px;letter-spacing:8px;">
            ${otp}
          </div>
          <p style="color:#ccc;font-size:13px;margin-top:16px;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
        </div>
      `
    });

    res.json({ success:true, message:"OTP sent to email" });

  }catch(err){
  console.error("ERROR:", err);
  res.status(500).json({ 
    success:false,
    message: err.message
  });
}

});

app.post("/api/auth/send-email-otp", verifyToken, async (req,res)=>{

  try{

    const user = await User.findById(req.user.id);

    if(!user){
      return res.json({ success:false, message:"User not found" });
    }

    if(user.emailVerified){
      return res.json({ success:true, message:"Email already verified" });
    }

    const otp = String(Math.floor(100000 + Math.random()*900000));

    user.emailOtp = otp;
    user.emailOtpExpire = Date.now() + 10*60*1000;

    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "AL ABUZER - Verify Your Email",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#1a1a2e;color:#fff;border-radius:12px;">
          <h2 style="color:#d4af37;text-align:center;">AL ABUZER PERFUMES</h2>
          <h3 style="color:#fff;text-align:center;">Email Verification</h3>
          <p style="color:#ccc;">Your OTP to verify your email address is:</p>
          <div style="background:#d4af37;color:#1a1a2e;font-size:32px;font-weight:bold;text-align:center;padding:16px;border-radius:8px;letter-spacing:8px;">
            ${otp}
          </div>
          <p style="color:#ccc;font-size:13px;margin-top:16px;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
        </div>
      `
    });

    res.json({ success:true, message:"OTP sent to email" });

  }catch(err){
  console.error("ERROR:", err);
  res.status(500).json({ 
    success:false,
    message: err.message
  });
}

});

app.post("/api/auth/verify-email-otp", verifyToken, async (req,res)=>{

  try{

    const { otp } = req.body;

    if(!otp){
      return res.json({ success:false, message:"OTP required" });
    }

    const user = await User.findById(req.user.id);

    if(!user){
      return res.json({ success:false, message:"User not found" });
    }

    if(user.emailVerified){
      return res.json({ success:true, message:"Email already verified" });
    }

    if(!user.emailOtp || user.emailOtp !== otp){
      return res.json({ success:false, message:"Invalid OTP" });
    }

    if(Date.now() > user.emailOtpExpire){
      return res.json({ success:false, message:"OTP expired" });
    }

    user.emailVerified = true;
    user.emailOtp = null;
    user.emailOtpExpire = null;

    await user.save();

    res.json({ success:true, message:"Email verified successfully" });

  }catch(err){
  console.error("ERROR:", err);
  res.status(500).json({ 
    success:false,
    message: err.message
  });
}

});

// ================================
// 💳 CREATE RAZORPAY ORDER
// ================================

app.post("/api/payment/create-order", verifyToken, async (req, res) => {

  try{

    const user = await User.findById(req.user.id);

    if(!user.phoneVerified){
      return res.status(401).json({
        success:false,
        requirePhone:true,
        message:"Phone verification required"
      });
    }

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