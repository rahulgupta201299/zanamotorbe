const Cart = require('../models/Cart');
const BikeProduct = require('../models/BikeProduct');

// Helper function to get or create cart
const getOrCreateCart = async (phoneNumber) => {
    let cart = await Cart.findOne({ phoneNumber, status: 'active' });
    if (!cart) {
        cart = new Cart({
            phoneNumber,
            items: [],
            status: 'active'
        });
        await cart.save();
    }
    return cart;
};

// Helper function to calculate item totals
const calculateItemTotal = (price, quantity) => {
    return price * quantity;
};

const validateProductAvailability = async (items) => {
    const validationResults = [];

    for (const item of items) {
        const product = await BikeProduct.findById(item.productId || item.product);

        if (!product) {
            validationResults.push({
                productId: item.productId || item.product,
                isValid: false,
                message: 'Product not found',
                requestedQuantity: item.quantity,
                availableQuantity: 0
            });
        } else if (product.quantityAvailable < item.quantity) {
            validationResults.push({
                productId: product._id,
                productName: product.name,
                isValid: false,
                message: 'Insufficient quantity available',
                requestedQuantity: item.quantity,
                availableQuantity: product.quantityAvailable,
                price: product.price
            });
        } else {
            validationResults.push({
                productId: product._id,
                productName: product.name,
                isValid: true,
                message: 'Product available',
                requestedQuantity: item.quantity,
                availableQuantity: product.quantityAvailable,
                price: product.price
            });
        }
    }

    return validationResults;
};

exports.validateCart = async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Items array is required and cannot be empty' 
            });
        }

        const validationResults = await validateProductAvailability(items);
        const allValid = validationResults.every(result => result.isValid);
        const invalidItems = validationResults.filter(result => !result.isValid);

        res.status(200).json({ 
            success: true, 
            data: {
                isValid: allValid,
                items: validationResults,
                invalidItems: invalidItems,
                message: allValid ? 'All items are available' : 'Some items are not available'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};





// Get active cart (for cart operations)
exports.getActiveCart = async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        let cart = await Cart.findOne({ phoneNumber, status: 'active' }).populate('items.product');

        if (!cart) {
            // Return virtual empty cart without saving to database
            cart = {
                phoneNumber,
                items: [],
                status: 'active',
                _id: null // Indicates this is a virtual cart
            };
        }

        res.status(200).json({
            success: true,
            data: cart
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Manage cart item (add/update/remove)
exports.manageCartItem = async (req, res) => {
    try {
        const { phoneNumber, productId, quantity } = req.body;

        if (!phoneNumber || !productId || quantity === undefined) {
            return res.status(400).json({
                success: false,
                error: 'phoneNumber, productId, and quantity are required'
            });
        }

        if (quantity < 0) {
            return res.status(400).json({
                success: false,
                error: 'Quantity cannot be negative'
            });
        }

        // Check product exists
        const product = await BikeProduct.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        let cart = await getOrCreateCart(phoneNumber);

        const existingItemIndex = cart.items.findIndex(
            item => item.product.toString() === productId
        );

        if (quantity === 0) {
            // Remove item if exists
            if (existingItemIndex > -1) {
                cart.items.splice(existingItemIndex, 1);
            }
        } else {
            // Check availability
            if (product.quantityAvailable < quantity) {
                return res.status(400).json({
                    success: false,
                    error: 'Insufficient quantity available',
                    available: product.quantityAvailable,
                    requested: quantity
                });
            }

            if (existingItemIndex > -1) {
                // Update existing item
                cart.items[existingItemIndex].quantity = quantity;
                cart.items[existingItemIndex].totalPrice = calculateItemTotal(product.price, quantity);
            } else {
                // Add new item
                cart.items.push({
                    product: productId,
                    quantity: quantity,
                    price: product.price,
                    totalPrice: calculateItemTotal(product.price, quantity)
                });
            }
        }

        // If cart becomes empty after removal, delete it from database
        if (cart.items.length === 0) {
            await Cart.findByIdAndDelete(cart._id);
            // Return virtual empty cart for consistency
            cart = {
                phoneNumber,
                items: [],
                status: 'active',
                _id: null
            };
        } else {
            await cart.save();
            await cart.populate('items.product');
        }

        const action = quantity === 0 ? 'removed from' : (existingItemIndex > -1 ? 'updated in' : 'added to');
        res.status(200).json({
            success: true,
            message: `Item ${action} cart successfully`,
            data: cart
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};



// Clear cart
exports.clearCart = async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'phoneNumber is required'
            });
        }

        const cart = await Cart.findOne({ phoneNumber, status: 'active' });
        if (!cart) {
            return res.status(404).json({
                success: false,
                error: 'Active cart not found'
            });
        }

        // Delete the cart since it's being cleared (becomes empty)
        await Cart.findByIdAndDelete(cart._id);

        // Return virtual empty cart for consistency
        const emptyCart = {
            phoneNumber,
            items: [],
            status: 'active',
            _id: null
        };

        res.status(200).json({
            success: true,
            message: 'Cart cleared successfully',
            data: emptyCart
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update cart addresses
exports.updateCartAddresses = async (req, res) => {
    try {
        const { phoneNumber, shippingAddress, billingAddress } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'phoneNumber is required'
            });
        }

        const cart = await Cart.findOne({ phoneNumber, status: 'active' });
        if (!cart) {
            return res.status(404).json({
                success: false,
                error: 'Active cart not found'
            });
        }

        if (shippingAddress) cart.shippingAddress = shippingAddress;
        if (billingAddress) cart.billingAddress = billingAddress;

        await cart.save();

        res.status(200).json({
            success: true,
            message: 'Cart addresses updated successfully',
            data: {
                shippingAddress: cart.shippingAddress,
                billingAddress: cart.billingAddress
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.checkoutCart = async (req, res) => {
    try {
        const { phoneNumber, paymentMethod = 'online' } = req.body;

        const cart = await Cart.findOne({
            phoneNumber,
            status: { $in: ['active', 'validated'] }
        }).populate('items.product');

        if (!cart) {
            return res.status(404).json({
                success: false,
                error: 'No active cart found'
            });
        }

        if (cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Cart is empty'
            });
        }

        if (!cart.shippingAddress || !cart.billingAddress) {
            return res.status(400).json({
                success: false,
                error: 'Shipping and billing addresses are required'
            });
        }

        // Validate product availability before checkout
        const validationResults = await validateProductAvailability(cart.items);
        const allValid = validationResults.every(result => result.isValid);

        if (!allValid) {
            return res.status(400).json({
                success: false,
                error: 'Some products are no longer available',
                data: validationResults
            });
        }

        // Update cart for checkout
        cart.paymentMethod = paymentMethod;
        cart.status = 'checkout';

        await cart.save();

        res.status(200).json({
            success: true,
            message: 'Cart ready for checkout',
            data: {
                cartId: cart._id,
                totalAmount: cart.totalAmount,
                paymentMethod: paymentMethod,
                status: cart.status,
                itemsCount: cart.items.length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
