const Cart = require('../models/Cart');
const BikeProduct = require('../models/BikeProduct');

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

exports.saveCartWithDetails = async (req, res) => {
    try {
        const { phoneNumber, items, shippingAddress, billingAddress } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'phoneNumber is required' });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Items array is required and cannot be empty' 
            });
        }

        const validationResults = await validateProductAvailability(items);
        const allValid = validationResults.every(result => result.isValid);

        if (!allValid) {
            const invalidItems = validationResults.filter(result => !result.isValid);
            return res.status(400).json({
                success: false,
                error: 'Some items are not available in the requested quantity',
                invalidItems: invalidItems
            });
        }

        const cartItems = [];
        for (const validationResult of validationResults) {
            const itemRequest = items.find(
                i => (i.productId || i.product).toString() === validationResult.productId.toString()
            );
            
            cartItems.push({
                product: validationResult.productId,
                quantity: validationResult.requestedQuantity,
                price: validationResult.price,
                totalPrice: validationResult.price * validationResult.requestedQuantity
            });
        }

        let cart = await Cart.findOne({ phoneNumber });

        const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        if (!cart) {
            cart = new Cart({
                phoneNumber,
                items: cartItems,
                shippingAddress,
                billingAddress,
                status: 'validated',
                orderNumber: orderId
            });
        } else {
            cart.items = cartItems;
            if (shippingAddress) cart.shippingAddress = shippingAddress;
            if (billingAddress) cart.billingAddress = billingAddress;
            cart.status = 'validated';
            cart.orderNumber = orderId;
        }

        await cart.save();
        await cart.populate('items.product');

        res.status(200).json({
            success: true,
            message: 'Cart saved successfully with validated items',
            data: {
                _id: cart._id,
                items: cart.items,
                shippingAddress: cart.shippingAddress,
                billingAddress: cart.billingAddress,
                subtotal: cart.subtotal,
                orderNumber: cart.orderNumber,
                status: cart.status,
                createdAt: cart.createdAt,
                updatedAt: cart.updatedAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ phoneNumber: req.params.phoneNumber }).populate('items.product');
        if (!cart) return res.status(404).json({ success: false, error: 'Cart not found' });
        res.status(200).json({ success: true, data: cart });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getUserOrders = async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const orders = await Cart.find({
            phoneNumber: phoneNumber
        })
        .populate('items.product')
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(limit);

        const totalOrders = await Cart.countDocuments({
            phoneNumber,
            status: 'ordered'
        });

        const totalPages = Math.ceil(totalOrders / limit);

        res.status(200).json({
            success: true,
            data: orders,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalOrders: totalOrders,
                ordersPerPage: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                nextPage: page < totalPages ? page + 1 : null,
                prevPage: page > 1 ? page - 1 : null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Cart.findOne({
            _id: orderId,
            status: 'ordered'
        }).populate('items.product');

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        res.status(200).json({
            success: true,
            data: order
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.checkoutCart = async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        const cart = await Cart.findOne({
            phoneNumber,
            status: { $in: ['active', 'validated', 'checkout'] }
        }).populate('items.product');

        if (!cart) {
            return res.status(404).json({
                success: false,
                error: 'No active cart found'
            });
        }

        if (!cart.shippingAddress || !cart.billingAddress) {
            return res.status(400).json({
                success: false,
                error: 'Shipping and billing addresses are required'
            });
        }

        // Generate orderNumber if not already present
        if (!cart.orderNumber) {
            cart.orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        }

        cart.status = 'ordered';
        cart.orderDate = new Date();
        cart.orderStatus = 'placed';

        await cart.save();

        res.status(200).json({
            success: true,
            message: 'Order placed successfully',
            data: {
                orderId: cart._id,
                orderNumber: cart.orderNumber,
                orderDate: cart.orderDate,
                totalAmount: cart.totalAmount,
                orderStatus: cart.orderStatus
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
