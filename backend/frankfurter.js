const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function getExchangeRate(fromCurrency, toCurrency = 'USD') {
    if (!fromCurrency || fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
        return 1;
    }
    try {
        const url = `https://api.frankfurter.app/latest?from=${fromCurrency.toUpperCase()}&to=${toCurrency.toUpperCase()}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.rates && data.rates[toCurrency.toUpperCase()]) {
            return data.rates[toCurrency.toUpperCase()];
        }
        return 1;
    } catch (error) {
        console.error("Error fetching exchange rate from Frankfurter:", error);
        return 1;
    }
}

module.exports = { getExchangeRate };