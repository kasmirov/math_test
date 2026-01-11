CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    cookies_agreement BOOLEAN DEFAULT FALSE,
    personal_data_agreement BOOLEAN DEFAULT FALSE,
    test_results_mailing BOOLEAN DEFAULT FALSE,
    obligatory_mailing BOOLEAN DEFAULT FALSE,
    service_news BOOLEAN DEFAULT FALSE,
    preferences TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "users" ("id", "email", "username", "password_hash")
SELECT 0, 'anonymous@localhost', 'anonymous', 'none'
WHERE NOT EXISTS ( SELECT 1 FROM users WHERE email = 'anonymous@localhost' );

CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    settings TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

INSERT INTO "profiles" (
    "id", "user_id", "name", "type", "settings"
)
SELECT 0, 0, 'anonymous', 'anonymous', '{"limits": {}}'
WHERE NOT EXISTS ( SELECT 1 FROM profiles WHERE name = 'anonymous');

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_uuid INTEGER NOT NULL,
    current_question_index INTEGER NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS test_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    problem_key TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    question_start_time TIMESTAMP,
    question TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    timeout INTEGER,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    problem_key TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    question_start_time TIMESTAMP,
    question TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    users_answer TEXT NOT NULL,
    is_correct BOOL NOT NULL,
    is_timeout BOOL NOT NULL,
    time_sec REAL NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    setting_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settings_yaml TEXT NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mistakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    problem_key TEXT NOT NULL,
    question TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_history_profile_problem ON history(profile_id, problem_key);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(question_start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_uuid ON sessions(session_uuid);