const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

router.post('/', categoryController.createCategory);
router.get('/', categoryController.getCategories);
router.get('/list', categoryController.getUniqueCategories);
router.get('/subcategories', categoryController.getUniqueSubCategories);
router.post('/:id', categoryController.updateCategory);

module.exports = router;
