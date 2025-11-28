const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

router.post('/', profileController.createProfile);
router.get('/:id', profileController.getProfileById);
router.get('/phone', profileController.getProfileByPhoneNumber);
router.post('/update/:id', profileController.updateProfile);

module.exports = router;


