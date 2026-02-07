import { STATE } from './state.js';
import { uploadPlant } from './network.js';

// --- Internal State ---
let activeLayer = 'stem';
let isDrawing = false;
let modal = null;

// --- LAYER STORAGE ---
const layers = {
    stem:   { canvas: null, ctx: null, btn: null, color: '#4caf50', size: 15 },
    leaves: { canvas: null, ctx: null, btn: null, color: '#2e7d32', size: 10 },
    flower: { canvas: null, ctx: null, btn: null, color: '#e91e63', size: 8 }
};

export function initEditor() {
    console.log("🔧 [Editor] Init...");
    modal = document.getElementById('editor-modal');
    
    // 1. Initialize Canvas Layers
    ['stem', 'leaves', 'flower'].forEach(key => {
        const c = document.getElementById(`canvas-${key}`);
        const b = document.getElementById(`btn-layer-${key}`);
        
        if (c && b) {
            layers[key].canvas = c;
            layers[key].ctx = c.getContext('2d', { willReadFrequently: true });
            layers[key].btn = b;

            c.addEventListener('mousedown', (e) => startStroke(e, key));
            c.addEventListener('mousemove', (e) => drawStroke(e, key));
            c.addEventListener('mouseup', endStroke);
            c.addEventListener('mouseout', endStroke);
        }
    });

    // 2. Initialize Inputs
    const colorInput = document.getElementById('editor-color');
    const sizeInput = document.getElementById('editor-size');
    const sizeDisplay = document.getElementById('size-display');

    if (colorInput) {
        colorInput.addEventListener('input', (e) => {
            layers[activeLayer].color = e.target.value;
        });
    }

    if (sizeInput) {
        const updateSize = (e) => {
            const val = parseInt(e.target.value);
            layers[activeLayer].size = val; 
            if(sizeDisplay) sizeDisplay.innerText = val + 'px';
        };
        sizeInput.addEventListener('input', updateSize);
        sizeInput.addEventListener('change', updateSize);
    }

    // 3. Buttons
    document.getElementById('btn-save')?.addEventListener('click', saveAndClose);
    document.getElementById('btn-cancel')?.addEventListener('click', closeEditor);
    document.getElementById('btn-clear')?.addEventListener('click', clearCurrentLayer);

    window.editor = { setLayer: switchLayer };
}

export function openEditor(x, y) {
    STATE.pendingLoc = { x, y };
    
    // Clear all canvases DYNAMICALLY
    Object.values(layers).forEach(l => {
        if(l.ctx) {
            // FIX: Use actual canvas width/height instead of hardcoded 160
            l.ctx.clearRect(0, 0, l.canvas.width, l.canvas.height);
        }
    });

    if(modal) modal.style.display = 'block';
    switchLayer('stem');
}

function closeEditor() {
    if(modal) modal.style.display = 'none';
}

function switchLayer(key) {
    activeLayer = key;
    const l = layers[key];

    // Update UI
    const colorInput = document.getElementById('editor-color');
    const sizeInput = document.getElementById('editor-size');
    const sizeDisplay = document.getElementById('size-display');

    if(colorInput) colorInput.value = l.color;
    if(sizeInput) {
        sizeInput.value = l.size;
        if(sizeDisplay) sizeDisplay.innerText = l.size + "px";
    }

    // Toggle Visibility
    Object.keys(layers).forEach(k => {
        const item = layers[k];
        if (k === key) {
            item.canvas.classList.add('active');
            item.canvas.classList.remove('inactive');
            item.btn.classList.add('active');
        } else {
            item.canvas.classList.remove('active');
            item.canvas.classList.add('inactive');
            item.btn.classList.remove('active');
        }
    });
}

function startStroke(e, key) {
    if (key !== activeLayer) return;
    isDrawing = true;
    drawStroke(e, key);
}

function endStroke() {
    isDrawing = false;
    if (layers[activeLayer]?.ctx) layers[activeLayer].ctx.beginPath();
}

function drawStroke(e, key) {
    if (!isDrawing || key !== activeLayer) return;
    
    const l = layers[key];
    
    // Scaling Logic handles the new size automatically!
    const rect = l.canvas.getBoundingClientRect();
    const scaleX = l.canvas.width / rect.width;
    const scaleY = l.canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    l.ctx.lineWidth = l.size; 
    l.ctx.strokeStyle = l.color;
    l.ctx.lineCap = 'round';
    l.ctx.lineJoin = 'round';

    l.ctx.lineTo(x, y);
    l.ctx.stroke();
    l.ctx.beginPath();
    l.ctx.moveTo(x, y);
}

function clearCurrentLayer() {
    const l = layers[activeLayer];
    // FIX: Clear using the new dimensions
    if(l.ctx) l.ctx.clearRect(0, 0, l.canvas.width, l.canvas.height);
}

function saveAndClose() {
    const user = document.getElementById('username')?.value || "Guest";
    
    const plantData = {
        x: STATE.pendingLoc.x,
        y: STATE.pendingLoc.y,
        stemTex: layers.stem.canvas.toDataURL(),
        leafTex: layers.leaves.canvas.toDataURL(),
        flowerTex: layers.flower.canvas.toDataURL(),
        author: user,
        timestamp: Date.now()
    };

    uploadPlant(plantData);
    closeEditor();
}