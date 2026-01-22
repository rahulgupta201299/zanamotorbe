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
                availableQuantity: 0,
                price: 0,
                product: null
            });
        } else if (product.quantityAvailable < item.quantity) {
            validationResults.push({
                productId: product._id,
                productName: product.name,
                isValid: false,
                message: 'Insufficient quantity available',
                requestedQuantity: item.quantity,
                availableQuantity: product.quantityAvailable,
                price: product.price,
                product: product
            });
        } else {
            validationResults.push({
                productId: product._id,
                productName: product.name,
                isValid: true,
                message: 'Product available',
                requestedQuantity: item.quantity,
                availableQuantity: product.quantityAvailable,
                price: product.price,
                product: product
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
        console.log('inside mangecartitem')
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
        const unProcessedItems = [];
        const errors = [];
        console.log(cart);
        // Process each item in the array to update cart
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

            // Find existing item in cart
            const existingItemIndex = cart.items.findIndex(item => item.product.toString() === productId);

            if (quantity === 0) {
                // Remove item if quantity is 0
                if (existingItemIndex > -1) {
                    cart.items.splice(existingItemIndex, 1);
                }
                continue;
            }

            const availableQuantity = product.quantityAvailable;
            const processedQuantity = Math.min(quantity, availableQuantity);

            if (existingItemIndex > -1) {
                // Update existing item
                cart.items[existingItemIndex].quantity = processedQuantity;
                cart.items[existingItemIndex].totalPrice = calculateItemTotal(product.price, processedQuantity);
            } else {
                // Add new item to cart
                cart.items.push({
                    product: productId,
                    quantity: processedQuantity,
                    price: product.price,
                    totalPrice: calculateItemTotal(product.price, processedQuantity)
                });
            }

            // If requested quantity exceeds available, add excess to unProcessedItems
            if (quantity > availableQuantity) {
                const excess = quantity - availableQuantity;
                unProcessedItems.push({
                    product: product._id,
                    quantity: excess,
                    price: product.price,
                    totalPrice: calculateItemTotal(product.price, excess),
                    message: `Only ${availableQuantity} available, ${excess} not processed`,
                    availableQuantity: availableQuantity
                });
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

                    console.log(cart)

        // Validate product availability for all cart items at the end
        if (cart.items.length > 0) {
            const validationResults = await validateProductAvailability(cart.items.map(item => ({ productId: item.product, quantity: item.quantity })));

            for (const result of validationResults) {
                if (!result.isValid) {
                    const itemIndex = cart.items.findIndex(item => item.product.toString() === result.productId.toString());
                    if (itemIndex > -1) {
                        cart.items.splice(itemIndex, 1);
                        unProcessedItems.push({
                            product: result.product,
                            quantity: result.requestedQuantity,
                            price: result.price,
                            totalPrice: calculateItemTotal(result.price, result.requestedQuantity),
                            message: result.message,
                            availableQuantity: result.availableQuantity
                        });
                    }
                }
            }
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
