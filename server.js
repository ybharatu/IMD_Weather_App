const express = require('express');
const path = require('path');
require('dotenv').config();

const { getStationId, getStationName } = require('./lib/cityLookup');
const { fetchCityWeather } = require('./lib/imdScraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'assets')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'assets/views', 'index.html'));
});

app.get('/api/weather/:city', async (req, res) => {
    const { city } = req.params;

    const stationId = getStationId(city);

    if (!stationId) {
        return res.status(404).json({ error: `City "${city}" not found in IMD station list` });
    }

    try {
        const data = await fetchCityWeather(stationId);
        data.city = getStationName(stationId) || data.city;
        return res.json(data);
    } catch (err) {
        return res.status(502).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});