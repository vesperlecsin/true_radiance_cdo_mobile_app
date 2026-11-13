const { Schema, model } = require('mongoose');
const { CATEGORIES } = require('../config/rules');

module.exports = model('Specialist', new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  role: { type: String, required: true },
  rating: { type: Number, default: 5 },
  yearsExperience: { type: Number, default: 0 },
  // A specialist can be booked for services in these categories
  serviceCategories: [{ type: String, enum: CATEGORIES }],
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true }));
