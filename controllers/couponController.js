const Coupon = require('../models/Coupon');
const { getConvertedPrice } = require('../utils/exchangeRate');
const currencyList = require('../utils/currencyList');

// Get all coupons (admin)
exports.getAllCoupons = async (req, res) => {
    try {
        const { page = 1, limit = 10, type, isActive, search } = req.query;

        const query = {};

        // Filter by type
        if (type) {
            query.type = type;
        }

        // Filter by active status
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        // Search by code or description
        if (search) {
            query.$or = [
                { code: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { createdAt: -1 }
        };

        const coupons = await Coupon.find(query)
            .sort(options.sort)
            .limit(options.limit)
            .skip((options.page - 1) * options.limit);

        const total = await Coupon.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                coupons,
                pagination: {
                    page: options.page,
                    limit: options.limit,
                    total,
                    pages: Math.ceil(total / options.limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get coupon by ID
exports.getCouponById = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate MongoDB ObjectId
        if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid coupon ID format'
        });
        }

        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        res.status(200).json({
            success: true,
            data: coupon
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};



// Create new coupon
exports.createCoupon = async (req, res) => {
    try {
        const couponData = req.body;

        // Validate required fields
        const requiredFields = ['code', 'type', 'discount'];
        const missingFields = requiredFields.filter(field => !couponData[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Validate coupon type
        const validTypes = ['Percentage', 'Flat', 'Special', 'Festival', 'First Order'];
        if (!validTypes.includes(couponData.type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid coupon type'
            });
        }

        // Validate percentage coupon has maxDiscount if needed
        if (couponData.type === 'Percentage' && couponData.discount > 50 && !couponData.maxDiscount) {
            return res.status(400).json({
                success: false,
                message: 'High percentage coupons should have a maxDiscount limit'
            });
        }

        // Check if code already exists
        const existingCoupon = await Coupon.findOne({ code: couponData.code.toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code already exists'
            });
        }

        // Create coupon
        const coupon = new Coupon({
            ...couponData,
            code: couponData.code.toUpperCase()
        });

        await coupon.save();

        res.status(201).json({
            success: true,
            message: 'Coupon created successfully',
            data: coupon
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update coupon
exports.updateCoupon = async (req, res) => {
    try {
        const { id, ...updateData } = req.body;

        // Don't allow updating code if it's being used
        if (updateData.code) {
            const existingCoupon = await Coupon.findOne({
                code: updateData.code.toUpperCase(),
                _id: { $ne: id }
            });
            if (existingCoupon) {
                return res.status(400).json({
                    success: false,
                    message: 'Coupon code already exists'
                });
            }
            updateData.code = updateData.code.toUpperCase();
        }

        // Validate coupon type if being updated
        if (updateData.type) {
            const validTypes = ['Percentage', 'Flat', 'Special', 'Festival', 'First Order'];
            if (!validTypes.includes(updateData.type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid coupon type'
                });
            }
        }

        const coupon = await Coupon.findByIdAndUpdate(
            id,
            { ...updateData, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Coupon updated successfully',
            data: coupon
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete coupon
exports.deleteCoupon = async (req, res) => {
    try {
        const { id } = req.body;

        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        // Check if coupon has been used
        if (coupon.usedCount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete coupon that has been used'
            });
        }

        await Coupon.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Coupon deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Toggle coupon active status
exports.toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.body;

        const coupon = await Coupon.findById(id);

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        coupon.isActive = !coupon.isActive;
        coupon.updatedAt = new Date();

        await coupon.save();

        res.status(200).json({
            success: true,
            message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
            data: coupon
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Validate coupon code (public endpoint)
exports.validateCouponCode = async (req, res) => {
    try {
        const { couponCode, phoneNumber, cartAmount, currency } = req.body;

        if (!couponCode) {
            return res.status(400).json({
                success: false,
                message: 'couponCode is required'
            });
        }

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

        // Check if valid currency
        const validCurrency = currency ? currencyList.find(c => c.code === currency) : null;
        
        // Convert coupon values based on currency
        const convertedDiscount = validCurrency ? await getConvertedPrice(coupon.discount, currency) : coupon.discount;
        const convertedMaxDiscount = coupon.maxDiscount ? (validCurrency ? await getConvertedPrice(coupon.maxDiscount, currency) : coupon.maxDiscount) : null;
        const convertedMinCartAmount = validCurrency ? await getConvertedPrice(coupon.minCartAmount, currency) : coupon.minCartAmount;

        // Basic validation
        const validation = {
            isValid: true,
            coupon: {
                code: coupon.code,
                type: coupon.type,
                discount: convertedDiscount,
                maxDiscount: convertedMaxDiscount,
                minCartAmount: convertedMinCartAmount,
                description: coupon.description,
                currency: currency || 'INR',
                currencySymbol: validCurrency ? validCurrency.symbol : '₹'
            },
            errors: []
        };

        // Check expiration
        if (coupon.expiresAt && new Date() > coupon.expiresAt) {
            validation.isValid = false;
            validation.errors.push('Coupon has expired');
        }

        // Check minimum cart amount (use converted values if currency provided)
        if (cartAmount !== undefined && cartAmount < convertedMinCartAmount) {
            validation.isValid = false;
            validation.errors.push(`Minimum cart amount of ${validCurrency ? validCurrency.symbol : '₹'}${convertedMinCartAmount} required`);
        }

        // Check usage limits
        if (phoneNumber) {
            if (coupon.usageLimit) {
                const userUsage = coupon.usedBy.find(u => u.phoneNumber === phoneNumber);
                if (userUsage && userUsage.usageCount >= coupon.usageLimit) {
                    validation.isValid = false;
                    validation.errors.push('Coupon usage limit exceeded for this user');
                }
            }

            if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
                validation.isValid = false;
                validation.errors.push('Coupon has reached maximum usage');
            }
        }

        res.status(200).json({
            success: true,
            data: validation
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
