// newsApi.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function getStockNews(symbol) {
    const apiKey = process.env.MARKETAUX_API_KEY;
    if (!apiKey) {
        console.error("Marketaux API Key is missing from environment variables.");
        return [];
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const url = `https://api.marketaux.com/v1/news/all?symbols=${encodeURIComponent(symbol)}&published_after=${oneWeekAgo}&limit=5&api_token=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Marketaux API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data || !data.data) {
            return [];
        }

        return data.data.map(article => {
            const matchedEntity = article.entities && article.entities.find(e => e.symbol.toUpperCase() === symbol.toUpperCase());
            
            let sentimentLabel = "Neutral";
            const score = matchedEntity ? matchedEntity.sentiment_score : null;
            if (score !== null) {
                if (score > 0.2) sentimentLabel = "Positive";
                else if (score < -0.2) sentimentLabel = "Negative";
            }

            const labelText = sentimentLabel === "Negative" ? " (it's bad)" : "";

            return {
                title: article.title,
                source: article.source,
                sentimentLabel: `${sentimentLabel}${labelText}`,
                matchScore: matchedEntity ? matchedEntity.match_score : 0
            };
        });

    } catch (error) {
        console.error("Fetch Stock News Error:", error.message || error);
        return [];
    }
}

module.exports = {
    getStockNews
};
