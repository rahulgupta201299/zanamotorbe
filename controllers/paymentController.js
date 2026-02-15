const Razorpay = require('razorpay');
const crypto = require('crypto');
const Cart = require('../models/Cart');
const config = require('../config/config');

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: config.RAZORPAY_KEY_ID,
    key_secret: config.RAZORPAY_KEY_SECRET,
});

// Create payment order
exports.createOrder = async (req, res) => {
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

        const amount = Math.round(cart.totalAmount * 100); // Amount in paisa

        const options = {
            amount: amount,
            currency: 'INR',
            receipt: `receipt_${cart._id}}`,
            payment_capture: 1, // Auto capture
            notes: {
                cartId: cart._id.toString(),
                phoneNumber: phoneNumber
            }
        };

        // Create Razorpay order
        const order = await razorpay.orders.create(options);

        // Update cart with order details
        cart.razorpayOrderId = order.id;
        cart.paymentMethod = 'online';
        cart.paymentStatus = 'pending';
        await cart.save();

        res.status(200).json({
            success: true,
            data: {
                orderId: order.id,
                amount: order.amount,
                currency: order.currency,
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
            cartId
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

        // Find and update cart
        const cart = await Cart.findById(cartId);
        if (!cart) {
            return res.status(404).json({
                success: false,
                error: 'Cart not found'
            });
        }

        // Update cart with payment details
        cart.razorpayPaymentId = razorpay_payment_id;
        cart.razorpaySignature = razorpay_signature;
        cart.paymentStatus = 'paid';
        cart.status = 'ordered';

        // Generate order number if not present
        if (!cart.orderNumber) {
            cart.orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        }

        cart.orderDate = new Date();
        cart.orderStatus = 'confirmed';

        await cart.save();

        res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            data: {
                orderId: cart._id,
                orderNumber: cart.orderNumber,
                paymentId: razorpay_payment_id,
                orderStatus: cart.orderStatus,
                orderDate: cart.orderDate
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

// Helper function to handle payment captured
async function handlePaymentCaptured(paymentEntity) {
    try {
        const orderId = paymentEntity.order_id;

        // Find cart by Razorpay order ID
        const cart = await Cart.findOne({ razorpayOrderId: orderId });

        if (cart) {
            cart.paymentStatus = 'paid';
            cart.status = 'ordered';
            cart.orderStatus = 'confirmed';

            if (!cart.orderNumber) {
                cart.orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
            }

            cart.orderDate = new Date();
            await cart.save();

            console.log('Payment captured for order:', cart.orderNumber);
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

        const cart = await Cart.findById(cartId).select('paymentStatus razorpayOrderId razorpayPaymentId orderNumber orderStatus');

        if (!cart) {
            return res.status(404).json({
                success: false,
                error: 'Cart not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                paymentStatus: cart.paymentStatus,
                orderId: cart.razorpayOrderId,
                paymentId: cart.razorpayPaymentId,
                orderNumber: cart.orderNumber,
                orderStatus: cart.orderStatus
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
