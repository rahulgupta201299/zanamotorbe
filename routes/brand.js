const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');

router.post('/', brandController.createBrand);
router.get('/', brandController.getAllBrands);
router.get('/with-models', brandController.getBrandsWithModels);

module.exports = router;
