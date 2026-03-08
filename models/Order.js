const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true
},

  items: [
    {
      slug: String,
      name: String,
      price: Number,
      image: String,
      qty: Number
    }
  ],

  shippingAddress: {
    name: String,
    phone: String,
    addressLine: String,
    city: String,
    state: String,
    pincode: String
  },

  paymentMethod: {
    type: String,
    default: "COD"
  },

  orderStatus: {
  type: String,
  enum: ["placed", "confirmed", "shipped", "delivered", "cancelled"],
  default: "placed"
},

}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);