const express = require('express');
const router = express.Router();
const modelController = require('../controllers/modelController');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 5MB limit
    }
});

router.post('/', upload.single('image'), modelController.createModel);
router.get('/brand/:brandId', modelController.getModelsByBrand);
router.get('/:id', modelController.getModelById);
router.post('/:id', upload.single('image'), modelController.updateModel);

module.exports = router;
