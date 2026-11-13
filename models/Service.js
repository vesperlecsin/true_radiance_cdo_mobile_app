const { Schema, model } = require('mongoose');
const { CATEGORIES } = require('../config/rules');

module.exports = model('Service', new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  category: { type: String, enum: CATEGORIES, required: true },
  description: { type: String, default: '' },
  durationMin: { type: Number, required: true, min: 15 },
  price: { type: Number, required: true, min: 0 },   // PHP
  popular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true }));
