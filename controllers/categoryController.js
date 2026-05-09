const Category = require('../models/Category');

exports.createCategory = async (req, res) => {
    try {
        const { category, typeOfCategory, isActive, subCategory } = req.body;
        const newCategory = new Category({ category, typeOfCategory, isActive, subCategory });
        await newCategory.save();
        res.status(201).json({ success: true, data: newCategory });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCategories = async (req, res) => {
    try {
        const { typeOfCategory } = req.query;
        let query = {};

        if (typeOfCategory) {
            if (typeOfCategory === 'Bike Specific') {
                query.typeOfCategory = { $in: ['Bike Specific', 'Both'] };
            } else if (typeOfCategory === 'Universal') {
                query.typeOfCategory = { $in: ['Universal', 'Both'] };
            } else {
                query.typeOfCategory = typeOfCategory;
            }
        }

        query.isActive = true;

        const categories = await Category.find(query);
        res.status(200).json({ success: true, data: categories });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { category, typeOfCategory, isActive, subCategory } = req.body;
        const updateFields = {};
        if (category !== undefined) updateFields.category = category;
        if (typeOfCategory !== undefined) updateFields.typeOfCategory = typeOfCategory;
        if (isActive !== undefined) updateFields.isActive = isActive;
        if (subCategory !== undefined) updateFields.subCategory = subCategory;

        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true }
        );
        if (!updatedCategory) return res.status(404).json({ success: false, message: 'Category not found' });
        res.status(200).json({ success: true, data: updatedCategory });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};