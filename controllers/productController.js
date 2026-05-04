const BikeProduct = require('../models/BikeProduct');
const BikeModel = require('../models/BikeModel');
const Wishlist = require('../models/Wishlist');
const { getConvertedPrice } = require('../utils/exchangeRate');
const currencyList = require('../utils/currencyList');
const mongoose = require('mongoose');

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

// Helper function to convert product prices based on currency
const convertProductPrices = async (products, currency) => {
    if (!products || !Array.isArray(products) || products.length === 0) {
        return products;
    }

    // Get INR info for default currency
    const inrCurrency = currencyList.find(c => c.code === 'INR');
    
    if (!currency || currency === 'INR') {
        // For INR, still add currency info for consistency
        const convertedProducts = products.map((product) => {
            const productObj = product.toObject ? product.toObject() : product;
            return {
                ...productObj,
                originalPrice: productObj.price,
                currency: 'INR',
                currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
            };
        });
        return convertedProducts;
    }

    // Check if valid currency
    const validCurrency = currencyList.find(c => c.code === currency);
    if (!validCurrency) {
        // Return with INR info if currency is invalid
        const convertedProducts = products.map((product) => {
            const productObj = product.toObject ? product.toObject() : product;
            return {
                ...productObj,
                currency: 'INR',
                currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
            };
        });
        return convertedProducts;
    }

    const convertedProducts = await Promise.all(
        products.map(async (product) => {
            const productObj = product.toObject ? product.toObject() : product;
            const originalPrice = productObj.price || 0;
            const convertedPrice = await getConvertedPrice(originalPrice, currency);
            
            return {
                ...productObj,
                price: convertedPrice,
                originalPrice: originalPrice,
                currency: currency,
                currencySymbol: validCurrency.symbol
            };
        })
    );

    return convertedProducts;
};

// Helper function to convert single product price
const convertSingleProductPrice = async (product, currency) => {
    // Get INR info for default currency
    const inrCurrency = currencyList.find(c => c.code === 'INR');
    
    if (!currency || currency === 'INR') {
        // For INR, still add currency info for consistency
        const productObj = product.toObject ? product.toObject() : product;
        return {
            ...productObj,
            originalPrice: productObj.price,
            currency: 'INR',
            currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
        };
    }

    const validCurrency = currencyList.find(c => c.code === currency);
    if (!validCurrency) {
        // Return with INR info if currency is invalid
        const productObj = product.toObject ? product.toObject() : product;
        return {
            ...productObj,
            currency: 'INR',
            currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
        };
    }

    const productObj = product.toObject ? product.toObject() : product;
    const originalPrice = productObj.price || 0;
    const convertedPrice = await getConvertedPrice(originalPrice, currency);

    return {
        ...productObj,
        price: convertedPrice,
        originalPrice: originalPrice,
        currency: currency,
        currencySymbol: validCurrency.symbol
    };
};

exports.createProduct = async (req, res) => {
    try {
        const { brand, model, isBikeSpecific, name, productCode, isNewArrival, isGarageFavorite, isComingSoon, shortDescription, longDescription, description, category, subCategory, categoryIcon, price, imageUrl, images, quantityAvailable, specifications, shippingAndReturn, isActive, priority } = req.body;
        const autoBikeSpecific = model ? (isBikeSpecific !== undefined ? isBikeSpecific : true) : false;

        const newProduct = new BikeProduct({
            brand,
            model,
            isBikeSpecific: autoBikeSpecific,
            name,
            productCode,
            isNewArrival,
            isGarageFavorite,
            isComingSoon,
            shortDescription,
            longDescription,
            description,
            category,
            subCategory,
            categoryIcon,
            price,
            imageUrl,
            images,
            quantityAvailable,
            specifications,
            shippingAndReturn,
            isActive,
            priority
        });
        await newProduct.save();
        res.status(201).json({ success: true, data: newProduct });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getProductsByModel = async (req, res) => {
    try {
        const { phoneNumber, currency, category, subCategory } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000;
        const skip = (page - 1) * limit;

        const query = { model: req.params.modelId, isActive: true };
        
        if (category) {
            query.category = { $regex: new RegExp(category, 'i') };
        }
        if (subCategory) {
            query.subCategory = { $regex: new RegExp(subCategory, 'i') };
        }

        const totalProducts = await BikeProduct.countDocuments(query);

        const products = await BikeProduct.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ priority: -1, quantityAvailable: -1, createdAt: -1 });

        const productsWithWishlist = await addIsWishlistToProducts(products, phoneNumber);
        const productsWithCurrency = await convertProductPrices(productsWithWishlist, currency);

        const totalPages = Math.ceil(totalProducts / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            success: true,
            data: productsWithCurrency,
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
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const { phoneNumber, currency } = req.query;
        const product = await BikeProduct.findOne({ _id: req.params.id, isActive: true });
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        
        const productsWithWishlist = await addIsWishlistToProducts([product], phoneNumber);
        const productWithCurrency = await convertSingleProductPrice(productsWithWishlist[0], currency);
        
        res.status(200).json({ success: true, data: productWithCurrency });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { brand, model, isBikeSpecific, name, productCode, isNewArrival, isGarageFavorite, isComingSoon, shortDescription, longDescription, description, category, subCategory, categoryIcon, price, imageUrl, images, quantityAvailable, specifications, shippingAndReturn, isActive, priority } = req.body;

        const autoBikeSpecific = model ?
            (isBikeSpecific !== undefined ? isBikeSpecific : true) :
            false;

        const updateFields = { 
            brand, model, isBikeSpecific: autoBikeSpecific, name, productCode, 
            isNewArrival, isGarageFavorite, isComingSoon, shortDescription, 
            longDescription, description, category, subCategory, categoryIcon, 
            price, imageUrl, images, quantityAvailable, specifications, 
            shippingAndReturn, isActive, priority 
        };

        // Remove undefined fields
        Object.keys(updateFields).forEach(key => updateFields[key] === undefined && delete updateFields[key]);

        const product = await BikeProduct.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true }
        );
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getProductsByCategory = async (req, res) => {
    try {
        const { phoneNumber, currency } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000;
        const skip = (page - 1) * limit;

        const query = { 
            category: { $regex: new RegExp(req.params.category, 'i') },
            isActive: true 
        };

        const totalProducts = await BikeProduct.countDocuments(query);

        const products = await BikeProduct.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ priority: -1, quantityAvailable: -1, createdAt: -1 });

        const productsWithWishlist = await addIsWishlistToProducts(products, phoneNumber);
        const productsWithCurrency = await convertProductPrices(productsWithWishlist, currency);

        const totalPages = Math.ceil(totalProducts / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            success: true,
            data: productsWithCurrency,
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
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getProductsByCategoryAndSubCategory = async (req, res) => {
    try {
        const { phoneNumber, currency } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000;
        const skip = (page - 1) * limit;

        const query = { 
            category: { $regex: new RegExp(req.params.category, 'i') },
            subCategory: { $regex: new RegExp(req.params.subCategory, 'i') },
            isActive: true 
        };

        const totalProducts = await BikeProduct.countDocuments(query);

        const products = await BikeProduct.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ priority: -1, quantityAvailable: -1, createdAt: -1 });

        const productsWithWishlist = await addIsWishlistToProducts(products, phoneNumber);
        const productsWithCurrency = await convertProductPrices(productsWithWishlist, currency);

        const totalPages = Math.ceil(totalProducts / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            success: true,
            data: productsWithCurrency,
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
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.getAllProductsPaginated = async (req, res) => {
    try {
        const { phoneNumber, currency } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000;
        const skip = (page - 1) * limit;

        const totalProducts = await BikeProduct.countDocuments({ isActive: true });

        const products = await BikeProduct.find({ isActive: true })
            .skip(skip)
            .limit(limit)
            .sort({ priority: -1, quantityAvailable: -1, createdAt: -1 });

        const productsWithWishlist = await addIsWishlistToProducts(products, phoneNumber);
        const productsWithCurrency = await convertProductPrices(productsWithWishlist, currency);

        const totalPages = Math.ceil(totalProducts / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({
            success: true,
            data: productsWithCurrency,
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
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.searchProducts = async (req, res) => {
    try {
        const { query, page = 1, limit = 1000, currency } = req.query;
        if (!query) {
        return res.status(400).json({ success: false, message: 'Query parameter is required' });
        }
        const skip = (page - 1) * parseInt(limit);

        // Decode URL-encoded query to handle spaces (%20, + etc.)
        let decodedQuery = decodeURIComponent(query);
        
        // Escape special regex characters and handle spaces
        const escapedQuery = decodedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, ' ').trim();
        const caseInsensitiveRegex = { $regex: escapedQuery, $options: 'i' };

        const matchingModels = await BikeModel.find({ name: caseInsensitiveRegex, isActive: true }).select('_id');
        const modelIds = matchingModels.map(m => m._id);

        const searchQuery = {
            $and: [
                { isActive: true },
                {
                    $or: [
                        { name: caseInsensitiveRegex },
                        { productCode: caseInsensitiveRegex },
                        { model: { $in: modelIds } }
                    ]
                }
            ]
        };

        const totalCount = await BikeProduct.countDocuments(searchQuery);

        const products = await BikeProduct.find(searchQuery)
            .select('name _id shortDescription price imageUrl category productCode quantityAvailable priority')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ priority: -1, quantityAvailable: -1, createdAt: -1 });

        const productsWithCurrency = await convertProductPrices(products, currency);
        const totalPages = Math.ceil(totalCount / limit);

        res.status(200).json({
            success: true,
            data: productsWithCurrency,
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
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCategoryCounts = async (req, res) => {
    try {
        const { currency } = req.query;
        
        const categoriesData = await BikeProduct.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    categoryIcon: { $first: '$categoryIcon' },
                    samplePrice: { $first: '$price' }
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

        // Get INR info for default currency
        const inrCurrency = currencyList.find(c => c.code === 'INR');

        // Convert prices if currency is provided
        if (currency && currency !== 'INR') {
            const validCurrency = currencyList.find(c => c.code === currency);
            if (validCurrency) {
                for (let cat of categoriesData) {
                    if (cat.samplePrice) {
                        cat.price = await getConvertedPrice(cat.samplePrice, currency);
                        cat.currency = currency;
                        cat.currencySymbol = validCurrency.symbol;
                    }
                }
            }
        } else {
            // Always include INR currency info for consistency
            for (let cat of categoriesData) {
                if (cat.samplePrice) {
                    cat.currency = 'INR';
                    cat.currencySymbol = inrCurrency ? inrCurrency.symbol : '₹';
                }
            }
        }

        res.status(200).json({
            success: true,
            data: categoriesData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCategoryCountsByModel = async (req, res) => {
    try {
        const { modelId } = req.params;
        const { currency } = req.query;
        
        const categoriesData = await BikeProduct.aggregate([
            { 
                $match: { 
                    model: new mongoose.Types.ObjectId(modelId),
                    isActive: true 
                } 
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    categoryIcon: { $first: '$categoryIcon' },
                    samplePrice: { $first: '$price' }
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

        // Get INR info for default currency
        const inrCurrency = currencyList.find(c => c.code === 'INR');

        // Convert prices if currency is provided
        if (currency && currency !== 'INR') {
            const validCurrency = currencyList.find(c => c.code === currency);
            if (validCurrency) {
                for (let cat of categoriesData) {
                    if (cat.samplePrice) {
                        cat.price = await getConvertedPrice(cat.samplePrice, currency);
                        cat.currency = currency;
                        cat.currencySymbol = validCurrency.symbol;
                    }
                }
            }
        } else {
            // Always include INR currency info for consistency
            for (let cat of categoriesData) {
                if (cat.samplePrice) {
                    cat.currency = 'INR';
                    cat.currencySymbol = inrCurrency ? inrCurrency.symbol : '₹';
                }
            }
        }

        res.status(200).json({
            success: true,
            data: categoriesData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getGarageFavorites = async (req, res) => {
    try {
        const { phoneNumber, currency } = req.query;
        const products = await BikeProduct.find({ isGarageFavorite: true, isActive: true })
            .sort({ priority: -1, quantityAvailable: -1, createdAt: -1 });
        
        const productsWithWishlist = await addIsWishlistToProducts(products, phoneNumber);
        const productsWithCurrency = await convertProductPrices(productsWithWishlist, currency);
        
        res.status(200).json({ success: true, data: productsWithCurrency });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getNewArrivals = async (req, res) => {
    try {
        const { phoneNumber, currency } = req.query;
        const products = await BikeProduct.find({ isNewArrival: true, isActive: true })
            .sort({ priority: -1, quantityAvailable: -1, createdAt: -1 });
        
        const productsWithWishlist = await addIsWishlistToProducts(products, phoneNumber);
        const productsWithCurrency = await convertProductPrices(productsWithWishlist, currency);
        
        res.status(200).json({ success: true, data: productsWithCurrency });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSubCategoryCountsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const subCategoriesData = await BikeProduct.aggregate([
            { 
                $match: { 
                    category: { $regex: new RegExp(category, 'i') },
                    isActive: true 
                } 
            },
            {
                $group: {
                    _id: '$subCategory',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $project: {
                    name: '$_id',
                    count: 1,
                    _id: 0
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: subCategoriesData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSubCategoryCountsByCategoryAndModel = async (req, res) => {
    try {
        const { category, modelId } = req.params;
        const subCategoriesData = await BikeProduct.aggregate([
            { 
                $match: { 
                    category: { $regex: new RegExp(category, 'i') },
                    model: new mongoose.Types.ObjectId(modelId),
                    isActive: true 
                } 
            },
            {
                $group: {
                    _id: '$subCategory',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $project: {
                    name: '$_id',
                    count: 1,
                    _id: 0
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: subCategoriesData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
