// server/controllers/authController.js
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


exports.registerUser = async (req, res) => {
    const { username, email, password } = req.body;

    // Verificar si el correo electrónico o el nombre de usuario ya están registrados
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
        return res.status(400).json({ message: 'El correo ya está registrado' });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
        return res.status(400).json({ message: 'El nombre de usuario ya está registrado' });
    }

    // Encriptar la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear un nuevo usuario
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'Usuario registrado con éxito' });
};

// server/controllers/authController.js

// Login de usuario
exports.loginUser = async (req, res) => {
    const { username, password } = req.body;
  
    // Buscar al usuario por username sin importar mayúsculas/minúsculas
    const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } }); // Usamos 'i' para insensibilidad a mayúsculas/minúsculas
    if (!user) {
      return res.status(400).json({ message: 'El usuario no existe' });
    }
  
    // Verificar la contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Contraseña incorrecta' });
    }
  
    // Generar un token JWT
    const token = jwt.sign({ userId: user._id }, 'secret_key', { expiresIn: '1h' });
    res.status(200).json({ message: 'Inicio de sesión exitoso', token });
  };
  