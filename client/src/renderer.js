import { CONFIG } from './config.js';
import { STATE } from './state.js';
import { AUDIO } from './audio.js'; 

let canvas, ctx;
const imageCache = {};
const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

// --- UI REFERENCES ---
const uiTimeIcon = document.getElementById('ui-time-icon');
const uiTimeText = document.getElementById('ui-time-text');
const uiWeather = document.getElementById('ui-weather');
const uiWindSpeed = document.getElementById('ui-wind-speed');
const uiWindArrow = document.getElementById('ui-wind-arrow');
const uiPlantCount = document.getElementById('ui-plant-count');

// Ground State
const groundState = {
    puddleLevel: 0, 
    snowLevel: 0,
    puddleMap: []
};

// Atmospheric State
let lightningFlash = 0;
let cycleTimer = 0; 
let timeOfDay = 0.5; 
let lightBeams = []; 
let auroraOpacity = 0; // For Aurora Borealis transition

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

    // Init Light Beams
    for(let i=0; i<5; i++) {
        lightBeams.push({
            x: Math.random() * window.innerWidth,
            width: 50 + Math.random() * 100,
            speed: 0.2 + Math.random() * 0.3,
            alpha: 0
        });
    }

    // Audio Init
    window.addEventListener('click', () => { AUDIO.init(); }, { once: true });

    generateGrass();
    resize();
    window.addEventListener('resize', () => { resize(); generateGrass(); });
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
    const smoothFactor = 0.05;

    // 1. Physics Values
    STATE.physics.speed = lerp(STATE.physics.speed, targetConfig.speed || 0.01, smoothFactor);
    STATE.physics.force = lerp(STATE.physics.force, targetConfig.force || 0.05, smoothFactor);

    // 2. Wind Logic
    const windCycle = Math.sin(time * 0.001); 
    const windNoise = Math.sin(time * 0.002) * 0.5;
    STATE.physics.direction = (windCycle + windNoise) * 1.0; 
    STATE.physics.accumulator += STATE.physics.speed;

    // 3. Ground Accumulation
    const drySpeed = targetConfig.drySpeed || 0.001;
    groundState.puddleLevel -= drySpeed * 0.1;
    groundState.puddleLevel = Math.max(0, Math.min(1, groundState.puddleLevel));

    const temp = targetConfig.temp || 20;
    if (temp < 0) groundState.snowLevel += 0.0005; 
    else groundState.snowLevel -= 0.002;
    groundState.snowLevel = Math.max(0, Math.min(1, groundState.snowLevel));

    // 4. Lightning
    if (targetConfig.lightning && Math.random() > 0.99) lightningFlash = 1.0;
    if (lightningFlash > 0) lightningFlash -= 0.05;

    // 5. Aurora Logic
    if (targetConfig.aurora) auroraOpacity = lerp(auroraOpacity, 0.6, 0.01);
    else auroraOpacity = lerp(auroraOpacity, 0, 0.01);

    // 6. Day/Night Cycle
    cycleTimer += 1;
    timeOfDay = (cycleTimer % CONFIG.CYCLE_DURATION) / CONFIG.CYCLE_DURATION;
    const isNight = timeOfDay > 0.75 || timeOfDay < 0.25;

    // 7. Audio
    AUDIO.update(STATE.currentWeather || 'sunny', isNight);

    // 8. Light Beams
    if (isNight) {
        lightBeams.forEach(b => {
            b.x += b.speed;
            if(b.x > canvas.width + 100) b.x = -100;
            b.alpha = 0.1 + Math.sin(time * 0.001 + b.x) * 0.05;
        });
    }

    // 9. UI Updates
    updateUI(isNight, targetConfig);

    // 10. Particles
    updateParticles(targetConfig);
}

function updateUI(isNight, targetConfig) {
    if (uiTimeText && uiTimeIcon) {
        const hour = Math.floor(timeOfDay * 24);
        const min = Math.floor((timeOfDay * 24 % 1) * 60);
        uiTimeText.innerText = `${hour.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`;
        
        let icon = '☀️';
        if (isNight) icon = '🌙';
        else if (timeOfDay < 0.3 || timeOfDay > 0.7) icon = '🌅';
        uiTimeIcon.innerText = icon;
    }

    if (uiWeather) {
        let label = targetConfig.label;
        if (isNight && label.includes("Sunny")) label = "Clear Night";
        uiWeather.innerText = label;
    }

    if (uiWindSpeed && uiWindArrow) {
        // Adjust display number for readability
        const kmh = Math.floor(Math.abs(STATE.physics.direction * STATE.physics.force) * 120);
        uiWindSpeed.innerText = kmh;
        const arrowRot = STATE.physics.direction > 0 ? 90 : 270;
        uiWindArrow.style.transform = `rotate(${arrowRot}deg)`;
    }

    if (uiPlantCount) {
        uiPlantCount.innerText = STATE.plants.length;
    }
}

function updateParticles(config) {
    const P = STATE.physics;
    
    // --- SPAWNING LOGIC ---
    // Cap particles at 2000 to prevent crash during Hurricane/Blizzard
    if(STATE.rainDrops.length < 2000) {
        if(config.rainRate > 0) for(let i=0; i<config.rainRate; i++) spawnParticle('rain');
        if(config.snowRate > 0) for(let i=0; i<config.snowRate; i++) spawnParticle('snow');
        if(config.hailRate > 0) for(let i=0; i<config.hailRate; i++) spawnParticle('hail');
        if(config.ashRate > 0)  for(let i=0; i<config.ashRate; i++) spawnParticle('ash');
        
        // Debris (Probabilistic)
        if(config.debris > 0) {
            // If debris is 1.0 (Hurricane), spawn 1 per frame. If 0.2, spawn rarely.
            if(Math.random() < config.debris) spawnParticle('debris');
        }

        // Meteors
        if(config.meteorRate > 0 && Math.random() < 0.05) spawnParticle('meteor');
    }

    // --- MOVEMENT LOGIC ---
    for(let i=STATE.rainDrops.length-1; i>=0; i--) {
        const p = STATE.rainDrops[i];
        
        // Wind Effect calculation
        const windX = (P.force * P.direction); 

        if (p.type === 'rain') {
            p.y += 20 + p.z * 10;
            p.x += windX * 10; 
        } 
        else if (p.type === 'snow' || p.type === 'ash') {
            p.y += 2 + p.z;
            p.x += (Math.sin(p.y * 0.05) * 2) + (windX * 5); 
        }
        else if (p.type === 'hail') {
            p.y += 30; 
            p.x += windX * 5; 
        }
        else if (p.type === 'debris') {
            p.x += windX * 20; 
            p.y += (Math.sin(p.x * 0.1) * 3) + 2; 
            p.r += 0.1; // Rotation
        }
        else if (p.type === 'meteor') {
            p.x -= 15; // Fast movement left
            p.y += 10; // Fast movement down
        }

        // --- DELETION LOGIC (More permissive) ---
        // Allow particles to go way off screen before killing them
        // This fixes the "Missing Particles" bug during high wind
        const buffer = 300; 
        if(p.y > canvas.height + buffer || p.x > canvas.width + buffer || p.x < -buffer) {
            STATE.rainDrops.splice(i, 1);
        }
    }
}

function spawnParticle(type) {
    const P = STATE.physics;
    
    // Spawn Logic:
    // If wind is blowing right (+), spawn left (-).
    // If wind is blowing left (-), spawn right (+).
    // We create a wide "Sky Bar" above the screen.
    
    const windDir = P.direction > 0 ? -1 : 1; 
    // Shift spawn point based on wind strength so they blow INTO view
    const windOffset = (P.force * 500) * windDir; 

    let startX = Math.random() * (canvas.width + 400) - 200; // Base spread
    startX += windOffset; // Apply wind bias

    if (type === 'meteor') {
        STATE.rainDrops.push({
            type: 'meteor',
            x: Math.random() * canvas.width + 200, // Spawn right side
            y: -200,
            z: Math.random(),
            len: 100 + Math.random() * 100
        });
    } else {
        STATE.rainDrops.push({
            type: type,
            x: startX, 
            y: -50, 
            z: Math.random(),
            r: Math.random() * Math.PI // Rotation for debris
        });
    }
}

function draw(time) {
    drawBackground();

    const P = STATE.physics;
    const baseLean = P.force * P.direction * 0.8; 
    const noise = Math.cos(P.accumulator) + Math.sin(P.accumulator * 2.7);
    const globalWind = baseLean + (noise * 0.1 * P.force);

    // GRASS
    ctx.lineWidth = 2;
    STATE.grassBlades.forEach(blade => {
        const localWind = globalWind * (0.5 + blade.z * 0.3);
        if (groundState.snowLevel > 0.1) ctx.strokeStyle = lerpColor(blade.color, '#ffffff', groundState.snowLevel * 0.8);
        else ctx.strokeStyle = blade.color;
        
        drawBlade(blade, localWind);
    });

    // PLANTS
    const now = Date.now();
    STATE.hoveredPlant = null;
    
    STATE.plants.sort((a,b) => a.y - b.y).forEach(p => {
        let age = now - (p.server_time || 0);
        const plantTurbulence = Math.sin(P.accumulator + (p.x * 0.005)) * (0.08 * P.force);
        const rotation = baseLean + plantTurbulence;

        ctx.save();
        ctx.translate(p.x, p.y);
        
        // Shadow
        ctx.save();
        ctx.scale(1, 0.3); 
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        if(groundState.snowLevel > 0.05) {
            ctx.filter = `brightness(${100 + groundState.snowLevel*50}%) grayscale(${groundState.snowLevel*100}%)`;
        }

        const maturity = Math.min(1, age / 12000); 
        ctx.rotate(rotation * maturity);
        drawPlant(p, age);
        ctx.restore();

        const hitX = p.x - (rotation * 60); 
        if(Math.abs(STATE.mouse.x - hitX) < 40 && Math.abs(STATE.mouse.y - p.y) < 80) {
            STATE.hoveredPlant = p;
        }
    });

    // PARTICLES (DRAW LOOP)
    if(STATE.rainDrops.length > 0) {
        STATE.rainDrops.forEach(d => { 
            ctx.beginPath(); 
            
            if (d.type === 'rain') {
                ctx.lineWidth = 1 + d.z;
                ctx.strokeStyle = `rgba(200, 230, 255, ${0.4 + d.z*0.3})`;
                ctx.moveTo(d.x, d.y);
                const lean = (P.force * P.direction) * 20;
                ctx.lineTo(d.x - lean, d.y - (15 + d.z * 15)); 
                ctx.stroke();
            } 
            else if (d.type === 'snow') {
                ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + d.z*0.4})`;
                ctx.arc(d.x, d.y, 2 + d.z*2, 0, Math.PI*2); 
                ctx.fill();
            }
            else if (d.type === 'ash') {
                ctx.fillStyle = `rgba(60, 60, 60, ${0.7})`;
                ctx.rect(d.x, d.y, 3, 3); 
                ctx.fill();
            }
            else if (d.type === 'hail') {
                ctx.fillStyle = `rgba(200, 200, 220, 0.9)`;
                ctx.arc(d.x, d.y, 3, 0, Math.PI*2);
                ctx.fill();
            }
            else if (d.type === 'debris') {
                // Tumbling squares
                ctx.save();
                ctx.translate(d.x, d.y);
                ctx.rotate(d.r);
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(-3, -3, 6, 6);
                ctx.restore();
            }
            else if (d.type === 'meteor') {
                // Glowing Trail
                const grad = ctx.createLinearGradient(d.x, d.y, d.x + 100, d.y - 60);
                grad.addColorStop(0, 'rgba(255, 255, 200, 1)');
                grad.addColorStop(1, 'rgba(255, 255, 200, 0)');
                ctx.strokeStyle = grad;
                ctx.lineWidth = 3;
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.x + 100, d.y - 60);
                ctx.stroke();
            }
        });
    }

    // LIGHTING & ATMOSPHERE
    drawLightingOverlay();

    // Name Tags
    if(STATE.hoveredPlant) drawNameTag(STATE.hoveredPlant);
}

function drawBackground() {
    let topColor, botColor;
    const C = CONFIG.SKY_COLORS;
    
    // Determine Base Sky Color
    if (timeOfDay < 0.25) { topColor = C.dawn[0]; botColor = C.dawn[1]; } 
    else if (timeOfDay < 0.75) { topColor = C.day[0]; botColor = C.day[1]; } 
    else if (timeOfDay < 0.90) { topColor = C.dusk[0]; botColor = C.dusk[1]; } 
    else { topColor = C.night[0]; botColor = C.night[1]; }

    // Apply Weather Tints (Dust Storm / Volcanic Ash)
    const targetConfig = CONFIG.WEATHER_TYPES[STATE.currentWeather];
    if(targetConfig && targetConfig.tint) {
        // Blend sky with tint
        ctx.fillStyle = targetConfig.tint;
        ctx.fillRect(0,0,canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'multiply'; // Blend it
    }

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, botColor);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Reset Composite
    ctx.globalCompositeOperation = 'source-over';

    // AURORA BOREALIS
    if(auroraOpacity > 0.01) {
        drawAurora(auroraOpacity);
    }
}

function drawAurora(opacity) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height/2);
    grad.addColorStop(0, `rgba(0, 255, 100, ${opacity * 0.5})`);
    grad.addColorStop(0.5, `rgba(100, 0, 255, ${opacity * 0.3})`);
    grad.addColorStop(1, `rgba(0, 255, 100, ${opacity * 0.5})`);
    
    ctx.fillStyle = grad;
    // Wavy shape
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for(let x=0; x<=canvas.width; x+=50) {
        ctx.lineTo(x, 100 + Math.sin(x*0.01 + Date.now()*0.001)*50);
    }
    ctx.lineTo(canvas.width, 0);
    ctx.fill();
    ctx.restore();
}

function drawLightingOverlay() {
    let darkness = 0;
    
    // Calculate Darkness
    const targetConfig = CONFIG.WEATHER_TYPES[STATE.currentWeather];
    const isDarkWeather = targetConfig && targetConfig.dark;

    if (timeOfDay < 0.2) darkness = 0.7 - (timeOfDay/0.2)*0.7; 
    else if (timeOfDay > 0.8) darkness = (timeOfDay-0.8)/0.2 * 0.7; 
    else if (timeOfDay < 0.25 || timeOfDay > 0.75) darkness = 0.3; 
    else darkness = 0; 

    if(isDarkWeather) darkness = Math.max(darkness, 0.4);

    if (darkness > 0.2) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay'; 
        lightBeams.forEach(b => {
            const grad = ctx.createLinearGradient(b.x, 0, b.x + 100, canvas.height);
            grad.addColorStop(0, `rgba(200, 200, 255, 0)`);
            grad.addColorStop(0.5, `rgba(200, 200, 255, ${b.alpha * 0.5})`);
            grad.addColorStop(1, `rgba(200, 200, 255, 0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(b.x - 50, 0, b.width + 100, canvas.height);
        });
        ctx.restore();
    }

    if (darkness > 0) {
        ctx.fillStyle = `rgba(5, 10, 30, ${darkness})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (lightningFlash > 0.01) {
        ctx.fillStyle = `rgba(255, 255, 255, ${lightningFlash})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function lerpColor(a, b, amount) {
    if (amount > 0.5) return b;
    return a;
}

function drawBlade(blade, windRad) {
    const angle = blade.baseAngle + (windRad * 1.0);
    const h = blade.height;
    
    const tipX = blade.x + Math.sin(angle) * h;
    const tipY = blade.y - Math.cos(angle) * h;
    const cpX = blade.x + Math.sin(angle) * (h * 0.4);
    const cpY = blade.y - Math.cos(angle) * (h * 0.4);

    ctx.beginPath(); 
    ctx.moveTo(blade.x, blade.y);
    ctx.quadraticCurveTo(cpX, cpY, tipX, tipY); 
    ctx.stroke();
}

function drawPlant(p, age) {
    const size = CONFIG.CANVAS_SIZE; 
    const growthTime = 12000;
    const progress = Math.min(1, age / growthTime);
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    
    const pStem = Math.min(1, Math.max(0, (progress-0)/0.4));     
    const pLeaves = Math.min(1, Math.max(0, (progress-0.2)/0.4)); 
    const pFlower = Math.min(1, Math.max(0, (progress-0.5)/0.5)); 
    
    if(pStem > 0) {
        if(!imageCache[p.stemTex]) { const i=new Image(); i.src=p.stemTex; imageCache[p.stemTex]=i; }
        const img = imageCache[p.stemTex];
        if(img && img.complete) {
            const h = size * pStem;
            ctx.drawImage(img, 0, size-h, size, h, -size/2, -h, size, h);
        }
    }
    const sLeaf = pLeaves > 0 ? easeOut(pLeaves) : 0;
    if(sLeaf > 0) drawPivoted(p.leafTex, size, sLeaf, 0, -80);
    const sFlow = pFlower > 0 ? easeOut(pFlower) : 0;
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