import { CONFIG } from './config.js';
import { STATE } from './state.js';

let canvas, ctx;

// UI Refs
const uiWeather = document.getElementById('weather-status');
const uiWindSpeed = document.getElementById('wind-speed');
const uiWindArrow = document.getElementById('wind-arrow');

const imageCache = {};
const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

export function initRenderer() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error("CRITICAL: Canvas not found!"); 
        return;
    }
    ctx = canvas.getContext('2d');

    // Generate Initial Grass
    generateGrass();

    // Start Loop
    resize();
    window.addEventListener('resize', () => {
        resize();
        generateGrass(); // Regenerate to fill new screen size
    });
    requestAnimationFrame(loop);
}

function generateGrass() {
    STATE.grassBlades = [];
    const count = CONFIG.GRASS_COUNT || 5000;
    
    for(let i=0; i<count; i++) {
        STATE.grassBlades.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            baseAngle: (Math.random() * 0.4) - 0.2, // Slight random tilt
            color: CONFIG.COLORS[Math.floor(Math.random() * 3)] // Pick generic greens
        });
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function loop(time) {
    updatePhysics();
    draw(time);
    requestAnimationFrame(loop);
}

function updatePhysics() {
    const targetConfig = CONFIG.WEATHER_TYPES[STATE.currentWeather];
    const smoothFactor = 0.005;

    STATE.physics.speed = lerp(STATE.physics.speed, targetConfig.speed, smoothFactor);
    STATE.physics.force = lerp(STATE.physics.force, targetConfig.force, smoothFactor);

    if (targetConfig.dir !== 0) {
        STATE.physics.direction = targetConfig.dir;
    }

    STATE.physics.accumulator += STATE.physics.speed;

    // UI Updates
    if(uiWeather) uiWeather.innerText = targetConfig.label;
    
    const kmh = Math.floor(STATE.physics.force * 250);
    if(uiWindSpeed) uiWindSpeed.innerText = kmh;
    
    const arrowRot = STATE.physics.direction > 0 ? 0 : 180;
    if(uiWindArrow) uiWindArrow.style.transform = `rotate(${arrowRot}deg)`;
    
    STATE.isRaining = targetConfig.rain;
    updateRain();
}

function updateRain() {
    if(STATE.isRaining) {
        if(Math.random() > 0.6) {
            const windOffset = STATE.physics.force * STATE.physics.direction * 500;
            STATE.rainDrops.push({
                x: Math.random() * (canvas.width + 1000) - 500 - windOffset, 
                y: -50,
                speed: 15 + Math.random() * 10, 
                len: 10 + Math.random() * 20
            });
        }
    }
    
    for(let i=STATE.rainDrops.length-1; i>=0; i--) {
        const d = STATE.rainDrops[i];
        d.y += d.speed;
        d.x += (STATE.physics.force * STATE.physics.direction) * 25; 
        if(d.y > canvas.height) STATE.rainDrops.splice(i, 1);
    }
}

function draw(time) {
    const weather = CONFIG.WEATHER_TYPES[STATE.currentWeather];
    
    // Background
    ctx.fillStyle = weather.dark ? '#0a1a0b' : '#103312';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const P = STATE.physics;
    const mainWave = Math.sin(P.accumulator);
    const drift = Math.cos(time * 0.0007) * 0.2;
    const windValue = (mainWave + drift) * P.force * P.direction;

    // Grass
    ctx.lineWidth = 2;
    STATE.grassBlades.forEach(blade => drawBlade(blade, windValue * 3));

    // Plants
    // PERFORMANCE FIX: Removed STATE.plants.sort() from here. Sorting happens in network.js now.
    
    const now = Date.now();
    STATE.hoveredPlant = null;

    STATE.plants.forEach(p => {
        let age = now - (p.server_time || 0);
        const localWave = Math.sin(P.accumulator + (p.x * 0.005));
        const staticLean = P.force * 0.5;
        const plantWind = (localWave + staticLean) * P.force * P.direction;

        ctx.save();
        ctx.translate(p.x, p.y);
        
        const maturity = Math.min(1, age / 2000); 
        ctx.rotate(plantWind * maturity);

        drawPlant(p, age);
        ctx.restore();

        // Hit detection
        if(Math.abs(STATE.mouse.x - p.x) < 40 && Math.abs(STATE.mouse.y - p.y) < 80) {
            STATE.hoveredPlant = p;
        }
    });

    // Rain
    if(STATE.rainDrops.length > 0) {
        ctx.strokeStyle = 'rgba(174, 194, 224, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        STATE.rainDrops.forEach(d => { 
            ctx.moveTo(d.x, d.y); 
            ctx.lineTo(d.x + (P.force * P.direction * 10), d.y + d.len); 
        });
        ctx.stroke();
    }

    if(STATE.hoveredPlant) drawNameTag(STATE.hoveredPlant);
}

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

function drawBlade(blade, wind) {
    let angle = blade.baseAngle + wind;
    const h = 18;
    const tipX = blade.x + Math.sin(angle)*h, tipY = blade.y - Math.cos(angle)*h;
    const cpX = blade.x + Math.sin(angle)*(h*0.5), cpY = blade.y - Math.cos(angle)*(h*0.5);
    ctx.strokeStyle = blade.color;
    ctx.beginPath(); ctx.moveTo(blade.x, blade.y);
    ctx.quadraticCurveTo(cpX, cpY, tipX, tipY); ctx.stroke();
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