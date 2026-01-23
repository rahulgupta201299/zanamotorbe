const Coupon = require('../models/Coupon');

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
        res.status(500).json({ success: false, error: error.message });
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
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Validate coupon type
        const validTypes = ['Percentage', 'Flat', 'Special', 'Festival', 'First Order'];
        if (!validTypes.includes(couponData.type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid coupon type'
            });
        }

        // Validate percentage coupon has maxDiscount if needed
        if (couponData.type === 'Percentage' && couponData.discount > 50 && !couponData.maxDiscount) {
            return res.status(400).json({
                success: false,
                error: 'High percentage coupons should have a maxDiscount limit'
            });
        }

        // Check if code already exists
        const existingCoupon = await Coupon.findOne({ code: couponData.code.toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                error: 'Coupon code already exists'
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
        res.status(500).json({ success: false, error: error.message });
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
                    error: 'Coupon code already exists'
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
                    error: 'Invalid coupon type'
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
                error: 'Coupon not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Coupon updated successfully',
            data: coupon
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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
                error: 'Coupon not found'
            });
        }

        // Check if coupon has been used
        if (coupon.usedCount > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete coupon that has been used'
            });
        }

        await Coupon.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Coupon deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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
                error: 'Coupon not found'
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
        res.status(500).json({ success: false, error: error.message });
    }
};

// Validate coupon code (public endpoint)
exports.validateCouponCode = async (req, res) => {
    try {
        const { couponCode, phoneNumber, cartAmount } = req.body;

        if (!couponCode) {
            return res.status(400).json({
                success: false,
                error: 'couponCode is required'
            });
        }

        const coupon = await Coupon.findOne({
            code: couponCode.toUpperCase(),
            isActive: true
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                error: 'Invalid coupon code'
            });
        }

        // Basic validation
        const validation = {
            isValid: true,
            coupon: {
                code: coupon.code,
                type: coupon.type,
                discount: coupon.discount,
                maxDiscount: coupon.maxDiscount,
                minCartAmount: coupon.minCartAmount,
                description: coupon.description
            },
            errors: []
        };

        // Check expiration
        if (coupon.expiresAt && new Date() > coupon.expiresAt) {
            validation.isValid = false;
            validation.errors.push('Coupon has expired');
        }

        // Check minimum cart amount
        if (cartAmount !== undefined && cartAmount < coupon.minCartAmount) {
            validation.isValid = false;
            validation.errors.push(`Minimum cart amount of ₹${coupon.minCartAmount} required`);
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
        res.status(500).json({ success: false, error: error.message });
    }
};
