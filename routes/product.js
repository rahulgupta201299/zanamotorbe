const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../utils/upload');

const productUploadFields = [
    { name: 'imageUrl', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 10 }
];

router.post('/', upload.fields(productUploadFields), productController.createProduct);
router.get('/all', productController.getAllProductsPaginated);
router.get('/landing/bike-specific', productController.getLandingBikeSpecificProducts);
router.get('/landing/universal', productController.getLandingUniversalProducts);
router.get('/search', productController.searchProducts);
router.get('/categories/count', productController.getCategoryCounts);
router.get('/garage-favorite', productController.getGarageFavorites);
router.get('/new-arrivals', productController.getNewArrivals);
router.get('/model/:modelId/categories/count', productController.getCategoryCountsByModel);
router.get('/model/:modelId', productController.getProductsByModel);
router.get('/category/:category', productController.getProductsByCategory);
router.get('/category/:category/subcategory/:subCategory', productController.getProductsByCategoryAndSubCategory);
router.get('/category/:category/subcategories/count', productController.getSubCategoryCountsByCategory);
router.get('/model/:modelId/category/:category/subcategories/count', productController.getSubCategoryCountsByCategoryAndModel);
router.get('/:id', productController.getProductById);
router.post('/:id', upload.fields(productUploadFields), productController.updateProduct);
router.post('/delete/:id', productController.deleteProduct);

module.exports = router;
