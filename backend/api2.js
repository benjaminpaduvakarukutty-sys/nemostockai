const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function getECBData() {
    try {
        const url = 'https://data-api.ecb.europa.eu/service/data/EXR/M.USD.EUR.SP00.A?format=jsondata';
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching data from ECB API:", error);
        return null;
    }
}

module.exports = { getECBData };