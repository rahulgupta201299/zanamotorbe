const BikeProduct = require('../models/BikeProduct');
const BikeModel = require('../models/BikeModel');
const Wishlist = require('../models/Wishlist');
const { getConvertedPrice } = require('../utils/exchangeRate');
const currencyList = require('../utils/currencyList');

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
    if (!currency || currency === 'INR') {
        return products;
    }

    // Check if valid currency
    const validCurrency = currencyList.find(c => c.code === currency);
    if (!validCurrency) {
        return products;
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
    if (!currency || currency === 'INR') {
        return product;
    }

    const validCurrency = currencyList.find(c => c.code === currency);
    if (!validCurrency) {
        return product;
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
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getProductsByModel = async (req, res) => {
    try {
        const { phoneNumber, currency } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalProducts = await BikeProduct.countDocuments({ model: req.params.modelId });

        const products = await BikeProduct.find({ model: req.params.modelId })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

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
        const product = await BikeProduct.findById(req.params.id);
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
        const { brand, model, isBikeSpecific, name, productCode, isNewArrival, isGarageFavorite, shortDescription, longDescription, description, category, categoryIcon, price, imageUrl, images, quantityAvailable, specifications, shippingAndReturn } = req.body;

        const autoBikeSpecific = model ?
            (isBikeSpecific !== undefined ? isBikeSpecific : true) :
            false;

        const product = await BikeProduct.findByIdAndUpdate(
            req.params.id,
            { brand, model, isBikeSpecific: autoBikeSpecific, name, productCode, isNewArrival, isGarageFavorite, shortDescription, longDescription, description, category, categoryIcon, price, imageUrl, images, quantityAvailable, specifications, shippingAndReturn },
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
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalProducts = await BikeProduct.countDocuments({ category: { $regex: new RegExp(req.params.category, 'i') } });

        const products = await BikeProduct.find({ category: { $regex: new RegExp(req.params.category, 'i') } })
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

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
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalProducts = await BikeProduct.countDocuments();

        const products = await BikeProduct.find()
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

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
        const { query, page = 1, limit = 10, currency } = req.query;
        if (!query) {
        return res.status(400).json({ success: false, message: 'Query parameter is required' });
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
        const products = await BikeProduct.find({ isGarageFavorite: true });
        
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
        const products = await BikeProduct.find({ isNewArrival: true });
        
        const productsWithWishlist = await addIsWishlistToProducts(products, phoneNumber);
        const productsWithCurrency = await convertProductPrices(productsWithWishlist, currency);
        
        res.status(200).json({ success: true, data: productsWithCurrency });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
