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

// Download all orders as CSV
exports.downloadAdminAllOrdersCsv = async (req, res) => {
    try {
        const { minAmount, maxAmount, startDate, endDate, paymentMethod, phoneNumber, emailId, sortBy = 'orderDate', sortOrder = 'desc' } = req.query;

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

        const sort = {};
        sort[sortBy] = sortOrder.toLowerCase() === 'asc' ? 1 : -1;

        const orders = await Order.find(query)
            .populate('items.product')
            .sort(sort);

        // Build CSV content
        const headers = [
            'Order Number',
            'Phone Number',
            'Email ID',
            'Product Codes',
            'Product Names',
            'Quantities',
            'Unit Prices',
            'Subtotal',
            'Discount Amount',
            'COD Charges',
            'Advance Paid',
            'Total Amount',
            'Payment Method',
            'Payment Status',
            'Payment Type',
            'Order Status',
            'Coupon Code',
            'Razorpay Order ID',
            'Razorpay Payment ID',
            'Admin Captured Payment ID',
            'Shipping Address',
            'Billing Address',
            'Order Created By Admin',
            'Order Date'
        ];

        const escapeCSV = (val) => {
            if (val === null || val === undefined) return '';
            let str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const formatAddress = (addr) => {
            if (!addr) return '';
            const parts = [
                addr.fullName,
                addr.phone ? `Phone: ${addr.phone}` : '',
                addr.addressLine1,
                addr.addressLine2,
                addr.city,
                addr.state,
                addr.postalCode,
                addr.country
            ].filter(Boolean);
            return parts.join(', ');
        };

        const rows = orders.map(order => {
            const productCodes = order.items.map(item => item.product ? item.product.productCode || 'N/A' : 'N/A').join(' | ');
            const productNames = order.items.map(item => item.product ? item.product.name : 'Unknown Product').join(' | ');
            const quantities = order.items.map(item => item.quantity).join(' | ');
            const unitPrices = order.items.map(item => item.price).join(' | ');

            return [
                order.orderNumber,
                order.phoneNumber,
                order.emailId || '',
                productCodes,
                productNames,
                quantities,
                unitPrices,
                order.subtotal,
                order.discountAmount,
                order.codCharges || 0,
                order.advancePaid || 0,
                order.totalAmount,
                order.paymentMethod,
                order.paymentStatus,
                order.paymentType,
                order.orderStatus,
                order.couponCode || '',
                order.razorpayOrderId || '',
                order.razorpayPaymentId || '',
                order.adminCapturedPaymentId || '',
                formatAddress(order.shippingAddress),
                formatAddress(order.billingAddress),
                order.isAdminCreated,
                order.orderDate.toISOString()
            ].map(escapeCSV).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
        res.status(200).send(csvContent);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const validateAddress = (address, fieldName) => {
    if (!address || typeof address !== 'object' || Array.isArray(address)) {
        return `${fieldName} must be a valid object`;
    }

    const requiredStringFields = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'postalCode', 'country'];
    for (const field of requiredStringFields) {
        const value = address[field];
        if (value === undefined || value === null || value === '') {
            return `${fieldName}.${field} is required`;
        }
        if (typeof value !== 'string') {
            return `${fieldName}.${field} must be a string`;
        }
        if (value.trim() === '') {
            return `${fieldName}.${field} must not be blank`;
        }
    }

    if (address.addressLine2 !== undefined && address.addressLine2 !== null) {
        if (typeof address.addressLine2 !== 'string') {
            return `${fieldName}.addressLine2 must be a string`;
        }
    }

    return null;
};

const validateItems = (items) => {
    const mongoose = require('mongoose');

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const prefix = `items[${i}]`;

        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return `${prefix} must be a valid object`;
        }

        // product (required, valid ObjectId)
        if (item.product === undefined || item.product === null || item.product === '') {
            return `${prefix}.product is required`;
        }
        if (!mongoose.Types.ObjectId.isValid(item.product)) {
            return `${prefix}.product must be a valid MongoDB ObjectId`;
        }

        // quantity (required, positive integer)
        if (item.quantity === undefined || item.quantity === null) {
            return `${prefix}.quantity is required`;
        }
        if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity)) {
            return `${prefix}.quantity must be a number`;
        }
        if (item.quantity <= 0) {
            return `${prefix}.quantity must be greater than 0`;
        }
        if (!Number.isInteger(item.quantity)) {
            return `${prefix}.quantity must be a whole number (integer)`;
        }

        // price (required, non-negative number)
        if (item.price === undefined || item.price === null) {
            return `${prefix}.price is required`;
        }
        if (typeof item.price !== 'number' || !Number.isFinite(item.price)) {
            return `${prefix}.price must be a number`;
        }
        if (item.price < 0) {
            return `${prefix}.price must be 0 or greater`;
        }

        // totalPrice (required, non-negative number)
        if (item.totalPrice === undefined || item.totalPrice === null) {
            return `${prefix}.totalPrice is required`;
        }
        if (typeof item.totalPrice !== 'number' || !Number.isFinite(item.totalPrice)) {
            return `${prefix}.totalPrice must be a number`;
        }
        if (item.totalPrice < 0) {
            return `${prefix}.totalPrice must be 0 or greater`;
        }
    }

    return null; // valid
};

exports.adminCreateOrder = async (req, res) => {
    try {
        const {
            phoneNumber,
            emailId,
            items,
            shippingAddress,
            billingAddress,
            shippingAddressSameAsBillingAddress,
            subtotal,
            discountAmount,
            codCharges,
            advancePaid,
            couponCode,
            totalAmount,
            currency,
            currencySymbol,
            paymentMethod,
            paymentType,
            paymentStatus,
            adminCapturedPaymentId
        } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'phoneNumber is required' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'items array is required and must not be empty' });
        }
        if (!shippingAddress) {
            return res.status(400).json({ success: false, message: 'shippingAddress is required' });
        }
        if (!billingAddress) {
            return res.status(400).json({ success: false, message: 'billingAddress is required' });
        }
        
        if (subtotal === undefined || subtotal === null) {
            return res.status(400).json({ success: false, message: 'subtotal is required' });
        }
        if (typeof subtotal !== 'number' || !Number.isFinite(subtotal) || subtotal < 0) {
            return res.status(400).json({ success: false, message: 'subtotal must be a non-negative number' });
        }
        
        if (totalAmount === undefined || totalAmount === null) {
            return res.status(400).json({ success: false, message: 'totalAmount is required' });
        }
        if (typeof totalAmount !== 'number' || !Number.isFinite(totalAmount) || totalAmount < 0) {
            return res.status(400).json({ success: false, message: 'totalAmount must be a non-negative number' });
        }
        
        if (!paymentMethod) {
            return res.status(400).json({ success: false, message: 'paymentMethod is required' });
        }

        if (!paymentType) {
            return res.status(400).json({ success: false, message: 'paymentType is required' });
        }

        // ── Validate paymentMethod enum ────────────────────────────────────
        const validPaymentMethods = ['cod', 'online'];
        if (!validPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: `Invalid paymentMethod. Allowed values: ${validPaymentMethods.join(', ')}`
            });
        }

        const validPaymentTypes = ['razorpay', 'upi'];
        if (!validPaymentTypes.includes(paymentType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid paymentType. Allowed values: ${validPaymentTypes.join(', ')}`
            });
        }

        // ── Validate paymentStatus enum (if provided) ─────────────────────
        const validPaymentStatuses = ['pending', 'partial_paid', 'paid', 'failed', 'refunded'];
        if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
            return res.status(400).json({
                success: false,
                message: `Invalid paymentStatus. Allowed values: ${validPaymentStatuses.join(', ')}`
            });
        }

        // ── Deep-validate shippingAddress ──────────────────────────────────
        const shippingAddressError = validateAddress(shippingAddress, 'shippingAddress');
        if (shippingAddressError) {
            return res.status(400).json({ success: false, message: shippingAddressError });
        }

        // ── Deep-validate billingAddress ───────────────────────────────────
        const billingAddressError = validateAddress(billingAddress, 'billingAddress');
        if (billingAddressError) {
            return res.status(400).json({ success: false, message: billingAddressError });
        }

        // ── Deep-validate items array ──────────────────────────────────────
        const itemsError = validateItems(items);
        if (itemsError) {
            return res.status(400).json({ success: false, message: itemsError });
        }

        // ── Generate unique order number ───────────────────────────────────
        const orderNumber = `ORD-ADM-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        const order = new Order({
            orderNumber,
            phoneNumber,
            emailId,
            items,
            shippingAddress,
            billingAddress,
            shippingAddressSameAsBillingAddress: shippingAddressSameAsBillingAddress || false,
            subtotal,
            shippingCost: 0,
            taxAmount: 0,
            discountAmount: discountAmount || 0,
            codCharges: codCharges || 0,
            advancePaid: advancePaid || 0,
            couponCode: couponCode || null,
            totalAmount,
            currency: currency || 'INR',
            currencySymbol: currencySymbol || '₹',
            paymentMethod,
            paymentStatus: paymentStatus || 'pending',
            paymentType: paymentType || 'razorpay',
            orderStatus: 'placed',
            statusHistory: [{
                status: 'placed',
                timestamp: new Date(),
                notes: 'Order created by admin'
            }],
            logisticsOrderId: null,
            logisticsReferenceId: null,
            logisticsAWBNumber: null,
            adminCapturedPaymentId: adminCapturedPaymentId,
            orderDate: new Date(),
            isAdminCreated: true
        });

        await order.save();

        return res.status(201).json({
            success: true,
            message: 'Order created successfully by admin',
            data: order
        });

    } catch (error) {
        console.error('Error in adminCreateOrder:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.adminUpdateOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // ── Guard: only admin-created orders can be updated via this endpoint
        if (!order.isAdminCreated) {
            return res.status(403).json({
                success: false,
                message: 'This order was not created by admin and cannot be updated via this endpoint'
            });
        }

        // ── Strip fields that must never be updated ────────────────────────
        const {
            phoneNumber,      // explicitly blocked
            orderNumber,      // immutable
            _id,              // immutable
            __v,              // internal
            createdAt,        // immutable
            isAdminCreated,   // should not be toggled via update
            ...allowedUpdates
        } = req.body;

        // Warn the caller if they tried to change phoneNumber
        if (phoneNumber !== undefined) {
            return res.status(400).json({
                success: false,
                message: 'phoneNumber cannot be updated'
            });
        }

        // ── Validate enums if they are being updated ───────────────────────
        const validPaymentMethods = ['cod', 'online'];
        if (allowedUpdates.paymentMethod && !validPaymentMethods.includes(allowedUpdates.paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: `Invalid paymentMethod. Allowed values: ${validPaymentMethods.join(', ')}`
            });
        }

        const validOrderStatuses = ['pending', 'placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
        if (allowedUpdates.orderStatus && !validOrderStatuses.includes(allowedUpdates.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: `Invalid orderStatus. Allowed values: ${validOrderStatuses.join(', ')}`
            });
        }

        const validPaymentTypes = ['razorpay', 'upi'];
        if (allowedUpdates.paymentMethod && !validPaymentTypes.includes(allowedUpdates.paymentType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid paymentType. Allowed values: ${validPaymentTypes.join(', ')}`
            });
        }

        const validPaymentStatuses = ['pending', 'partial_paid', 'paid', 'failed', 'refunded'];
        if (allowedUpdates.paymentStatus && !validPaymentStatuses.includes(allowedUpdates.paymentStatus)) {
            return res.status(400).json({
                success: false,
                message: `Invalid paymentStatus. Allowed values: ${validPaymentStatuses.join(', ')}`
            });
        }

        // ── Deep-validate shippingAddress if provided ──────────────────────
        if (allowedUpdates.shippingAddress !== undefined) {
            const shippingAddressError = validateAddress(allowedUpdates.shippingAddress, 'shippingAddress');
            if (shippingAddressError) {
                return res.status(400).json({ success: false, message: shippingAddressError });
            }
        }

        // ── Deep-validate billingAddress if provided ───────────────────────
        if (allowedUpdates.billingAddress !== undefined) {
            const billingAddressError = validateAddress(allowedUpdates.billingAddress, 'billingAddress');
            if (billingAddressError) {
                return res.status(400).json({ success: false, message: billingAddressError });
            }
        }

        // ── Deep-validate items if provided ───────────────────────────────
        if (allowedUpdates.items !== undefined) {
            if (!Array.isArray(allowedUpdates.items) || allowedUpdates.items.length === 0) {
                return res.status(400).json({ success: false, message: 'items must be a non-empty array' });
            }
            const itemsError = validateItems(allowedUpdates.items);
            if (itemsError) {
                return res.status(400).json({ success: false, message: itemsError });
            }
        }

        // ── If orderStatus is changing, append to statusHistory ────────────
        if (allowedUpdates.orderStatus && allowedUpdates.orderStatus !== order.orderStatus) {
            const historyEntry = {
                status: allowedUpdates.orderStatus,
                timestamp: new Date(),
                notes: allowedUpdates.statusNote || `Order status updated by admin to ${allowedUpdates.orderStatus}`
            };
            order.statusHistory.push(historyEntry);
        }

        // Remove statusNote from updates (it's only used for history entry, not a schema field)
        delete allowedUpdates.statusNote;

        // ── Apply updates ──────────────────────────────────────────────────
        Object.assign(order, allowedUpdates);
        order.updatedAt = new Date();

        await order.save();

        return res.status(200).json({
            success: true,
            message: 'Admin-created order updated successfully',
            data: order
        });

    } catch (error) {
        console.error('Error in adminUpdateOrder:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};