const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Product = require("../models/Product");
const transporter = require("../utils/mailer");
const User = require("../models/User");

const { verifyToken, verifyAdmin } = require("../middleware/auth");
/* =========================
   🛒 CREATE ORDER
========================= */

router.post("/", verifyToken, async (req, res) => {
  try {
    const {
  items,
  shippingAddress,
  paymentMethod
} = req.body;

const userId = req.user.id;   // 🔐 TAKE FROM TOKEN

const user = await User.findById(userId);

if(!user.phoneVerified){
  return res.status(401).json({
    success:false,
    requirePhone:true,
    message:"Phone verification required"
  });
}

    if (!items || !items.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid order data"
      });
    }

    /* =========================
   📦 STOCK VALIDATION
========================= */

const enrichedItems = [];

for (const item of items) {

  const product = await Product.findOne({ slug: item.slug });

  if (!product) {
    return res.status(400).json({
      success: false,
      message: `Product not found: ${item.slug}`
    });
  }

  if (product.trackStock && !product.allowBackorder) {
    if (product.stock < item.qty) {
      return res.status(400).json({
        success: false,
        message: `${product.name} is out of stock`
      });
    }
  }

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
  paymentMethod
});

    await order.save();

app.post("/api/auth/send-phone-otp", verifyToken, async (req,res)=>{

  try{

    const { phone } = req.body;

    if(!/^[6-9]\d{9}$/.test(phone)){
      return res.json({ success:false, message:"Invalid phone" });
    }

    const user = await User.findById(req.user.id);

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
    res.status(500).json({ success:false });
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
    user.otp = null;
    user.otpExpire = null;

    await user.save();

    res.json({ success:true });

  }catch(err){
    res.status(500).json({ success:false });
  }

});

/* =========================
   📧 ORDER PLACED EMAIL
========================= */

try{

const user = await User.findById(userId);

if(false){ // email system disabled

await transporter.sendMail({

from:process.env.EMAIL_USER,
to:user.email,
subject:"Order Placed - AL ABUZER PERFUMES",

html:`

<h2>Thank you for your order</h2>

<p>Your order has been placed successfully.</p>

<p><strong>Order ID:</strong> ${order._id}</p>

<p>We will notify you when your order ships.</p>

`

});

}

}catch(e){
console.log("EMAIL ERROR:",e);
}

/* =========================
   📉 AUTO STOCK REDUCE
========================= */

for (const item of items) {
  const product = await Product.findOne({ slug: item.slug });

  if (!product) continue;

  // only reduce if stock tracking enabled
  if (product.trackStock) {
    product.stock = Math.max(0, product.stock - item.qty);
    await product.save();
  }
}

    res.json({
      success: true,
      message: "Order placed successfully",
      order
    });

  } catch (err) {
    console.error("ORDER ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Order failed"
    });
  }
});

/* =========================
   📦 GET USER ORDERS
========================= */

const mongoose = require("mongoose");

router.get("/user/:userId", verifyToken, async (req, res) => {
  if (req.user.id !== req.params.userId && req.user.role !== "admin") {
  return res.status(403).json({ success: false, message: "Unauthorized" });
  }
  try {
    const { userId } = req.params;

    // ✅ ObjectId validation (PREMIUM SAFETY)
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId"
      });
    }

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders
    });

  } catch (err) {
    console.error("FETCH ORDER ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders"
    });
  }
});

/* =========================
   🔄 UPDATE ORDER STATUS
========================= */

router.put("/status/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    const allowed = [
      "placed",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled"
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

// 🔥 pehle order fetch kar
const order = await Order.findById(req.params.id);

if (!order) {
  return res.status(404).json({
    success: false,
    message: "Order not found"
  });
}

// 🔒 FLOW CONTROL
const flow = {
  placed: ["confirmed","cancelled"],
  confirmed: ["shipped","cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: []
};

const current = order.orderStatus;

// ❌ invalid jump block
if(!flow[current].includes(status)){
  return res.status(400).json({
    success:false,
    message:"Invalid status transition"
  });
}

if(["delivered","cancelled"].includes(current)){
  return res.status(400).json({
    success:false,
    message:"Final status cannot be changed"
  });
}

// 🔥 ab update kar
order.orderStatus = status;
await order.save();

/* =========================
   📧 ORDER STATUS EMAIL
========================= */

try{

const user = await User.findById(order.userId);

if(false){

await transporter.sendMail({

from:process.env.EMAIL_USER,
to:user.email,
subject:`Order Update - ${status}`,

html:`

<h2>Order Status Updated</h2>

<p>Your order status is now:</p>

<h3>${status.toUpperCase()}</h3>

<p>Order ID: ${order._id}</p>

<p>Thank you for shopping with AL-ABUZER PERFUMES.</p>

`

});

}

}catch(e){
console.log("EMAIL ERROR:",e);
}

    res.json({
      success: true,
      message: "Order status updated",
      order
    });

  } catch (err) {
    console.error("STATUS UPDATE ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update status"
    });
  }
});

/* =========================
   📦 GET ALL ORDERS (ADMIN)
========================= */

router.get("/all", verifyToken, verifyAdmin, async (req, res) => {
  try {

    const orders = await Order.find()
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders
    });

  } catch (err) {

    console.error("ADMIN FETCH ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch orders"
    });

  }
});

module.exports = router;