// List of countries with ISD codes
const countries = require('../utils/isdCodes');

exports.getIsdCodes = (req, res) => {
    res.status(200).json({
        success: true,
        data: countries
    });
};
