const BikeModel = require('../models/BikeModel');

exports.createModel = async (req, res) => {
    try {
        const { brand, name, type, description, imageUrl } = req.body;
        const newModel = new BikeModel({ brand, name, type, description, imageUrl });
        await newModel.save();
        res.status(201).json({ success: true, data: newModel });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getModelsByBrand = async (req, res) => {
    try {
        const models = await BikeModel.find({ brand: req.params.brandId }).populate('brand');
        const modelData = models.map(m => ({ _id: m._id, name: m.name }));
        res.status(200).json({ success: true, data: modelData });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getModelById = async (req, res) => {
    try {
        const model = await BikeModel.findById(req.params.id).populate('brand');
        if (!model) return res.status(404).json({ success: false, error: 'Model not found' });
        res.status(200).json({ success: true, data: model });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateModel = async (req, res) => {
    try {
        const { brand, name, type, description, imageUrl } = req.body;
        const model = await BikeModel.findByIdAndUpdate(
            req.params.id,
            { brand, name, type, description, imageUrl },
            { new: true }
        ).populate('brand');
        if (!model) return res.status(404).json({ success: false, error: 'Model not found' });
        res.status(200).json({ success: true, data: model });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}
