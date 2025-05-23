// server/routes/parcelRoutes.js
const express = require('express');
const router = express.Router();
const Parcel = require('../models/parcelModel');

// Guardar una nueva parcela
router.post('/guardar', async (req, res) => {
  try {
    const { name, geometry, parcelaInfo, query, arboles, convergencia, vuelo } = req.body;
    // Si tienes autenticación, puedes obtener el userId del token
    // const userId = req.userId;
    const newParcel = new Parcel({
      name,
      geometry,
      parcelaInfo,
      query,
      arboles,
      convergencia,
      vuelo
      // userId
    });
    await newParcel.save();
    res.status(201).json({ success: true, message: 'Parcela guardada correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al guardar la parcela', error: error.message });
  }
});

// Listar parcelas guardadas
router.get('/listar', async (req, res) => {
  try {
    // Si tienes autenticación, filtra por userId
    // const userId = req.userId;
    // const parcels = await Parcel.find({ userId });
    const parcels = await Parcel.find();
    res.json({ success: true, parcels });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener las parcelas', error: error.message });
  }
});

module.exports = router;
