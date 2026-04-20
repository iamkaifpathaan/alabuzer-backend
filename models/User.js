const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  name: String,

  phone: {
    type: String,
    unique: true,
    sparse: true,
    set: function(v) {
      if (v === null || v === undefined || v === '') return undefined;
      return v;
    }
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

  otp: String,
  otpExpire: Date,

  role: {
    type: String,
    default: "user"
  }

}, { timestamps: true });

userSchema.pre('save', function() {
  if (!this.phone) {
    this.phone = undefined;
    this.unmarkModified('phone');
  }
});

module.exports = mongoose.model("User", userSchema);