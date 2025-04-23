// server/models/userModel.js
const mongoose = require('../db');  // Importa la conexión a la base de datos

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);  // Crea el modelo

module.exports = User;
