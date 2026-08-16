const cheerio = require('cheerio');
const fetch = require('node-fetch');

const BASE_URL = 'https://city.imd.gov.in/citywx/city_weather_test_try_warnings.php';
const REQUEST_TIMEOUT = 10000;

function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseNumber(value) {
    const cleaned = cleanText(value);
    const parsed = Number.parseFloat(cleaned);
    if (Number.isNaN(parsed)) {
        return null;
    }
    return parsed;
}

function getHeaderInfo($) {
    const city = $('font[color="blue"]').first().text().trim();

    let date = null;
    $('b').each(function () {
        const text = cleanText($(this).text());
        const match = text.match(/Dated\s*:?\s*(.+)/);
        if (match) {
            date = match[1].trim();
            return false;
        }
    });

    return { city, date };
}

function getObservedData($) {
    let observedTable = null;

    $('table').each(function () {
        if ($(this).text().includes('Past 24 Hours Weather Data')) {
            observedTable = $(this);
            return false;
        }
    });

    const observed = {
        max_temp: null,
        min_temp: null,
        rainfall: null,
        humidity_0830: null,
        humidity_1730: null,
        sunset: null,
        sunrise: null,
        moonset: null,
        moonrise: null
    };

    if (!observedTable) {
        return observed;
    }

    observedTable.find('tr').each(function () {
        const cells = $(this).find('td');
        if (cells.length < 2) {
            return;
        }

        const label = cleanText(cells.eq(0).text()).toLowerCase();
        const value = cleanText(cells.eq(1).text());

        const assign = (key) => {
            if (value === 'NA') {
                return;
            }
            observed[key] = parseNumber(value);
        };

        if (label.includes('sunset')) { observed.sunset = value; }
        else if (label.includes('sunrise')) { observed.sunrise = value; }
        else if (label.includes('moonset')) { observed.moonset = value; }
        else if (label.includes('moonrise')) { observed.moonrise = value; }
        else if (label.includes('maximum temp')) { assign('max_temp'); }
        else if (label.includes('minimum temp')) { assign('min_temp'); }
        else if (label.includes('rainfall')) { assign('rainfall'); }
        else if (label.includes('1730') && label.includes('humidity')) { assign('humidity_1730'); }
        else if (label.includes('0830') && label.includes('humidity')) { assign('humidity_0830'); }
    });

    return observed;
}

function getForecast($) {
    let forecastTable = null;

    $('table').each(function () {
        if ($(this).text().includes('Forecast/Warnings')) {
            forecastTable = $(this);
            return false;
        }
    });

    const forecast = [];

    if (!forecastTable) {
        return forecast;
    }

    forecastTable.find('tr').each(function () {
        const cellElements = $(this).find('td').filter(function () {
            return cleanText($(this).text()) !== '';
        }).get();

        const values = cellElements.map(el => cleanText($(el).text()));

        if (values.length < 7) {
            return;
        }

        if (!/^\d{1,2}-[A-Za-z]{3}/.test(values[0])) {
            return;
        }

        const warningColor = $(cellElements[4]).attr('bgcolor') || null;

        forecast.push({
            date: values[0],
            min_temp: parseNumber(values[1]),
            max_temp: parseNumber(values[2]),
            condition: values[3],
            warning: values[4] || null,
            warning_color: warningColor,
            rh_0830: parseNumber(values[5]),
            rh_1730: parseNumber(values[6])
        });
    });

    return forecast;
}

const MONTHS = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
};

function parseForecastDate(dateStr) {
    const match = String(dateStr || '').match(/^(\d{1,2})-([A-Za-z]{3})/);
    if (!match) {
        return null;
    }
    const month = MONTHS[match[2][0].toUpperCase() + match[2].slice(1).toLowerCase()];
    if (month === undefined) {
        return null;
    }
    return { month, day: Number.parseInt(match[1], 10) };
}

function getISTToday() {
    const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    return { month: ist.getMonth(), day: ist.getDate() };
}

function filterForecastFromToday(forecast) {
    const today = getISTToday();

    const filtered = forecast.filter((day) => {
        const parsed = parseForecastDate(day.date);
        if (!parsed) {
            return true;
        }
        return (parsed.month > today.month) ||
            (parsed.month === today.month && parsed.day >= today.day);
    });

    return filtered.length > 0 ? filtered : forecast;
}

async function fetchCityWeather(stationId) {
    const url = `${BASE_URL}?id=${encodeURIComponent(stationId)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let response;
    try {
        response = await fetch(url, {
            headers: { 'Accept-Charset': 'iso-8859-1' },
            signal: controller.signal
        });
    } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            throw new Error('IMD request timed out');
        }
        throw err;
    }

    clearTimeout(timeout);

    if (!response.ok) {
        throw new Error(`IMD page responded with ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const html = new TextDecoder('iso-8859-1').decode(buffer);

    const $ = cheerio.load(html);

    const header = getHeaderInfo($);
    const observed = getObservedData($);
    const forecast = getForecast($);

    if (!header.city && forecast.length === 0) {
        throw new Error('No weather data found for this station');
    }

    return {
        city: header.city,
        station_id: stationId,
        date: header.date,
        observed,
        forecast: filterForecastFromToday(forecast),
        source: 'imd'
    };
}

module.exports = { fetchCityWeather };