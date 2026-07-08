const Blog = require('../models/Blog');
const { uploadToS3, deleteFromS3 } = require('../utils/s3');

exports.createBlog = async (req, res) => {
    try {
        const { title, description, content, isActive } = req.body;
        let imageUrl = req.body.imageUrl;

        if (req.file) {
            imageUrl = await uploadToS3(req.file, 'blogs');
        }

        const newBlog = new Blog({ title, description, content, imageUrl, isActive });
        await newBlog.save();
        res.status(201).json({ success: true, data: newBlog });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllBlogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;

        const query = {};
        if (req.query.all !== 'true') {
            query.isActive = true;
        }

        // Get total count for pagination metadata
        const totalBlogs = await Blog.countDocuments(query);

        // Fetch paginated blogs
        const blogs = await Blog.find(query)
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
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getBlogById = async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
        res.status(200).json({ success: true, data: blog });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateBlog = async (req, res) => {
    try {
        const { title, description, content, isActive } = req.body;
        let imageUrl = req.body.imageUrl;

        const existingBlog = await Blog.findById(req.params.id);
        if (!existingBlog) return res.status(404).json({ success: false, message: 'Blog not found' });

        if (req.file) {
            imageUrl = await uploadToS3(req.file, 'blogs');
            if (existingBlog.imageUrl) {
                await deleteFromS3(existingBlog.imageUrl);
            }
        } else if (!imageUrl && existingBlog.imageUrl) {
            // Keep old image if no new file is uploaded and no explicit imageUrl provided
            imageUrl = existingBlog.imageUrl;
        } else if (imageUrl !== existingBlog.imageUrl && existingBlog.imageUrl) {
            // If a different explicit string url was sent or null to remove it
            await deleteFromS3(existingBlog.imageUrl);
        }

        existingBlog.title = title || existingBlog.title;
        existingBlog.description = description !== undefined ? description : existingBlog.description;
        existingBlog.content = content || existingBlog.content;
        existingBlog.imageUrl = imageUrl;
        if (isActive !== undefined) {
            existingBlog.isActive = isActive;
        }

        const blog = await existingBlog.save();
        
        res.status(200).json({ success: true, data: blog });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteBlog = async (req, res) => {
    try {
        const blog = await Blog.findByIdAndDelete(req.params.id);
        if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
        
        if (blog.imageUrl) {
            await deleteFromS3(blog.imageUrl);
        }
        
        res.status(200).json({ success: true, data: { message: 'Blog deleted successfully' } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.recommendBlogsByTitle = async (req, res) => {
    try {
        const { title, limit = 100 } = req.query;

        if (!title) {
        return res.status(400).json({
            success: false,
            message: 'Title search parameter is required'
        });
        }

        // Create a case-insensitive regex search for title keywords
        const titleRegex = new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

        const query = { title: { $regex: titleRegex } };
        if (req.query.all !== 'true') {
            query.isActive = true;
        }

        const blogs = await Blog.find(query)
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
        res.status(500).json({ success: false, message: error.message });
    }
};
