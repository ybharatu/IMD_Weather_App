const fs = require('fs');
const path = require('path');

const CITY_DATA_PATH = path.join(__dirname, '..', 'cities.txt');

let stations = null;

function loadStations() {
    if (stations === null) {
        const raw = fs.readFileSync(CITY_DATA_PATH, 'utf8');
        stations = JSON.parse(raw);
    }
    return stations;
}

function normalize(name) {
    return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getStationId(cityName) {
    const query = normalize(cityName);
    if (!query) {
        return null;
    }

    const data = loadStations();
    let matches = [];

    for (const id of Object.keys(data)) {
        const stationName = normalize(data[id]);

        if (stationName === query) {
            return id;
        }

        if (
            stationName.startsWith(`${query}-`) ||
            stationName.startsWith(`${query} `) ||
            stationName.split(/[\s-]+/).includes(query)
        ) {
            matches.push({ id, stationName });
        }
    }

    if (matches.length === 0) {
        return null;
    }

    matches.sort((a, b) => a.stationName.localeCompare(b.stationName));
    return matches[0].id;
}

function getStationName(stationId) {
    const data = loadStations();
    return data[stationId] || null;
}

module.exports = { getStationId, getStationName };
