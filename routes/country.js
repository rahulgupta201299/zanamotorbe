const express = require('express');
const router = express.Router();
const countryController = require('../controllers/countryController');

router.get('/isd-codes', countryController.getIsdCodes);
router.get('/currencies', countryController.getCurrencies);
router.get('/location-currency', countryController.getLocationCurrency);
router.get('/ip-location-currency', countryController.getIpLocationCurrency);
router.get('/validate-pincode/:pincode', countryController.validatePincode);

module.exports = router;
