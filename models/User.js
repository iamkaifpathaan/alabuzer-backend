const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  name: String,

  phone: {
    type: String,
    unique: true,
    sparse: true
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

  emailVerified: {
    type: Boolean,
    default: false
  },

  emailOtp: String,
  emailOtpExpire: Date,

  resetAllowed: {
    type: Boolean,
    default: false
  },
  resetAllowedExpire: Date,

  otp: String,
  otpExpire: Date,

  role: {
    type: String,
    default: "user"
  }

}, { timestamps: true });

userSchema.pre('save', async function() {
  if (!this.phone) {
    this.phone = undefined;
  }
});

module.exports = mongoose.model("User", userSchema);