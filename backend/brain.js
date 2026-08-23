function calculateAlphaScore(changePercent, volatilityIndex, volumeRatio = 1.0) {
    const change = Number(changePercent) || 0;
    const volatility = Number(volatilityIndex) || 0;
    const volume = Number(volumeRatio) || 1.0;

    let baseScore = 50 + (change * 2.5) - (volatility * 1.2);
    
    if (volume > 1.2) {
        baseScore += 5;
    } else if (volume < 0.8) {
        baseScore -= 5;
    }

    baseScore = Math.max(1, Math.min(99, baseScore));
    return Number(baseScore.toFixed(1));
}

function calculateHoldingPeriod(volatilityNum) {
    const volatility = Number(volatilityNum) || 0;
    let holdingDays = 5;
    if (volatility > 2.0) {
        holdingDays = 3;
    } else if (volatility < 0.5) {
        holdingDays = 7;
    }
    return holdingDays;
}

function generateStrategy({
    changePercent,
    quantitativeScore,
    daySpread,
    volatility,
    volumeRatio,
    holdingDays
}) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (holdingDays || 5));
    const formattedSellDate = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    let strategyHeader;
    let strategyWhy;
    let strategyAction;

    const change = Number(changePercent) || 0;
    const score = Number(quantitativeScore) || 0;
    const vol = Number(volatility) || 0;
    const spread = Number(daySpread) || 0;
    const volume = Number(volumeRatio) || 1.0;

    const strongMomentum = change > 0;
    const strongScore = score >= 60;
    const strongVolume = volume >= 1.2;
    const highRisk = vol > 3;

    if (
        strongMomentum &&
        strongScore &&
        strongVolume &&
        !highRisk
    ) {
        strategyHeader = "STRATEGY: BULLISH SETUP";
        strategyWhy = `Positive momentum (${change.toFixed(2)}%), strong quantitative score (${score}/100), and above-average trading activity support the current setup (Volatility spread: ${spread.toFixed(2)}).`;
        strategyAction = `Consider monitoring the position for continued confirmation before target date ${formattedSellDate}.`;
    } else if (highRisk || score < 45) {
        strategyHeader = "STRATEGY: CAUTION";
        strategyWhy = `The current risk profile is elevated because of weak momentum (${change.toFixed(2)}%), a lower quantitative score (${score}/100), or high volatility (${vol.toFixed(2)}).`;
        strategyAction = "Wait for additional confirmation before increasing exposure or evaluate potential exit paths.";
    } else {
        strategyHeader = "STRATEGY: NEUTRAL";
        strategyWhy = `Current signals are mixed (Score: ${score}/100, Change: ${change.toFixed(2)}%) and do not provide a strong directional advantage.`;
        strategyAction = "Monitor momentum, volume, and volatility for confirmation.";
    }

    return {
        strategyHeader,
        strategyWhy,
        strategyAction
    };
}

function compareStocks(stockA, stockB, rateA = 1, rateB = 1) {
    const safeRateA = Number(rateA) || 1;
    const safeRateB = Number(rateB) || 1;

    const priceAUSD = (Number(stockA.regularMarketPrice || 0) * safeRateA).toFixed(2);
    const priceBUSD = (Number(stockB.regularMarketPrice || 0) * safeRateB).toFixed(2);
    const changeA = Number(stockA.regularMarketChangePercent) || 0;
    const changeB = Number(stockB.regularMarketChangePercent) || 0;

    const highA = Number(stockA.regularMarketDayHigh) || Number(stockA.regularMarketPrice) || 0;
    const lowA = Number(stockA.regularMarketDayLow) || Number(stockA.regularMarketPrice) || 0;
    const spreadA = highA - lowA;
    const volA = highA > 0 ? ((spreadA / highA) * 100).toFixed(2) : "0.00";

    const highB = Number(stockB.regularMarketDayHigh) || Number(stockB.regularMarketPrice) || 0;
    const lowB = Number(stockB.regularMarketDayLow) || Number(stockB.regularMarketPrice) || 0;
    const spreadB = highB - lowB;
    const volB = highB > 0 ? ((spreadB / highB) * 100).toFixed(2) : "0.00";

    let dataQualityA = "COMPLETE";
    let volumeRatioA = 1.0;
    if (stockA.regularMarketVolume && stockA.averageDailyVolume3Month) {
        volumeRatioA = Number(stockA.regularMarketVolume) / Number(stockA.averageDailyVolume3Month);
    } else {
        dataQualityA = "DEGRADED (MISSING VOLUME)";
    }

    let dataQualityB = "COMPLETE";
    let volumeRatioB = 1.0;
    if (stockB.regularMarketVolume && stockB.averageDailyVolume3Month) {
        volumeRatioB = Number(stockB.regularMarketVolume) / Number(stockB.averageDailyVolume3Month);
    } else {
        dataQualityB = "DEGRADED (MISSING VOLUME)";
    }

    const scoreA = calculateAlphaScore(changeA, volA, volumeRatioA);
    const scoreB = calculateAlphaScore(changeB, volB, volumeRatioB);

    let betterStock = scoreA >= scoreB ? stockA.shortName : stockB.shortName;
    let betterSymbol = scoreA >= scoreB ? stockA.symbol : stockB.symbol;
    let whyText = scoreA >= scoreB 
        ? `${stockA.shortName} demonstrates stronger relative performance with an Alpha Score of ${scoreA} compared to ${stockB.shortName}'s score of ${scoreB}, backed by superior momentum (${changeA.toFixed(2)}% vs ${changeB.toFixed(2)}%).`
        : `${stockB.shortName} demonstrates stronger relative performance with an Alpha Score of ${scoreB} compared to ${stockA.shortName}'s score of ${scoreA}, backed by superior momentum (${changeB.toFixed(2)}% vs ${changeA.toFixed(2)}%).`;

    let reply = `⚖️ COMPARATIVE ANALYSIS: ${stockA.symbol} vs ${stockB.symbol}\n\n` +
                `• ${stockA.shortName} (${stockA.symbol}) [Telemetry: ${dataQualityA}]:\n` +
                `  - Price: ${stockA.regularMarketPrice} ${stockA.currency} (~$${priceAUSD})\n` +
                `  - Daily Change: ${changeA.toFixed(2)}% | Alpha: ${scoreA}/100\n\n` +
                `• ${stockB.shortName} (${stockB.symbol}) [Telemetry: ${dataQualityB}]:\n` +
                `  - Price: ${stockB.regularMarketPrice} ${stockB.currency} (~$${priceBUSD})\n` +
                `  - Daily Change: ${changeB.toFixed(2)}% | Alpha: ${scoreB}/100\n\n` +
                `🏆 MODEL SIGNAL: ${betterStock} (${betterSymbol}) currently ranks higher\n` +
                `• Why: ${whyText}`;

    return reply;
}

module.exports = {
    calculateAlphaScore,
    calculateHoldingPeriod,
    generateStrategy,
    compareStocks
};