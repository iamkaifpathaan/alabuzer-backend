const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
  password: String,
  phone: String,

  role: {
  type: String,
  default: "user" // user or admin
}
 
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);