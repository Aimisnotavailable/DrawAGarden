from flask import Flask, jsonify, request, send_from_directory, render_template
from flask_cors import CORS
import sqlite3
import time
import random
import os

# 1. SETUP PATHS
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TARGET_FOLDER = os.path.join(BASE_DIR, 'templates')
DB_PATH = os.path.join(BASE_DIR, 'database.db')

app = Flask(__name__, static_folder=TARGET_FOLDER, template_folder=TARGET_FOLDER)
CORS(app)

# --- DATABASE HELPERS ---
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db_connection() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS plants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                x REAL, y REAL,
                stemTex TEXT, leafTex TEXT, flowerTex TEXT,
                author TEXT,
                hp REAL, maxHp REAL, vit REAL,
                dead INTEGER DEFAULT 0,
                death_time REAL DEFAULT 0,
                death_cause TEXT,
                protect_until REAL DEFAULT 0,
                last_saved_hp REAL DEFAULT 0,
                server_time REAL
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS server_stats (
                key TEXT PRIMARY KEY,
                value INTEGER
            )
        ''')
        conn.execute("INSERT OR IGNORE INTO server_stats (key, value) VALUES ('deaths', 0)")
        conn.commit()

# --- GLOBAL STATE ---
admin_override = {"weather": None, "time_offset": 0}
WEATHER_TYPES = ["sunny", "cloudy", "breeze", "rain", "storm", "gale", "snow", "blizzard", "hail", "fog", "tornado", "dust_storm", "volcanic_ash", "meteor_shower", "aurora_borealis"]
current_weather = "sunny"
last_weather_change = 0
WEATHER_DURATION_SEC = 300
env_state = {"snow_level": 0.0, "puddle_level": 0.0}
LAST_TICK_TIME = time.time()

# --- LOGIC ---
def update_weather_logic():
    global current_weather, last_weather_change, env_state
    if admin_override["weather"]:
        current_weather = admin_override["weather"]
    else:
        now = time.time()
        if now - last_weather_change > WEATHER_DURATION_SEC:
            weights = [0.3] + [0.7 / (len(WEATHER_TYPES)-1)] * (len(WEATHER_TYPES)-1)
            current_weather = random.choices(WEATHER_TYPES, weights=weights, k=1)[0]
            last_weather_change = now

    w = current_weather
    if "snow" in w or "blizzard" in w:
        rate = 0.002 if "blizzard" in w else 0.0005
        env_state["snow_level"] = min(1.0, env_state["snow_level"] + rate)
    elif "sunny" in w:
        env_state["snow_level"] = max(0.0, env_state["snow_level"] - 0.001)
    else:
        env_state["snow_level"] = max(0.0, env_state["snow_level"] - 0.0002)

    if w == "storm" or w == "rain":
        rate = 0.005 if "storm" in w else 0.001
        env_state["puddle_level"] = min(1.0, env_state["puddle_level"] + rate)
        env_state["snow_level"] = max(0.0, env_state["snow_level"] - 0.002)
    else:
        dry_rate = 0.002 if any(x in w for x in ["breeze", "gale", "dust"]) else 0.0005
        if "sunny" in w: dry_rate = 0.001
        env_state["puddle_level"] = max(0.0, env_state["puddle_level"] - dry_rate)

def update_world_physics():
    global LAST_TICK_TIME
    now = time.time()
    dt = now - LAST_TICK_TIME
    LAST_TICK_TIME = now
    is_stormy = current_weather in ['storm', 'blizzard', 'tornado', 'hail']

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Clean up old dead plants (10s after death)
    # Note: death_time is stored in SECONDS in DB for physics math
    cursor.execute("DELETE FROM plants WHERE dead = 1 AND (? - death_time) > 10", (now,))
    if cursor.rowcount > 0:
        cursor.execute("UPDATE server_stats SET value = value + ? WHERE key = 'deaths'", (cursor.rowcount,))
    
    plants = cursor.execute("SELECT * FROM plants WHERE dead = 0").fetchall()
    for p in plants:
        new_hp = p['hp']
        is_dead = False
        death_cause = None
        is_protected = p['protect_until'] > now # Physics uses Seconds
        
        if is_stormy and not is_protected:
            new_hp = max(0.0, p['hp'] - (5.0 * dt))
            if new_hp <= 0.0:
                is_dead = True
                death_cause = current_weather
        elif not is_stormy and p['hp'] < p['maxHp']:
            new_hp = min(p['maxHp'], p['hp'] + ((1.5 * p['vit']) * dt))

        if is_dead or abs(new_hp - p['last_saved_hp']) > 0.5:
            cursor.execute('''
                UPDATE plants SET hp = ?, dead = ?, death_time = ?, death_cause = ?, last_saved_hp = ? WHERE id = ?
            ''', (new_hp, 1 if is_dead else 0, now if is_dead else 0, death_cause, new_hp, p['id']))
            
    conn.commit()
    conn.close()

# --- ROUTES ---
@app.route('/')
def index(): return send_from_directory(app.static_folder, 'index.html')

@app.route('/this_is_not_the_admin_panel')
def admin(): return render_template('admin.html', weather_types=WEATHER_TYPES)

@app.route('/<path:path>')
def serve_static(path): return send_from_directory(app.static_folder, path)

# --- API ---
@app.route('/api/plant', methods=['POST'])
def plant_seed():
    data = request.json
    now_sec = time.time()
    
    # FIX 1: Store Milliseconds for Client Compatibility
    # But we also need Seconds for server physics checks if we used that column for logic.
    # To be safe, we store MILLISECONDS in 'server_time' column since it is display-only.
    client_timestamp_ms = now_sec * 1000 
    
    max_hp = int(random.uniform(80.0, 300.0))
    vit = round(random.uniform(0.5, 5.0), 2)
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        INSERT INTO plants (x, y, stemTex, leafTex, flowerTex, author, hp, maxHp, vit, dead, protect_until, last_saved_hp, server_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    ''', (data.get('x'), data.get('y'), data.get('stemTex'), data.get('leafTex'), 
          data.get('flowerTex'), data.get('author', 'Anonymous'), max_hp, max_hp, vit, max_hp, client_timestamp_ms))
    new_id = cur.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({
        "id": new_id,
        "x": data.get('x'), "y": data.get('y'),
        "stemTex": data.get('stemTex'), "leafTex": data.get('leafTex'), "flowerTex": data.get('flowerTex'),
        "author": data.get('author', 'Anonymous'),
        "stats": {"hp": max_hp, "maxHp": max_hp, "vit": vit, "dead": False, "death_time": 0, "death_cause": None, "protect_until": 0},
        "server_time": client_timestamp_ms # Return MS
    })

@app.route('/api/plant/protect', methods=['POST'])
def protect_plant():
    data = request.json
    plant_id = data.get('id')
    now = time.time()
    conn = get_db_connection()
    plant = conn.execute("SELECT dead FROM plants WHERE id = ?", (plant_id,)).fetchone()
    
    if not plant:
        conn.close()
        return jsonify({"error": "Plant not found"}), 404
    if plant['dead']:
        conn.close()
        return jsonify({"error": "Too late, plant is dead."}), 400
        
    until = now + 60 # Protection uses Seconds
    conn.execute("UPDATE plants SET protect_until = ? WHERE id = ?", (until, plant_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "protect_until": until})

@app.route('/api/updates', methods=['GET'])
def get_updates():
    update_world_physics()
    update_weather_logic()
    
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM plants").fetchall()
    stats = conn.execute("SELECT value FROM server_stats WHERE key = 'deaths'").fetchone()
    conn.close()
    
    plants_list = []
    for row in rows:
        p = dict(row)
        
        # FIX 2: Ensure server_time is treated as Milliseconds. 
        # If the DB has old "Seconds" data (small numbers), we patch it on the fly.
        if p['server_time'] and p['server_time'] < 2000000000: 
            p['server_time'] = p['server_time'] * 1000

        p['stats'] = {
            "hp": p['hp'], "maxHp": p['maxHp'], "vit": p['vit'], 
            "dead": bool(p['dead']), "death_time": p['death_time'], 
            "death_cause": p['death_cause'], "protect_until": p['protect_until']
        }
        plants_list.append(p)

    current_time_ms = (time.time() + (admin_override["time_offset"] * 3600)) * 1000
    return jsonify({
        "time": current_time_ms,
        "weather": current_weather,
        "env": env_state,
        "plants": plants_list,
        "deaths": stats['value'] if stats else 0
    })

@app.route('/api/admin/update', methods=['POST'])
def admin_update():
    data = request.json
    if 'weather' in data: admin_override['weather'] = data['weather']
    if 'time_offset' in data: admin_override['time_offset'] = data['time_offset']
    return jsonify({"status": "ok", "overrides": admin_override})
