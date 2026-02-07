export const CONFIG = {
    API_URL: 'http://localhost:5000/api', 
    POLL_INTERVAL: 2000,
    GRASS_COUNT: 8000,
    CANVAS_SIZE: 160,

    COLORS: ['#1e361a', '#2d4c1e', '#4a6b2f', '#638235', '#789440', '#8f9e53'],

    WEATHER_TYPES: {
        // VISUAL KEY:
        // tint: Hex color to overlay on screen (e.g. Orange for dust)
        // vis: Visibility (0.0 to 1.0)
        
        // --- BASICS ---
        sunny:          { label: "☀️ Sunny",            speed: 0.005, force: 0.05, temp: 20, drySpeed: 0.01,  vis: 1.0 },
        cloudy:         { label: "☁️ Cloudy",           speed: 0.01,  force: 0.05, temp: 15, drySpeed: 0.001, vis: 0.9 },
        breeze:         { label: "🍃 Breeze",           speed: 0.02,  force: 0.15, temp: 18, drySpeed: 0.01,  vis: 1.0, debris: 0.2 },
        
        // --- WET ---
        rain:           { label: "🌧️ Rain",             speed: 0.03,  force: 0.20, temp: 12, drySpeed: -0.01, vis: 0.8, rainRate: 5 },
        storm:          { label: "⛈️ Storm",            speed: 0.15,  force: 0.50, temp: 10, drySpeed: -0.02, vis: 0.6, rainRate: 15, dark: true },
        thunderstorm:   { label: "⚡ Thunderstorm",     speed: 0.20,  force: 0.60, temp: 10, drySpeed: -0.03, vis: 0.5, rainRate: 20, dark: true, lightning: true },
        hurricane:      { label: "🌀 Hurricane",        speed: 0.35,  force: 0.90, temp: 15, drySpeed: -0.05, vis: 0.4, rainRate: 40, dark: true, debris: 1.0 },
        
        // --- FROZEN ---
        snow:           { label: "🌨️ Snow",             speed: 0.01,  force: 0.05, temp: -5, drySpeed: 0.001, vis: 0.7, snowRate: 5, dark: true },
        blizzard:       { label: "❄️ Blizzard",         speed: 0.30,  force: 0.70, temp: -15, drySpeed: 0.0,   vis: 0.2, snowRate: 20, dark: true },
        hail:           { label: "☄️ Hail",             speed: 0.10,  force: 0.30, temp: 0,  drySpeed: -0.01, vis: 0.8, hailRate: 15, dark: true },
        
        // --- ATMOSPHERIC / COSMIC ---
        fog:            { label: "🌫️ Fog",              speed: 0.005, force: 0.02, temp: 10, drySpeed: -0.001, vis: 0.2, dark: true },
        tornado:        { label: "🌪️ Tornado",          speed: 0.50,  force: 1.40, temp: 15, drySpeed: 0.0,   vis: 0.5, debris: 1.0, dark: true, tint: '#2a2a2a' },
        dust_storm:     { label: "🏜️ Dust Storm",       speed: 0.20,  force: 0.40, temp: 30, drySpeed: 0.05,  vis: 0.3, debris: 0.5, tint: '#d68e31' }, 
        volcanic_ash:   { label: "🌋 Volcanic Ash",     speed: 0.05,  force: 0.10, temp: 5,  drySpeed: 0.01,  vis: 0.4, ashRate: 10, tint: '#3d3d3d' },
        meteor_shower:  { label: "🌠 Meteor Shower",    speed: 0.01,  force: 0.05, temp: 10, drySpeed: 0.005, vis: 1.0, meteorRate: 1, dark: true, night: true },
        aurora_borealis:{ label: "🌌 Aurora",           speed: 0.01,  force: 0.05, temp: -10,drySpeed: 0.0,   vis: 1.0, dark: true, aurora: true }
    }
};