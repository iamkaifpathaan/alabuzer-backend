const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  name: String,

  // Phone is NOT part of the account/auth system.
  // It is used only during checkout and belongs to the Order (shippingAddress.phone).
  // Therefore we must NOT enforce uniqueness or store it on the User.
  // (Kept out entirely to prevent E11000 dup key errors on phone:null.)

  email: {
    type: String,
    unique: true,
    sparse: true
  },

  password: String,

  emailVerified: {
    type: Boolean,
    default: false
  },

  emailOtp: String,
  emailOtpExpire: Date,

  pendingEmail: String,
  pendingEmailOtp: String,
  pendingEmailOtpExpire: Date,
  pendingEmailOtpResendCount: {
    type: Number,
    default: 0
  },
  pendingEmailOtpLastSent: Date,

  resetOtp: String,
  resetOtpExpire: Date,
  resetOtpVerified: {
    type: Boolean,
    default: false
  },

  role: {
    type: String,
    default: "user"
  }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
