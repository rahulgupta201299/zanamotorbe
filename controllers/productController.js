const BikeProduct = require('../models/BikeProduct');
const BikeModel = require('../models/BikeModel');

exports.createProduct = async (req, res) => {
    try {
        const { brand, model, isBikeSpecific, name, shortDescription, longDescription, description, category, categoryIcon, price, imageUrl, images, quantityAvailable, specifications, shippingAndReturn } = req.body;

        // Auto-set isBikeSpecific based on whether model is provided
        const autoBikeSpecific = model ? (isBikeSpecific !== undefined ? isBikeSpecific : true) : false;

        const newProduct = new BikeProduct({
            brand,
            model,
            isBikeSpecific: autoBikeSpecific,
            name,
            shortDescription,
            longDescription,
            description,
            category,
            categoryIcon,
            price,
            imageUrl,
            images,
            quantityAvailable,
            specifications,
            shippingAndReturn
        });
        await newProduct.save();
        res.status(201).json({ success: true, data: newProduct });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getProductsByModel = async (req, res) => {
    try {
        const products = await BikeProduct.find({ model: req.params.modelId });
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const product = await BikeProduct.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { brand, model, isBikeSpecific, name, shortDescription, longDescription, description, category, categoryIcon, price, imageUrl, images, quantityAvailable, specifications, shippingAndReturn } = req.body;

        // Auto-set isBikeSpecific based on whether model is provided (only if not explicitly set)
        const autoBikeSpecific = model ?
            (isBikeSpecific !== undefined ? isBikeSpecific : true) :
            false;

        const product = await BikeProduct.findByIdAndUpdate(
            req.params.id,
            { brand, model, isBikeSpecific: autoBikeSpecific, name, shortDescription, longDescription, description, category, categoryIcon, price, imageUrl, images, quantityAvailable, specifications, shippingAndReturn },
            { new: true }
        );
        if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getProductsByCategory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get total count for the category
        const totalProducts = await BikeProduct.countDocuments({ category: req.params.category });

        // Get paginated products for the category
        const products = await BikeProduct.find({ category: req.params.category })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 }); // Sort by newest first

        // Calculate pagination info
        const totalPages = Math.ceil(totalProducts / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            success: true,
            data: products,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalProducts: totalProducts,
                productsPerPage: limit,
                hasNextPage: hasNextPage,
                hasPrevPage: hasPrevPage,
                nextPage: hasNextPage ? page + 1 : null,
                prevPage: hasPrevPage ? page - 1 : null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getAllProductsPaginated = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get total count
        const totalProducts = await BikeProduct.countDocuments();

        // Get paginated products
        const products = await BikeProduct.find()
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 }); // Sort by newest first

        // Calculate pagination info
        const totalPages = Math.ceil(totalProducts / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            success: true,
            data: products,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalProducts: totalProducts,
                productsPerPage: limit,
                hasNextPage: hasNextPage,
                hasPrevPage: hasPrevPage,
                nextPage: hasNextPage ? page + 1 : null,
                prevPage: hasPrevPage ? page - 1 : null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.searchProducts = async (req, res) => {
    try {
        const { query, page = 1, limit = 10 } = req.query;
        if (!query) {
            return res.status(400).json({ success: false, error: 'Query parameter is required' });
        }
        const skip = (page - 1) * parseInt(limit);

        // Find model IDs where name matches query
        const matchingModels = await BikeModel.find({ name: { $regex: new RegExp(query, 'i') } }).select('_id');
        const modelIds = matchingModels.map(m => m._id);

        const totalCount = await BikeProduct.countDocuments({
            $and: [
                {
                    $or: [
                        { name: { $regex: new RegExp(query, 'i') } },
                        { model: { $in: modelIds } }
                    ]
                },
                { quantityAvailable: { $gt: 0 } }
            ]
        });

        const products = await BikeProduct.find({
            $and: [
                {
                    $or: [
                        { name: { $regex: new RegExp(query, 'i') } },
                        { model: { $in: modelIds } }
                    ]
                },
                { quantityAvailable: { $gt: 0 } }
            ]
        })
            .select('name _id shortDescription price imageUrl')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const totalPages = Math.ceil(totalCount / limit);

        res.status(200).json({
            success: true,
            data: products,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalProducts: totalCount,
                productsPerPage: parseInt(limit),
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                nextPage: page < totalPages ? parseInt(page) + 1 : null,
                prevPage: page > 1 ? parseInt(page) - 1 : null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getCategoryCounts = async (req, res) => {
    try {
        // Get category counts using MongoDB aggregation, including categoryIcon
        const categoriesData = await BikeProduct.aggregate([
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    categoryIcon: { $first: '$categoryIcon' }
                }
            },
            {
                $sort: { count: -1 } // Sort by count descending
            },
            {
                $project: {
                    name: '$_id',
                    icon: '$categoryIcon',
                    count: 1,
                    _id: 0
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: categoriesData
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}