export const CONFIG = {
    API_URL: 'http://localhost:5000/api', // Change if hosted
    POLL_INTERVAL: 2000,
    GRASS_COUNT: 6000,
    CANVAS_SIZE: 160,

    COLORS: ['#2ecc71', '#27ae60', '#1abc9c', '#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#e74c3c', '#ecf0f1', '#555', '#000'],

    // PHYSICS PRESETS
    // Direction: 1 = Right, -1 = Left. 0 = Random/Current.
    WEATHER_TYPES: {
        sunny:       { label: "☀️ Sunny",        speed: 0.005,  force: 0.02, rain: false, dark: false, dir: 0 },
        breeze:      { label: "🍃 Breezy",       speed: 0.015,  force: 0.08, rain: false, dark: false, dir: 0 },
        cloudy:      { label: "☁️ Cloudy",       speed: 0.010,  force: 0.04, rain: false, dark: false, dir: 0 },
        rain:        { label: "🌧️ Raining",      speed: 0.020,  force: 0.10, rain: true,  dark: true,  dir: 0 },
        storm:       { label: "⛈️ Thunderstorm", speed: 0.050,  force: 0.25, rain: true,  dark: true,  dir: 1 }, // Storms usually blow hard one way
        gale:        { label: "🌬️ Gale Force",   speed: 0.080,  force: 0.40, rain: true,  dark: true,  dir: 1 }
    }
};