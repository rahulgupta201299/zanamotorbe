const Cart = require('../models/Cart');
const BikeProduct = require('../models/BikeProduct');
const { getConvertedPrice } = require('../utils/exchangeRate');
const currencyList = require('../utils/currencyList');

// Helper function to convert order prices based on currency
const convertOrderPrices = async (order, currency) => {
    if (!order || !order.items || order.items.length === 0) {
        return order;
    }

    if (!currency || currency === 'INR') {
        return order;
    }

    const validCurrency = currencyList.find(c => c.code === currency);
    if (!validCurrency) {
        return order;
    }

    const orderObj = order.toObject ? order.toObject() : order;

    // Convert item prices
    const convertedItems = await Promise.all(
        orderObj.items.map(async (item) => {
            const itemObj = item.toObject ? item.toObject() : item;
            const originalPrice = itemObj.price || 0;
            const originalTotalPrice = itemObj.totalPrice || 0;

            const convertedPrice = await getConvertedPrice(originalPrice, currency);
            const convertedTotalPrice = await getConvertedPrice(originalTotalPrice, currency);

            // Convert product prices if product is populated
            let convertedProduct = itemObj.product;
            if (convertedProduct && typeof convertedProduct === 'object' && convertedProduct._id) {
                const productObj = convertedProduct.toObject ? convertedProduct.toObject() : convertedProduct;
                const productOriginalPrice = productObj.price || 0;
                const productConvertedPrice = await getConvertedPrice(productOriginalPrice, currency);

                convertedProduct = {
                    ...productObj,
                    price: productConvertedPrice,
                    originalPrice: productOriginalPrice,
                    currency: currency,
                    currencySymbol: validCurrency.symbol
                };
            }

            return {
                ...itemObj,
                product: convertedProduct,
                price: convertedPrice,
                totalPrice: convertedTotalPrice,
                originalPrice: originalPrice,
                originalTotalPrice: originalTotalPrice,
                currency: currency,
                currencySymbol: validCurrency.symbol
            };
        })
    );

    // Convert order totals
    const convertedOrder = {
        ...orderObj,
        items: convertedItems,
        subtotal: await getConvertedPrice(orderObj.subtotal || 0, currency),
        originalSubtotal: orderObj.subtotal || 0,
        discountAmount: await getConvertedPrice(orderObj.discountAmount || 0, currency),
        originalDiscountAmount: orderObj.discountAmount || 0,
        shippingCost: await getConvertedPrice(orderObj.shippingCost || 0, currency),
        originalShippingCost: orderObj.shippingCost || 0,
        taxAmount: await getConvertedPrice(orderObj.taxAmount || 0, currency),
        originalTaxAmount: orderObj.taxAmount || 0,
        totalAmount: await getConvertedPrice(orderObj.totalAmount || 0, currency),
        originalTotalAmount: orderObj.totalAmount || 0,
        currency: currency,
        currencySymbol: validCurrency.symbol
    };

    return convertedOrder;
};

// Get orders for a specific user
exports.getUserOrders = async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const { page = 1, limit = 10, status } = req.query;
        const { currency } = req.query;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Build query
        const query = {
            phoneNumber,
            status: 'ordered'
        };

        // Add status filter if provided
        if (status) {
            query.orderStatus = status;
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get total count
        const totalOrders = await Cart.countDocuments(query);

        // Get orders with pagination
        let orders = await Cart.find(query)
            .populate('items.product')
            .sort({ orderDate: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Convert prices based on currency
        orders = await Promise.all(
            orders.map(async (order) => {
                return await convertOrderPrices(order, currency);
            })
        );

        const totalPages = Math.ceil(totalOrders / parseInt(limit));

        res.status(200).json({
            success: true,
            data: {
                orders,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalOrders,
                    hasNextPage: parseInt(page) < totalPages,
                    hasPrevPage: parseInt(page) > 1
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get order details by order ID
exports.getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { currency } = req.query;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        const order = await Cart.findById(orderId).populate('items.product');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Convert prices based on currency
        const convertedOrder = await convertOrderPrices(order, currency);

        res.status(200).json({
            success: true,
            data: convertedOrder
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get order by order number
exports.getOrderByNumber = async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const { currency } = req.query;

        if (!orderNumber) {
            return res.status(400).json({
                success: false,
                message: 'Order number is required'
            });
        }

        const order = await Cart.findOne({ orderNumber }).populate('items.product');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Convert prices based on currency
        const convertedOrder = await convertOrderPrices(order, currency);

        res.status(200).json({
            success: true,
            data: convertedOrder
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update order status (Admin)
exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { orderStatus, trackingNumber, estimatedDelivery, notes } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        if (!orderStatus) {
            return res.status(400).json({
                success: false,
                message: 'Order status is required'
            });
        }

        // Valid order statuses
        const validStatuses = ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
        if (!validStatuses.includes(orderStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order status'
            });
        }

        const order = await Cart.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if order can be cancelled
        if (orderStatus === 'cancelled' && ['delivered', 'cancelled', 'returned'].includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled as it is already ' + order.orderStatus
            });
        }

        // Update order fields
        order.orderStatus = orderStatus;
        
        if (trackingNumber !== undefined) {
            order.trackingNumber = trackingNumber;
        }
        
        if (estimatedDelivery !== undefined) {
            order.estimatedDelivery = estimatedDelivery;
        }

        if (notes !== undefined) {
            // Append to existing notes or create new
            if (order.notes) {
                order.notes += `\n${new Date().toISOString()}: ${notes}`;
            } else {
                order.notes = notes;
            }
        }

        // If order is cancelled and was paid, update payment status to refunded
        if (orderStatus === 'cancelled' && order.paymentStatus === 'paid') {
            order.paymentStatus = 'refunded';
        }

        await order.save();

        res.status(200).json({
            success: true,
            message: 'Order status updated successfully',
            data: {
                _id: order._id,
                orderNumber: order.orderNumber,
                orderStatus: order.orderStatus,
                trackingNumber: order.trackingNumber,
                estimatedDelivery: order.estimatedDelivery,
                notes: order.notes,
                paymentStatus: order.paymentStatus,
                updatedAt: order.updatedAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Cancel order
exports.cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        const order = await Cart.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if order can be cancelled
        if (['delivered', 'cancelled', 'returned'].includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled as it is already ' + order.orderStatus
            });
        }

        // Update order status to cancelled
        order.orderStatus = 'cancelled';

        // If order was paid, update payment status to refunded
        if (order.paymentStatus === 'paid') {
            order.paymentStatus = 'refunded';
        }

        // Add cancellation reason to notes
        const cancellationNote = `Cancelled: ${reason || 'No reason provided'}`;
        if (order.notes) {
            order.notes += `\n${new Date().toISOString()}: ${cancellationNote}`;
        } else {
            order.notes = cancellationNote;
        }

        await order.save();

        res.status(200).json({
            success: true,
            message: 'Order cancelled successfully',
            data: {
                _id: order._id,
                orderNumber: order.orderNumber,
                orderStatus: order.orderStatus,
                paymentStatus: order.paymentStatus,
                notes: order.notes,
                updatedAt: order.updatedAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
