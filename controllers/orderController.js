const Order = require('../models/Order');
const { getConvertedPrice } = require('../utils/exchangeRate');
const currencyList = require('../utils/currencyList');
const { SHIPKLOUD_PUBLIC_KEY, SHIPKLOUD_PRIVATE_KEY, SHIPKLOUD_TRACK_ORDER_URL } = require('../config/config')
const axios = require('axios');

// Get orders by phone number
exports.getOrdersByPhone = async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const { currency, status, page = 1, limit = 1000 } = req.query;

        const query = { phoneNumber };
        if (status) {
            query.orderStatus = status;
        }

        const orders = await Order.find(query)
            .sort({ orderDate: -1 })
            .populate('items.product')
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Order.countDocuments(query);

        // Handle multi-currency conversion
        const validCurrency = currency && currency !== 'INR' ? currencyList.find(c => c.code === currency) : null;
        
        const convertedOrders = await Promise.all(orders.map(async (order) => {
            if (validCurrency) {
                const convertedAmount = await getConvertedPrice(order.totalAmount, currency);
                return {
                    ...order.toObject(),
                    totalAmount: convertedAmount,
                    currency: currency,
                    currencySymbol: validCurrency.symbol
                };
            }
            return order;
        }));

        const currentPage = parseInt(page);
        const totalPages = Math.ceil(total / limit);
        
        res.status(200).json({
            success: true,
            data: {
                orders: convertedOrders,
                pagination: {
                    currentPage: currentPage,
                    totalPages: totalPages,
                    totalOrders: total,
                    hasNextPage: currentPage < totalPages,
                    hasPrevPage: currentPage > 1
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { currency } = req.query;

        const order = await Order.findById(orderId).populate('items.product');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Handle multi-currency conversion
        const validCurrency = currency && currency !== 'INR' ? currencyList.find(c => c.code === currency) : null;
        let responseOrder = order.toObject();

        if (validCurrency) {
            responseOrder.totalAmount = await getConvertedPrice(order.totalAmount, currency);
            responseOrder.subtotal = await getConvertedPrice(order.subtotal, currency);
            responseOrder.shippingCost = await getConvertedPrice(order.shippingCost, currency);
            responseOrder.taxAmount = await getConvertedPrice(order.taxAmount, currency);
            responseOrder.discountAmount = await getConvertedPrice(order.discountAmount, currency);
            responseOrder.currency = currency;
            responseOrder.currencySymbol = validCurrency.symbol;

            // Convert item prices
            responseOrder.items = await Promise.all(order.items.map(async (item) => {
                return {
                    ...item.toObject(),
                    price: await getConvertedPrice(item.price, currency),
                    totalPrice: await getConvertedPrice(item.totalPrice, currency)
                };
            }));
        }

        res.status(200).json({
            success: true,
            data: responseOrder
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all orders for admin with filtering, sorting and pagination
exports.getAdminAllOrders = async (req, res) => {
    try {
        const { minAmount, maxAmount, startDate, endDate, paymentMethod, phoneNumber, emailId, sortBy = 'orderDate', sortOrder = 'desc', page = 1, limit = 10 } = req.query;

        // Validate sortBy field
        const allowedSortFields = ['totalAmount', 'updatedAt', 'orderDate'];
        if (sortBy && !allowedSortFields.includes(sortBy)) {
            return res.status(400).json({
                success: false,
                message: `Invalid sortBy field. Allowed fields: ${allowedSortFields.join(', ')}`
            });
        }

        // Validate sortOrder
        if (sortOrder && !['asc', 'desc'].includes(sortOrder.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sortOrder. Use "asc" or "desc"'
            });
        }

        const query = {};

        // Amount filters
        if (minAmount || maxAmount) {
            query.totalAmount = {};
            if (minAmount) query.totalAmount.$gte = parseFloat(minAmount);
            if (maxAmount) query.totalAmount.$lte = parseFloat(maxAmount);
        }

        // Date filters (handling IST offset +5:30)
        if (startDate || endDate) {
            query.orderDate = {}; // Using orderDate for orders by default
            if (startDate) query.orderDate.$gte = new Date(`${startDate}T00:00:00+05:30`);
            if (endDate) query.orderDate.$lte = new Date(`${endDate}T23:59:59.999+05:30`);
        }

        // Additional filters
        if (phoneNumber) {
            query.phoneNumber = phoneNumber;
        }

        if (emailId) {
            query.emailId = emailId;
        }

        // Scoped filters (only return online paid and COD partial paid orders)
        const conditions = [];

        // Track if online paid / cod partial orders are allowed by request filters
        let allowOnlinePaid = true;
        let allowCodPartial = true;

        if (paymentMethod) {
            if (paymentMethod === 'cod') {
                allowOnlinePaid = false;
            } else {
                allowCodPartial = false;
            }
        }

        if (allowOnlinePaid) {
            const cond = { paymentStatus: 'paid' };
            if (paymentMethod) {
                cond.paymentMethod = paymentMethod;
            } else {
                cond.paymentMethod = { $ne: 'cod' };
            }
            conditions.push(cond);
        }

        if (allowCodPartial) {
            conditions.push({ paymentMethod: 'cod', paymentStatus: 'partial_paid' });
        }

        if (conditions.length === 0) {
            query._id = null; // Force 0 matches if filters are mutually exclusive with our scoped criteria
        } else if (conditions.length === 1) {
            Object.assign(query, conditions[0]);
        } else {
            query.$or = conditions;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sort = {};
        sort[sortBy] = sortOrder.toLowerCase() === 'asc' ? 1 : -1;

        const totalOrders = await Order.countDocuments(query);
        const orders = await Order.find(query)
            .populate('items.product')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        const totalPages = Math.ceil(totalOrders / limit);

        res.status(200).json({
            success: true,
            data: {
                orders,
                pagination: {
                    totalOrders,
                    totalPages,
                    currentPage: parseInt(page),
                    limit: parseInt(limit),
                    hasNextPage: parseInt(page) < totalPages,
                    hasPrevPage: parseInt(page) > 1
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get order statistics for admin (count and total amount grouped by payment method and status)
exports.getAdminOrderStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const query = {};

        // Date filters (handling IST offset +5:30)
        if (startDate || endDate) {
            query.orderDate = {};
            if (startDate) query.orderDate.$gte = new Date(`${startDate}T00:00:00+05:30`);
            if (endDate) query.orderDate.$lte = new Date(`${endDate}T23:59:59.999+05:30`);
        }

        const stats = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    onlineCount: {
                        $sum: {
                            $cond: [
                                { $and: [ { $ne: ["$paymentMethod", "cod"] }, { $eq: ["$paymentStatus", "paid"] } ] },
                                1,
                                0
                            ]
                        }
                    },
                    onlineTotalAmount: {
                        $sum: {
                            $cond: [
                                { $and: [ { $ne: ["$paymentMethod", "cod"] }, { $eq: ["$paymentStatus", "paid"] } ] },
                                "$totalAmount",
                                0
                            ]
                        }
                    },
                    codCount: {
                        $sum: {
                            $cond: [
                                { $and: [ { $eq: ["$paymentMethod", "cod"] }, { $eq: ["$paymentStatus", "partial_paid"] } ] },
                                1,
                                0
                            ]
                        }
                    },
                    codTotalAmount: {
                        $sum: {
                            $cond: [
                                { $and: [ { $eq: ["$paymentMethod", "cod"] }, { $eq: ["$paymentStatus", "partial_paid"] } ] },
                                "$totalAmount",
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const result = stats.length > 0 ? stats[0] : {
            onlineCount: 0,
            onlineTotalAmount: 0,
            codCount: 0,
            codTotalAmount: 0
        };

        res.status(200).json({
            success: true,
            data: {
                online: {
                    count: result.onlineCount,
                    totalAmount: result.onlineTotalAmount
                },
                cod: {
                    count: result.codCount,
                    totalAmount: result.codTotalAmount
                },
                overall: {
                    count: result.onlineCount + result.codCount,
                    totalAmount: result.onlineTotalAmount + result.codTotalAmount
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.trackOrderByOrderId = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }


        const AWBNumber = order.logisticsAWBNumber;

        if (AWBNumber) {
            const response = await axios.get(
              `${SHIPKLOUD_TRACK_ORDER_URL}?awb_number=${AWBNumber}`,
              {
                headers: {
                  "public-key": SHIPKLOUD_PUBLIC_KEY,
                  "private-key": SHIPKLOUD_PRIVATE_KEY,
                  "Content-Type": "application/json",
                },
              },
            );

            // Validate successful response
            if (response.data && response.data.result == "1" && response.data.data) {
              const shipmentData = response.data.data;
              const currentStatus = shipmentData.current_status ? shipmentData.current_status : null;
              const expectedDeliveryDate = shipmentData.expected_delivery_date ? shipmentData.expected_delivery_date : null;
              const orderStatus = shipmentData.order_status ? shipmentData.order_status : null;
              responseOrder = { currentStatus, expectedDeliveryDate, orderStatus }
            } else {
              console.log(`Track Order Failed ${order.orderNumber}:`,response.data.message || "Unknown response format");
            }
        }

        res.status(200).json({
            success: true,
            data: responseOrder
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};