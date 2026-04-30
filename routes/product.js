const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 5MB limit per file
    }
});

// Accepts a single 'image' field (primary) and up to 10 'images' (gallery)
const uploadFields = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 10 }
]);

router.post('/', uploadFields, productController.createProduct);
router.get('/all', productController.getAllProductsPaginated);
router.get('/search', productController.searchProducts);
router.get('/categories/count', productController.getCategoryCounts);
router.get('/garage-favorite', productController.getGarageFavorites);
router.get('/new-arrivals', productController.getNewArrivals);
router.get('/model/:modelId', productController.getProductsByModel);
router.get('/category/:category', productController.getProductsByCategory);
router.get('/:id', productController.getProductById);
router.post('/:id', uploadFields, productController.updateProduct);

module.exports = router;
