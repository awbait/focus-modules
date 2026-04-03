-- Patients: humans or animals
CREATE TABLE IF NOT EXISTS pt_patients (
    id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name           TEXT NOT NULL,
    type           TEXT NOT NULL DEFAULT 'human' CHECK (type IN ('human', 'animal')),
    avatar         TEXT NOT NULL DEFAULT '',
    linked_user_id TEXT,
    created_at     DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Global medication catalog
CREATE TABLE IF NOT EXISTS pt_medications (
    id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name           TEXT NOT NULL,
    target_type    TEXT NOT NULL DEFAULT 'universal' CHECK (target_type IN ('human', 'animal', 'universal')),
    default_dosage TEXT NOT NULL DEFAULT '',
    form           TEXT NOT NULL DEFAULT 'tablet' CHECK (form IN ('tablet', 'drops', 'injection', 'ointment')),
    notes          TEXT NOT NULL DEFAULT '',
    created_at     DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Prescriptions: patient + medication + dosage + period
CREATE TABLE IF NOT EXISTS pt_prescriptions (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    patient_id    TEXT NOT NULL REFERENCES pt_patients(id) ON DELETE CASCADE,
    medication_id TEXT NOT NULL REFERENCES pt_medications(id) ON DELETE CASCADE,
    dosage        TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    start_date    TEXT NOT NULL DEFAULT (date('now')),
    end_date      TEXT,
    meal_relation TEXT NOT NULL DEFAULT 'none',
    meal_minutes  INTEGER NOT NULL DEFAULT 30,
    duration_days INTEGER,
    created_at    DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Schedules: time + days for a prescription
CREATE TABLE IF NOT EXISTS pt_schedules (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    prescription_id TEXT NOT NULL REFERENCES pt_prescriptions(id) ON DELETE CASCADE,
    time            TEXT NOT NULL,
    days            TEXT NOT NULL DEFAULT '[]',
    active          INTEGER NOT NULL DEFAULT 1,
    frequency_type  TEXT NOT NULL DEFAULT 'daily',
    frequency_value INTEGER NOT NULL DEFAULT 0,
    course_off_days INTEGER NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Dose log: auto-generated from schedules, tracked by users
CREATE TABLE IF NOT EXISTS pt_dose_logs (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    schedule_id   TEXT NOT NULL REFERENCES pt_schedules(id) ON DELETE CASCADE,
    planned_at    DATETIME NOT NULL,
    given_at      DATETIME,
    given_by      TEXT,
    given_by_name TEXT,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'given', 'skipped', 'overdue')),
    skip_reason   TEXT NOT NULL DEFAULT '',
    created_at    DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (schedule_id, planned_at)
);

CREATE INDEX IF NOT EXISTS idx_pt_dose_logs_planned ON pt_dose_logs(planned_at);
CREATE INDEX IF NOT EXISTS idx_pt_dose_logs_schedule ON pt_dose_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_pt_prescriptions_patient ON pt_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_pt_schedules_prescription ON pt_schedules(prescription_id);

-- Generic settings for SDK
CREATE TABLE IF NOT EXISTS pt_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '{}'
);
INSERT OR IGNORE INTO pt_settings (key, value) VALUES ('global', '{}');
