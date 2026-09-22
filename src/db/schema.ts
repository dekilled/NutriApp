// Definição das tabelas do banco SQLite local (off-line first).

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS meal_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS nutrition_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  label TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS plan_meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  slot_id INTEGER NOT NULL,
  scheduled_time TEXT,
  description TEXT NOT NULL,
  calories REAL,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  notes TEXT,
  FOREIGN KEY (plan_id) REFERENCES nutrition_plan(id) ON DELETE CASCADE,
  FOREIGN KEY (slot_id) REFERENCES meal_slots(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS plan_supplements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  dose TEXT,
  scheduled_time TEXT,
  with_meal_slot INTEGER,
  notes TEXT,
  FOREIGN KEY (plan_id) REFERENCES nutrition_plan(id) ON DELETE CASCADE,
  FOREIGN KEY (with_meal_slot) REFERENCES meal_slots(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS food_guidelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  food TEXT NOT NULL,
  type TEXT NOT NULL,
  reason TEXT,
  FOREIGN KEY (plan_id) REFERENCES nutrition_plan(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_date TEXT NOT NULL UNIQUE,
  plan_id INTEGER,
  notes TEXT,
  FOREIGN KEY (plan_id) REFERENCES nutrition_plan(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS meal_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_log_id INTEGER NOT NULL,
  slot_id INTEGER NOT NULL,
  plan_meal_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  actual_description TEXT,
  actual_calories REAL,
  logged_at TEXT,
  notes TEXT,
  FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE,
  FOREIGN KEY (slot_id) REFERENCES meal_slots(id) ON DELETE RESTRICT,
  FOREIGN KEY (plan_meal_id) REFERENCES plan_meals(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS supplement_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_log_id INTEGER NOT NULL,
  plan_supplement_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  logged_at TEXT,
  notes TEXT,
  FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_supplement_id) REFERENCES plan_supplements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_log_id INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  total_minutes REAL,
  notes TEXT,
  FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_s REAL,
  confidence REAL,
  FOREIGN KEY (session_id) REFERENCES activity_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_plan_meals_plan_id ON plan_meals(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_supplements_plan_id ON plan_supplements(plan_id);
CREATE INDEX IF NOT EXISTS idx_food_guidelines_plan_id ON food_guidelines(plan_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_plan_id ON daily_logs(plan_id);
CREATE INDEX IF NOT EXISTS idx_meal_logs_daily_log_id ON meal_logs(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_daily_log_id ON supplement_logs(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_activity_sessions_daily_log_id ON activity_sessions(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_activity_segments_session_id ON activity_segments(session_id);
`
