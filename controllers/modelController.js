const BikeModel = require('../models/BikeModel');
const { uploadToS3, deleteFromS3 } = require('../utils/s3');

exports.createModel = async (req, res) => {
    try {
        const { brand, name, type, category, description, isActive } = req.body;
        let imageUrl = req.body.imageUrl;

        if (req.file) {
            imageUrl = await uploadToS3(req.file, 'models');
        }

        const newModel = new BikeModel({ brand, name, type, category, description, imageUrl, isActive });
        await newModel.save();
        res.status(201).json({ success: true, data: newModel });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getModelsByBrand = async (req, res) => {
    try {
        const models = await BikeModel.find({ brand: req.params.brandId, isActive: true }).populate('brand');
        const modelData = models.map(m => ({ _id: m._id, name: m.name, category: m.category }));
        res.status(200).json({ success: true, data: modelData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getModelById = async (req, res) => {
    try {
        const model = await BikeModel.findOne({ _id: req.params.id, isActive: true }).populate('brand');
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });
        res.status(200).json({ success: true, data: model });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateModel = async (req, res) => {
    try {
        const { brand, name, type, category, description, isActive } = req.body;
        let imageUrl = req.body.imageUrl;

        const existingModel = await BikeModel.findById(req.params.id);
        if (!existingModel) return res.status(404).json({ success: false, message: 'Model not found' });

        if (req.file) {
            imageUrl = await uploadToS3(req.file, 'models');
            if (existingModel.imageUrl) {
                await deleteFromS3(existingModel.imageUrl);
            }
        } else if (!imageUrl && existingModel.imageUrl) {
            imageUrl = existingModel.imageUrl;
        } else if (imageUrl !== existingModel.imageUrl && existingModel.imageUrl) {
            await deleteFromS3(existingModel.imageUrl);
        }

        const updateFields = {};
        if (brand !== undefined) updateFields.brand = brand;
        if (name !== undefined) updateFields.name = name;
        if (type !== undefined) updateFields.type = type;
        if (category !== undefined) updateFields.category = category;
        if (description !== undefined) updateFields.description = description;
        if (imageUrl !== undefined) updateFields.imageUrl = imageUrl;
        if (isActive !== undefined) updateFields.isActive = isActive;

        const model = await BikeModel.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true }
        ).populate('brand');

        res.status(200).json({ success: true, data: model });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
