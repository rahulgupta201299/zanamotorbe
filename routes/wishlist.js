const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');

router.post('/add', wishlistController.addToWishlist);
router.get('/:phoneNumber', wishlistController.getWishlist);
router.post('/remove', wishlistController.removeFromWishlist);

module.exports = router;
