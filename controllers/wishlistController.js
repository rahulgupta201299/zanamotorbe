const Wishlist = require('../models/Wishlist');
const BikeProduct = require('../models/BikeProduct');

// Helper function to get or create wishlist
const getOrCreateWishlist = async (phoneNumber) => {
    let wishlist = await Wishlist.findOne({ phoneNumber });
    if (!wishlist) {
        wishlist = new Wishlist({
            phoneNumber,
            products: []
        });
        await wishlist.save();
    }
    return wishlist;
};

// Add products to wishlist
exports.addToWishlist = async (req, res) => {
    try {
        const { phoneNumber, productIds } = req.body;

        if (!phoneNumber || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'phoneNumber and productIds (array) are required'
            });
        }

        // Check if all products exist
        const products = await BikeProduct.find({ _id: { $in: productIds } });
        if (products.length !== productIds.length) {
            const foundIds = products.map(p => p._id.toString());
            const missingIds = productIds.filter(id => !foundIds.includes(id));
            return res.status(404).json({
                success: false,
                error: 'Some products not found',
                missingProductIds: missingIds
            });
        }

        let wishlist = await getOrCreateWishlist(phoneNumber);

        // Find products that are not already in wishlist
        const existingProductIds = wishlist.products.map(id => id.toString());
        const newProductIds = productIds.filter(id => !existingProductIds.includes(id));

        if (newProductIds.length === 0) {
            await wishlist.populate({
                path: 'products',
                populate: {
                    path: 'brand model'
                }
            });
            return res.status(200).json({
                success: true,
                message: 'All products already in wishlist',
                data: wishlist
            });
        }

        // Add new products to wishlist
        wishlist.products.push(...newProductIds);
        await wishlist.save();
        await wishlist.populate({
            path: 'products',
            populate: {
                path: 'brand model'
            }
        });

        const message = newProductIds.length === productIds.length 
            ? 'Products added to wishlist successfully' 
            : 'Some products were already in wishlist, others added successfully';

        res.status(200).json({
            success: true,
            message: message,
            data: wishlist
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get user's wishlist
exports.getWishlist = async (req, res) => {
    try {
        const { phoneNumber } = req.params;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'phoneNumber is required'
            });
        }

        const wishlist = await Wishlist.findOne({ phoneNumber }).populate({
            path: 'products',
            populate: {
                path: 'brand model'
            }
        });

        if (!wishlist) {
            // Return empty wishlist
            return res.status(200).json({
                success: true,
                data: {
                    phoneNumber,
                    products: [],
                    _id: null
                }
            });
        }

        res.status(200).json({
            success: true,
            data: wishlist
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Remove products from wishlist
exports.removeFromWishlist = async (req, res) => {
    try {
        const { phoneNumber, productIds } = req.body;

        if (!phoneNumber || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'phoneNumber and productIds (array) are required'
            });
        }

        const wishlist = await Wishlist.findOne({ phoneNumber });
        if (!wishlist) {
            return res.status(404).json({
                success: false,
                error: 'Wishlist not found'
            });
        }

        const originalLength = wishlist.products.length;
        
        // Remove all products that are in the productIds array
        wishlist.products = wishlist.products.filter(id => !productIds.includes(id.toString()));

        const removedCount = originalLength - wishlist.products.length;

        if (removedCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'None of the products found in wishlist'
            });
        }

        // If wishlist becomes empty, delete it
        if (wishlist.products.length === 0) {
            await Wishlist.findByIdAndDelete(wishlist._id);
            return res.status(200).json({
                success: true,
                message: 'Products removed from wishlist successfully. Wishlist is now empty.',
                data: {
                    phoneNumber,
                    products: [],
                    _id: null
                }
            });
        }

        await wishlist.save();
        await wishlist.populate({
            path: 'products',
            populate: {
                path: 'brand model'
            }
        });

        res.status(200).json({
            success: true,
            message: 'Products removed from wishlist successfully',
            data: wishlist
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
