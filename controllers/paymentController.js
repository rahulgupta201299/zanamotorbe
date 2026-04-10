const Razorpay = require('razorpay');
const crypto = require('crypto');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const BikeProduct = require('../models/BikeProduct');
const config = require('../config/config');
const { getConvertedPrice, getReverseConvertedPrice } = require('../utils/exchangeRate');
const currencyList = require('../utils/currencyList');
const { sendOrderConfirmationEmail, sendPaymentConfirmationSMS } = require('../utils/email');

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: config.RAZORPAY_KEY_ID,
    key_secret: config.RAZORPAY_KEY_SECRET,
});

// Create COD (Cash on Delivery) order
exports.createCODOrder = async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        const cart = await Cart.findOne({
            phoneNumber,
            status: 'active'
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

        // COD is only available for India (INR)
        const shippingCountry = cart.shippingAddress.country ? cart.shippingAddress.country.toLowerCase() : '';
        if (shippingCountry !== 'india' && shippingCountry !== 'in') {
            return res.status(400).json({
                success: false,
                error: 'Cash on Delivery is only available for orders within India'
            });
        }

        // COD is always in INR with ₹ symbol
        const displayAmount = cart.totalAmount;
        const currencySymbol = '₹';

        // Generate order number
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // Prepare order items with product details
        const orderItems = cart.items.map(item => ({
            product: item.product._id,
            productName: item.product.name || 'Unknown Product',
            productImage: item.product.images ? item.product.images[0] : null,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice
        }));

        // Create Order document with COD status
        const order = new Order({
            orderNumber: orderNumber,
            phoneNumber: cart.phoneNumber,
            emailId: cart.emailId,
            items: orderItems,
            shippingAddress: cart.shippingAddress,
            billingAddress: cart.billingAddress,
            shippingAddressSameAsBillingAddress: cart.shippingAddressSameAsBillingAddress,
            subtotal: cart.subtotal,
            shippingCost: cart.shippingCost,
            taxAmount: cart.taxAmount,
            discountAmount: cart.discountAmount,
            couponCode: cart.couponCode,
            totalAmount: cart.totalAmount,
            currency: 'INR',
            currencySymbol: currencySymbol,
            paymentMethod: 'cod',
            paymentStatus: 'pending',
            orderStatus: 'pending',
            statusHistory: [{
                status: 'pending',
                timestamp: new Date(),
                notes: 'COD order created, awaiting delivery'
            }],
            orderDate: new Date(),
            originalCartId: cart._id
        });

        await order.save();

        // Reduce product quantity in inventory immediately for COD orders
        if (orderItems && orderItems.length > 0) {
            for (const item of orderItems) {
                await BikeProduct.findByIdAndUpdate(
                    item.product,
                    { $inc: { quantityAvailable: -item.quantity } }
                );
            }
        }

        // Delete the cart since COD order is confirmed immediately
        if (cart._id) {
            await Cart.findByIdAndDelete(cart._id);
        }

        // Send confirmation email and SMS
        sendOrderNotifications(order);

        res.status(200).json({
            success: true,
            data: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                paymentMethod: 'cod',
                displayAmount: displayAmount,
                displayCurrency: 'INR',
                currencySymbol: currencySymbol,
                cartId: cart._id,
                status: 'pending',
                message: 'COD order created successfully. You will pay on delivery.'
            }
        });

    } catch (error) {
        console.log('Error creating COD order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create COD order'
        });
    }
};

// Helper function to send order notifications (common for COD and online payments)
const sendOrderNotifications = (order) => {
    const customerName = order.shippingAddress?.fullName || 'Customer';
    const customerEmail = order.emailId;
    const customerPhone = order.phoneNumber;

    // Send email if customer has email
    if (customerEmail) {
        sendOrderConfirmationEmail(order, customerEmail, customerName)
            .then(result => {
                if (result.success) {
                    console.log('Order confirmation email sent to:', customerEmail);
                } else {
                    console.log('Failed to send order confirmation email:', result.error);
                }
            })
            .catch(err => console.log('Email sending error:', err));
    }

    // Send SMS notification
    if (customerPhone) {
        sendPaymentConfirmationSMS(order, customerPhone)
            .then(result => {
                if (result.success) {
                    console.log('Order confirmation SMS sent to:', customerPhone);
                } else {
                    console.log('Failed to send order confirmation SMS:', result.error);
                }
            })
            .catch(err => console.log('SMS sending error:', err));
    }
};

// Confirm COD order (when delivered and paid)
exports.confirmCODOrder = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: 'Order ID is required'
            });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        if (order.paymentMethod !== 'cod') {
            return res.status(400).json({
                success: false,
                error: 'This is not a COD order'
            });
        }

        if (order.paymentStatus === 'paid') {
            return res.status(400).json({
                success: false,
                error: 'COD order already confirmed'
            });
        }

        // Update order status to placed (COD confirmed)
        order.paymentStatus = 'paid';
        order.orderStatus = 'placed';
        order.statusHistory.push({
            status: 'placed',
            timestamp: new Date(),
            notes: 'COD payment received on delivery'
        });
        await order.save();

        res.status(200).json({
            success: true,
            message: 'COD order confirmed successfully',
            data: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                paymentStatus: order.paymentStatus,
                orderStatus: order.orderStatus
            }
        });

    } catch (error) {
        console.log('Error confirming COD order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to confirm COD order'
        });
    }
};

// Cancel COD order
exports.cancelCODOrder = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: 'Order ID is required'
            });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        if (order.paymentMethod !== 'cod') {
            return res.status(400).json({
                success: false,
                error: 'This is not a COD order'
            });
        }

        if (order.orderStatus === 'cancelled') {
            return res.status(400).json({
                success: false,
                error: 'COD order already cancelled'
            });
        }

        // Update order status to cancelled
        order.orderStatus = 'cancelled';
        order.statusHistory.push({
            status: 'cancelled',
            timestamp: new Date(),
            notes: 'COD order cancelled'
        });
        await order.save();

        // Return cart to active status
        if (order.originalCartId) {
            await Cart.findByIdAndUpdate(order.originalCartId, {
                status: 'active',
                paymentStatus: null,
                paymentMethod: null,
                orderId: null
            });
        }

        res.status(200).json({
            success: true,
            message: 'COD order cancelled successfully',
            data: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                orderStatus: order.orderStatus
            }
        });

    } catch (error) {
        console.log('Error cancelling COD order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel COD order'
        });
    }
};

// Create payment order
exports.createOrder = async (req, res) => {
    try {
        const { phoneNumber, currency } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        const cart = await Cart.findOne({
            phoneNumber,
            status: 'active'
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

        // Handle multi-currency - Razorpay only supports INR
        const validCurrency = currency && currency !== 'INR' ? currencyList.find(c => c.code === currency) : null;
        let amountInPaisa;
        let displayAmount;
        let currencySymbol;

        if (validCurrency) {
            // Convert the cart total (in INR) to the selected currency for display
            const convertedAmount = await getConvertedPrice(cart.totalAmount, currency);
            displayAmount = convertedAmount;
            currencySymbol = validCurrency.symbol;
            // Use reverse conversion to convert from selected currency back to INR
            const amountInINR = await getReverseConvertedPrice(convertedAmount, currency);
            amountInPaisa = Math.round(amountInINR * 100);
        } else {
            displayAmount = cart.totalAmount;
            currencySymbol = '₹';
            amountInPaisa = Math.round(cart.totalAmount * 100);
        }

        // Generate order number
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // Prepare order items with product details
        const orderItems = cart.items.map(item => ({
            product: item.product._id,
            productName: item.product.name || 'Unknown Product',
            productImage: item.product.images ? item.product.images[0] : null,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice
        }));

        // Create Order document with pending status
        const order = new Order({
            orderNumber: orderNumber,
            phoneNumber: cart.phoneNumber,
            emailId: cart.emailId,
            items: orderItems,
            shippingAddress: cart.shippingAddress,
            billingAddress: cart.billingAddress,
            shippingAddressSameAsBillingAddress: cart.shippingAddressSameAsBillingAddress,
            subtotal: cart.subtotal,
            shippingCost: cart.shippingCost,
            taxAmount: cart.taxAmount,
            discountAmount: cart.discountAmount,
            couponCode: cart.couponCode,
            totalAmount: cart.totalAmount,
            currency: validCurrency ? currency : 'INR',
            currencySymbol: currencySymbol,
            paymentMethod: 'online',
            paymentStatus: 'pending',
            orderStatus: 'pending',
            statusHistory: [{
                status: 'pending',
                timestamp: new Date(),
                notes: 'Order created, awaiting payment confirmation'
            }],
            orderDate: new Date(),
            originalCartId: cart._id
        });

        await order.save();

        // Create Razorpay order for payment
        const razorpayOptions = {
            amount: amountInPaisa,
            currency: 'INR',
            receipt: `receipt_${cart._id}`,
            payment_capture: 1,
            notes: {
                orderId: order._id.toString(),
                orderNumber: orderNumber,
                phoneNumber: phoneNumber,
                originalCurrency: validCurrency ? currency : 'INR'
            }
        };

        let razorpayOrder;
        try {
            razorpayOrder = await razorpay.orders.create(razorpayOptions);
        } catch (razorpayError) {
            // Delete the order if Razorpay order creation fails
            await Order.findByIdAndDelete(order._id);
            console.log('Razorpay order creation failed:', razorpayError);
            return res.status(500).json({
                success: false,
                error: 'Failed to create payment order. Please try again.'
            });
        }

        // Update order with Razorpay order ID
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();

        // Update cart with order reference
        cart.orderId = order._id;
        cart.razorpayOrderId = razorpayOrder.id;
        cart.status = 'pending';
        cart.paymentStatus = 'pending';
        await cart.save();

        res.status(200).json({
            success: true,
            data: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                razorpayOrderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                displayAmount: displayAmount,
                displayCurrency: validCurrency ? currency : 'INR',
                currencySymbol: currencySymbol,
                key: config.RAZORPAY_KEY_ID,
                cartId: cart._id,
                name: "zanaltd",
                status: 'pending',
                message: 'Order created successfully'
            }
        });

    } catch (error) {
        console.log('Error creating order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create order'
        });
    }
};

// Verify payment
exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId,
            currency
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required payment verification parameters'
            });
        }

        // Verify signature
        const sign = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest('hex');

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({
                success: false,
                error: 'Payment verification failed'
            });
        }

        // Find the existing order (created by createOrder)
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        // Update order with payment details
        order.razorpayOrderId = razorpay_order_id;
        order.razorpayPaymentId = razorpay_payment_id;
        order.razorpaySignature = razorpay_signature;
        
        // Only update orderStatus to processing if not already placed (webhook may have run first)
        if (order.orderStatus !== 'placed' && order.orderStatus !== 'delivered') {
            order.orderStatus = 'processing';
            order.statusHistory.push({
                status: 'processing',
                timestamp: new Date(),
                notes: 'Payment verified, processing order'
            });
        }
        await order.save();

        // Get currency info
        const validCurrency = currency && currency !== 'INR' ? currencyList.find(c => c.code === currency) : null;
        const currencySymbol = validCurrency ? validCurrency.symbol : '₹';

        // Handle multi-currency for response
        let displayAmount;
        if (validCurrency) {
            displayAmount = await getConvertedPrice(order.totalAmount, currency);
        } else {
            displayAmount = order.totalAmount;
        }

        res.status(200).json({
            success: true,
            message: 'Payment verified successfully. Order is being processed',
            data: {
                orderId: order._id,
                orderNumber: order.orderNumber,
                paymentId: razorpay_payment_id,
                orderStatus: order.orderStatus,
                orderDate: order.orderDate,
                totalAmount: displayAmount,
                displayCurrency: validCurrency ? currency : 'INR',
                currencySymbol: currencySymbol
            }
        });

    } catch (error) {
        console.log('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            error: 'Payment verification failed'
        });
    }
};

// Handle Razorpay webhook
exports.handleWebhook = async (req, res) => {
    try {
        const secret = config.RAZORPAY_WEBHOOK_SECRET;
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        const razorpaySignature = req.headers['x-razorpay-signature'];

        if (expectedSignature !== razorpaySignature) {
            return res.status(400).json({
                success: false,
                error: 'Invalid webhook signature'
            });
        }

        const event = req.body.event;
        const paymentEntity = req.body.payload.payment.entity;

        console.log('Webhook received:', event);

        switch (event) {
            case 'payment.captured':
                await handlePaymentCaptured(paymentEntity);
                break;
            case 'payment.failed':
                await handlePaymentFailed(paymentEntity);
                break;
            default:
                console.log('Unhandled webhook event:', event);
        }

        res.status(200).json({ success: true });

    } catch (error) {
        console.log('Webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Webhook processing failed'
        });
    }
};

// Helper function to handle payment captured from webhook
async function handlePaymentCaptured(paymentEntity) {
    try {
        const razorpayOrderId = paymentEntity.order_id;

        // Find existing order by razorpayOrderId
        const order = await Order.findOne({ razorpayOrderId: razorpayOrderId });

        if (order) {
            order.paymentStatus = 'paid';
            order.orderStatus = 'placed';
            order.razorpayPaymentId = paymentEntity.id;
            order.statusHistory.push({
                status: 'placed',
                timestamp: new Date(),
                notes: 'Payment confirmed via webhook'
            });
            await order.save();

            // Reduce product quantity in inventory
            if (order.items && order.items.length > 0) {
                for (const item of order.items) {
                    await BikeProduct.findByIdAndUpdate(
                        item.product,
                        { $inc: { quantityAvailable: -item.quantity } }
                    );
                }
            }

            // Delete the cart
            if (order.originalCartId) {
                await Cart.findByIdAndDelete(order.originalCartId);
            }

            // Send confirmation email and SMS using common helper function
            sendOrderNotifications(order);

            console.log('Order updated from webhook:', order.orderNumber);
        } else {
            console.log('Order not found for razorpay order:', razorpayOrderId);
        }
    } catch (error) {
        console.log('Error handling payment captured:', error);
    }
}

// Helper function to handle payment failed
async function handlePaymentFailed(paymentEntity) {
    try {
        const razorpayOrderId = paymentEntity.order_id;

        // Find existing order by razorpayOrderId
        const order = await Order.findOne({ razorpayOrderId: razorpayOrderId });

        if (order) {
            order.paymentStatus = 'failed';
            order.orderStatus = 'cancelled';
            order.statusHistory.push({
                status: 'cancelled',
                timestamp: new Date(),
                notes: 'Payment failed'
            });
            await order.save();

            // Return cart to active status
            if (order.originalCartId) {
                await Cart.findByIdAndUpdate(order.originalCartId, {
                    status: 'active',
                    paymentStatus: 'failed'
                });
            }

            console.log('Payment failed for order:', order.orderNumber);
        }
    } catch (error) {
        console.log('Error handling payment failed:', error);
    }
}

// Get payment status
exports.getPaymentStatus = async (req, res) => {
    try {
        const { orderId, cartId } = req.params;
        const { currency } = req.query;

        // Handle multi-currency for response
        const validCurrency = currency && currency !== 'INR' ? currencyList.find(c => c.code === currency) : null;
        let currencySymbol = validCurrency ? validCurrency.symbol : '₹';

        // First try to find by orderId
        if (orderId) {
            const order = await Order.findById(orderId);
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            // Handle multi-currency for response
            let displayAmount;
            if (validCurrency) {
                displayAmount = await getConvertedPrice(order.totalAmount, currency);
            } else {
                displayAmount = order.totalAmount;
            }

            return res.status(200).json({
                success: true,
                data: {
                    orderId: order._id,
                    orderNumber: order.orderNumber,
                    paymentStatus: order.paymentStatus,
                    orderStatus: order.orderStatus,
                    razorpayOrderId: order.razorpayOrderId,
                    paymentId: order.razorpayPaymentId,
                    totalAmount: displayAmount,
                    displayCurrency: validCurrency ? currency : 'INR',
                    currencySymbol: currencySymbol
                }
            });
        }

        // Fallback to cartId lookup
        if (cartId) {
            const cart = await Cart.findById(cartId).select('paymentStatus razorpayOrderId razorpayPaymentId totalAmount orderId');

            if (!cart) {
                return res.status(404).json({
                    success: false,
                    error: 'Cart not found'
                });
            }

            // Handle multi-currency for response
            let displayAmount;
            if (validCurrency && cart.totalAmount) {
                displayAmount = await getConvertedPrice(cart.totalAmount, currency);
            } else {
                displayAmount = cart.totalAmount || 0;
            }

            return res.status(200).json({
                success: true,
                data: {
                    orderId: cart.orderId,
                    cartId: cart._id,
                    paymentStatus: cart.paymentStatus,
                    razorpayOrderId: cart.razorpayOrderId,
                    paymentId: cart.razorpayPaymentId,
                    totalAmount: displayAmount,
                    displayCurrency: validCurrency ? currency : 'INR',
                    currencySymbol: currencySymbol
                }
            });
        }

        return res.status(400).json({
            success: false,
            error: 'orderId or cartId is required'
        });

    } catch (error) {
        console.log('Error getting payment status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get payment status'
        });
    }
};
