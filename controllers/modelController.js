const BikeModel = require('../models/BikeModel');
const { uploadToS3, deleteFromS3 } = require('../utils/s3Upload');

exports.createModel = async (req, res) => {
    try {
        const { brand, name, type, category, description } = req.body;
        let imageUrl = req.body.imageUrl;

        if (req.file) {
            imageUrl = await uploadToS3(req.file, 'models');
        }

        const newModel = new BikeModel({ brand, name, type, category, description, imageUrl });
        await newModel.save();
        res.status(201).json({ success: true, data: newModel });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getModelsByBrand = async (req, res) => {
    try {
        const models = await BikeModel.find({ brand: req.params.brandId }).populate('brand');
        const modelData = models.map(m => ({ _id: m._id, name: m.name, category: m.category }));
        res.status(200).json({ success: true, data: modelData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getModelById = async (req, res) => {
    try {
        const model = await BikeModel.findById(req.params.id).populate('brand');
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });
        res.status(200).json({ success: true, data: model });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateModel = async (req, res) => {
    try {
        const { brand, name, type, category, description } = req.body;
        let imageUrl = req.body.imageUrl;
        let oldImageUrl = null;

        if (req.file) {
            const oldModel = await BikeModel.findById(req.params.id);
            if (oldModel && oldModel.imageUrl) {
                oldImageUrl = oldModel.imageUrl;
            }
            imageUrl = await uploadToS3(req.file, 'models');
        }

        const updateData = { brand, name, type, category, description };
        if (imageUrl !== undefined) {
            updateData.imageUrl = imageUrl;
        }

        const model = await BikeModel.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).populate('brand');
        if (!model) return res.status(404).json({ success: false, message: 'Model not found' });

        if (oldImageUrl && oldImageUrl !== model.imageUrl) {
            await deleteFromS3(oldImageUrl);
        }

        res.status(200).json({ success: true, data: model });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
