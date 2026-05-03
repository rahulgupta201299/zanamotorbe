const countries = require('../utils/isdCodes');
const currencies = require('../utils/currencyList');
const { fetchExchangeRates } = require('../utils/exchangeRate');
const axios = require('axios');
const config = require('../config/config')

exports.getIsdCodes = (req, res) => {
    res.status(200).json({
        success: true,
        data: countries
    });
};

exports.getLocationCurrency = async (req, res) => {
    try {
        const { lat, lng } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
        }

        const apiKey = config.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, message: 'Google Maps API key is not configured' });
        }

        const response = await axios.get(`${config.GOOGLE_MAPS_GEOLOCATION_URL}?latlng=${lat},${lng}&key=${apiKey}`);
        const data = response.data;

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            return res.status(404).json({ success: false, message: 'Location not found' });
        }

        // Find the country component in the address
        let countryCode = null;
        let countryName = null;
        for (const component of data.results[0].address_components) {
            if (component.types.includes('country')) {
                countryCode = component.short_name;
                countryName = component.long_name;
                break;
            }
        }

        if (!countryCode) {
            return res.status(404).json({ success: false, message: 'Country not found in location' });
        }

        // Map country to currency
        const euroCountries = ['AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'HR'];

        let currencyCode = 'USD'; // default
        if (countryCode === 'IN') currencyCode = 'INR';
        else if (countryCode === 'US') currencyCode = 'USD';
        else if (countryCode === 'GB') currencyCode = 'GBP';
        else if (euroCountries.includes(countryCode)) currencyCode = 'EUR';

        // Find currency object from our currencyList
        const currencyObj = currencies.find(c => c.code === currencyCode);

        res.status(200).json({
            success: true,
            data: {
                countryCode,
                countryName,
                currency: currencyCode,
                currencyDetails: currencyObj || { code: currencyCode }
            }
        });
    } catch (error) {
        console.error('Error fetching location currency:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching location data'
        });
    }
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
