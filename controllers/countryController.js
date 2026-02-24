const countries = require('../utils/isdCodes');
const currencies = require('../utils/currencyList');

exports.getIsdCodes = (req, res) => {
    res.status(200).json({
        success: true,
        data: countries
    });
};

exports.getCurrencies = (req, res) => {
    res.status(200).json({
        success: true,
        data: currencies
    });
};
