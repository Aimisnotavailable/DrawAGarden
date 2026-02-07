import { CONFIG } from './config.js';
import { STATE } from './state.js';

let canvas, ctx;
const imageCache = {};
const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

// UI Refs
const uiWeather = document.getElementById('weather-status');
const uiWindSpeed = document.getElementById('wind-speed');
const uiWindArrow = document.getElementById('wind-arrow');

const groundState = { puddleLevel: 0, snowLevel: 0, puddleMap: [] };
let lightningFlash = 0;

export function initRenderer() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Init Puddles
    for(let i=0; i<20; i++) {
        groundState.puddleMap.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            w: 100 + Math.random() * 200,
            h: 30 + Math.random() * 50
        });
    }

    generateGrass();
    resize();
    window.addEventListener('resize', () => { resize(); generateGrass(); });
    requestAnimationFrame(loop);
}

function generateGrass() {
    STATE.grassBlades = [];
    for(let i=0; i<CONFIG.GRASS_COUNT; i++) {
        STATE.grassBlades.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            baseAngle: (Math.random() * 0.2) - 0.1,
            color: CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)],
            height: 15 + Math.random() * 15,
            z: Math.random()
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
    const targetConfig = CONFIG.WEATHER_TYPES[STATE.currentWeather] || CONFIG.WEATHER_TYPES['sunny'];
    const smoothFactor = 0.02;

    STATE.physics.speed = lerp(STATE.physics.speed, targetConfig.speed || 0.01, smoothFactor);
    STATE.physics.force = lerp(STATE.physics.force, targetConfig.force || 0.05, smoothFactor);

    // Wind
    const windCycle = Math.sin(time * 0.0003); 
    STATE.physics.direction = windCycle + (Math.sin(time * 0.001) * 0.3);
    STATE.physics.accumulator += STATE.physics.speed;

    // Accumulation
    const drySpeed = targetConfig.drySpeed || 0.001;
    groundState.puddleLevel -= drySpeed * 0.1;
    groundState.puddleLevel = Math.max(0, Math.min(1, groundState.puddleLevel));

    const temp = targetConfig.temp || 20;
    if (temp < 0) groundState.snowLevel += 0.0005; 
    else groundState.snowLevel -= 0.002;
    groundState.snowLevel = Math.max(0, Math.min(1, groundState.snowLevel));

    // Lightning
    if (targetConfig.lightning && targetConfig.rainRate > 0) {
        if (Math.random() > 0.99) lightningFlash = 1.0;
    }
    if (lightningFlash > 0) lightningFlash -= 0.05;

    // UI
    if(uiWeather) uiWeather.innerText = targetConfig.label;
    const kmh = Math.floor(Math.abs(STATE.physics.direction * STATE.physics.force) * 120);
    if(uiWindSpeed) uiWindSpeed.innerText = kmh;
    if(uiWindArrow) uiWindArrow.style.transform = `rotate(${STATE.physics.direction > 0 ? 90 : 270}deg)`;
    
    updateParticles(targetConfig);
}

function updateParticles(config) {
    const P = STATE.physics;
    
    // SPAWN
    if(config.rainRate > 0) for(let i=0; i<config.rainRate; i++) spawnParticle('rain');
    if(config.snowRate > 0) for(let i=0; i<config.snowRate; i++) spawnParticle('snow');
    if(config.hailRate > 0) for(let i=0; i<config.hailRate; i++) spawnParticle('hail');
    if(config.ashRate > 0)  for(let i=0; i<config.ashRate; i++) spawnParticle('ash');
    
    // Meteors spawn rarely
    if(config.meteorRate > 0 && Math.random() < 0.05) spawnParticle('meteor');
    
    // Debris
    if(config.debris > 0 && Math.random() < config.debris) spawnParticle('debris');

    // MOVE
    for(let i=STATE.rainDrops.length-1; i>=0; i--) {
        const p = STATE.rainDrops[i];
        
        if (p.type === 'rain') {
            const s = 15 + (p.z * 25); 
            p.y += s; p.x += (P.force * P.direction) * (s * 0.5); 
        } 
        else if (p.type === 'snow' || p.type === 'ash') {
            const s = 1 + (p.z * 2);
            p.y += s; 
            p.x += (Math.sin(p.y * 0.05) * 2) + (P.force * P.direction * 5); 
        }
        else if (p.type === 'hail') {
            p.y += 25; p.x += (P.force * P.direction * 2); 
        }
        else if (p.type === 'debris') {
            p.x += (P.force * P.direction * 30) + (Math.random() * 5);
            p.y += (Math.sin(p.x * 0.1) * 2) + 1; 
        }
        else if (p.type === 'meteor') {
            // Meteors shoot across sky
            p.x += p.speedX;
            p.y += p.speedY;
            p.life -= 0.02; // They burn out
        }

        // Cleanup
        const bounds = 100;
        let dead = false;
        if(p.type === 'meteor') { if(p.life <= 0) dead = true; }
        else if(p.y > canvas.height + bounds || p.x > canvas.width + bounds || p.x < -bounds) dead = true;

        if(dead) STATE.rainDrops.splice(i, 1);
    }
}

function spawnParticle(type) {
    const P = STATE.physics;
    const windOffset = P.force * P.direction * 500;
    
    if (type === 'meteor') {
        STATE.rainDrops.push({
            type: type,
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height/2), // Upper half only
            z: 0,
            speedX: (Math.random() - 0.5) * 40,
            speedY: 5 + Math.random() * 5,
            life: 1.0
        });
        return;
    }

    STATE.rainDrops.push({
        type: type,
        x: Math.random() * (canvas.width + 1000) - 500 - windOffset, 
        y: -50, 
        z: Math.random()
    });
}

function draw(time) {
    const weather = CONFIG.WEATHER_TYPES[STATE.currentWeather] || CONFIG.WEATHER_TYPES['sunny'];
    
    // 1. BACKGROUND / SKY
    let bg = [21, 54, 24]; // Base Green

    if (weather.dark || weather.night) bg = [10, 15, 12]; // Night/Dark
    if (weather.tint) {
        // Apply Tint (Dust Storm / Ash)
        ctx.fillStyle = weather.tint;
        ctx.fillRect(0,0, canvas.width, canvas.height);
    } else {
        // Normal Sky
        ctx.fillStyle = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // AURORA EFFECT
    if (weather.aurora) {
        drawAurora(time);
    }

    // Snow Ground Blend
    if (groundState.snowLevel > 0.5) {
        // Whiten the background logic can go here or be handled by overlay
    }

    // 2. PUDDLES
    if (groundState.puddleLevel > 0.01) {
        ctx.fillStyle = `rgba(30, 40, 50, ${groundState.puddleLevel * 0.6})`;
        groundState.puddleMap.forEach(pud => {
            ctx.beginPath();
            ctx.ellipse(pud.x, pud.y, pud.w*groundState.puddleLevel, pud.h*groundState.puddleLevel, 0, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    const P = STATE.physics;
    const baseLean = P.force * P.direction;
    const globalWind = baseLean + ((Math.cos(P.accumulator) + Math.sin(P.accumulator * 2.7)) * 0.1 * P.force);

    // 3. GRASS
    ctx.lineWidth = 2;
    STATE.grassBlades.forEach(blade => {
        const localWind = globalWind * (0.8 + blade.z * 0.4);
        // Snow/Ash coloring for grass
        if (groundState.snowLevel > 0.1) ctx.strokeStyle = lerpColor(blade.color, '#ffffff', groundState.snowLevel * 0.8);
        else if (weather.ashRate > 0) ctx.strokeStyle = lerpColor(blade.color, '#555555', 0.4); // Ash makes grass grey
        else ctx.strokeStyle = blade.color;
        
        drawBlade(blade, localWind);
    });

    // 4. PLANTS
    const now = Date.now();
    STATE.plants.forEach(p => {
        let age = now - (p.server_time || 0);
        const rotation = baseLean + (Math.sin(P.accumulator + (p.x * 0.005)) * (0.15 * P.force));

        ctx.save();
        ctx.translate(p.x, p.y);
        
        // Filters
        let filter = "";
        if(groundState.snowLevel > 0.05) filter += `brightness(${100 + groundState.snowLevel*100}%) grayscale(${groundState.snowLevel*100}%) `;
        if(weather.tint) filter += `sepia(0.5) `; // Add sepia for dust storms
        ctx.filter = filter;

        const maturity = Math.min(1, age / 2000); 
        ctx.rotate(rotation * maturity);
        drawPlant(p, age);
        ctx.restore();
    });

    // 5. PARTICLES
    STATE.rainDrops.forEach(d => { 
        ctx.beginPath();
        if (d.type === 'rain') {
            ctx.lineWidth = 1 + d.z;
            ctx.strokeStyle = `rgba(200, 230, 255, ${0.3 + d.z*0.3})`;
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - ((P.force * P.direction) * 10), d.y - (20 + d.z * 30));
            ctx.stroke();
        } 
        else if (d.type === 'snow') {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + d.z*0.5})`;
            ctx.arc(d.x, d.y, 2 + d.z*2, 0, Math.PI*2); ctx.fill();
        }
        else if (d.type === 'ash') {
            ctx.fillStyle = `rgba(100, 100, 100, ${0.8})`; // Grey Ash
            ctx.rect(d.x, d.y, 3, 3); ctx.fill();
        }
        else if (d.type === 'hail') {
            ctx.fillStyle = `rgba(220, 240, 255, 0.9)`;
            ctx.arc(d.x, d.y, 3, 0, Math.PI*2); ctx.fill();
        }
        else if (d.type === 'meteor') {
            // Shooting star trail
            ctx.lineWidth = 2;
            ctx.strokeStyle = `rgba(255, 255, 200, ${d.life})`;
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - d.speedX*3, d.y - d.speedY*3);
            ctx.stroke();
        }
        else if (d.type === 'debris') {
            ctx.fillStyle = '#8f9e53';
            ctx.rect(d.x, d.y, 4, 4); ctx.fill();
        }
    });

    // 6. OVERLAYS (Fog / Tint / Flash)
    
    // Snow Floor
    if (groundState.snowLevel > 0.05) {
        const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - 200);
        grad.addColorStop(0, `rgba(255, 255, 255, ${groundState.snowLevel * 0.8})`);
        grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
        ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Tint Overlay (Dust/Ash)
    if (weather.tint) {
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = weather.tint;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(0,0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
    }

    // Fog / Visibility
    if (weather.vis && weather.vis < 1.0) {
        const fogOpacity = (1.0 - weather.vis) * 0.9; 
        ctx.fillStyle = `rgba(200, 210, 220, ${fogOpacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (lightningFlash > 0.01) {
        ctx.fillStyle = `rgba(255, 255, 255, ${lightningFlash})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawAurora(time) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Create a waving curtain of color
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    const shift = Math.sin(time * 0.0005) * 0.5 + 0.5;
    
    gradient.addColorStop(0, 'rgba(0, 255, 128, 0)');
    gradient.addColorStop(shift, 'rgba(0, 255, 128, 0.3)');
    gradient.addColorStop(1, 'rgba(128, 0, 255, 0.2)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2); // Top half only
    ctx.restore();
}

function lerpColor(a, b, amount) { if (amount > 0.5) return b; return a; }

// ... Keep drawBlade, drawPlant, drawPivoted, drawNameTag ...
function drawBlade(blade, windRad) {
    const angle = blade.baseAngle + (windRad * 1.5);
    const h = blade.height;
    const tipX = blade.x + Math.sin(angle) * h;
    const tipY = blade.y - Math.cos(angle) * h;
    const cpX = blade.x + Math.sin(angle) * (h * 0.4);
    const cpY = blade.y - Math.cos(angle) * (h * 0.4);
    ctx.beginPath(); ctx.moveTo(blade.x, blade.y);
    ctx.quadraticCurveTo(cpX, cpY, tipX, tipY); ctx.stroke();
}
// Include drawPlant, drawPivoted, drawNameTag from previous code
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