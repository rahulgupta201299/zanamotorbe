const express = require('express');
const router = express.Router();
const countryController = require('../controllers/countryController');

router.get('/isd-codes', countryController.getIsdCodes);

module.exports = router;
