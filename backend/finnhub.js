const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

async function fetchFinnhubData(endpoint, symbol, retries = 2) {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
        throw new Error('FINNHUB_API_KEY is not defined in environment variables.');
    }

    const url = `${FINNHUB_BASE_URL}${endpoint}?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${apiKey}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            if (attempt === retries) {
                console.error(`Error fetching Finnhub data for [${symbol}] on endpoint [${endpoint}]:`, error.message);
                return null;
            }
            // Wait briefly before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
}

async function getCompanyFundamentals(symbol) {
    const [profile, metrics, recommendation] = await Promise.all([
        fetchFinnhubData('/stock/profile2', symbol),
        fetchFinnhubData('/stock/metric', symbol),
        fetchFinnhubData('/stock/recommendation', symbol)
    ]);

    return {
        profile: profile || {},
        metrics: metrics?.metric || {},
        recommendation: Array.isArray(recommendation) && recommendation.length > 0 ? recommendation[0] : null
    };
}

module.exports = {
    fetchFinnhubData,
    getCompanyFundamentals
};