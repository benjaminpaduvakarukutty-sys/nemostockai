const axios = require('axios');

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

async function searchStocks(query) {
    if (!query) return [];
    try {
        const response = await axios.get(`https://finnhub.io/api/v1/search`, {
            params: { q: query, token: FINNHUB_API_KEY }
        });

        if (!response.data || !response.data.result) return [];

        return response.data.result.slice(0, 10).map(item => ({
            symbol: item.symbol,
            shortName: item.description || item.symbol
        }));
    } catch (error) {
        console.error("Finnhub Search Error:", error.message);
        return [];
    }
}

async function fetchStockQuote(symbol) {
    if (!symbol) return null;
    const cleanSymbol = symbol.toUpperCase().trim();

    try {
        const [quoteRes, profileRes] = await Promise.all([
            axios.get(`https://finnhub.io/api/v1/quote`, {
                params: { symbol: cleanSymbol, token: FINNHUB_API_KEY }
            }),
            axios.get(`https://finnhub.io/api/v1/stock/profile2`, {
                params: { symbol: cleanSymbol, token: FINNHUB_API_KEY }
            }).catch(() => ({ data: {} }))
        ]);

        const data = quoteRes.data;
        if (!data || !data.c || data.c === 0) {
            return null;
        }

        const profile = profileRes.data || {};
        const currentPrice = data.c;
        const prevClose = data.pc || currentPrice;
        const changePercent = prevClose ? ((currentPrice - prevClose) / prevClose) * 100 : 0;

        return {
            symbol: cleanSymbol,
            shortName: profile.name || cleanSymbol,
            regularMarketPrice: currentPrice,
            regularMarketChangePercent: changePercent,
            regularMarketDayHigh: data.h || currentPrice,
            regularMarketDayLow: data.l || currentPrice,
            currency: profile.currency || 'USD',
            regularMarketVolume: 0,
            averageDailyVolume3Month: 0
        };
    } catch (error) {
        console.warn(`Finnhub quote lookup failed for symbol: ${symbol}`);
        return null;
    }
}

module.exports = {
    searchStocks,
    fetchStockQuote
};
