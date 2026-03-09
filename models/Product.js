const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  slug: {
    type: String,
    required: true,
    unique: true
  },

  price: {
    type: Number,
    required: true
  },

  discountPrice: {
    type: Number,
    default: 0
  },

  category: {
    type: String,
    required: true,
    enum: [
    "Attar Roll On",
    "Travelling Collection",
    "Body Mist",
    "Perfume 75ml",
    "Oudh Collection",
    "Bakhoor",
    "Air Freshener",
    "Combo Packs"
    ]
  },

  subCategory: {
    type: String
  },

  tags: {
    type: [String],
    default: []
  },

  description: {
    type: String
  },

  images: {
    type: [String],
    default: []
  },

  // ⭐ IMPROVED STOCK SYSTEM
  stock: {
    type: Number,
    default: 0
  },

  trackStock: {
    type: Boolean,
    default: true
  },

  allowBackorder: {
    type: Boolean,
    default: false
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);