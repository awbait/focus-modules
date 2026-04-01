package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	fm "github.com/awbait/focus-modules/sdk/go/focusmodule"
)

var (
	db  *sql.DB
	app *fm.App
)

func main() {
	fm.Run(fm.Config{
		SettingsTable: "ec_settings",
	}, func(a *fm.App) {
		db = a.DB
		app = a

		a.Mux.HandleFunc("GET /value", handleGetValue)
		a.Mux.HandleFunc("GET /history", handleGetHistory)
		a.Mux.HandleFunc("POST /increment", handleIncrement)
		a.Mux.HandleFunc("POST /decrement", handleDecrement)
		a.Mux.HandleFunc("POST /reset", handleReset)
	})
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
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	step := parseStep(r)
	mutateValue(w, step)
}

func handleDecrement(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	step := parseStep(r)
	mutateValue(w, -step)
}

func handleReset(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
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
	app.Broadcast("value.changed", map[string]any{"value": 0, "delta": -current})
	fm.JSON(w, map[string]int{"value": 0, "delta": -current})
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
	app.Broadcast("value.changed", map[string]any{"value": newValue, "delta": delta})
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
