from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import time
import random

app = Flask(__name__, static_folder='../client')
CORS(app)

GLOBAL_PLANTS = []

# --- SERVER SIDE WEATHER LOGIC ---
WEATHER_TYPES = ["sunny", "cloudy", "breeze", "rain", "storm", "gale"]

# The Server is the "Source of Truth"
WEATHER_STATE = {
    "current": "sunny",
    "last_change": time.time()
}

def update_weather_logic():
    # Change weather every 30 seconds
    now = time.time()
    if now - WEATHER_STATE['last_change'] > 30:
        # Pick a new random weather
        new_weather = random.choice(WEATHER_TYPES)
        
        # Update State
        WEATHER_STATE['current'] = new_weather
        WEATHER_STATE['last_change'] = now
        print(f"Server changed weather to: {new_weather}")

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/api/plant', methods=['POST'])
def add_plant():
    data = request.json
    new_plant = {
        "id": len(GLOBAL_PLANTS),
        "x": data['x'],
        "y": data['y'],
        "stemTex": data['stemTex'],
        "leafTex": data['leafTex'],
        "flowerTex": data['flowerTex'],
        "author": data.get('author', 'Anonymous'),
        "server_time": time.time() * 1000
    }
    GLOBAL_PLANTS.append(new_plant)
    return jsonify(new_plant)

@app.route('/api/updates', methods=['GET'])
def get_updates():
    # 1. Check if it's time to change weather
    update_weather_logic()
    
    # 2. Robust Input Handling
    try:
        since = float(request.args.get('since', 0))
    except (ValueError, TypeError):
        since = 0.0

    # 3. Filter New Plants
    new_plants = [p for p in GLOBAL_PLANTS if p.get('server_time', 0) > since]
    
    # 4. Return Data + Current Weather
    return jsonify({
        "plants": new_plants,
        "server_time": time.time() * 1000,
        "weather": WEATHER_STATE['current'] # Sending "storm", "sunny", etc.
    }), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)