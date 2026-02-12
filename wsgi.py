from app import app, init_db, TARGET_FOLDER

if __name__ == '__main__':
    print(f"Serving everything from: {TARGET_FOLDER}")
    # Initialize DB on startup
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)