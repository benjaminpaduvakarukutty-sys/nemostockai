require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { searchStocks, fetchStockQuote } = require('./apis');
const { getExchangeRate } = require('./frankfurter');
const { getECBData } = require('./api2');
const { getCompanyFundamentals } = require('./finnhub');
const { calculateAlphaScore, calculateHoldingPeriod, generateStrategy, compareStocks } = require('./brain');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.post('/api/message', async (req, res) => {
    try {
        const { userText, compareWith } = req.body;
        const cleanText = userText ? userText.trim() : "";
        const upperText = cleanText.toUpperCase();

        if (!cleanText) {
            return res.json({ reply: "Please enter a stock, company name, or macro request.", emotion: "neutral" });
        }

        if (upperText.includes("WHO MADE YOU") || upperText.includes("WHO CREATED YOU")) {
            return res.json({ reply: "I was created by Benjamin Paduva.", emotion: "smart" });
        }

        // 0. If user asks for ECB or macroeconomic/currency data
        if (upperText.includes("ECB") || upperText.includes("MACRO") || upperText.includes("EXCHANGE RATE TREND")) {
            const ecbData = await getECBData();
            if (ecbData) {
                return res.json({
                    reply: "ECB MACROECONOMIC DATA FETCHED SUCCESSFULLY\nData stream loaded and ready for high-speed analysis.",
                    emotion: "smart"
                });
            }
        }

        // Handle VS Comparison Mode
        if (compareWith) {
            const upperCompareWith = compareWith.toUpperCase();
            let stockA = await fetchStockQuote(upperText);
            let stockB = await fetchStockQuote(upperCompareWith);

            if (stockA && stockA.regularMarketPrice && stockB && stockB.regularMarketPrice) {
                let rateA = 1;
                if (stockA.currency && stockA.currency.toUpperCase() !== 'USD') {
                    rateA = await getExchangeRate(stockA.currency, 'USD') || 1;
                }
                let rateB = 1;
                if (stockB.currency && stockB.currency.toUpperCase() !== 'USD') {
                    rateB = await getExchangeRate(stockB.currency, 'USD') || 1;
                }

                const reply = compareStocks(stockA, stockB, rateA, rateB);
                return res.json({ reply, emotion: "smart" });
            } else {
                return res.json({ reply: `Could not complete comparison between ${upperText} and ${upperCompareWith}. One or both tickers are invalid.`, emotion: "sad" });
            }
        }

        // 1. If it looks like an exact ticker, fetch quote, validate stock first, then safely fetch Finnhub
        if (cleanText.includes(".") || (cleanText.length <= 6 && !cleanText.includes(" "))) {
            let stock = await fetchStockQuote(upperText);

            if (stock && stock.regularMarketPrice) {
                let finnhubData = null;
                if (!upperText.includes(".")) {
                    try {
                        finnhubData = await getCompanyFundamentals(upperText);
                    } catch (error) {
                        console.error("Finnhub error:", error.message);
                    }
                }

                let exchangeRate = 1;
                if (stock.currency && stock.currency.toUpperCase() !== 'USD') {
                    exchangeRate = await getExchangeRate(stock.currency, 'USD') || 1;
                }
                
                const priceInUSD = (Number(stock.regularMarketPrice) * exchangeRate).toFixed(2);
                const changePercent = Number(stock.regularMarketChangePercent) || 0;
                const trendSymbol = changePercent >= 0 ? "📈" : "📉";

                const highPrice = Number(stock.regularMarketDayHigh) || Number(stock.regularMarketPrice);
                const lowPrice = Number(stock.regularMarketDayLow) || Number(stock.regularMarketPrice);
                const daySpread = highPrice - lowPrice;
                const volatilityIndex = highPrice > 0 ? ((daySpread / highPrice) * 100).toFixed(2) : "0.00";
                
                let dataQuality = "COMPLETE";
                let volumeRatio = 1.0;
                if (stock.regularMarketVolume && stock.averageDailyVolume3Month) {
                    volumeRatio = Number(stock.regularMarketVolume) / Number(stock.averageDailyVolume3Month);
                } else {
                    dataQuality = "DEGRADED (MISSING VOLUME)";
                }

                const quantitativeScore = calculateAlphaScore(changePercent, volatilityIndex, volumeRatio);
                const holdingDays = calculateHoldingPeriod(parseFloat(volatilityIndex));
                
                const { strategyHeader, strategyWhy, strategyAction } = generateStrategy({
                    changePercent,
                    quantitativeScore,
                    daySpread,
                    volatility: parseFloat(volatilityIndex),
                    volumeRatio,
                    holdingDays
                });

                let reply = `${trendSymbol} ${stock.shortName || upperText} (${stock.symbol}) [Telemetry: ${dataQuality}]\n` +
                            `• Live Price: ${stock.regularMarketPrice} ${stock.currency} (~$${priceInUSD} USD)\n` +
                            `• Daily Performance: ${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%\n` +
                            `• Intraday Volatility: ${volatilityIndex}% (Spread: ${daySpread.toFixed(2)})\n` +
                            `• Alpha Rating: ${quantitativeScore} out of 100\n`;

                if (finnhubData && finnhubData.metrics) {
                    const rawPe = finnhubData.metrics.peBasicExclExtraTTM || finnhubData.metrics.peTTM;
                    const peRatio = rawPe ? Number(rawPe).toFixed(1) : "N/A";
                    
                    const rawCap = Number(finnhubData.profile?.marketCapitalization);
                    let marketCap = "N/A";
                    if (Number.isFinite(rawCap) && rawCap > 0) {
                        if (rawCap >= 1000) {
                            marketCap = `$${(rawCap / 1000).toFixed(2)}B`;
                        } else {
                            marketCap = `$${rawCap.toFixed(2)}M`;
                        }
                    }

                    reply += `• Valuation (P/E): ${peRatio}\n` +
                             `• Market Capitalization: ${marketCap}\n`;
                }

                reply += `\nSTRATEGY OUTLOOK: ${strategyHeader}\n` +
                         `• Key Takeaway: ${strategyWhy}\n` +
                         `• Recommended Action: ${strategyAction}`;

                const emotion = changePercent >= 0 ? "happy" : "sad";
                return res.json({ reply, emotion });
            }
        }

        // 2. Otherwise, run autocomplete search suggestions
        const matches = await searchStocks(cleanText);

        if (matches && matches.length > 0) {
            const validMatches = matches.filter(m => {
                const name = m.shortName || m.shortname || m.longname || m.name;
                const symbol = m.symbol;
                return name && symbol && symbol !== "undefined";
            });

            if (validMatches.length > 0) {
                return res.json({
                    suggestions: validMatches,
                    emotion: "smart"
                });
            }
        }

        // 3. Fallback if nothing found
        return res.json({
            reply: `No companies found matching "${cleanText}". Try another name or ticker.`,
            emotion: "sad"
        });
    } catch (error) {
        console.error("API Error:", error);
        return res.json({
            reply: "An error occurred while communicating with financial data providers. Please try again shortly.",
            emotion: "sad"
        });
    }
});

app.listen(port, () => {
    console.log(`Stock Analysis AI backend running at http://localhost:${port}`);
});
