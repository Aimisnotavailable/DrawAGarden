import { CONFIG } from './config.js';
import { STATE } from './state.js';

let canvas, ctx;
const imageCache = {};
const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

// UI Refs
const uiWeather = document.getElementById('weather-status');
const uiWindSpeed = document.getElementById('wind-speed');
const uiWindArrow = document.getElementById('wind-arrow');

export function initRenderer() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Force regenerate grass to apply new Green colors
    generateGrass();

    resize();
    window.addEventListener('resize', () => {
        resize();
        generateGrass();
    });
    requestAnimationFrame(loop);
}

function generateGrass() {
    STATE.grassBlades = [];
    const count = CONFIG.GRASS_COUNT;
    for(let i=0; i<count; i++) {
        STATE.grassBlades.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            baseAngle: (Math.random() * 0.2) - 0.1,
            // Randomly pick from the new Green Palette
            color: CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)],
            height: 15 + Math.random() * 15,
            z: Math.random() // Depth for parallax swaying
        });
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function loop(time) {
    updatePhysics(time);
    draw(time);
    requestAnimationFrame(loop);
}

function updatePhysics(time) {
    const targetConfig = CONFIG.WEATHER_TYPES[STATE.currentWeather];
    const smoothFactor = 0.02;

    // 1. Interpolate Force/Speed
    STATE.physics.speed = lerp(STATE.physics.speed, targetConfig.speed, smoothFactor);
    STATE.physics.force = lerp(STATE.physics.force, targetConfig.force, smoothFactor);

    // 2. DYNAMIC WIND DIRECTION
    // We use a slow sine wave (period approx 20 seconds) to shift direction
    // Result: Wind blows Left -> Stops -> Blows Right -> Stops
    const windCycle = Math.sin(time * 0.0003); 
    
    // We mix the cycle with some noise so it's not perfectly robotic
    const windNoise = Math.sin(time * 0.001) * 0.3;
    STATE.physics.direction = windCycle + windNoise;

    STATE.physics.accumulator += STATE.physics.speed;

    // UI Updates
    if(uiWeather) uiWeather.innerText = targetConfig.label;
    
    const kmh = Math.floor(Math.abs(STATE.physics.direction * STATE.physics.force) * 100);
    if(uiWindSpeed) uiWindSpeed.innerText = kmh;
    
    // Rotate arrow based on actual direction
    const arrowRot = STATE.physics.direction > 0 ? 90 : 270;
    if(uiWindArrow) uiWindArrow.style.transform = `rotate(${arrowRot}deg)`;
    
    // Rain Logic
    updateRain(targetConfig.rainRate);
}

function updateRain(rate) {
    const P = STATE.physics;
    
    // 1. SPAWN RAIN (Batch spawning for volume)
    if(rate > 0) {
        // Spawn 'rate' amount of particles per frame
        for(let i=0; i<rate; i++) {
            STATE.rainDrops.push({
                x: Math.random() * (canvas.width + 1000) - 500, 
                y: -100, // Start well above screen
                z: Math.random(), // Depth: 0 (far) to 1 (close)
                speedY: 0, 
                speedX: 0
            });
        }
    }
    
    // 2. MOVE RAIN
    for(let i=STATE.rainDrops.length-1; i>=0; i--) {
        const d = STATE.rainDrops[i];
        
        // Physics based on depth (z)
        // Close drops (z=1) move faster than far drops (z=0)
        const depthSpeed = 15 + (d.z * 25); 
        
        d.y += depthSpeed;
        
        // Wind affects rain X. 
        // We multiply by direction to make rain slant left or right.
        d.x += (P.force * P.direction) * (depthSpeed * 0.5); 
        
        if(d.y > canvas.height) STATE.rainDrops.splice(i, 1);
    }
}

function draw(time) {
    const weather = CONFIG.WEATHER_TYPES[STATE.currentWeather];
    
    // Darker background for storms
    ctx.fillStyle = weather.dark ? '#051106' : '#153618';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const P = STATE.physics;
    
    // Wind Calculations
    const baseLean = P.force * P.direction;
    const noise = Math.cos(P.accumulator) + Math.sin(P.accumulator * 2.7);
    const globalWind = baseLean + (noise * 0.1 * P.force);

    // --- DRAW GRASS ---
    ctx.lineWidth = 2;
    STATE.grassBlades.forEach(blade => {
        // Parallax wind: blades "further back" (low z) move less
        const localWind = globalWind * (0.8 + blade.z * 0.4);
        drawBlade(blade, localWind);
    });

    // --- DRAW PLANTS ---
    const now = Date.now();
    STATE.hoveredPlant = null;

    STATE.plants.forEach(p => {
        let age = now - (p.server_time || 0);
        
        // Plant turbulence
        const plantTurbulence = Math.sin(P.accumulator + (p.x * 0.005)) * (0.15 * P.force);
        const rotation = baseLean + plantTurbulence;

        ctx.save();
        ctx.translate(p.x, p.y);
        
        const maturity = Math.min(1, age / 2000); 
        ctx.rotate(rotation * maturity);

        drawPlant(p, age);
        ctx.restore();

        // Hitbox
        const hitX = p.x - (rotation * 60); 
        if(Math.abs(STATE.mouse.x - hitX) < 40 && Math.abs(STATE.mouse.y - p.y) < 80) {
            STATE.hoveredPlant = p;
        }
    });

    // --- DRAW RAIN ---
    if(STATE.rainDrops.length > 0) {
        ctx.beginPath();
        STATE.rainDrops.forEach(d => { 
            // Render Settings based on Depth (Z)
            // Close drops: Thicker, longer, more opaque
            // Far drops: Thin, short, transparent
            const length = 20 + (d.z * 30);
            const opacity = 0.2 + (d.z * 0.4);
            const width = 1 + (d.z * 1.5);

            ctx.lineWidth = width;
            
            // We must set strokeStyle individually or batch them. 
            // For performance in JS Canvas, simple batching is usually okay, 
            // but for depth opacity we need individual or sorted draws.
            // Simplified here: MoveTo/LineTo
            
            // To make opacity work in a single batch, we can't. 
            // So we just use a middle-ground color or draw purely white with low global alpha.
            // BETTER: Just draw them as lines.
            
            ctx.moveTo(d.x, d.y);
            // Calculate tail based on wind
            const tailX = d.x - ((P.force * P.direction) * 10);
            const tailY = d.y - length;
            ctx.lineTo(tailX, tailY);
        });
        
        ctx.strokeStyle = 'rgba(200, 230, 255, 0.4)';
        ctx.stroke();
    }

    if(STATE.hoveredPlant) drawNameTag(STATE.hoveredPlant);
}

function drawBlade(blade, windRad) {
    const angle = blade.baseAngle + (windRad * 1.5);
    const h = blade.height;
    
    const tipX = blade.x + Math.sin(angle) * h;
    const tipY = blade.y - Math.cos(angle) * h;
    const cpX = blade.x + Math.sin(angle) * (h * 0.4);
    const cpY = blade.y - Math.cos(angle) * (h * 0.4);

    ctx.strokeStyle = blade.color;
    ctx.beginPath(); 
    ctx.moveTo(blade.x, blade.y);
    ctx.quadraticCurveTo(cpX, cpY, tipX, tipY); 
    ctx.stroke();
}

// ... drawPlant, drawPivoted, drawNameTag remain unchanged ...
// (Include them here if you are copying the whole file, otherwise keep existing)
function drawPlant(p, age) {
    const growthTime = 12000;
    const progress = Math.min(1, age / growthTime);
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);

    const pStem = Math.min(1, Math.max(0, (progress-0)/0.4));     
    const pLeaves = Math.min(1, Math.max(0, (progress-0.2)/0.4)); 
    const pFlower = Math.min(1, Math.max(0, (progress-0.5)/0.5)); 

    const sLeaf = pLeaves > 0 ? easeOut(pLeaves) : 0;
    const sFlow = pFlower > 0 ? easeOut(pFlower) : 0;
    const size = CONFIG.CANVAS_SIZE; 

    if(p === STATE.hoveredPlant) { ctx.shadowColor="white"; ctx.shadowBlur=15; }

    if(pStem > 0) {
        if(!imageCache[p.stemTex]) { const i=new Image(); i.src=p.stemTex; imageCache[p.stemTex]=i; }
        const img = imageCache[p.stemTex];
        if(img && img.complete) {
            const h = size * pStem;
            ctx.drawImage(img, 0, size-h, size, h, -size/2, -h, size, h);
        }
    }
    if(sLeaf > 0) drawPivoted(p.leafTex, size, sLeaf, 0, -80);
    if(sFlow > 0) drawPivoted(p.flowerTex, size, sFlow, 0, -150);

    ctx.shadowBlur=0;
}

function drawPivoted(src, size, scale, anchorX, anchorY) {
    if(!imageCache[src]) { const i=new Image(); i.src=src; imageCache[src]=i; }
    const img = imageCache[src];
    if(img && img.complete) {
        ctx.save();
        ctx.translate(anchorX, anchorY);
        ctx.scale(scale, scale);
        ctx.translate(-anchorX, -anchorY);
        ctx.drawImage(img, -size/2, -size, size, size);
        ctx.restore();
    }
}

function drawNameTag(p) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    const text = `Gardener: ${p.author}`;
    ctx.font = "bold 20px sans-serif";
    const w = ctx.measureText(text).width + 20;
    const bx = p.x - w/2;
    const by = p.y - 180;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath(); ctx.roundRect(bx, by, w, 40, 8); ctx.fill();
    ctx.fillStyle = "white";
    ctx.fillText(text, bx+10, by+26);
    ctx.restore();
}