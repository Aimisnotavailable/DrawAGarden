import { STATE } from './state.js';
import { uploadPlant } from './network.js';

// Internal State
let activeLayer = 'stem';
let isDrawing = false;
let modal = null;

// References to our canvas stack
const layers = {
    stem:   { canvas: null, ctx: null, btn: null, color: '#4caf50' },
    leaves: { canvas: null, ctx: null, btn: null, color: '#2e7d32' },
    flower: { canvas: null, ctx: null, btn: null, color: '#e91e63' }
};

const PALETTE = [
    '#2e7d32', '#4caf50', '#81c784', // Greens
    '#c62828', '#e53935', '#ff8a80', // Reds
    '#f9a825', '#ffeb3b', '#fff59d', // Yellows
    '#6a1b9a', '#ab47bc', '#e1bee7', // Purples
    '#3e2723', '#795548', '#ffffff'  // Browns/White
];

export function initEditor() {
    modal = document.getElementById('editor-modal');
    
    // 1. Initialize Layers
    ['stem', 'leaves', 'flower'].forEach(key => {
        const c = document.getElementById(`canvas-${key}`);
        const b = document.getElementById(`btn-layer-${key}`);
        
        if (c && b) {
            layers[key].canvas = c;
            layers[key].ctx = c.getContext('2d', { willReadFrequently: true });
            layers[key].btn = b;

            // Input Handling
            c.addEventListener('mousedown', (e) => startStroke(e, key));
            c.addEventListener('mousemove', (e) => drawStroke(e, key));
            c.addEventListener('mouseup', endStroke);
            c.addEventListener('mouseout', endStroke);
        } else {
            console.error(`Editor: Missing elements for layer ${key}`);
        }
    });

    // 2. Initialize Palette
    const pContainer = document.getElementById('palette-container');
    if (pContainer) {
        PALETTE.forEach(color => {
            const el = document.createElement('div');
            el.className = 'swatch';
            el.style.backgroundColor = color;
            el.onclick = () => {
                layers[activeLayer].color = color;
                // Visual feedback could go here
            };
            pContainer.appendChild(el);
        });
    }

    // 3. UI Bindings
    document.getElementById('btn-save')?.addEventListener('click', saveAndClose);
    document.getElementById('btn-cancel')?.addEventListener('click', closeEditor);
    document.getElementById('btn-clear')?.addEventListener('click', clearCurrentLayer);

    // Expose to window for HTML onclick handlers
    window.editor = { setLayer: switchLayer };
}

export function openEditor(x, y) {
    STATE.pendingLoc = { x, y };
    
    // Clear all canvases for a fresh start
    Object.values(layers).forEach(l => {
        if(l.ctx) l.ctx.clearRect(0, 0, 160, 160);
    });

    if(modal) modal.style.display = 'block';
    switchLayer('stem');
}

function closeEditor() {
    if(modal) modal.style.display = 'none';
}

function switchLayer(key) {
    activeLayer = key;
    
    // Update DOM visibility/classes
    Object.keys(layers).forEach(k => {
        const l = layers[k];
        if (k === key) {
            l.canvas.classList.add('active');
            l.canvas.classList.remove('inactive');
            l.btn.classList.add('active');
        } else {
            l.canvas.classList.remove('active');
            l.canvas.classList.add('inactive');
            l.btn.classList.remove('active');
        }
    });
}

// --- Drawing Logic ---

function startStroke(e, key) {
    if (key !== activeLayer) return;
    isDrawing = true;
    drawStroke(e, key); // Draw initial dot
}

function endStroke() {
    isDrawing = false;
    const ctx = layers[activeLayer].ctx;
    if (ctx) ctx.beginPath(); // Reset path
}

function drawStroke(e, key) {
    if (!isDrawing || key !== activeLayer) return;
    
    const l = layers[key];
    const rect = l.canvas.getBoundingClientRect();
    const scaleX = l.canvas.width / rect.width;
    const scaleY = l.canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    l.ctx.lineWidth = 10;
    l.ctx.lineCap = 'round';
    l.ctx.lineJoin = 'round';
    l.ctx.strokeStyle = l.color;

    l.ctx.lineTo(x, y);
    l.ctx.stroke();
    l.ctx.beginPath();
    l.ctx.moveTo(x, y);
}

function clearCurrentLayer() {
    const l = layers[activeLayer];
    l.ctx.clearRect(0, 0, 160, 160);
}

// --- Persistence ---

function saveAndClose() {
    const user = document.getElementById('username')?.value || "Guest";
    
    // Extract Base64 PNGs
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