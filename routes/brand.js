const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');

router.post('/', brandController.createBrand);
router.post('/:id', brandController.updateBrand);
router.get('/', brandController.getAllBrands);
router.get('/with-models', brandController.getBrandsWithModels);

module.exports = router;
