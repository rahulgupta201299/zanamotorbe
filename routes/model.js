const express = require('express');
const router = express.Router();
const modelController = require('../controllers/modelController');
const upload = require('../utils/upload');

router.post('/', upload.single('image'), modelController.createModel);
router.get('/brand/:brandId', modelController.getModelsByBrand);
router.get('/:id', modelController.getModelById);
router.post('/:id', upload.single('image'), modelController.updateModel);

module.exports = router;
