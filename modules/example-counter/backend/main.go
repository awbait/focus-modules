package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	fm "github.com/awbait/focus-modules/sdk/go/focusmodule"
)

var db *sql.DB

func main() {
	db = fm.OpenDB()
	defer func() { _ = db.Close() }()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", fm.HealthHandler)
	mux.HandleFunc("GET /value", handleGetValue)
	mux.HandleFunc("GET /history", handleGetHistory)
	mux.HandleFunc("POST /increment", handleIncrement)
	mux.HandleFunc("POST /decrement", handleDecrement)
	mux.HandleFunc("POST /reset", handleReset)
	mux.HandleFunc("GET /settings", handleGetSettings)
	mux.HandleFunc("PUT /settings", handlePutSettings)
	mux.HandleFunc("GET /widget-settings/{widgetId}", handleGetWidgetSettings)
	mux.HandleFunc("PUT /widget-settings/{widgetId}", handlePutWidgetSettings)

	fm.ListenAndServe(mux, "Example Counter")
}

// --- Handlers ---

func handleGetValue(w http.ResponseWriter, _ *http.Request) {
	var value int
	err := db.QueryRow("SELECT value FROM ec_values WHERE id = 1").Scan(&value)
	if err != nil {
		fm.InternalError(w, "query value", err)
		return
	}
	fm.JSON(w, map[string]int{"value": value})
}

func handleGetHistory(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}

	rows, err := db.Query(
		"SELECT id, value, delta, created_at FROM ec_history ORDER BY id DESC LIMIT ?",
		limit,
	)
	if err != nil {
		fm.InternalError(w, "query history", err)
		return
	}
	defer func() { _ = rows.Close() }()

	type entry struct {
		ID        int    `json:"id"`
		Value     int    `json:"value"`
		Delta     int    `json:"delta"`
		CreatedAt string `json:"created_at"`
	}
	var entries []entry
	for rows.Next() {
		var e entry
		if err := rows.Scan(&e.ID, &e.Value, &e.Delta, &e.CreatedAt); err != nil {
			fm.InternalError(w, "scan history", err)
			return
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		fm.InternalError(w, "iterate history", err)
		return
	}
	if entries == nil {
		entries = []entry{}
	}
	fm.JSON(w, entries)
}

func handleIncrement(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, "resident") {
		return
	}
	step := parseStep(r)
	mutateValue(w, step)
}

func handleDecrement(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, "resident") {
		return
	}
	step := parseStep(r)
	mutateValue(w, -step)
}

func handleReset(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, "resident") {
		return
	}
	var current int
	if err := db.QueryRow("SELECT value FROM ec_values WHERE id = 1").Scan(&current); err != nil {
		fm.InternalError(w, "query value", err)
		return
	}
	if _, err := db.Exec("UPDATE ec_values SET value = 0 WHERE id = 1"); err != nil {
		fm.InternalError(w, "reset value", err)
		return
	}
	if current != 0 {
		recordHistory(0, -current)
	}
	fm.BroadcastEvent("example-counter", "value.changed", map[string]any{"value": 0, "delta": -current})
	fm.JSON(w, map[string]int{"value": 0, "delta": -current})
}

func handleGetSettings(w http.ResponseWriter, _ *http.Request) {
	var raw string
	err := db.QueryRow("SELECT value FROM ec_settings WHERE key = 'global'").Scan(&raw)
	if err != nil {
		fm.JSON(w, map[string]int{"step": 1})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = fmt.Fprint(w, raw)
}

func handlePutSettings(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, "owner") {
		return
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		fm.HTTPError(w, http.StatusBadRequest, "invalid json")
		return
	}
	data, _ := json.Marshal(body)
	_, err := db.Exec(
		"INSERT INTO ec_settings (key, value) VALUES ('global', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		string(data),
	)
	if err != nil {
		fm.InternalError(w, "save settings", err)
		return
	}
	fm.JSON(w, map[string]bool{"ok": true})
}

func handleGetWidgetSettings(w http.ResponseWriter, _ *http.Request) {
	handleGetSettings(w, nil)
}

func handlePutWidgetSettings(w http.ResponseWriter, r *http.Request) {
	handlePutSettings(w, r)
}

// --- Helpers ---

func parseStep(r *http.Request) int {
	step := 1
	var body struct {
		Step int `json:"step"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err == nil && body.Step > 0 {
		step = body.Step
	}
	return step
}

func mutateValue(w http.ResponseWriter, delta int) {
	var newValue int
	err := db.QueryRow(
		"UPDATE ec_values SET value = value + ? WHERE id = 1 RETURNING value",
		delta,
	).Scan(&newValue)
	if err != nil {
		fm.InternalError(w, "update value", err)
		return
	}
	recordHistory(newValue, delta)
	fm.BroadcastEvent("example-counter", "value.changed", map[string]any{"value": newValue, "delta": delta})
	fm.JSON(w, map[string]int{"value": newValue, "delta": delta})
}

func recordHistory(value, delta int) {
	_, err := db.Exec(
		"INSERT INTO ec_history (value, delta) VALUES (?, ?)",
		value, delta,
	)
	if err != nil {
		log.Printf("record history: %v", err)
	}
}
