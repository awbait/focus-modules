CREATE TABLE IF NOT EXISTS ec_values (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    value INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO ec_values (id, value) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS ec_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    value      INTEGER NOT NULL,
    delta      INTEGER NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ec_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '{}'
);

INSERT OR IGNORE INTO ec_settings (key, value) VALUES ('global', '{"step":1}');
