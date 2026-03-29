const Razorpay = require('razorpay');
const crypto = require('crypto');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const BikeProduct = require('../models/BikeProduct');
const config = require('../config/config');
const { getConvertedPrice, getReverseConvertedPrice } = require('../utils/exchangeRate');
const currencyList = require('../utils/currencyList');

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: config.RAZORPAY_KEY_ID,
    key_secret: config.RAZORPAY_KEY_SECRET,
});

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
        // cart.totalAmount is stored in INR in the database
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

        const options = {
            amount: amountInPaisa,
            currency: 'INR',
            receipt: `receipt_${cart._id}`,
            payment_capture: 1,
            notes: {
                cartId: cart._id.toString(),
                phoneNumber: phoneNumber,
                originalCurrency: validCurrency ? currency : 'INR'
            }
        };

        // Create Razorpay order
        const razorpayOrder = await razorpay.orders.create(options);

        // Update cart with order details
        cart.razorpayOrderId = razorpayOrder.id;
        cart.paymentMethod = 'online';
        cart.paymentStatus = 'pending';
        cart.status = 'checkout';
        await cart.save();

        res.status(200).json({
            success: true,
            data: {
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                displayAmount: displayAmount,
                displayCurrency: validCurrency ? currency : 'INR',
                currencySymbol: currencySymbol,
                cartId: cart._id,
                name: "zanaltd"
            }
        });

    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create payment order'
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
            cartId,
            currency
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !cartId) {
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

        // Find cart
        const cart = await Cart.findById(cartId).populate('items.product');
        if (!cart) {
            return res.status(404).json({
                success: false,
                error: 'Cart not found'
            });
        }

        // Generate order number
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // Get currency info
        const validCurrency = currency && currency !== 'INR' ? currencyList.find(c => c.code === currency) : null;
        const currencySymbol = validCurrency ? validCurrency.symbol : '₹';

        // Prepare order items with product details
        const orderItems = cart.items.map(item => ({
            product: item.product._id,
            productName: item.product.name || 'Unknown Product',
            productImage: item.product.images ? item.product.images[0] : null,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice
        }));

        // Create Order document
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
            paymentMethod: cart.paymentMethod || 'online',
            paymentStatus: 'paid',
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            orderStatus: 'placed',
            statusHistory: [{
                status: 'placed',
                timestamp: new Date(),
                notes: 'Order placed successfully after payment'
            }],
            orderDate: new Date(),
            originalCartId: cart._id
        });

        await order.save();

        // Reduce product quantity in inventory
        if (cart.items && cart.items.length > 0) {
            for (const item of cart.items) {
                await BikeProduct.findByIdAndUpdate(
                    item.product._id,
                    { $inc: { quantityAvailable: -item.quantity } }
                );
            }
        }

        // Delete the cart after successful order creation
        await Cart.findByIdAndDelete(cartId);

        // Handle multi-currency for response
        let displayAmount;
        if (validCurrency) {
            displayAmount = await getConvertedPrice(order.totalAmount, currency);
        } else {
            displayAmount = order.totalAmount;
        }

        res.status(200).json({
            success: true,
            message: 'Payment verified and order created successfully',
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
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            error: 'Payment verification failed'
        });
    }
};

// Handle Razorpay webhook
exports.handleWebhook = async (req, res) => {
    try {
        const secret = config.RAZORPAY_KEY_SECRET;
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
        console.error('Webhook error:', error);
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

        // Find cart by Razorpay order ID
        const cart = await Cart.findOne({ razorpayOrderId: razorpayOrderId }).populate('items.product');

        if (cart && cart.status !== 'checkout') {
            // Generate order number
            const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

            // Prepare order items
            const orderItems = cart.items.map(item => ({
                product: item.product._id,
                productName: item.product.name || 'Unknown Product',
                productImage: item.product.images ? item.product.images[0] : null,
                quantity: item.quantity,
                price: item.price,
                totalPrice: item.totalPrice
            }));

            // Create Order document
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
                currencySymbol: '₹',
                paymentMethod: cart.paymentMethod || 'online',
                paymentStatus: 'paid',
                razorpayOrderId: razorpayOrderId,
                razorpayPaymentId: paymentEntity.id,
                orderStatus: 'placed',
                statusHistory: [{
                    status: 'placed',
                    timestamp: new Date(),
                    notes: 'Order placed from webhook payment capture'
                }],
                orderDate: new Date(),
                originalCartId: cart._id
            });

            await order.save();

            // Reduce product quantity in inventory
            if (cart.items && cart.items.length > 0) {
                for (const item of cart.items) {
                    await BikeProduct.findByIdAndUpdate(
                        item.product._id,
                        { $inc: { quantityAvailable: -item.quantity } }
                    );
                }
            }

            // Delete the cart
            await Cart.findByIdAndDelete(cart._id);

            console.log('Order created from webhook:', order.orderNumber);
        } else if (!cart) {
            console.log('Cart not found for razorpay order:', razorpayOrderId);
        }
    } catch (error) {
        console.error('Error handling payment captured:', error);
    }
}

// Helper function to handle payment failed
async function handlePaymentFailed(paymentEntity) {
    try {
        const orderId = paymentEntity.order_id;

        const cart = await Cart.findOne({ razorpayOrderId: orderId });

        if (cart) {
            cart.paymentStatus = 'failed';
            cart.status = 'active'; // Return to active cart
            await cart.save();

            console.log('Payment failed for cart:', cart._id);
        }
    } catch (error) {
        console.error('Error handling payment failed:', error);
    }
}

// Get payment status
exports.getPaymentStatus = async (req, res) => {
    try {
        const { cartId } = req.params;
        const { currency } = req.query;

        const cart = await Cart.findById(cartId).select('paymentStatus razorpayOrderId razorpayPaymentId totalAmount');

        if (!cart) {
            return res.status(404).json({
                success: false,
                error: 'Cart not found'
            });
        }

        // Handle multi-currency for response
        const validCurrency = currency && currency !== 'INR' ? currencyList.find(c => c.code === currency) : null;
        let displayAmount;
        let currencySymbol;

        if (validCurrency && cart.totalAmount) {
            const convertedAmount = await getConvertedPrice(cart.totalAmount, currency);
            displayAmount = convertedAmount;
            currencySymbol = validCurrency.symbol;
        } else {
            displayAmount = cart.totalAmount || 0;
            currencySymbol = '₹';
        }

        res.status(200).json({
            success: true,
            data: {
                paymentStatus: cart.paymentStatus,
                razorpayOrderId: cart.razorpayOrderId,
                paymentId: cart.razorpayPaymentId,
                totalAmount: displayAmount,
                displayCurrency: validCurrency ? currency : 'INR',
                currencySymbol: currencySymbol
            }
        });

    } catch (error) {
        console.error('Error getting payment status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get payment status'
        });
    }
};
