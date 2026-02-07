export const CONFIG = {
    API_URL: 'http://localhost:5000/api', 
    POLL_INTERVAL: 2000,
    GRASS_COUNT: 8000, // Increased density
    CANVAS_SIZE: 160,

    // NEW: Strictly organic green palette (No blues)
    COLORS: [
        '#1e361a', // Dark Forest
        '#2d4c1e', // Deep Green
        '#4a6b2f', // Olive
        '#638235', // Muted Green
        '#789440', // Fern
        '#8f9e53'  // Dry Grass
    ],

    WEATHER_TYPES: {
        // rainRate: How many drops to spawn per frame (0 = none, 20 = heavy)
        sunny:       { label: "☀️ Sunny",        speed: 0.005, force: 0.05, rainRate: 0,  dark: false },
        breeze:      { label: "🍃 Breezy",       speed: 0.02,  force: 0.15, rainRate: 0,  dark: false },
        cloudy:      { label: "☁️ Cloudy",       speed: 0.01,  force: 0.05, rainRate: 0,  dark: false },
        rain:        { label: "🌧️ Raining",      speed: 0.03,  force: 0.20, rainRate: 5,  dark: true  },
        storm:       { label: "⛈️ Thunderstorm", speed: 0.15,  force: 0.50, rainRate: 15, dark: true  }, 
        gale:        { label: "🌬️ Gale Force",   speed: 0.25,  force: 0.80, rainRate: 25, dark: true  }
    }
};