const BikeBrand = require('../models/BikeBrand');
const BikeModel = require('../models/BikeModel');
const BikeProduct = require('../models/BikeProduct');

exports.createBrand = async (req, res) => {
    try {
        const { name, description } = req.body;
        const newBrand = new BikeBrand({ name, description });
        await newBrand.save();
        res.status(201).json({ success: true, data: newBrand });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateBrand = async (req, res) => {
    try {
        const { name, description } = req.body;
        const brand = await BikeBrand.findByIdAndUpdate(
            req.params.id,
            { name, description },
            { new: true }
        );
        if (!brand) return res.status(404).json({ success: false, error: 'Brand not found' });
        res.status(200).json({ success: true, data: brand });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getAllBrands = async (req, res) => {
    try {
        const brands = await BikeBrand.find();
        res.status(200).json({ success: true, data: brands });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getBrandsWithModels = async (req, res) => {
    try {
        const { category, page = 1, limit = 10 } = req.query;
        
        const pageNum = parseInt(page) > 0 ? parseInt(page) : 1;
        const limitNum = parseInt(limit) > 0 ? parseInt(limit) : 10;
        const skip = (pageNum - 1) * limitNum;

        // Get total count of brands with models
        const brands = await BikeBrand.find();
        const brandsWithModels = [];
        const brandModelCounts = [];

        for (const brand of brands) {
            const modelQuery = { brand: brand._id };
            if (category) {
                modelQuery.category = category;
            }
            const models = await BikeModel.find(modelQuery);
            if (models.length > 0) {
                brandsWithModels.push({
                    ...brand.toObject(),
                    models: models.map(m => ({
                        ...m.toObject(),
                        brandName: brand.name
                    }))
                });
                brandModelCounts.push(brand._id.toString());
            }
        }

        const totalBrands = brandsWithModels.length;
        const totalPages = Math.ceil(totalBrands / limitNum);
        const paginatedBrands = brandsWithModels.slice(skip, skip + limitNum);

        res.status(200).json({
            success: true,
            data: paginatedBrands,
            pagination: {
                total: totalBrands,
                page: pageNum,
                limit: limitNum,
                totalPages: totalPages,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
