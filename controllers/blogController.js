const Blog = require('../models/Blog');

exports.createBlog = async (req, res) => {
    try {
        const { title, description, content, imageUrl } = req.body;
        const newBlog = new Blog({ title, description, content, imageUrl });
        await newBlog.save();
        res.status(201).json({ success: true, data: newBlog });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getAllBlogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get total count for pagination metadata
        const totalBlogs = await Blog.countDocuments();

        // Fetch paginated blogs
        const blogs = await Blog.find()
            .sort({ createdAt: -1 }) // Sort by newest first
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalBlogs / limit);

        res.status(200).json({
            success: true,
            data: blogs,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalBlogs: totalBlogs,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                limit: limit
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getBlogById = async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ success: false, error: 'Blog not found' });
        res.status(200).json({ success: true, data: blog });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateBlog = async (req, res) => {
    try {
        const { title, description, content, imageUrl } = req.body;
        const blog = await Blog.findByIdAndUpdate(
            req.params.id,
            { title, description, content, imageUrl },
            { new: true }
        );
        if (!blog) return res.status(404).json({ success: false, error: 'Blog not found' });
        res.status(200).json({ success: true, data: blog });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.deleteBlog = async (req, res) => {
    try {
        const blog = await Blog.findByIdAndDelete(req.params.id);
        if (!blog) return res.status(404).json({ success: false, error: 'Blog not found' });
        res.status(200).json({ success: true, data: { message: 'Blog deleted successfully' } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.recommendBlogsByTitle = async (req, res) => {
    try {
        const { title, limit = 10 } = req.query;

        if (!title) {
            return res.status(400).json({
                success: false,
                error: 'Title search parameter is required'
            });
        }

        // Create a case-insensitive regex search for title keywords
        const titleRegex = new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        const blogs = await Blog.find({
            title: { $regex: titleRegex }
        })
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }); // Sort by newest first

        res.status(200).json({
            success: true,
            searchedTitle: title,
            totalResults: blogs.length,
            limit: parseInt(limit),
            data: blogs
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
