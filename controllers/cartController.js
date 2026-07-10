const Cart = require('../models/Cart');
const BikeProduct = require('../models/BikeProduct');
const Coupon = require('../models/Coupon');
const { getConvertedPrice } = require('../utils/exchangeRate');
const currencyList = require('../utils/currencyList');
const { COD_CHARGES } = require('../config/config')

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

    // Get INR info for default currency
    const inrCurrency = currencyList.find(c => c.code === 'INR');

    if (!currency || currency === 'INR') {
        // For INR, still add currency info for consistency
        const cartObj = cart.toObject ? cart.toObject() : cart;

        const convertedItems = cartObj.items.map((item) => {
            const itemObj = item.toObject ? item.toObject() : item;
            let convertedProduct = itemObj.product;

            if (convertedProduct && typeof convertedProduct === 'object' && convertedProduct._id) {
                const productObj = convertedProduct.toObject ? convertedProduct.toObject() : convertedProduct;
                convertedProduct = {
                    ...productObj,
                    originalPrice: productObj.price,
                    currency: 'INR',
                    currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
                };
            }

            return {
                ...itemObj,
                product: convertedProduct,
                originalPrice: itemObj.price,
                originalTotalPrice: itemObj.totalPrice,
                currency: 'INR',
                currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
            };
        });

        return {
            ...cartObj,
            items: convertedItems,
            originalSubtotal: cartObj.subtotal,
            originalDiscountAmount: cartObj.discountAmount,
            originalShippingCost: cartObj.shippingCost,
            originalTaxAmount: cartObj.taxAmount,
            codCharges: cartObj.codCharges || 0,
            originalCodCharges: cartObj.codCharges || 0,
            originalTotalAmount: cartObj.totalAmount,
            currency: 'INR',
            currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
        };
    }

    const validCurrency = currencyList.find(c => c.code === currency);
    if (!validCurrency) {
        // Return with INR info if currency is invalid
        const cartObj = cart.toObject ? cart.toObject() : cart;

        const convertedItems = cartObj.items.map((item) => {
            const itemObj = item.toObject ? item.toObject() : item;
            let convertedProduct = itemObj.product;

            if (convertedProduct && typeof convertedProduct === 'object' && convertedProduct._id) {
                const productObj = convertedProduct.toObject ? convertedProduct.toObject() : convertedProduct;
                convertedProduct = {
                    ...productObj,
                    currency: 'INR',
                    currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
                };
            }

            return {
                ...itemObj,
                product: convertedProduct,
                currency: 'INR',
                currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
            };
        });

        return {
            ...cartObj,
            items: convertedItems,
            currency: 'INR',
            currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
        };
    }

    // Convert item prices
    const convertedItems = await Promise.all(
        cart.items.map(async (item) => {
            const itemObj = item.toObject ? item.toObject() : item;
            const originalPrice = itemObj.price;
            const originalTotalPrice = itemObj.totalPrice;

            const convertedPrice = await getConvertedPrice(originalPrice, currency);
            const convertedTotalPrice = await getConvertedPrice(originalTotalPrice, currency);

            // Convert product prices if product is populated
            let convertedProduct = itemObj.product;
            if (convertedProduct && typeof convertedProduct === 'object' && convertedProduct._id) {
                const productObj = convertedProduct.toObject ? convertedProduct.toObject() : convertedProduct;
                const productOriginalPrice = productObj.price;
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
        subtotal: await getConvertedPrice(cart.subtotal, currency),
        originalSubtotal: cart.subtotal,
        discountAmount: await getConvertedPrice(cart.discountAmount, currency),
        originalDiscountAmount: cart.discountAmount,
        shippingCost: await getConvertedPrice(cart.shippingCost, currency),
        originalShippingCost: cart.shippingCost,
        taxAmount: await getConvertedPrice(cart.taxAmount, currency),
        originalTaxAmount: cart.taxAmount,
        codCharges: cart.codCharges ? await getConvertedPrice(cart.codCharges, currency) : 0,
        originalCodCharges: cart.codCharges || 0,
        totalAmount: await getConvertedPrice(cart.totalAmount, currency),
        originalTotalAmount: cart.totalAmount,
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

    // Get INR info for default currency
    const inrCurrency = currencyList.find(c => c.code === 'INR');

    if (!currency || currency === 'INR') {
        // For INR, still add currency info for consistency
        const convertedResults = results.map((result) => {
            let convertedProduct = result.product;

            if (convertedProduct && typeof convertedProduct === 'object' && convertedProduct._id) {
                const productObj = convertedProduct.toObject ? convertedProduct.toObject() : convertedProduct;
                convertedProduct = {
                    ...productObj,
                    originalPrice: productObj.price,
                    currency: 'INR',
                    currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
                };
            }

            return {
                ...result,
                product: convertedProduct,
                originalPrice: result.price,
                currency: 'INR',
                currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
            };
        });
        return convertedResults;
    }

    const validCurrency = currencyList.find(c => c.code === currency);
    if (!validCurrency) {
        // Return with INR info if currency is invalid
        const convertedResults = results.map((result) => {
            let convertedProduct = result.product;

            if (convertedProduct && typeof convertedProduct === 'object' && convertedProduct._id) {
                const productObj = convertedProduct.toObject ? convertedProduct.toObject() : convertedProduct;
                convertedProduct = {
                    ...productObj,
                    currency: 'INR',
                    currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
                };
            }

            return {
                ...result,
                product: convertedProduct,
                currency: 'INR',
                currencySymbol: inrCurrency ? inrCurrency.symbol : '₹'
            };
        });
        return convertedResults;
    }

    const convertedResults = await Promise.all(
        results.map(async (result) => {
            const convertedPrice = await getConvertedPrice(result.price, currency);
            let convertedProduct = result.product;

            if (convertedProduct && typeof convertedProduct === 'object' && convertedProduct._id) {
                const productObj = convertedProduct.toObject ? convertedProduct.toObject() : convertedProduct;
                const productOriginalPrice = productObj.price;
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
                ...result,
                product: convertedProduct,
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
            codCharges: convertedCart.codCharges,
            totalAmount: convertedCart.totalAmount,
            status: convertedCart.status,
            couponCode: convertedCart.couponCode,
            appliedCoupon: convertedCart.appliedCoupon,
            createdAt: convertedCart.createdAt,
            updatedAt: convertedCart.updatedAt,
            couponRemoved: couponRemoved,
            couponRemovedMessage: couponRemoved ? couponRemovedMessage : undefined,
            currency: convertedCart.currency || currency || 'INR',
            currencySymbol: convertedCart.currencySymbol || '₹'
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
            code: couponCode,
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

        // Update cart with subtotal and recalculate totalAmount
        cart.subtotal = subtotal;
        cart.discountAmount = discountAmount;
        cart.totalAmount = subtotal - discountAmount + (cart.shippingCost) + (cart.taxAmount);

        // Apply coupon to cart
        cart.appliedCoupon = coupon._id;
        cart.couponCode = coupon.code;

        await cart.save();

        // Re-fetch the cart to get the updated values after save
        const updatedCart = await Cart.findById(cart._id);

        // Convert prices based on currency (only convert if currency is not INR)
        const shouldConvert = currency && currency !== 'INR';
        const validCurrency = shouldConvert ? currencyList.find(c => c.code === currency) : null;

        const responseData = {
            couponCode: coupon.code,
            couponType: coupon.type,
            subtotal: shouldConvert ? await getConvertedPrice(updatedCart.subtotal, currency) : updatedCart.subtotal,
            discountAmount: shouldConvert ? await getConvertedPrice(updatedCart.discountAmount, currency) : updatedCart.discountAmount,
            totalAmount: shouldConvert ? await getConvertedPrice(updatedCart.totalAmount, currency) : updatedCart.totalAmount,
            shippingCost: shouldConvert ? await getConvertedPrice(updatedCart.shippingCost, currency) : (updatedCart.shippingCost),
            taxAmount: shouldConvert ? await getConvertedPrice(updatedCart.taxAmount, currency) : (updatedCart.taxAmount),
            codCharges: shouldConvert ? await getConvertedPrice(updatedCart.codCharges || 0, currency) : (updatedCart.codCharges || 0),
            currency: currency || 'INR',
            currencySymbol: validCurrency ? validCurrency.symbol : '₹'
        };

        res.status(200).json({
            success: true,
            message: 'Coupon applied successfully',
            data: responseData
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
        const convertedShippingCost = validCurrency ? await getConvertedPrice(cart.shippingCost, currency) : cart.shippingCost;
        const convertedTaxAmount = validCurrency ? await getConvertedPrice(cart.taxAmount, currency) : cart.taxAmount;

        res.status(200).json({
            success: true,
            message: 'Coupon removed successfully',
            data: {
                totalAmount: convertedTotalAmount,
                subtotal: convertedSubtotal,
                shippingCost: convertedShippingCost,
                taxAmount: convertedTaxAmount,
                discountAmount: 0,
                codCharges: validCurrency ? await getConvertedPrice(cart.codCharges || 0, currency) : (cart.codCharges || 0),
                currency: currency || 'INR',
                currencySymbol: validCurrency ? validCurrency.symbol : '₹'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Set payment method and apply cod charges
exports.setPaymentMethod = async (req, res) => {
    try {
        const { phoneNumber, method, currency } = req.body;

        if (!phoneNumber || !method) {
            return res.status(400).json({
                success: false,
                message: 'phoneNumber and method are required'
            });
        }

        const cart = await Cart.findOne({ phoneNumber, status: 'active' }).populate('items.product');
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Active cart not found'
            });
        }

        if (method === 'cod') {
            cart.codCharges = COD_CHARGES;
        } else {
            cart.codCharges = 0;
        }

        cart.paymentMethod = method;
        await cart.save();

        const convertedCart = await convertCartPrices(cart, currency);

        let advanceAmount = 0;
        if (method === 'cod') {
            if (cart.totalAmount < 1000) {
                advanceAmount = 300;
            } else if (cart.totalAmount >= 1000 && cart.totalAmount < 2000) {
                advanceAmount = 600;
            } else {
                advanceAmount = 1000;
            }
        }

        let finalAdvanceAmount = advanceAmount;
        if (currency && currency !== 'INR') {
            finalAdvanceAmount = await getConvertedPrice(advanceAmount, currency);
        }

        res.status(200).json({
            success: true,
            message: 'Payment method updated successfully',
            data: {
                ...convertedCart,
                advanceAmount: finalAdvanceAmount,
                originalAdvanceAmount: advanceAmount
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all active carts for admin with filtering and pagination
exports.getAdminActiveCarts = async (req, res) => {
    try {
        const { minAmount, maxAmount, startDate, endDate, phoneNumber, emailId, sortBy = 'updatedAt', sortOrder = 'desc', page = 1, limit = 10 } = req.query;

        // Validate sortBy field
        const allowedSortFields = ['totalAmount', 'updatedAt'];
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

        const query = { status: 'active' };

        if (minAmount || maxAmount) {
            query.totalAmount = {};
            if (minAmount) query.totalAmount.$gte = parseFloat(minAmount);
            if (maxAmount) query.totalAmount.$lte = parseFloat(maxAmount);
        }

        // Date filters (handling IST offset +5:30)
        if (startDate || endDate) {
            query.updatedAt = {};
            if (startDate) query.updatedAt.$gte = new Date(`${startDate}T00:00:00+05:30`);
            if (endDate) query.updatedAt.$lte = new Date(`${endDate}T23:59:59.999+05:30`);
        }

        // Additional filters
        if (phoneNumber) {
            query.phoneNumber = phoneNumber;
        }

        if (emailId) {
            query.emailId = emailId;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const totalCarts = await Cart.countDocuments(query);
        const carts = await Cart.find(query)
            .populate('items.product')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        // Map carts to object if needed (convertCartPrices was doing this plus conversion)
        // Since we removed currency, we just return the carts as is or populate them.
        const cartData = carts.map(cart => cart.toObject ? cart.toObject() : cart);

        const totalPages = Math.ceil(totalCarts / limit);

        res.status(200).json({
            success: true,
            data: {
                carts: cartData,
                pagination: {
                    totalCarts,
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

// Download active carts as CSV
exports.downloadAdminActiveCartsCsv = async (req, res) => {
    try {
        const { minAmount, maxAmount, startDate, endDate, phoneNumber, emailId, sortBy = 'updatedAt', sortOrder = 'desc' } = req.query;

        // Same query construction as getAdminActiveCarts
        const query = { status: 'active' };

        if (minAmount || maxAmount) {
            query.totalAmount = {};
            if (minAmount) query.totalAmount.$gte = parseFloat(minAmount);
            if (maxAmount) query.totalAmount.$lte = parseFloat(maxAmount);
        }

        // Date filters (handling IST offset +5:30)
        if (startDate || endDate) {
            query.updatedAt = {};
            if (startDate) query.updatedAt.$gte = new Date(`${startDate}T00:00:00+05:30`);
            if (endDate) query.updatedAt.$lte = new Date(`${endDate}T23:59:59.999+05:30`);
        }

        // Additional filters
        if (phoneNumber) {
            query.phoneNumber = phoneNumber;
        }

        if (emailId) {
            query.emailId = emailId;
        }

        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const carts = await Cart.find(query)
            .populate('items.product')
            .sort(sort);

        // Build CSV content
        const headers = [
            'Cart ID',
            'Phone Number',
            'Email ID',
            'Product Codes',
            'Product Names',
            'Quantities',
            'Unit Prices',
            'Subtotal',
            'Discount Amount',
            'COD Charges',
            'Total Amount',
            'Coupon Code',
            'Razorpay Order ID',
            'Shipping Address',
            'Billing Address',
            'Created At',
            'Updated At'
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

        const rows = carts.map(cart => {
            const productCodes = cart.items.map(item => item.product ? item.product.productCode || 'N/A' : 'N/A').join(' | ');
            const productNames = cart.items.map(item => item.product ? item.product.name : 'Unknown Product').join(' | ');
            const quantities = cart.items.map(item => item.quantity).join(' | ');
            const unitPrices = cart.items.map(item => item.price).join(' | ');

            return [
                cart._id,
                cart.phoneNumber,
                cart.emailId || '',
                productCodes,
                productNames,
                quantities,
                unitPrices,
                cart.subtotal,
                cart.discountAmount,
                cart.codCharges || 0,
                cart.totalAmount,
                cart.couponCode || '',
                cart.razorpayOrderId || '',
                formatAddress(cart.shippingAddress),
                formatAddress(cart.billingAddress),
                cart.createdAt.toISOString(),
                cart.updatedAt.toISOString()
            ].map(escapeCSV).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="active_carts.csv"');
        res.status(200).send(csvContent);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Store / update UTM parameters on the active cart
exports.updateCartUtmParams = async (req, res) => {
    try {
        const {
            phoneNumber,
            utm_source,
            utm_medium,
            utm_campaign,
            utm_term,
            utm_content
        } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'phoneNumber is required'
            });
        }

        const utmFieldsProvided = [utm_source, utm_medium, utm_campaign, utm_term, utm_content]
            .some(v => v !== undefined);

        if (!utmFieldsProvided) {
            return res.status(400).json({
                success: false,
                message: 'At least one UTM parameter (utm_source, utm_medium, utm_campaign, utm_term, utm_content) is required'
            });
        }

        // Get or create the active cart
        let cart = await Cart.findOne({ phoneNumber, status: 'active' });
        if (!cart) {
            cart = new Cart({
                phoneNumber,
                items: [],
                status: 'active'
            });
        }

        // Merge: only overwrite keys that were explicitly provided in the request
        if (!cart.utmParams) {
            cart.utmParams = {};
        }
        if (utm_source   !== undefined) cart.utmParams.utm_source   = utm_source;
        if (utm_medium   !== undefined) cart.utmParams.utm_medium   = utm_medium;
        if (utm_campaign !== undefined) cart.utmParams.utm_campaign = utm_campaign;
        if (utm_term     !== undefined) cart.utmParams.utm_term     = utm_term;
        if (utm_content  !== undefined) cart.utmParams.utm_content  = utm_content;

        // Mark the nested object as modified so Mongoose persists it
        cart.markModified('utmParams');

        await cart.save();

        res.status(200).json({
            success: true,
            message: 'UTM parameters saved successfully',
            data: {
                utmParams: cart.utmParams
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
