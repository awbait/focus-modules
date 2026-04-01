package focusmodule

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
)

// settingsHandler provides generic JSON settings CRUD for a module.
// It stores settings as a raw JSON blob in the given table with schema:
//
//	CREATE TABLE <table> (key TEXT PRIMARY KEY, value TEXT NOT NULL);
type settingsHandler struct {
	db    *sql.DB
	table string
}

func newSettingsHandler(db *sql.DB, table string) *settingsHandler {
	return &settingsHandler{db: db, table: table}
}

// Get returns the settings JSON from the database.
// If no record exists, it returns {}.
func (s *settingsHandler) Get(w http.ResponseWriter, _ *http.Request) {
	var raw string
	query := fmt.Sprintf("SELECT value FROM %s WHERE key = 'global'", s.table)
	err := s.db.QueryRow(query).Scan(&raw)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, "{}")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = fmt.Fprint(w, raw)
}

// Put saves settings as a JSON blob. Requires the "owner" role.
func (s *settingsHandler) Put(w http.ResponseWriter, r *http.Request) {
	if !RequireRole(w, r, RoleOwner) {
		return
	}

	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		HTTPError(w, http.StatusBadRequest, "invalid json")
		return
	}

	data, _ := json.Marshal(body)
	query := fmt.Sprintf(
		"INSERT INTO %s (key, value) VALUES ('global', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		s.table,
	)
	if _, err := s.db.Exec(query, string(data)); err != nil {
		InternalError(w, "save settings", err)
		return
	}

	JSON(w, map[string]bool{"ok": true})
}
