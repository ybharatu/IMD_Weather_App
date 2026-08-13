const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const suggestions = document.getElementById('suggestions');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const weatherCard = document.getElementById('weatherCard');

const cityList = [
    'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata',
    'Hyderabad', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow',
    'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal',
    'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana',
    'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot',
    'Varanasi', 'Srinagar', 'Aurangabad', 'Dhanbad', 'Amritsar',
    'Allahabad', 'Ranchi', 'Coimbatore', 'Jabalpur', 'Gwalior',
    'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota',
    'Guwahati', 'Chandigarh', 'Solapur', 'Hubli', 'Bareilly',
    'Mysore', 'Gurgaon', 'Aligarh', 'Jalandhar', 'Tiruchirappalli',
    'Bhubaneswar', 'Salem', 'Mira-Bhayandar', 'Thiruvananthapuram', 'Bhiwandi',
    'Saharanpur', 'Gorakhpur', 'Guntur', 'Bikaner', 'Amravati',
    'Noida', 'Jamshedpur', 'Bhilai', 'Warangal', 'Cuttack',
    'Firozabad', 'Kochi', 'Bhavnagar', 'Dehradun', 'Durgapur',
    'Asansol', 'Nanded', 'Kolhapur', 'Ajmer', 'Akola',
    'Gulbarga', 'Jamnagar', 'Ujjain', 'Loni', 'Siliguri',
    'Jhansi', 'Ulhasnagar', 'Nellore', 'Jammu', 'Sangli-Miraj',
    'Belgaum', 'Mangalore', 'Ambattur', 'Tirunelveli', 'Malegaon',
    'Gaya', 'Jalgaon', 'Udaipur', 'Maunath-Bhanjan', 'Tirupur'
];

function showLoading() {
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    weatherCard.classList.add('hidden');
}

function showError(message) {
    loading.classList.add('hidden');
    weatherCard.classList.add('hidden');
    error.textContent = message;
    error.classList.remove('hidden');
}

function hideAll() {
    loading.classList.add('hidden');
    error.classList.add('hidden');
    weatherCard.classList.add('hidden');
}

function updateSuggestions(query) {
    if (!query) {
        suggestions.classList.add('hidden');
        return;
    }

    const matches = cityList.filter(city =>
        city.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);

    if (matches.length === 0) {
        suggestions.classList.add('hidden');
        return;
    }

    suggestions.innerHTML = matches.map(city =>
        `<div class="suggestion-item">${city}</div>`
    ).join('');
    suggestions.classList.remove('hidden');
}

function selectCity(city) {
    cityInput.value = city;
    suggestions.classList.add('hidden');
    fetchWeather(city);
}

function getWeatherIcon(condition) {
    const conditionLower = (condition || '').toLowerCase();

    if (conditionLower.includes('thunder') || conditionLower.includes('storm')) {
        return '⛈️';
    } else if (conditionLower.includes('rain') || conditionLower.includes('shower') || conditionLower.includes('drizzle')) {
        return '🌧️';
    } else if (conditionLower.includes('snow')) {
        return '❄️';
    } else if (conditionLower.includes('fog') || conditionLower.includes('mist') || conditionLower.includes('haze')) {
        return '🌫️';
    } else if (conditionLower.includes('partly')) {
        return '⛅';
    } else if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) {
        return '☁️';
    } else if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
        return '☀️';
    }
    return '🌤️';
}

function renderWarnings(forecast) {
    const warnings = (forecast || []).filter(day =>
        day.warning && day.warning.toLowerCase() !== 'no warning'
    );

    const warningsContainer = document.getElementById('warnings');
    if (warnings.length === 0) {
        warningsContainer.innerHTML = '';
        return;
    }

    warningsContainer.innerHTML = warnings.map(day => `
        <div class="warning-item">
            <strong>${day.date}:</strong>${day.warning}
        </div>
    `).join('');
}

function displayWeather(data) {
    const today = data.forecast && data.forecast[0] ? data.forecast[0] : {};
    const condition = today.condition || data.observed && data.observed.condition || '';
    const icon = getWeatherIcon(condition);

    document.getElementById('cityName').textContent = data.city || 'Unknown City';
    document.getElementById('weatherDesc').textContent = data.date
        ? `${data.date} · ${icon} ${condition}`
        : `${icon} ${condition}`;

    if (today.max_temp != null && today.min_temp != null) {
        document.getElementById('tempValue').textContent = `${today.min_temp}° / ${today.max_temp}°`;
    } else {
        document.getElementById('tempValue').textContent = '--';
    }

    const observed = data.observed || {};
    document.getElementById('sunrise').textContent = observed.sunrise || '--';
    document.getElementById('sunset').textContent = observed.sunset || '--';
    document.getElementById('moonrise').textContent = observed.moonrise || '--';
    document.getElementById('moonset').textContent = observed.moonset || '--';

    renderWarnings(data.forecast);

    const forecastContainer = document.getElementById('forecastContainer');
    if (data.forecast && data.forecast.length > 0) {
        forecastContainer.innerHTML = data.forecast.map(day => `
            <div class="forecast-item">
                <span class="forecast-date">${day.date}</span>
                <span class="forecast-icon">${getWeatherIcon(day.condition)}</span>
                <span class="forecast-temp">${day.max_temp != null ? day.max_temp : '--'}° / ${day.min_temp != null ? day.min_temp : '--'}°</span>
                <span class="forecast-desc">${day.condition || 'N/A'}</span>
            </div>
        `).join('');
    } else {
        forecastContainer.innerHTML = '<p class="no-forecast">Forecast data unavailable</p>';
    }

    loading.classList.add('hidden');
    error.classList.add('hidden');
    weatherCard.classList.remove('hidden');
}

async function fetchWeather(city) {
    if (!city.trim()) {
        showError('Please enter a city name');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`/api/weather/${encodeURIComponent(city.trim())}`);

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        displayWeather(data);
    } catch (err) {
        showError(err.message || 'Failed to fetch weather data. Please try again.');
    }
}

cityInput.addEventListener('input', (e) => {
    updateSuggestions(e.target.value);
});

cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        suggestions.classList.add('hidden');
        fetchWeather(cityInput.value);
    }
});

suggestions.addEventListener('click', (e) => {
    if (e.target.classList.contains('suggestion-item')) {
        selectCity(e.target.textContent);
    }
});

searchBtn.addEventListener('click', () => {
    suggestions.classList.add('hidden');
    fetchWeather(cityInput.value);
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-section')) {
        suggestions.classList.add('hidden');
    }
});

cityInput.focus();