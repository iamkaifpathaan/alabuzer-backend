const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  name: String,

  // Phase 1 (index fix only): phone fields stay for now because checkout flows
  // currently rely on user.phoneVerified and user.phone.
  // IMPORTANT: phone must NOT be unique across users.
  phone: {
    type: String,
    // no unique index here (phone can be shared across users)
    // keep sparse so missing phones are not indexed if an index exists in DB
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

  phoneOtpResendCount: {
  type: Number,
  default: 0
  },

  phoneOtpLastSent: Date,

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
  phoneOtpTarget: String,

  role: {
    type: String,
    default: "user"
  }

}, { timestamps: true });

// Prevent persisting phone as null/"" which can still be indexed and cause
// dup-key errors if any leftover unique index exists in the DB.
userSchema.pre('save', function() {
  if (!this.phone) {
    this.phone = undefined;
    this.unmarkModified('phone');
  }
});

module.exports = mongoose.model("User", userSchema);
