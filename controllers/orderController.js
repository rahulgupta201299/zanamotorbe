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