const { Schema, model } = require('mongoose');
module.exports = model('Customer', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true },          // +639XXXXXXXXX
  passwordHash: { type: String, required: true }
}, { timestamps: true }));