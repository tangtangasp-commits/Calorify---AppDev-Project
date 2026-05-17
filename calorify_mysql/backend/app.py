# ============================================================
# CALORIFY! — Flask Backend
# Install: pip install flask flask-cors mysql-connector-python bcrypt requests
# ============================================================

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import mysql.connector
import bcrypt
import requests
import os, math, sys, random
from datetime import date, timedelta

try:
    from config import DB_HOST, DB_USER, DB_PASS, DB_NAME
except ImportError:
    print("ERROR: config.py not found."); sys.exit(1)

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)

# ─── DB ───────────────────────────────────────────────────
def get_db():
    return mysql.connector.connect(host=DB_HOST, user=DB_USER, password=DB_PASS, database=DB_NAME)

def init_db():
    try:
        conn = mysql.connector.connect(host=DB_HOST, user=DB_USER, password=DB_PASS)
        cur  = conn.cursor()
        cur.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
        cur.execute(f"USE {DB_NAME}")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                name       VARCHAR(100) NOT NULL,
                email      VARCHAR(150) UNIQUE NOT NULL,
                password   VARCHAR(255) NOT NULL,
                age        INT, weight_kg DECIMAL(5,2), height_cm DECIMAL(5,2),
                sex        ENUM('male','female') DEFAULT 'male',
                activity   ENUM('sedentary','light','moderate','active') DEFAULT 'moderate',
                goal       ENUM('loss','maintain','gain') DEFAULT 'maintain',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # targets: min AND max for all 5 macros
        cur.execute("""
            CREATE TABLE IF NOT EXISTS targets (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                user_id         INT NOT NULL UNIQUE,
                cal_min         INT NOT NULL,
                cal_max         INT NOT NULL,
                protein_min_g   DECIMAL(6,2) NOT NULL,
                protein_max_g   DECIMAL(6,2) NOT NULL,
                carbs_min_g     DECIMAL(6,2) NOT NULL,
                carbs_max_g     DECIMAL(6,2) NOT NULL,
                fat_min_g       DECIMAL(6,2) NOT NULL,
                fat_max_g       DECIMAL(6,2) NOT NULL,
                fiber_min_g     DECIMAL(6,2) NOT NULL,
                fiber_max_g     DECIMAL(6,2) NOT NULL,
                updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # foods: now include carbs and fat per 100g
        cur.execute("""
            CREATE TABLE IF NOT EXISTS foods (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                user_id         INT,
                name            VARCHAR(200) NOT NULL,
                calories_per100 DECIMAL(7,2) NOT NULL,
                protein_per100  DECIMAL(7,2) DEFAULT 0,
                carbs_per100    DECIMAL(7,2) DEFAULT 0,
                fat_per100      DECIMAL(7,2) DEFAULT 0,
                fiber_per100    DECIMAL(7,2) DEFAULT 0,
                source          ENUM('usda','custom','cache') DEFAULT 'usda',
                created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        """)

        # meal_logs: now include carbs and fat
        cur.execute("""
            CREATE TABLE IF NOT EXISTS meal_logs (
                id        INT AUTO_INCREMENT PRIMARY KEY,
                user_id   INT NOT NULL,
                food_id   INT,
                food_name VARCHAR(200) NOT NULL,
                meal_type ENUM('Breakfast','Lunch','Dinner','Snack') NOT NULL,
                grams     DECIMAL(7,2) NOT NULL,
                calories  DECIMAL(7,2) NOT NULL,
                protein_g DECIMAL(7,2) NOT NULL DEFAULT 0,
                carbs_g   DECIMAL(7,2) NOT NULL DEFAULT 0,
                fat_g     DECIMAL(7,2) NOT NULL DEFAULT 0,
                fiber_g   DECIMAL(7,2) NOT NULL DEFAULT 0,
                logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        for idx in [
            "CREATE INDEX IF NOT EXISTS idx_meal_user_date ON meal_logs(user_id, logged_at)",
            "CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name)",
        ]:
            try: cur.execute(idx)
            except: pass

        # ── Migrations: safely add new columns to existing tables ──
        def col_exists(table, column):
            cur.execute("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=%s AND table_name=%s AND column_name=%s",
                        (DB_NAME, table, column))
            return cur.fetchone()[0] > 0

        # foods: add carbs_per100 and fat_per100
        if not col_exists("foods", "carbs_per100"):
            cur.execute("ALTER TABLE foods ADD COLUMN carbs_per100 DECIMAL(7,2) DEFAULT 0 AFTER protein_per100")
            print("  ✚ Added foods.carbs_per100")
        if not col_exists("foods", "fat_per100"):
            cur.execute("ALTER TABLE foods ADD COLUMN fat_per100 DECIMAL(7,2) DEFAULT 0 AFTER carbs_per100")
            print("  ✚ Added foods.fat_per100")

        # meal_logs: add carbs_g and fat_g
        if not col_exists("meal_logs", "carbs_g"):
            cur.execute("ALTER TABLE meal_logs ADD COLUMN carbs_g DECIMAL(7,2) NOT NULL DEFAULT 0 AFTER protein_g")
            print("  ✚ Added meal_logs.carbs_g")
        if not col_exists("meal_logs", "fat_g"):
            cur.execute("ALTER TABLE meal_logs ADD COLUMN fat_g DECIMAL(7,2) NOT NULL DEFAULT 0 AFTER carbs_g")
            print("  ✚ Added meal_logs.fat_g")

        # targets: if old schema (has 'calories' column), migrate it
        if col_exists("targets", "calories"):
            print("  ↻ Migrating old targets schema...")
            # Add new columns with defaults first
            new_cols = [
                ("cal_min",       "INT NOT NULL DEFAULT 1500"),
                ("cal_max",       "INT NOT NULL DEFAULT 2500"),
                ("protein_min_g", "DECIMAL(6,2) NOT NULL DEFAULT 100"),
                ("protein_max_g", "DECIMAL(6,2) NOT NULL DEFAULT 180"),
                ("carbs_min_g",   "DECIMAL(6,2) NOT NULL DEFAULT 150"),
                ("carbs_max_g",   "DECIMAL(6,2) NOT NULL DEFAULT 300"),
                ("fat_min_g",     "DECIMAL(6,2) NOT NULL DEFAULT 40"),
                ("fat_max_g",     "DECIMAL(6,2) NOT NULL DEFAULT 90"),
                ("fiber_min_g",   "DECIMAL(6,2) NOT NULL DEFAULT 25"),
                ("fiber_max_g",   "DECIMAL(6,2) NOT NULL DEFAULT 40"),
            ]
            for col, defn in new_cols:
                if not col_exists("targets", col):
                    cur.execute(f"ALTER TABLE targets ADD COLUMN {col} {defn}")
            # Copy old values into new columns
            cur.execute("""
                UPDATE targets SET
                    cal_min = GREATEST(COALESCE(calories,1800) - 200, 1200),
                    cal_max = COALESCE(calories, 2000) + 200,
                    protein_min_g = GREATEST(COALESCE(protein_g,100) - 20, 50),
                    protein_max_g = COALESCE(protein_g,120) + 30,
                    fiber_min_g   = COALESCE(fiber_g, 25),
                    fiber_max_g   = COALESCE(fiber_g, 25) + 15
                WHERE cal_min = 1500
            """)
            # Drop old columns
            for old_col in ["calories", "protein_g", "fiber_g"]:
                if col_exists("targets", old_col):
                    cur.execute(f"ALTER TABLE targets DROP COLUMN {old_col}")
            print("  ✔ targets migration complete")
        else:
            # Fresh targets table — just add any missing new columns
            new_cols = [
                ("cal_min",       "INT NOT NULL DEFAULT 1500",          "user_id"),
                ("cal_max",       "INT NOT NULL DEFAULT 2500",          "cal_min"),
                ("protein_min_g", "DECIMAL(6,2) NOT NULL DEFAULT 100", "cal_max"),
                ("protein_max_g", "DECIMAL(6,2) NOT NULL DEFAULT 180", "protein_min_g"),
                ("carbs_min_g",   "DECIMAL(6,2) NOT NULL DEFAULT 150", "protein_max_g"),
                ("carbs_max_g",   "DECIMAL(6,2) NOT NULL DEFAULT 300", "carbs_min_g"),
                ("fat_min_g",     "DECIMAL(6,2) NOT NULL DEFAULT 40",  "carbs_max_g"),
                ("fat_max_g",     "DECIMAL(6,2) NOT NULL DEFAULT 90",  "fat_min_g"),
                ("fiber_min_g",   "DECIMAL(6,2) NOT NULL DEFAULT 25",  "fat_max_g"),
                ("fiber_max_g",   "DECIMAL(6,2) NOT NULL DEFAULT 40",  "fiber_min_g"),
            ]
            for col, defn, after in new_cols:
                if not col_exists("targets", col):
                    cur.execute(f"ALTER TABLE targets ADD COLUMN {col} {defn} AFTER {after}")
                    print(f"  ✚ Added targets.{col}")

        cur.execute("SELECT COUNT(*) FROM foods")
        if cur.fetchone()[0] == 0:
            seed = [
                # name, cal, pro, carbs, fat, fiber
                ('Chicken Breast',  165, 31.0,  0.0,  3.6, 0.0),
                ('Brown Rice',      111,  2.6, 23.0,  0.9, 1.8),
                ('Egg',             155, 13.0,  1.1, 11.0, 0.0),
                ('Salmon',          208, 20.0,  0.0, 13.0, 0.0),
                ('Broccoli',         34,  2.8,  7.0,  0.4, 2.6),
                ('Oats',            389, 17.0, 66.0,  7.0,10.6),
                ('Banana',           89,  1.1, 23.0,  0.3, 2.6),
                ('Tofu',             76,  8.0,  1.9,  4.8, 0.3),
                ('Khao Man Gai',    180, 14.0, 22.0,  4.0, 0.5),
                ('Pad Thai',        190,  9.0, 25.0,  7.0, 1.2),
                ('White Rice',      130,  2.7, 28.0,  0.3, 0.4),
                ('Bread',           265,  9.0, 49.0,  3.2, 2.7),
                ('Croissant',       406,  8.2, 46.0, 21.0, 2.1),
                ('Sushi Roll',      150,  5.0, 28.0,  2.0, 0.5),
                ('Greek Yogurt',     59, 10.0,  3.6,  0.4, 0.0),
                ('Avocado',         160,  2.0,  9.0, 15.0, 6.7),
                ('Sweet Potato',     86,  1.6, 20.0,  0.1, 3.0),
                ('Pork',            242, 27.0,  0.0, 14.0, 0.0),
                ('Beef',            250, 26.0,  0.0, 15.0, 0.0),
                ('Milk',             61,  3.2,  4.8,  3.3, 0.0),
                ('Peanut Butter',   588, 25.0, 20.0, 50.0, 6.0),
                ('Almonds',         579, 21.0, 22.0, 50.0,12.5),
                ('Lentils',         116,  9.0, 20.0,  0.4, 7.9),
                ('Pasta',           131,  5.0, 25.0,  1.1, 1.8),
                ('Potato',           77,  2.0, 17.0,  0.1, 2.2),
                ('Tuna',            109, 25.0,  0.0,  1.0, 0.0),
                ('Apple',            52,  0.3, 14.0,  0.2, 2.4),
                ('Orange',           47,  0.9, 12.0,  0.1, 2.4),
                ('Cheese',          402, 25.0,  1.3, 33.0, 0.0),
                ('Butter',          717,  0.9,  0.1, 81.0, 0.0),
            ]
            cur.executemany(
                "INSERT INTO foods (name,calories_per100,protein_per100,carbs_per100,fat_per100,fiber_per100,source) VALUES (%s,%s,%s,%s,%s,%s,'cache')",
                seed
            )

        conn.commit(); cur.close(); conn.close()
        print("✅  Database ready.")
    except mysql.connector.Error as e:
        print(f"\n❌  MySQL Error: {e}")
        print("Check that MySQL is running and your password in config.py is correct.\n")
        sys.exit(1)

# ─── USDA ─────────────────────────────────────────────────
USDA_API_KEY = os.getenv("USDA_API_KEY", "DEMO_KEY")
USDA_URL     = "https://api.nal.usda.gov/fdc/v1/foods/search"

def get_nutrient(nutrients, name):
    for n in nutrients:
        if name.lower() in n.get("nutrientName", "").lower():
            return round(n.get("value", 0), 2)
    return 0.0

# ─── Target calc (min + max for all macros) ───────────────
def calc_targets(user):
    w = float(user["weight_kg"])
    h = float(user["height_cm"])
    a = int(user["age"])
    goal     = user["goal"]
    activity = user["activity"]

    bmr = (88.36 + 13.4*w + 4.8*h - 5.7*a) if user["sex"] == "male" \
        else (447.6 + 9.2*w + 3.1*h - 4.3*a)
    mult = {"sedentary":1.2,"light":1.375,"moderate":1.55,"active":1.725}
    tdee = bmr * mult.get(activity, 1.2)

    # Calorie range
    if goal == "loss":
        cal_max = math.floor(tdee - 300)
        cal_min = math.floor(tdee - 700)   # don't go below -700
    elif goal == "gain":
        cal_min = math.floor(tdee + 200)
        cal_max = math.floor(tdee + 500)
    else:
        cal_min = math.floor(tdee - 100)
        cal_max = math.floor(tdee + 100)

    # Protein (g)
    pro_min = math.floor(w * 1.6)
    pro_max = math.floor(w * (2.2 if goal == "gain" else 2.0))

    # Carbs (~45–55% of calories / 4kcal per g)
    carbs_min = math.floor(cal_min * 0.40 / 4)
    carbs_max = math.floor(cal_max * 0.55 / 4)

    # Fat (~20–35% of calories / 9kcal per g)
    fat_min = math.floor(cal_min * 0.20 / 9)
    fat_max = math.floor(cal_max * 0.35 / 9)

    # Fiber
    fiber_min = 25
    fiber_max = 40

    return {
        "cal_min": cal_min, "cal_max": cal_max,
        "protein_min": pro_min, "protein_max": pro_max,
        "carbs_min": carbs_min, "carbs_max": carbs_max,
        "fat_min": fat_min, "fat_max": fat_max,
        "fiber_min": fiber_min, "fiber_max": fiber_max,
    }

# ─── Summary helpers ──────────────────────────────────────
def day_status(row, targets):
    """Return 'hit', 'over', or 'under' based on whether the day hit targets."""
    cal  = float(row.get("calories", 0) or 0)
    pro  = float(row.get("protein",  0) or 0)
    hits = 0
    if targets["cal_min"] <= cal <= targets["cal_max"]: hits += 1
    if pro >= targets["protein_min_g"]: hits += 1
    if hits == 2: return "hit"
    if cal > targets["cal_max"]: return "over"
    return "under"

def build_summary(user_id, targets, db, start_date, end_date):
    cur = db.cursor(dictionary=True)
    cur.execute("""
        SELECT
            DATE(logged_at)        AS day,
            SUM(calories)          AS calories,
            SUM(protein_g)         AS protein,
            SUM(carbs_g)           AS carbs,
            SUM(fat_g)             AS fat,
            SUM(fiber_g)           AS fiber,
            COUNT(*)               AS meals
        FROM meal_logs
        WHERE user_id=%s AND DATE(logged_at) BETWEEN %s AND %s
        GROUP BY DATE(logged_at)
        ORDER BY day
    """, (user_id, start_date, end_date))
    days = [dict(r) for r in cur.fetchall()]
    cur.close()

    if not days:
        return {"days": [], "stats": None}

    cal_min  = float(targets["cal_min"])
    cal_max  = float(targets["cal_max"])
    pro_min  = float(targets["protein_min_g"])

    # per-day stats
    cals   = [float(d["calories"] or 0) for d in days]
    pros   = [float(d["protein"]  or 0) for d in days]
    carbs  = [float(d["carbs"]    or 0) for d in days]
    fats   = [float(d["fat"]      or 0) for d in days]
    fibers = [float(d["fiber"]    or 0) for d in days]

    hit_days   = sum(1 for i, d in enumerate(days) if cal_min <= cals[i] <= cal_max and pros[i] >= pro_min)
    over_days  = sum(1 for c in cals if c > cal_max)
    under_days = sum(1 for c in cals if c < cal_min)
    logged_days = len(days)

    best_day  = days[cals.index(max(cals))]   # highest cal day
    worst_day = days[cals.index(min(cals))]   # lowest cal day

    # Trends (simple: compare first half vs second half avg)
    mid = len(days) // 2
    first_avg  = sum(cals[:mid])  / max(mid, 1)
    second_avg = sum(cals[mid:])  / max(len(days) - mid, 1)
    trend = "improving" if second_avg < first_avg and "loss" in targets.get("goal","") \
        else "improving" if second_avg > first_avg and "gain" in targets.get("goal","") \
        else "stable" if abs(second_avg - first_avg) < 100 else "fluctuating"

    stats = {
        "logged_days":   logged_days,
        "hit_days":      hit_days,
        "over_days":     over_days,
        "under_days":    under_days,
        "hit_rate":      round(hit_days / logged_days * 100),
        "avg_cal":       round(sum(cals)   / logged_days),
        "avg_protein":   round(sum(pros)   / logged_days, 1),
        "avg_carbs":     round(sum(carbs)  / logged_days, 1),
        "avg_fat":       round(sum(fats)   / logged_days, 1),
        "avg_fiber":     round(sum(fibers) / logged_days, 1),
        "total_cal":     round(sum(cals)),
        "best_day":      {"day": str(best_day["day"]),  "calories": round(float(best_day["calories"] or 0))},
        "worst_day":     {"day": str(worst_day["day"]), "calories": round(float(worst_day["calories"] or 0))},
        "trend":         trend,
        "cal_target":    f"{cal_min}–{cal_max}",
        "protein_target":f"≥{pro_min}g",
    }
    # Stringify any date objects
    for d in days:
        if 'day' in d and hasattr(d['day'], 'isoformat'):
            d['day'] = d['day'].isoformat()
    if stats:
        for k in ['best_day', 'worst_day']:
            if k in stats and 'day' in stats[k] and hasattr(stats[k]['day'], 'isoformat'):
                stats[k]['day'] = stats[k]['day'].isoformat()
    return {"days": days, "stats": stats}

# ─── Meal plan generator ─────────────────────────────────
def suggest_full_day_plan(targets, db):
    """Build a full suggested day meal plan scaled to the user's calorie target."""
    cur = db.cursor(dictionary=True)
    cur.execute(
        "SELECT name, calories_per100, protein_per100, carbs_per100, fat_per100, fiber_per100 "
        "FROM foods WHERE calories_per100 > 0"
    )
    fdb = {f["name"]: f for f in cur.fetchall()}
    cur.close()

    goal    = targets.get("goal", "maintain")
    cal_mid = (float(targets["cal_min"]) + float(targets["cal_max"])) / 2
    scale   = cal_mid / 2000   # scale base portions (designed at 2000 kcal) to user target

    # Base templates per goal: (label, [(food_name, base_grams), ...])
    templates = {
        "loss": [
            ("🌅 Breakfast", [("Oats", 60),  ("Greek Yogurt", 150), ("Apple", 150)]),
            ("☀️ Lunch",     [("Chicken Breast", 200), ("Broccoli", 200), ("Sweet Potato", 120)]),
            ("🌙 Dinner",    [("Salmon", 150), ("Broccoli", 200), ("Brown Rice", 80)]),
            ("🍎 Snack",     [("Greek Yogurt", 120), ("Apple", 100)]),
        ],
        "gain": [
            ("🌅 Breakfast", [("Oats", 100), ("Egg", 150), ("Banana", 150), ("Milk", 200)]),
            ("☀️ Lunch",     [("Chicken Breast", 250), ("White Rice", 200), ("Avocado", 80)]),
            ("🌙 Dinner",    [("Beef", 200), ("Brown Rice", 200), ("Sweet Potato", 150)]),
            ("🍎 Snack",     [("Peanut Butter", 40), ("Banana", 150), ("Almonds", 30)]),
        ],
        "maintain": [
            ("🌅 Breakfast", [("Oats", 80),  ("Egg", 100), ("Banana", 120)]),
            ("☀️ Lunch",     [("Chicken Breast", 200), ("Brown Rice", 150), ("Broccoli", 150)]),
            ("🌙 Dinner",    [("Salmon", 150), ("White Rice", 150), ("Broccoli", 150)]),
            ("🍎 Snack",     [("Greek Yogurt", 150), ("Almonds", 25)]),
        ],
    }

    plan = []
    for label, items in templates.get(goal, templates["maintain"]):
        entries   = []
        meal_cal  = 0
        meal_pro  = 0
        meal_carb = 0
        meal_fat  = 0
        for name, base_g in items:
            f = fdb.get(name)
            if not f:
                continue
            g    = max(20, round(base_g * scale / 5) * 5)   # round to nearest 5g
            cal  = round(float(f["calories_per100"])  * g / 100)
            pro  = round(float(f["protein_per100"])   * g / 100, 1)
            carb = round(float(f["carbs_per100"])     * g / 100, 1)
            fat  = round(float(f["fat_per100"])       * g / 100, 1)
            meal_cal  += cal
            meal_pro  += pro
            meal_carb += carb
            meal_fat  += fat
            entries.append(
                f"{name} ({g}g) — {cal} kcal · {pro}g protein · {carb}g carbs · {fat}g fat"
            )
        if entries:
            plan.append({
                "meal":  f"{label}  (~{meal_cal} kcal)",
                "items": entries,
                "note":  f"~{meal_pro:.0f}g protein · ~{meal_carb:.0f}g carbs · ~{meal_fat:.0f}g fat",
            })
    return plan


# ─── Smart recommendations ────────────────────────────────
def build_recommendations(user_id, targets, db):
    cur = db.cursor(dictionary=True)

    cur.execute("""
        SELECT DATE(logged_at) AS day,
               SUM(calories) AS cal, SUM(protein_g) AS pro,
               SUM(carbs_g) AS carbs, SUM(fat_g) AS fat, SUM(fiber_g) AS fib
        FROM meal_logs
        WHERE user_id=%s AND logged_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(logged_at) ORDER BY day DESC
    """, (user_id,))
    days = cur.fetchall()

    cur.execute("""
        SELECT food_name, SUM(calories) AS total_cal, COUNT(*) AS freq
        FROM meal_logs WHERE user_id=%s AND logged_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY food_name ORDER BY freq DESC LIMIT 5
    """, (user_id,))
    top_foods = [dict(f) for f in cur.fetchall()]

    cur.execute("""
        SELECT COALESCE(SUM(calories),0) AS cal, COALESCE(SUM(protein_g),0) AS pro,
               COALESCE(SUM(carbs_g),0) AS carbs, COALESCE(SUM(fat_g),0) AS fat,
               COALESCE(SUM(fiber_g),0) AS fib
        FROM meal_logs WHERE user_id=%s AND DATE(logged_at)=CURDATE()
    """, (user_id,))
    today = cur.fetchone()
    cur.close()

    cal_min   = float(targets["cal_min"])
    cal_max   = float(targets["cal_max"])
    pro_min   = float(targets["protein_min_g"])
    pro_max   = float(targets["protein_max_g"])
    carbs_min = float(targets["carbs_min_g"])
    carbs_max = float(targets["carbs_max_g"])
    fat_min   = float(targets["fat_min_g"])
    fat_max   = float(targets["fat_max_g"])
    fib_min   = float(targets["fiber_min_g"])

    tc  = float(today["cal"])
    tp  = float(today["pro"])
    tca = float(today["carbs"])
    tf  = float(today["fat"])
    tfi = float(today["fib"])

    tips = []

    # Today calorie status
    if tc == 0:
        goal      = targets.get("goal", "maintain")
        goal_desc = {"loss": "weight loss 🏃", "gain": "muscle gain 💪", "maintain": "maintenance ⚖️"}
        tips.append({
            "type": "info", "icon": "🗓️",
            "text": (f"Nothing logged yet today — here's a suggested plan for your "
                     f"{goal_desc.get(goal, 'maintenance')} goal. "
                     f"Target: {cal_min}–{cal_max} kcal.")
        })
        tips.append({
            "type": "info", "icon": "🎯",
            "text": (f"Daily macro targets: {int(pro_min)}–{int(pro_max)}g protein · "
                     f"{int(carbs_min)}–{int(carbs_max)}g carbs · "
                     f"{int(fat_min)}–{int(fat_max)}g fat · "
                     f"{int(fib_min)}g+ fiber.")
        })
        plan = suggest_full_day_plan(targets, db)
        return {"tips": tips, "plan": plan, "top_foods": top_foods}
    elif tc > cal_max:
        tips.append({"type":"danger","icon":"⚠️","text":f"You've exceeded your calorie limit today ({int(tc)} / {cal_max} kcal max)."})
    elif tc < cal_min:
        tips.append({"type":"warning","icon":"💡","text":f"You're below your minimum calorie goal today ({int(tc)} / {cal_min} kcal min)."})
    else:
        tips.append({"type":"success","icon":"✅","text":f"Calories on track: {int(tc)} kcal (target {cal_min}–{cal_max} kcal)."})

    # Protein
    if tp < pro_min:
        tips.append({"type":"warning","icon":"💪","text":f"Protein low today: {tp:.0f}g (min {pro_min}g). Add chicken, eggs, tuna, or Greek yogurt."})
    elif tp > pro_max:
        tips.append({"type":"info","icon":"💪","text":f"Protein is above max today ({tp:.0f}g / {pro_max}g max) — not harmful but consider balance."})
    else:
        tips.append({"type":"success","icon":"💪","text":f"Protein on track: {tp:.0f}g (target {pro_min}–{pro_max}g)."})

    # Carbs
    if tca < carbs_min:
        tips.append({"type":"warning","icon":"🌾","text":f"Carbs low: {tca:.0f}g (min {carbs_min}g). Add rice, oats, or sweet potato."})
    elif tca > carbs_max:
        tips.append({"type":"danger","icon":"🌾","text":f"Carbs over limit: {tca:.0f}g (max {carbs_max}g). Watch refined carbs."})

    # Fat
    if tf < fat_min:
        tips.append({"type":"warning","icon":"🥑","text":f"Fat too low: {tf:.0f}g (min {fat_min}g). Add avocado, nuts, or olive oil."})
    elif tf > fat_max:
        tips.append({"type":"danger","icon":"🥑","text":f"Fat over limit: {tf:.0f}g (max {fat_max}g). Reduce fried foods or butter."})

    # Fiber
    if tfi < fib_min:
        tips.append({"type":"warning","icon":"🥦","text":f"Fiber low: {tfi:.0f}g (min {fib_min}g). Try broccoli, lentils, or an apple."})

    # Weekly patterns
    if len(days) >= 3:
        avg_cal   = sum(float(d["cal"]   or 0) for d in days) / len(days)
        avg_pro   = sum(float(d["pro"]   or 0) for d in days) / len(days)
        avg_carbs = sum(float(d["carbs"] or 0) for d in days) / len(days)
        avg_fat   = sum(float(d["fat"]   or 0) for d in days) / len(days)

        if avg_cal > cal_max * 1.05:
            tips.append({"type":"danger","icon":"📊","text":f"7-day avg {int(avg_cal)} kcal/day — consistently above your limit of {cal_max}."})
        elif avg_cal < cal_min * 0.9:
            tips.append({"type":"warning","icon":"📊","text":f"7-day avg {int(avg_cal)} kcal/day — consistently below your minimum of {cal_min}."})
        else:
            tips.append({"type":"success","icon":"📈","text":f"Great consistency! 7-day avg: {int(avg_cal)} kcal, {avg_pro:.0f}g protein."})

        if avg_pro < pro_min * 0.8:
            tips.append({"type":"warning","icon":"🥩","text":f"Weekly avg protein only {avg_pro:.0f}g — target is ≥{pro_min}g daily."})
        if avg_carbs > carbs_max * 1.1:
            tips.append({"type":"warning","icon":"🌾","text":f"Weekly avg carbs {avg_carbs:.0f}g — above your max of {carbs_max}g."})
        if avg_fat > fat_max * 1.1:
            tips.append({"type":"warning","icon":"🧈","text":f"Weekly avg fat {avg_fat:.0f}g — above your max of {fat_max}g."})

    elif len(days) == 0:
        tips.append({"type":"info","icon":"📅","text":"Log meals for a few days to unlock weekly pattern analysis."})

    # Meal plan for rest of today
    remaining_cal = cal_max - tc
    remaining_pro = pro_min - tp
    plan = []
    if remaining_cal > 150:
        items = []
        if remaining_pro > 15:
            items.append(f"High-protein food: e.g. chicken breast, tuna, or eggs (~{min(int(remaining_cal*0.35),350)} kcal)")
        if tfi < fib_min * 0.7:
            items.append("Fiber-rich vegetable: broccoli, salad, or lentils")
        if tca < carbs_min:
            items.append(f"Complex carbs: brown rice or oats (~{min(int(remaining_cal*0.3),200)} kcal)")
        if items:
            plan.append({
                "meal": f"Suggested for rest of today ({int(remaining_cal)} kcal left)",
                "items": items,
                "note": f"Aim for {max(0,int(remaining_pro))}g more protein, {max(0, fib_min - tfi):.0f}g more fiber."
            })

    return {"tips": tips, "plan": plan, "top_foods": top_foods}

# ══════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════

@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

# ── Auth ──────────────────────────────────────────────────
@app.route("/api/register", methods=["POST"])
def register():
    data   = request.json
    hashed = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt()).decode()
    db = get_db(); cur = db.cursor()
    try:
        cur.execute(
            "INSERT INTO users (name,email,password,age,weight_kg,height_cm,sex,activity,goal) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (data["name"],data["email"],hashed,data["age"],data["weight_kg"],data["height_cm"],data["sex"],data["activity"],data["goal"])
        )
        uid = cur.lastrowid
        t   = calc_targets(data)
        cur.execute("""
            INSERT INTO targets (user_id,cal_min,cal_max,protein_min_g,protein_max_g,carbs_min_g,carbs_max_g,fat_min_g,fat_max_g,fiber_min_g,fiber_max_g)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE cal_min=%s,cal_max=%s,protein_min_g=%s,protein_max_g=%s,carbs_min_g=%s,carbs_max_g=%s,fat_min_g=%s,fat_max_g=%s,fiber_min_g=%s,fiber_max_g=%s
        """, (uid,t["cal_min"],t["cal_max"],t["protein_min"],t["protein_max"],t["carbs_min"],t["carbs_max"],t["fat_min"],t["fat_max"],t["fiber_min"],t["fiber_max"],
              t["cal_min"],t["cal_max"],t["protein_min"],t["protein_max"],t["carbs_min"],t["carbs_max"],t["fat_min"],t["fat_max"],t["fiber_min"],t["fiber_max"]))
        db.commit()
        return jsonify({"user_id": uid, "targets": t}), 201
    except mysql.connector.IntegrityError:
        return jsonify({"error": "Email already registered"}), 409
    finally:
        cur.close(); db.close()

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT * FROM users WHERE email=%s", (data["email"],))
    user = cur.fetchone(); cur.close(); db.close()
    if not user or not bcrypt.checkpw(data["password"].encode(), user["password"].encode()):
        return jsonify({"error": "Invalid credentials"}), 401
    user.pop("password")
    return jsonify({"user": user}), 200

# ── Targets ───────────────────────────────────────────────
@app.route("/api/targets/<int:user_id>", methods=["GET"])
def get_targets(user_id):
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT * FROM targets WHERE user_id=%s", (user_id,))
    row = cur.fetchone(); cur.close(); db.close()
    return jsonify(dict(row) if row else {})

@app.route("/api/profile/<int:user_id>", methods=["PUT"])
def update_profile(user_id):
    data = request.json
    db = get_db(); cur = db.cursor()
    cur.execute("UPDATE users SET age=%s,weight_kg=%s,height_cm=%s,sex=%s,activity=%s,goal=%s WHERE id=%s",
                (data["age"],data["weight_kg"],data["height_cm"],data["sex"],data["activity"],data["goal"],user_id))
    t = calc_targets(data)
    cur.execute("""
        INSERT INTO targets (user_id,cal_min,cal_max,protein_min_g,protein_max_g,carbs_min_g,carbs_max_g,fat_min_g,fat_max_g,fiber_min_g,fiber_max_g)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE cal_min=%s,cal_max=%s,protein_min_g=%s,protein_max_g=%s,carbs_min_g=%s,carbs_max_g=%s,fat_min_g=%s,fat_max_g=%s,fiber_min_g=%s,fiber_max_g=%s
    """, (user_id,t["cal_min"],t["cal_max"],t["protein_min"],t["protein_max"],t["carbs_min"],t["carbs_max"],t["fat_min"],t["fat_max"],t["fiber_min"],t["fiber_max"],
          t["cal_min"],t["cal_max"],t["protein_min"],t["protein_max"],t["carbs_min"],t["carbs_max"],t["fat_min"],t["fat_max"],t["fiber_min"],t["fiber_max"]))
    db.commit(); cur.close(); db.close()
    return jsonify({"targets": t})

# ── Food search ───────────────────────────────────────────
@app.route("/api/foods/search", methods=["GET"])
def search_foods():
    query = request.args.get("q", "")
    if not query: return jsonify([])
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT * FROM foods WHERE name LIKE %s LIMIT 8", (f"%{query}%",))
    cached = [dict(r) for r in cur.fetchall()]
    if cached: cur.close(); db.close(); return jsonify(cached)
    try:
        resp  = requests.get(USDA_URL, params={"query":query,"api_key":USDA_API_KEY,"pageSize":5,"dataType":"Foundation,SR Legacy,Survey (FNDDS)"}, timeout=5)
        items = resp.json().get("foods", [])
    except:
        cur.close(); db.close(); return jsonify([])
    results = []
    for item in items:
        nuts = item.get("foodNutrients", [])
        food = {
            "name": item["description"].title(),
            "calories_per100": get_nutrient(nuts, "Energy"),
            "protein_per100":  get_nutrient(nuts, "Protein"),
            "carbs_per100":    get_nutrient(nuts, "Carbohydrate"),
            "fat_per100":      get_nutrient(nuts, "Total lipid"),
            "fiber_per100":    get_nutrient(nuts, "Fiber"),
            "source": "usda"
        }
        cur.execute(
            "INSERT IGNORE INTO foods (name,calories_per100,protein_per100,carbs_per100,fat_per100,fiber_per100,source) VALUES (%s,%s,%s,%s,%s,%s,'cache')",
            (food["name"],food["calories_per100"],food["protein_per100"],food["carbs_per100"],food["fat_per100"],food["fiber_per100"])
        )
        results.append(food)
    db.commit(); cur.close(); db.close()
    return jsonify(results)

# ── Meal Logging ──────────────────────────────────────────
@app.route("/api/meals/user/<int:user_id>", methods=["GET"])
def get_meals(user_id):
    date_str = request.args.get("date", "")
    db = get_db(); cur = db.cursor(dictionary=True)
    if date_str:
        cur.execute("SELECT * FROM meal_logs WHERE user_id=%s AND DATE(logged_at)=%s ORDER BY logged_at", (user_id, date_str))
    else:
        cur.execute("SELECT * FROM meal_logs WHERE user_id=%s ORDER BY logged_at DESC LIMIT 100", (user_id,))
    rows = [serialize_row(r) for r in cur.fetchall()]; cur.close(); db.close()
    return jsonify(rows)

@app.route("/api/meals", methods=["POST"])
def log_meal():
    data  = request.json
    grams = float(data.get("grams", 0))
    if grams <= 0: return jsonify({"error": "Grams must be > 0"}), 400

    # Use client-provided date (fixes timezone issues); fall back to server NOW()
    log_date = data.get("log_date")   # "YYYY-MM-DD" sent by the frontend
    logged_at = f"{log_date} 12:00:00" if log_date else None

    db = get_db(); cur = db.cursor()
    cur.execute("SELECT id FROM foods WHERE name=%s LIMIT 1", (data["food_name"],))
    row = cur.fetchone()
    if row:
        food_id = row[0]
    else:
        cur.execute(
            "INSERT INTO foods (name,calories_per100,protein_per100,carbs_per100,fat_per100,fiber_per100,source) VALUES (%s,%s,%s,%s,%s,%s,'custom')",
            (data["food_name"],
             round(float(data["calories"]) / grams * 100, 2),
             round(float(data.get("protein",0))  / grams * 100, 2),
             round(float(data.get("carbs",0))    / grams * 100, 2),
             round(float(data.get("fat",0))      / grams * 100, 2),
             round(float(data.get("fiber",0))    / grams * 100, 2))
        )
        food_id = cur.lastrowid

    if logged_at:
        cur.execute(
            "INSERT INTO meal_logs (user_id,food_id,food_name,meal_type,grams,calories,protein_g,carbs_g,fat_g,fiber_g,logged_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (data["user_id"],food_id,data["food_name"],data["meal_type"],grams,
             float(data["calories"]),float(data.get("protein",0)),float(data.get("carbs",0)),
             float(data.get("fat",0)),float(data.get("fiber",0)), logged_at)
        )
    else:
        cur.execute(
            "INSERT INTO meal_logs (user_id,food_id,food_name,meal_type,grams,calories,protein_g,carbs_g,fat_g,fiber_g) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (data["user_id"],food_id,data["food_name"],data["meal_type"],grams,
             float(data["calories"]),float(data.get("protein",0)),float(data.get("carbs",0)),
             float(data.get("fat",0)),float(data.get("fiber",0)))
        )
    db.commit(); meal_id = cur.lastrowid; cur.close(); db.close()
    return jsonify({"id": meal_id}), 201

@app.route("/api/meals/<int:meal_id>", methods=["DELETE"])
def delete_meal(meal_id):
    db = get_db(); cur = db.cursor()
    cur.execute("DELETE FROM meal_logs WHERE id=%s", (meal_id,))
    db.commit(); cur.close(); db.close()
    return jsonify({"deleted": meal_id})

# ── Analytics ─────────────────────────────────────────────
@app.route("/api/analytics/<int:user_id>", methods=["GET"])
def analytics(user_id):
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("""
        SELECT DATE(logged_at) AS day, SUM(calories) AS calories,
               SUM(protein_g) AS protein, SUM(carbs_g) AS carbs,
               SUM(fat_g) AS fat, SUM(fiber_g) AS fiber
        FROM meal_logs WHERE user_id=%s AND logged_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(logged_at) ORDER BY day
    """, (user_id,))
    rows = [serialize_row(r) for r in cur.fetchall()]; cur.close(); db.close()
    return jsonify(rows)

# ── Weekly summary ────────────────────────────────────────
@app.route("/api/summary/weekly/<int:user_id>", methods=["GET"])
def weekly_summary(user_id):
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT * FROM targets WHERE user_id=%s", (user_id,))
    targets = cur.fetchone(); cur.close()
    if not targets: db.close(); return jsonify({"error": "No targets set"})
    today = date.today()
    start = today - timedelta(days=6)
    result = build_summary(user_id, targets, db, start.isoformat(), today.isoformat())
    db.close(); return jsonify(result)

# ── Monthly summary ───────────────────────────────────────
@app.route("/api/summary/monthly/<int:user_id>", methods=["GET"])
def monthly_summary(user_id):
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT * FROM targets WHERE user_id=%s", (user_id,))
    targets = cur.fetchone(); cur.close()
    if not targets: db.close(); return jsonify({"error": "No targets set"})
    today = date.today()
    start = today.replace(day=1)
    result = build_summary(user_id, targets, db, start.isoformat(), today.isoformat())
    db.close(); return jsonify(result)

# ── Recommendations ───────────────────────────────────────
@app.route("/api/recommendations/<int:user_id>", methods=["GET"])
def recommendations(user_id):
    try:
        db = get_db(); cur = db.cursor(dictionary=True)
        cur.execute("SELECT * FROM targets WHERE user_id=%s", (user_id,))
        targets = cur.fetchone()
        cur.execute("SELECT goal FROM users WHERE id=%s", (user_id,))
        user_row = cur.fetchone()
        cur.close()
        if not targets: db.close(); return jsonify({"tips":[],"plan":[],"top_foods":[]})
        if user_row:
            targets["goal"] = user_row.get("goal", "maintain")
        result = build_recommendations(user_id, targets, db)
        db.close(); return jsonify(result)
    except Exception as e:
        print(f"Recommendations error: {e}")
        try: db.close()
        except: pass
        return jsonify({"tips": [{"type":"info","icon":"💡","text":"Start logging meals to get personalised recommendations!"}], "plan":[], "top_foods":[]})

# ── Date serialization helper ─────────────────────────────
def serialize_row(row):
    out = {}
    for k, v in row.items():
        if hasattr(v, 'isoformat'):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out

# ── History by date ───────────────────────────────────────
@app.route("/api/history/<int:user_id>", methods=["GET"])
def history(user_id):
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("""
        SELECT DATE(logged_at) AS day, SUM(calories) AS calories,
               SUM(protein_g) AS protein, SUM(carbs_g) AS carbs,
               SUM(fat_g) AS fat, SUM(fiber_g) AS fiber, COUNT(*) AS meal_count
        FROM meal_logs WHERE user_id=%s
        GROUP BY DATE(logged_at) ORDER BY day DESC LIMIT 30
    """, (user_id,))
    rows = [serialize_row(r) for r in cur.fetchall()]; cur.close(); db.close()
    return jsonify(rows)

# ══════════════════════════════════════════════════════════
if __name__ == "__main__":
    init_db()
    print("\n✅  CALORIFY is running!")
    print("👉  Open http://localhost:5000 in your browser\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
