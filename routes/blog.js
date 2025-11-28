const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');

router.post('/', blogController.createBlog);
router.get('/', blogController.getAllBlogs);
router.get('/recommend', blogController.recommendBlogsByTitle);
router.get('/:id', blogController.getBlogById);
router.post('/update/:id', blogController.updateBlog);
router.post('/delete/:id', blogController.deleteBlog);

module.exports = router;
