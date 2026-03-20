const countries = require('../utils/isdCodes');
const currencies = require('../utils/currencyList');
const { fetchExchangeRates } = require('../utils/exchangeRate');

exports.getIsdCodes = (req, res) => {
    res.status(200).json({
        success: true,
        data: countries
    });
};

exports.getCurrencies = async (req, res) => {
    try {
        const rates = await fetchExchangeRates();
        const currenciesWithRates = currencies.map(currency => ({
            ...currency,
            exchangeRate: rates[currency.code] || 1
        }));
        
        res.status(200).json({
            success: true,
            data: currenciesWithRates
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching currencies'
        });
    }
};
