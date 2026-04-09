const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  name: {
    type: String,
    default: "User"
  },

  phone: {
    type: String,
    required: true,
    unique: true
  },

  otp: Number,
  otpExpire: Date,

  role: {
    type: String,
    default: "user"
  }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);