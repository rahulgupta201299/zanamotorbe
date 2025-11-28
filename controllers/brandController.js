const BikeBrand = require('../models/BikeBrand');
const BikeModel = require('../models/BikeModel');
const BikeProduct = require('../models/BikeProduct');

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
        const brands = await BikeBrand.find();
        const brandsWithModels = [];

        for (const brand of brands) {
            const models = await BikeModel.find({ brand: brand._id });
            brandsWithModels.push({
                ...brand.toObject(),
                models: models.map(m => ({
                    ...m.toObject(),
                    brandName: brand.name
                }))
            });
        }

        res.status(200).json({ success: true, data: brandsWithModels });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
