const yahooFinance = require('yahoo-finance2').default;
yahooFinance.suppressNotices(['yahooSurvey']);

async function searchStocks(query, retries = 2) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const results = await yahooFinance.search(query);
            return results.quotes.map(q => ({
                symbol: q.symbol,
                shortName: q.shortname || q.longname || q.name || q.symbol
            })).slice(0, 10);
        } catch (error) {
            if (error.message && error.message.includes("Too Many Requests")) {
                return [];
            }
            if (attempt === retries) {
                return [];
            }
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }
}

async function fetchStockQuote(symbol, retries = 2) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const quote = await yahooFinance.quote(symbol);
            if (!quote) {
                return null;
            }
            return {
                symbol: quote.symbol || symbol,
                shortName: quote.shortName || quote.longName || symbol,
                regularMarketPrice: quote.regularMarketPrice ?? 0,
                regularMarketChangePercent: quote.regularMarketChangePercent ?? 0,
                regularMarketDayHigh: quote.regularMarketDayHigh ?? 0,
                regularMarketDayLow: quote.regularMarketDayLow ?? 0,
                currency: quote.currency || 'USD',
                regularMarketVolume: quote.regularMarketVolume ?? 0,
                averageDailyVolume3Month: quote.averageDailyVolume3Month ?? 0
            };
        } catch (error) {
            if (error.message && error.message.includes("Too Many Requests")) {
                return null;
            }
            if (attempt === retries) {
                return null;
            }
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }
}

module.exports = {
    searchStocks,
    fetchStockQuote
};
