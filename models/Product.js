const mongoose = require("mongoose");
const slugify = require("slugify");
const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  slug: {
  type: String,
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

productSchema.index({ slug: 1 });

productSchema.pre("validate", async function(next){

  if(!this.slug && this.name){

    let baseSlug = slugify(this.name,{
      lower:true,
      strict:true
    });

    let slug = baseSlug;
    let counter = 1;

    while(await mongoose.models.Product.findOne({ slug })){
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
  }

  next();

});

module.exports = mongoose.model("Product", productSchema);