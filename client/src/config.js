export const CONFIG = {
    API_URL: 'http://localhost:5000/api', 
    POLL_INTERVAL: 2000,
    GRASS_COUNT: 8000,
    CANVAS_SIZE: 160,

    // DAY CYCLE
    CYCLE_DURATION: 3000, // Speed of day (higher = slower)

    // COLORS
    COLORS: ['#1e361a', '#2d4c1e', '#4a6b2f', '#638235', '#789440', '#8f9e53'],

    // MOOD BACKGROUNDS (We keep these as the "Base" floor/air color)
    SKY_COLORS: {
        dawn:  ['#4a3b3b', '#6b4c4c'], // Muted reddish-brown (Ground/Earth tone)
        day:   ['#2a3a2a', '#3a4a3a'], // Dark Greenish (Forest floor feel)
        dusk:  ['#2d2424', '#4a3030'], // Darker Red/Brown
        night: ['#050505', '#1a1a1a']  // Almost Black
    },

    WEATHER_TYPES: {
        // Updated Wind/Force values for better visual effect
        sunny:          { label: "☀️ Sunny",            speed: 0.01,  force: 0.10, temp: 20, drySpeed: 0.01,  vis: 1.0 },
        cloudy:         { label: "☁️ Cloudy",           speed: 0.02,  force: 0.20, temp: 15, drySpeed: 0.001, vis: 0.9 },
        breeze:         { label: "🍃 Breeze",           speed: 0.05,  force: 0.40, temp: 18, drySpeed: 0.01,  vis: 1.0, debris: 0.2 },
        
        rain:           { label: "🌧️ Rain",             speed: 0.04,  force: 0.30, temp: 12, drySpeed: -0.01, vis: 0.8, rainRate: 5 },
        storm:          { label: "⛈️ Storm",            speed: 0.20,  force: 0.80, temp: 10, drySpeed: -0.02, vis: 0.6, rainRate: 15, dark: true },
        thunderstorm:   { label: "⚡ Thunderstorm",     speed: 0.25,  force: 0.90, temp: 10, drySpeed: -0.03, vis: 0.5, rainRate: 20, dark: true, lightning: true },
        hurricane:      { label: "🌀 Hurricane",        speed: 0.50,  force: 1.50, temp: 15, drySpeed: -0.05, vis: 0.4, rainRate: 40, dark: true, debris: 1.0 },
        
        snow:           { label: "🌨️ Snow",             speed: 0.02,  force: 0.10, temp: -5, drySpeed: 0.001, vis: 0.7, snowRate: 5, dark: true },
        blizzard:       { label: "❄️ Blizzard",         speed: 0.40,  force: 1.00, temp: -15, drySpeed: 0.0,   vis: 0.2, snowRate: 20, dark: true },
        hail:           { label: "☄️ Hail",             speed: 0.15,  force: 0.50, temp: 0,  drySpeed: -0.01, vis: 0.8, hailRate: 15, dark: true },
        
        fog:            { label: "🌫️ Fog",              speed: 0.005, force: 0.05, temp: 10, drySpeed: -0.001, vis: 0.2, dark: true },
        tornado:        { label: "🌪️ Tornado",          speed: 0.60,  force: 2.00, temp: 15, drySpeed: 0.0,   vis: 0.5, debris: 1.0, dark: true, tint: '#2a2a2a' },
        dust_storm:     { label: "🏜️ Dust Storm",       speed: 0.30,  force: 0.60, temp: 30, drySpeed: 0.05,  vis: 0.3, debris: 0.5, tint: '#d68e31' }, 
        volcanic_ash:   { label: "🌋 Volcanic Ash",     speed: 0.05,  force: 0.10, temp: 5,  drySpeed: 0.01,  vis: 0.4, ashRate: 10, tint: '#3d3d3d' },
        meteor_shower:  { label: "🌠 Meteor Shower",    speed: 0.01,  force: 0.05, temp: 10, drySpeed: 0.005, vis: 1.0, meteorRate: 1, dark: true, night: true },
        aurora_borealis:{ label: "🌌 Aurora",           speed: 0.01,  force: 0.05, temp: -10,drySpeed: 0.0,   vis: 1.0, dark: true, aurora: true },
        
        default:        { label: "Unknown",             speed: 0.01, force: 0.05, temp: 20, drySpeed: 0.001, vis: 1.0 }
    }
};