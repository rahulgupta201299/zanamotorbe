const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const upload = require('../utils/upload');

router.post('/', upload.single('image'), blogController.createBlog);
router.get('/', blogController.getAllBlogs);
router.get('/recommend', blogController.recommendBlogsByTitle);
router.get('/:id', blogController.getBlogById);
router.post('/update/:id', upload.single('image'), blogController.updateBlog);
router.post('/delete/:id', blogController.deleteBlog);

module.exports = router;
