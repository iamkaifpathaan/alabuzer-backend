const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Product = require("../models/Product");

/* =========================
   🛒 CREATE ORDER
========================= */

router.post("/", async (req, res) => {
  try {
    const {
      userId,
      items,
      shippingAddress,
      paymentMethod
    } = req.body;

    if (!userId || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid order data"
      });
    }

    /* =========================
   📦 STOCK VALIDATION
========================= */

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
}

    const order = new Order({
      userId,
      items,
      shippingAddress,
      paymentMethod
    });

    await order.save();

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

router.get("/user/:userId", async (req, res) => {
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

router.put("/status/:id", async (req, res) => {
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

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus: status },
      { new: true }
    );

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

module.exports = router;

/* =========================
   📦 GET ALL ORDERS (ADMIN)
========================= */

router.get("/all", async (req, res) => {
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