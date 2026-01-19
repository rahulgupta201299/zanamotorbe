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

// Add product to wishlist
exports.addToWishlist = async (req, res) => {
    try {
        const { phoneNumber, productId } = req.body;

        if (!phoneNumber || !productId) {
            return res.status(400).json({
                success: false,
                error: 'phoneNumber and productId are required'
            });
        }

        // Check if product exists
        const product = await BikeProduct.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        let wishlist = await getOrCreateWishlist(phoneNumber);

        // Check if product already in wishlist
        const productExists = wishlist.products.some(id => id.toString() === productId);

        if (productExists) {
            await wishlist.populate({
                path: 'products',
                populate: {
                    path: 'brand model'
                }
            });
            return res.status(200).json({
                success: true,
                message: 'Product already in wishlist',
                data: wishlist
            });
        }

        // Add product to wishlist
        wishlist.products.push(productId);
        await wishlist.save();
        await wishlist.populate({
            path: 'products',
            populate: {
                path: 'brand model'
            }
        });

        res.status(200).json({
            success: true,
            message: 'Product added to wishlist successfully',
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

// Remove product from wishlist
exports.removeFromWishlist = async (req, res) => {
    try {
        const { phoneNumber, productId } = req.body;

        if (!phoneNumber || !productId) {
            return res.status(400).json({
                success: false,
                error: 'phoneNumber and productId are required'
            });
        }

        const wishlist = await Wishlist.findOne({ phoneNumber });
        if (!wishlist) {
            return res.status(404).json({
                success: false,
                error: 'Wishlist not found'
            });
        }

        const productIndex = wishlist.products.findIndex(id => id.toString() === productId);
        if (productIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Product not found in wishlist'
            });
        }

        // Remove product
        wishlist.products.splice(productIndex, 1);

        // If wishlist becomes empty, delete it
        if (wishlist.products.length === 0) {
            await Wishlist.findByIdAndDelete(wishlist._id);
            return res.status(200).json({
                success: true,
                message: 'Product removed from wishlist successfully. Wishlist is now empty.',
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
            message: 'Product removed from wishlist successfully',
            data: wishlist
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
