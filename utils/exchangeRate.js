const axios = require('axios');

let cachedRates = null;
let lastFetchedTime = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY || '20ffd9f46b82e31205fe919c';
const BASE_URL = `https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/INR`;

/**
 * Fetches exchange rates from the API
 * @returns {Promise<Object>} Exchange rates object
 */
const fetchExchangeRates = async () => {
    const currentTime = Date.now();
    
    // Return cached rates if still valid
    if (cachedRates && lastFetchedTime && (currentTime - lastFetchedTime) < CACHE_DURATION) {
        return cachedRates;
    }

    try {
        const response = await axios.get(BASE_URL);
        if (response.data && response.data.conversion_rates) {
            cachedRates = response.data.conversion_rates;
            lastFetchedTime = currentTime;
            return cachedRates;
        }
        throw new Error('Invalid response from exchange rate API');
    } catch (error) {
        console.error('Error fetching exchange rates:', error.message);
        // Return default rates if API fails
        return {
            INR: 1,
            USD: 0.012,
            EUR: 0.011,
            GBP: 0.0095
        };
    }
};

/**
 * Converts price from INR to target currency
 * @param {number} priceInINR - Price in Indian Rupees
 * @param {string} targetCurrency - Target currency code (USD, EUR, GBP)
 * @returns {Promise<number>} Converted price
 */
const convertCurrency = async (priceInINR, targetCurrency) => {
    if (!targetCurrency || targetCurrency === 'INR') {
        return priceInINR;
    }

    const rates = await fetchExchangeRates();
    const exchangeRate = rates[targetCurrency];
    
    if (!exchangeRate) {
        console.warn(`Exchange rate for ${targetCurrency} not found, returning original price`);
        return priceInINR;
    }

    return priceInINR * exchangeRate;
};

/**
 * Applies CROSS_CURRENCY_MULTIPLIER to the converted price
 * @param {number} priceInINR - Price in Indian Rupees
 * @param {string} targetCurrency - Target currency code
 * @returns {Promise<number>} Final converted price with multiplier (rounded to 2 decimals)
 */
const getConvertedPrice = async (priceInINR, targetCurrency) => {
    const multiplier = parseFloat(process.env.CROSS_CURRENCY_MULTIPLIER) || 1;
    const convertedPrice = await convertCurrency(priceInINR, targetCurrency);
    return Math.round((convertedPrice * multiplier) * 100) / 100;
};

module.exports = {
    fetchExchangeRates,
    convertCurrency,
    getConvertedPrice
};
