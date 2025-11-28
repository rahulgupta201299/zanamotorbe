const express = require('express');
const router = express.Router();
const modelController = require('../controllers/modelController');

router.post('/', modelController.createModel);
router.get('/brand/:brandId', modelController.getModelsByBrand);
router.get('/:id', modelController.getModelById);
router.post('/:id', modelController.updateModel);

module.exports = router;
