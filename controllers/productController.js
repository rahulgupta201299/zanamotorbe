const BikeProduct = require('../models/BikeProduct');
const BikeModel = require('../models/BikeModel');
const Wishlist = require('../models/Wishlist');

// Helper function to add isWishlist field to products
const addIsWishlistToProducts = async (products, phoneNumber) => {
    if (!phoneNumber) {
        return products.map(product => ({ ...product.toObject(), isWishlist: false }));
    }
    
    const wishlist = await Wishlist.findOne({ phoneNumber });
    const wishlistProductIds = wishlist ? wishlist.products.map(id => id.toString()) : [];
    
    return products.map(product => ({
        ...product.toObject(),
        isWishlist: wishlistProductIds.includes(product._id.toString())
    }));
};

exports.createProduct = async (req, res) => {
    try {
        const { brand, model, isBikeSpecific, name, productCode, isNewArrival, isGarageFavorite, shortDescription, longDescription, description, category, categoryIcon, price, imageUrl, images, quantityAvailable, specifications, shippingAndReturn } = req.body;
        const autoBikeSpecific = model ? (isBikeSpecific !== undefined ? isBikeSpecific : true) : false;

        const newProduct = new BikeProduct({
            brand,
            model,
            isBikeSpecific: autoBikeSpecific,
            name,
            productCode,
            isNewArrival,
            isGarageFavorite,
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
        const { phoneNumber } = req.query;
        const products = await BikeProduct.find({ model: req.params.modelId });
        const productsWithWishlist = await addIsWishlistToProducts(products, phoneNumber);
        res.status(200).json({ success: true, data: productsWithWishlist });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const { phoneNumber } = req.query;
        const product = await BikeProduct.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
        const productsWithWishlist = await addIsWishlistToProducts([product], phoneNumber);
        res.status(200).json({ success: true, data: productsWithWishlist[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { brand, model, isBikeSpecific, name, productCode, isNewArrival, isGarageFavorite, shortDescription, longDescription, description, category, categoryIcon, price, imageUrl, images, quantityAvailable, specifications, shippingAndReturn } = req.body;

        const autoBikeSpecific = model ?
            (isBikeSpecific !== undefined ? isBikeSpecific : true) :
            false;

        const product = await BikeProduct.findByIdAndUpdate(
            req.params.id,
            { brand, model, isBikeSpecific: autoBikeSpecific, name, productCode, isNewArrival, isGarageFavorite, shortDescription, longDescription, description, category, categoryIcon, price, imageUrl, images, quantityAvailable, specifications, shippingAndReturn },
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
        const { phoneNumber } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalProducts = await BikeProduct.countDocuments({ category: { $regex: new RegExp(req.params.category, 'i') } });

        const products = await BikeProduct.find({ category: { $regex: new RegExp(req.params.category, 'i') } })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const productsWithWishlist = await addIsWishlistToProducts(products, phoneNumber);

        const totalPages = Math.ceil(totalProducts / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            success: true,
            data: productsWithWishlist,
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
        const { phoneNumber } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalProducts = await BikeProduct.countDocuments();

        const products = await BikeProduct.find()
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const productsWithWishlist = await addIsWishlistToProducts(products, phoneNumber);

        const totalPages = Math.ceil(totalProducts / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            success: true,
            data: productsWithWishlist,
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
            .select('name _id shortDescription price imageUrl category')
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
        const categoriesData = await BikeProduct.aggregate([
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    categoryIcon: { $first: '$categoryIcon' }
                }
            },
            {
                $sort: { count: -1 }
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
};

exports.getGarageFavorites = async (req, res) => {
    try {
        const products = await BikeProduct.find({ isGarageFavorite: true });
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getNewArrivals = async (req, res) => {
    try {
        const products = await BikeProduct.find({ isNewArrival: true });
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
