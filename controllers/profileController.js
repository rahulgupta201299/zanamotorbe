const Profile = require('../models/Profile');

exports.createProfile = async (req, res) => {
    try {
        const { firstName, lastName, isdCode, phoneNumber, emailId, address, notifyOffers, bikeOwnedByCustomer } = req.body;

        // Check if profile with same isdCode and phoneNumber already exists
        const existingProfile = await Profile.findOne({ isdCode, phoneNumber });
        if (existingProfile) {
            return res.status(400).json({ success: false, error: 'Profile with this ISD code and phone number already exists' });
        }

        const newProfile = new Profile({ firstName, lastName, isdCode, phoneNumber, emailId, address, notifyOffers, bikeOwnedByCustomer });
        await newProfile.save();
        res.status(201).json({ success: true, data: newProfile });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getProfileById = async (req, res) => {
    try {
        const profile = await Profile.findById(req.params.id);
        if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
        res.status(200).json({ success: true, data: profile });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, isdCode, phoneNumber, emailId, address, notifyOffers, bikeOwnedByCustomer } = req.body;
        const profile = await Profile.findByIdAndUpdate(
            req.params.id,
            { firstName, lastName, isdCode, phoneNumber, emailId, address, notifyOffers, bikeOwnedByCustomer },
            { new: true }
        );
        if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
        res.status(200).json({ success: true, data: profile });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getProfileByPhoneNumber = async (req, res) => {
    try {
        const { isdCode, phoneNumber } = req.query;
        const profile = await Profile.findOne({ isdCode, phoneNumber });
        if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
        res.status(200).json({ success: true, data: profile });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
