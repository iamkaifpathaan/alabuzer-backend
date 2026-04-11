const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  name: String,

  phone: {
    type: String,
    required: true,
    unique: true
  },

  phoneVerified: {
  type: Boolean,
  default: false
  },

  email: {
    type: String,
    unique: true,
    sparse: true
  },

  password: String,

  otp: String,
  otpExpire: Date,

  role: {
    type: String,
    default: "user"
  }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);