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

// Manage cart item (add/update/remove multiple items)
exports.manageCartItem = async (req, res) => {
    try {
        const { phoneNumber, items } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'phoneNumber is required'
            });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'items array is required and cannot be empty'
            });
        }

        let cart = await getOrCreateCart(phoneNumber);
        const processedItems = [];
        const unProcessedItems = [];
        const errors = [];

        // Process each item in the array
        for (let i = 0; i < items.length; i++) {
            const { productId, quantity } = items[i];

            if (!productId || quantity === undefined) {
                errors.push({
                    index: i,
                    productId,
                    quantity,
                    message: 'productId and quantity are required'
                });
                continue;
            }

            if (quantity < 0) {
                errors.push({
                    index: i,
                    productId,
                    quantity,
                    message: 'Quantity cannot be negative'
                });
                continue;
            }

            const product = await BikeProduct.findById(productId);
            if (!product) {
                errors.push({
                    index: i,
                    productId,
                    message: 'Product not found',
                    quantity
                });
                continue;
            }

            const existingItemIndex = cart.items.findIndex(
                item => item.product.toString() === productId
            );

            if (quantity === 0) {
                // Remove item if exists
                if (existingItemIndex > -1) {
                    cart.items.splice(existingItemIndex, 1);
                    processedItems.push({
                        productId,
                        action: 'removed',
                        quantity: 0
                    });
                } else {
                    processedItems.push({
                        productId,
                        action: 'no-op',
                        quantity: 0,
                        message: 'Item not in cart'
                    });
                }
            } else {
                // quantity > 0
                let quantityToAdd = quantity;
                let quantityNotProcessed = 0;

                if (product.quantityAvailable < quantity) {
                    quantityToAdd = product.quantityAvailable;
                    quantityNotProcessed = quantity - product.quantityAvailable;

                    if (quantityNotProcessed > 0) {
                        unProcessedItems.push({
                            product: product.toObject(),
                            quantity: quantityNotProcessed,
                            price: product.price,
                            totalPrice: calculateItemTotal(product.price, quantityNotProcessed),
                            message: `Only ${quantityToAdd} available, ${quantityNotProcessed} not processed`,
                            availableQuantity: product.quantityAvailable
                        });
                    }
                }

                if (quantityToAdd > 0) {
                    if (existingItemIndex > -1) {
                        // Update existing item
                        cart.items[existingItemIndex].quantity += quantityToAdd;
                        cart.items[existingItemIndex].totalPrice = calculateItemTotal(product.price, cart.items[existingItemIndex].quantity);
                        processedItems.push({
                            productId,
                            action: 'updated',
                            quantity: cart.items[existingItemIndex].quantity
                        });
                    } else {
                        // Add new item
                        cart.items.push({
                            product: productId,
                            quantity: quantityToAdd,
                            price: product.price,
                            totalPrice: calculateItemTotal(product.price, quantityToAdd)
                        });
                        processedItems.push({
                            productId,
                            action: 'added',
                            quantity: quantityToAdd
                        });
                    }
                }
            }
        }

        // If there are validation errors, return them
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation errors in request',
                errors
            });
        }

        // Save cart if it has items, or delete if empty
        if (cart.items.length === 0) {
            if (cart._id) {
                await Cart.findByIdAndDelete(cart._id);
            }
            cart = {
                phoneNumber,
                items: [],
                status: 'active',
                _id: null,
                subtotal: 0,
                paymentStatus: 'pending',
                shippingCost: 0,
                taxAmount: 0,
                discountAmount: 0,
                totalAmount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        } else {
            await cart.save();
            await cart.populate('items.product');
        }

        res.status(200).json({
            success: true,
            processedItems: cart.items,
            unProcessedItems,
            subtotal: cart.subtotal,
            paymentStatus: cart.paymentStatus,
            shippingCost: cart.shippingCost,
            taxAmount: cart.taxAmount,
            discountAmount: cart.discountAmount,
            totalAmount: cart.totalAmount,
            status: cart.status,
            createdAt: cart.createdAt,
            updatedAt: cart.updatedAt
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
