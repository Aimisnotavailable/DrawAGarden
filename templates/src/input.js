import { STATE } from './state.js';
import { openEditor } from './editor.js';
import { protectPlant } from './network.js'; 
import { AUDIO } from './audio.js';          

let lastShieldTime = 0; 

export function initInput() {
    console.log("[System] Initializing Input...");
    const canvas = document.getElementById('gameCanvas');

    // 1. Track Mouse (Keep this for visuals/tooltips)
    window.addEventListener('mousemove', (e) => {
        STATE.mouse.x = e.clientX;
        STATE.mouse.y = e.clientY;
    });

    // 2. Handle Clicks
    window.addEventListener('mousedown', (e) => {
        if (e.target.id !== 'gameCanvas') return;

        const clickX = e.clientX;
        const clickY = e.clientY;
        
        // --- NEW HITBOX CHECK ---
        // Find a plant that is close to the mouse click
        // Box: 60px wide (30px L/R), 180px tall (from base upwards)
        const clickedPlant = STATE.plants.find(p => {
            const dx = Math.abs(p.x - clickX);
            const dy = p.y - clickY; // positive means click is ABOVE base
            
            // Check: Within 40px left/right AND between 0px and 200px up
            return (dx < 40 && dy > 0 && dy < 200);
        });

        if (clickedPlant) {
            // A. Cooldown Check (2 Seconds)
            const now = Date.now();
            if (now - lastShieldTime < 2000) { 
                console.log("⏳ Shield recharging...");
                return; 
            }
            
            // B. Action!
            console.log(`🛡️ Protecting Plant ${clickedPlant.id}`);
            protectPlant(clickedPlant.id); 
            AUDIO.play('protect');               
            lastShieldTime = now;
            
            return; // STOP here. Do not open editor.
        }

        // --- IF NO PLANT HIT, OPEN EDITOR ---
        openEditor(clickX, clickY);
    });
}