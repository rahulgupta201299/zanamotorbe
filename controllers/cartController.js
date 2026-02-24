const Cart = require('../models/Cart');
const BikeProduct = require('../models/BikeProduct');
const Coupon = require('../models/Coupon');
const { getConvertedPrice } = require('../utils/exchangeRate');
const currencyList = require('../utils/currencyList');

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

// Helper function to convert cart prices based on currency
const convertCartPrices = async (cart, currency) => {
    if (!cart || !cart.items || cart.items.length === 0) {
        return cart;
    }

    if (!currency || currency === 'INR') {
        return cart;
    }

    const validCurrency = currencyList.find(c => c.code === currency);
    if (!validCurrency) {
        return cart;
    }

    // Convert item prices
    const convertedItems = await Promise.all(
        cart.items.map(async (item) => {
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

    // Convert cart totals
    const convertedCart = {
        ...cart.toObject(),
        items: convertedItems,
        subtotal: await getConvertedPrice(cart.subtotal || 0, currency),
        originalSubtotal: cart.subtotal || 0,
        discountAmount: await getConvertedPrice(cart.discountAmount || 0, currency),
        originalDiscountAmount: cart.discountAmount || 0,
        shippingCost: await getConvertedPrice(cart.shippingCost || 0, currency),
        originalShippingCost: cart.shippingCost || 0,
        taxAmount: await getConvertedPrice(cart.taxAmount || 0, currency),
        originalTaxAmount: cart.taxAmount || 0,
        totalAmount: await getConvertedPrice(cart.totalAmount || 0, currency),
        originalTotalAmount: cart.totalAmount || 0,
        currency: currency,
        currencySymbol: validCurrency.symbol
    };

    return convertedCart;
};

// Helper function to convert validation result prices
const convertValidationResults = async (results, currency) => {
    if (!results || !Array.isArray(results) || results.length === 0) {
        return results;
    }

    if (!currency || currency === 'INR') {
        return results;
    }

    const validCurrency = currencyList.find(c => c.code === currency);
    if (!validCurrency) {
        return results;
    }

    const convertedResults = await Promise.all(
        results.map(async (result) => {
            const convertedPrice = await getConvertedPrice(result.price || 0, currency);
            return {
                ...result,
                price: convertedPrice,
                originalPrice: result.price,
                currency: currency,
                currencySymbol: validCurrency.symbol
            };
        })
    );

    return convertedResults;
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
        const { items, currency } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Items array is required and cannot be empty' 
            });
        }

        const validationResults = await validateProductAvailability(items);
        
        // Convert prices based on currency
        const convertedResults = await convertValidationResults(validationResults, currency);
        
        const allValid = convertedResults.every(result => result.isValid);
        const invalidItems = convertedResults.filter(result => !result.isValid);

        res.status(200).json({ 
            success: true, 
            data: {
                isValid: allValid,
                items: convertedResults,
                invalidItems: invalidItems,
                message: allValid ? 'All items are available' : 'Some items are not available'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};




// Get active cart (for cart operations)
exports.getActiveCart = async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const { currency } = req.query;
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

        // Convert prices based on currency
        const convertedCart = await convertCartPrices(cart, currency);

        res.status(200).json({
            success: true,
            data: convertedCart
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Manage cart item (add/update/remove multiple items)
exports.manageCartItem = async (req, res) => {
    try {
        console.log('inside mangecartitem')
        const { phoneNumber, items, currency } = req.body;

        if (!phoneNumber) {
        return res.status(400).json({
            success: false,
            message: 'phoneNumber is required'
        });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'items array is required and cannot be empty'
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
                    product: product,
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
                message: 'Validation errors in request',
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

        // Handle coupon validation and recalculation if coupon is already applied
        let couponRemoved = false;
        let couponRemovedMessage = '';
        
        if (cart.appliedCoupon && cart.items.length > 0) {
            // Calculate new subtotal
            const newSubtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
            
            // Get the applied coupon details
            const coupon = await Coupon.findById(cart.appliedCoupon);
            
            if (coupon) {
                // Re-validate coupon eligibility with new subtotal
                const eligibility = await validateCouponEligibility(coupon, phoneNumber, newSubtotal);
                
                if (!eligibility.isValid) {
                    // Coupon is no longer applicable, remove it
                    couponRemoved = true;
                    couponRemovedMessage = eligibility.message;
                    cart.appliedCoupon = null;
                    cart.couponCode = null;
                    cart.discountAmount = 0;
                } else {
                    // Coupon is still applicable, recalculate discount
                    const newDiscountAmount = calculateDiscount(coupon, newSubtotal);
                    cart.discountAmount = newDiscountAmount;
                }
            } else {
                // Coupon no longer exists in database, remove it
                couponRemoved = true;
                couponRemovedMessage = 'Applied coupon no longer exists';
                cart.appliedCoupon = null;
                cart.couponCode = null;
                cart.discountAmount = 0;
            }
        } else if (cart.appliedCoupon && cart.items.length === 0) {
            // Cart is empty, remove coupon
            couponRemoved = true;
            couponRemovedMessage = 'Cart is empty';
            cart.appliedCoupon = null;
            cart.couponCode = null;
            cart.discountAmount = 0;
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

        // Convert prices based on currency
        const convertedCart = await convertCartPrices(cart, currency);

        res.status(200).json({
            success: true,
            processedItems: convertedCart.items,
            unProcessedItems,
            subtotal: convertedCart.subtotal,
            paymentStatus: convertedCart.paymentStatus,
            shippingCost: convertedCart.shippingCost,
            taxAmount: convertedCart.taxAmount,
            discountAmount: convertedCart.discountAmount,
            totalAmount: convertedCart.totalAmount,
            status: convertedCart.status,
            couponCode: convertedCart.couponCode,
            appliedCoupon: convertedCart.appliedCoupon,
            createdAt: convertedCart.createdAt,
            updatedAt: convertedCart.updatedAt,
            couponRemoved: couponRemoved,
            couponRemovedMessage: couponRemoved ? couponRemovedMessage : undefined,
            currency: currency || 'INR'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};



// Clear cart
exports.clearCart = async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
        return res.status(400).json({
            success: false,
            message: 'phoneNumber is required'
        });
        }

        const cart = await Cart.findOne({ phoneNumber, status: 'active' });
        if (!cart) {
        return res.status(404).json({
            success: false,
            message: 'Active cart not found'
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
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update cart addresses
exports.updateCartAddresses = async (req, res) => {
    try {
        const { phoneNumber, shippingAddress, billingAddress, emailId, shippingAddressSameAsBillingAddress } = req.body;

        if (!phoneNumber) {
        return res.status(400).json({
            success: false,
            message: 'phoneNumber is required'
        });
        }

        const cart = await Cart.findOne({ phoneNumber, status: 'active' });
        if (!cart) {
        return res.status(404).json({
            success: false,
            message: 'Active cart not found'
        });
        }

        if (shippingAddress) cart.shippingAddress = shippingAddress;
        if (billingAddress) cart.billingAddress = billingAddress;
        if (emailId !== undefined) cart.emailId = emailId;
        if (shippingAddressSameAsBillingAddress !== undefined) cart.shippingAddressSameAsBillingAddress = shippingAddressSameAsBillingAddress;

        await cart.save();

        res.status(200).json({
            success: true,
            message: 'Cart addresses updated successfully',
            data: {
                shippingAddress: cart.shippingAddress,
                billingAddress: cart.billingAddress,
                emailId: cart.emailId,
                shippingAddressSameAsBillingAddress: cart.shippingAddressSameAsBillingAddress
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Helper function to calculate discount based on coupon type
const calculateDiscount = (coupon, subtotal) => {
    let discount = 0;

    switch (coupon.type) {
        case 'Percentage':
            discount = (subtotal * coupon.discount) / 100;
            if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                discount = coupon.maxDiscount;
            }
            break;
        case 'Flat':
            discount = coupon.discount;
            break;
        case 'Special':
        case 'Festival':
        case 'First Order':
            // For now, treat as flat discount, but can be customized later
            discount = coupon.discount;
            break;
        default:
            discount = 0;
    }

    return Math.round(discount); // Round to avoid decimal issues
};

// Helper function to validate coupon eligibility
const validateCouponEligibility = async (coupon, phoneNumber, subtotal) => {
    // Check if coupon is active
    if (!coupon.isActive) {
        return { isValid: false, message: 'Coupon is not active' };
    }

    // Check expiration
    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
        return { isValid: false, message: 'Coupon has expired' };
    }

    // Check minimum cart amount
    if (subtotal < coupon.minCartAmount) {
        return { isValid: false, message: `Minimum cart amount of ₹${coupon.minCartAmount} required` };
    }

    // Check usage limit per user
    if (coupon.usageLimit) {
        const userUsage = coupon.usedBy.find(u => u.phoneNumber === phoneNumber);
        if (userUsage && userUsage.usageCount >= coupon.usageLimit) {
            return { isValid: false, message: 'Coupon usage limit exceeded' };
        }
    }

    // Check overall usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return { isValid: false, message: 'Coupon has reached maximum usage' };
    }

    return { isValid: true };
};

// Apply coupon to cart
exports.applyCoupon = async (req, res) => {
    try {
        const { phoneNumber, couponCode, currency } = req.body;

        if (!phoneNumber) {
        return res.status(400).json({
            success: false,
            message: 'phoneNumber is required'
        });
        }

        if (!couponCode) {
        return res.status(400).json({
            success: false,
            message: 'couponCode is required'
        });
        }

        const cart = await Cart.findOne({ phoneNumber, status: 'active' });
        if (!cart) {
        return res.status(404).json({
            success: false,
            message: 'Active cart not found'
        });
        }

        if (cart.items.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Cart is empty'
        });
        }

        // Find coupon
        const coupon = await Coupon.findOne({
            code: couponCode.toUpperCase(),
            isActive: true
        });

        if (!coupon) {
        return res.status(404).json({
            success: false,
            message: 'Invalid coupon code'
        });
        }

        // Calculate current subtotal
        const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

        // Validate coupon eligibility
        const eligibility = await validateCouponEligibility(coupon, phoneNumber, subtotal);
        if (!eligibility.isValid) {
            return res.status(400).json({
                success: false,
                message: eligibility.message
            });
        }

        // Calculate discount
        const discountAmount = calculateDiscount(coupon, subtotal);

        // Apply coupon to cart
        cart.appliedCoupon = coupon._id;
        cart.couponCode = coupon.code;
        cart.discountAmount = discountAmount;

        await cart.save();

        // Convert prices based on currency
        const validCurrency = currency ? currencyList.find(c => c.code === currency) : null;
        const convertedDiscountAmount = validCurrency ? await getConvertedPrice(discountAmount, currency) : discountAmount;
        const convertedTotalAmount = validCurrency ? await getConvertedPrice(cart.totalAmount, currency) : cart.totalAmount;
        const convertedSubtotal = validCurrency ? await getConvertedPrice(subtotal, currency) : subtotal;
        const convertedShippingCost = validCurrency ? await getConvertedPrice(cart.shippingCost || 0, currency) : cart.shippingCost;
        const convertedTaxAmount = validCurrency ? await getConvertedPrice(cart.taxAmount || 0, currency) : cart.taxAmount;

        res.status(200).json({
            success: true,
            message: 'Coupon applied successfully',
            data: {
                couponCode: coupon.code,
                couponType: coupon.type,
                discountAmount: convertedDiscountAmount,
                totalAmount: convertedTotalAmount,
                subtotal: convertedSubtotal,
                shippingCost: convertedShippingCost,
                taxAmount: convertedTaxAmount,
                currency: currency || 'INR',
                currencySymbol: validCurrency ? validCurrency.symbol : '₹'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Remove coupon from cart
exports.removeCoupon = async (req, res) => {
    try {
        const { phoneNumber, currency } = req.body;

        if (!phoneNumber) {
        return res.status(400).json({
            success: false,
            message: 'phoneNumber is required'
        });
        }

        const cart = await Cart.findOne({ phoneNumber, status: 'active' });
        if (!cart) {
        return res.status(404).json({
            success: false,
            message: 'Active cart not found'
        });
        }

        if (!cart.appliedCoupon) {
        return res.status(400).json({
            success: false,
            message: 'No coupon applied to cart'
        });
        }

        // Remove coupon
        cart.appliedCoupon = null;
        cart.couponCode = null;
        cart.discountAmount = 0;

        await cart.save();

        // Convert prices based on currency
        const validCurrency = currency ? currencyList.find(c => c.code === currency) : null;
        const convertedTotalAmount = validCurrency ? await getConvertedPrice(cart.totalAmount, currency) : cart.totalAmount;
        const convertedSubtotal = validCurrency ? await getConvertedPrice(cart.subtotal, currency) : cart.subtotal;
        const convertedShippingCost = validCurrency ? await getConvertedPrice(cart.shippingCost || 0, currency) : cart.shippingCost;
        const convertedTaxAmount = validCurrency ? await getConvertedPrice(cart.taxAmount || 0, currency) : cart.taxAmount;

        res.status(200).json({
            success: true,
            message: 'Coupon removed successfully',
            data: {
                totalAmount: convertedTotalAmount,
                subtotal: convertedSubtotal,
                shippingCost: convertedShippingCost,
                taxAmount: convertedTaxAmount,
                discountAmount: 0,
                currency: currency || 'INR',
                currencySymbol: validCurrency ? validCurrency.symbol : '₹'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.checkoutCart = async (req, res) => {
    try {
        const { phoneNumber, paymentMethod = 'online', currency } = req.body;

        const cart = await Cart.findOne({
            phoneNumber,
            status: { $in: ['active', 'validated'] }
        }).populate('items.product');

        if (!cart) {
        return res.status(404).json({
            success: false,
            message: 'No active cart found'
        });
        }

        if (cart.items.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Cart is empty'
        });
        }

        if (!cart.shippingAddress || !cart.billingAddress) {
        return res.status(400).json({
            success: false,
            message: 'Shipping and billing addresses are required'
        });
        }

        // Validate product availability before checkout
        const validationResults = await validateProductAvailability(cart.items);
        const allValid = validationResults.every(result => result.isValid);

        if (!allValid) {
            return res.status(400).json({
                success: false,
                message: 'Some products are no longer available',
                data: validationResults
            });
        }

        // Update cart for checkout
        cart.paymentMethod = paymentMethod;
        cart.status = 'ordered';
        cart.orderDate = new Date();

        // Generate order number
        const orderNumber = `ORD-${phoneNumber}-${Date.now()}`;
        cart.orderNumber = orderNumber;

        // Update coupon usage if coupon was applied
        if (cart.appliedCoupon) {
            const coupon = await Coupon.findById(cart.appliedCoupon);
            if (coupon) {
                // Increment overall usage count
                coupon.usedCount += 1;

                // Update user usage
                let userUsage = coupon.usedBy.find(u => u.phoneNumber === phoneNumber);
                if (userUsage) {
                    userUsage.usageCount += 1;
                    userUsage.usedAt = new Date();
                } else {
                    coupon.usedBy.push({
                        phoneNumber: phoneNumber,
                        usageCount: 1,
                        usedAt: new Date()
                    });
                }

                await coupon.save();
            }
        }

        await cart.save();

        // Convert prices based on currency
        const validCurrency = currency ? currencyList.find(c => c.code === currency) : null;
        const convertedTotalAmount = validCurrency ? await getConvertedPrice(cart.totalAmount, currency) : cart.totalAmount;

        res.status(200).json({
            success: true,
            message: 'Order placed successfully',
            data: {
                orderId: cart._id,
                orderNumber: cart.orderNumber,
                orderDate: cart.orderDate,
                totalAmount: convertedTotalAmount,
                orderStatus: cart.orderStatus,
                itemsCount: cart.items.length,
                currency: currency || 'INR',
                currencySymbol: validCurrency ? validCurrency.symbol : '₹'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
