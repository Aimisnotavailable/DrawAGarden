export class AudioManager {
    constructor() {
        this.enabled = false;
        this.sounds = {};
        
        // Procedural Audio Context
        // We use a safe check because some browsers complain if created too early
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        this.sources = {
            'rain': 'sounds/rain.mp3',
            'wind': 'sounds/wind.mp3',
            'crickets': 'sounds/crickets.mp3',
            'storm': 'sounds/storm.mp3',
            'fire': 'sounds/fire.mp3'
        };
    }

    init() {
        if(this.enabled) return;
        this.enabled = true;
        
        // 1. Wake up the Audio Engine (Browsers sleep it until a user clicks)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        console.log("🔊 Audio System Initialized");

        // Start ambient MP3s (these require files)
        for (const [key, path] of Object.entries(this.sources)) {
            const audio = new Audio(path);
            audio.loop = true;
            audio.volume = 0; 
            this.sounds[key] = audio;
            audio.play().catch(e => {
                // It's normal for this to fail if user hasn't clicked yet
                console.log("Waiting for interaction to play ambience...");
            });
        }
    }

    // --- COMPATIBILITY FIX ---
    // This allows AUDIO.play('protect') to work
    play(type) {
        this.playEffect(type);
    }

    playEffect(type) {
        // Always try to wake up the engine first
        if (this.ctx.state === 'suspended') this.ctx.resume();

        if (type === 'protect') this.playChime();
        if (type === 'shatter') this.playWither();
    }

    playChime() {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t); // A4
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.1); // Slide up to A5
        
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5); 

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(t + 1.5);
    }

    playWither() {
        const t = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.5; 
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Pink Noise Generator
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5; 
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Filter Sweep (The "Crumble" sound)
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t); 
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.4); 

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    }

    update(weatherType, isNight) {
        if(!this.enabled) return;

        let targetRain = 0;
        let targetWind = 0.3; // Base wind volume increased (was 0.1)
        let targetCrickets = 0;
        let targetStorm = 0;

        // WEATHER LOGIC
        if (weatherType.includes('rain')) {
            targetRain = 0.5;
            targetWind = 0.4;
        } 
        else if (weatherType.includes('storm') || weatherType.includes('thunder')) {
            targetRain = 0.6;
            targetStorm = 0.6;
            targetWind = 0.6;
        } 
        else if (weatherType.includes('breeze') || weatherType.includes('cloudy')) {
            targetWind = 0.5; // Louder for breeze
        }
        else if (weatherType.includes('gale') || weatherType.includes('hurricane') || weatherType.includes('tornado')) {
            targetWind = 1.0; // Max volume
            targetRain = 0.3;
        }
        else if (weatherType.includes('blizzard')) {
            targetWind = 0.8;
        }

        // NIGHT LOGIC
        if (isNight && !weatherType.includes('storm') && !weatherType.includes('rain') && !weatherType.includes('snow')) {
            targetCrickets = 0.4;
        }

        this.fadeTo(this.sounds['rain'], targetRain);
        this.fadeTo(this.sounds['wind'], targetWind);
        this.fadeTo(this.sounds['crickets'], targetCrickets);
        this.fadeTo(this.sounds['storm'], targetStorm);
        this.fadeTo(this.sounds['fire'], 0);
    }

    fadeTo(audio, targetVol) {
        if (!audio) return;
        const speed = 0.02;
        const current = audio.volume;
        if (Math.abs(current - targetVol) < speed) {
            audio.volume = targetVol;
        } else if (current < targetVol) {
            audio.volume = Math.min(1, current + speed);
        } else {
            audio.volume = Math.max(0, current - speed);
        }
    }
}

// Helper for pink noise generation
let lastOut = 0;

// Export Singleton for easy access in network.js
export const AUDIO = new AudioManager();