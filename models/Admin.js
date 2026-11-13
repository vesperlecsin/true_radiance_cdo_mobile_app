const { Schema, model } = require('mongoose');
module.exports = model('Admin', new Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, default: 'Admin' },
  role: { type: String, default: 'Branch Manager' }
}, { timestamps: true }));
