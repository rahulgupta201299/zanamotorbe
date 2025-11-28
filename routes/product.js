const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.post('/', productController.createProduct);
router.get('/all', productController.getAllProductsPaginated);
router.get('/search', productController.searchProducts);
router.get('/categories/count', productController.getCategoryCounts);
router.get('/model/:modelId', productController.getProductsByModel);
router.get('/category/:category', productController.getProductsByCategory);
router.get('/:id', productController.getProductById);
router.post('/:id', productController.updateProduct);

module.exports = router;
