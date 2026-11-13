const { Schema, model } = require('mongoose');
// One document (_id: 'main') holding the editable booking policies
module.exports = model('Setting', new Schema({ _id: String }, { strict: false, timestamps: true }));