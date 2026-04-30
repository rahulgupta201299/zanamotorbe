const countries = require('../utils/isdCodes');
const currencies = require('../utils/currencyList');
const { fetchExchangeRates } = require('../utils/exchangeRate');
const axios = require('axios');
const config = require('../config/config');

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

exports.getCountryFromCoords = async (req, res) => {
    try {
        const { lat, lng } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                message: 'lat and lng query parameters are required'
            });
        }

        const apiKey = config.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: 'Google Maps API key is not configured'
            });
        }

        const url = `${config.GOOGLE_GEOCODING_URL}?latlng=${lat},${lng}&result_type=country&key=${apiKey}`;
        const response = await axios.get(url);
        const data = response.data;

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Unable to determine country. Google API status: ${data.status}`
            });
        }

        // Extract country info from address components
        const result = data.results[0];
        const countryComponent = result.address_components.find(
            component => component.types.includes('country')
        );

        if (!countryComponent) {
            return res.status(404).json({
                success: false,
                message: 'Country not found in geocoding results'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                country: countryComponent.long_name,
                countryCode: countryComponent.short_name,
                formattedAddress: result.formatted_address,
                lat: parseFloat(lat),
                lng: parseFloat(lng)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
