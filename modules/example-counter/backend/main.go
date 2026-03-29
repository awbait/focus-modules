package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"

	_ "modernc.org/sqlite"
)

var db *sql.DB

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8700"
	}
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "focus.db"
	}

	var err error
	db, err = sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)")
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	defer db.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /value", handleGetValue)
	mux.HandleFunc("GET /history", handleGetHistory)
	mux.HandleFunc("POST /increment", handleIncrement)
	mux.HandleFunc("POST /decrement", handleDecrement)
	mux.HandleFunc("POST /reset", handleReset)
	mux.HandleFunc("GET /settings", handleGetSettings)
	mux.HandleFunc("PUT /settings", handlePutSettings)
	mux.HandleFunc("GET /widget-settings/{widgetId}", handleGetWidgetSettings)
	mux.HandleFunc("PUT /widget-settings/{widgetId}", handlePutWidgetSettings)

	ln, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		log.Fatalf("listen: %v", err)
	}

	// Handshake: print JSON to stdout so the host knows we're ready.
	handshake := map[string]any{
		"protocol": "focus-module/1",
		"port":     ln.Addr().(*net.TCPAddr).Port,
		"name":     "Example Counter",
	}
	enc := json.NewEncoder(os.Stdout)
	_ = enc.Encode(handshake)

	log.Printf("example-counter listening on %s", ln.Addr())
	if err := http.Serve(ln, mux); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

// --- Handlers ---

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "ok")
}

func handleGetValue(w http.ResponseWriter, _ *http.Request) {
	var value int
	err := db.QueryRow("SELECT value FROM ec_values WHERE id = 1").Scan(&value)
	if err != nil {
		httpError(w, "query value", err)
		return
	}
	jsonResponse(w, map[string]int{"value": value})
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
		httpError(w, "query history", err)
		return
	}
	defer rows.Close()

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
			httpError(w, "scan history", err)
			return
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		httpError(w, "iterate history", err)
		return
	}
	if entries == nil {
		entries = []entry{}
	}
	jsonResponse(w, entries)
}

func handleIncrement(w http.ResponseWriter, r *http.Request) {
	if !requireRole(w, r, "resident") {
		return
	}
	step := parseStep(r)
	mutateValue(w, step)
}

func handleDecrement(w http.ResponseWriter, r *http.Request) {
	if !requireRole(w, r, "resident") {
		return
	}
	step := parseStep(r)
	mutateValue(w, -step)
}

func handleReset(w http.ResponseWriter, r *http.Request) {
	if !requireRole(w, r, "resident") {
		return
	}
	// Get current value to compute delta.
	var current int
	if err := db.QueryRow("SELECT value FROM ec_values WHERE id = 1").Scan(&current); err != nil {
		httpError(w, "query value", err)
		return
	}
	if _, err := db.Exec("UPDATE ec_values SET value = 0 WHERE id = 1"); err != nil {
		httpError(w, "reset value", err)
		return
	}
	if current != 0 {
		recordHistory(0, -current)
	}
	broadcastChange(0, -current)
	jsonResponse(w, map[string]int{"value": 0, "delta": -current})
}

func handleGetSettings(w http.ResponseWriter, _ *http.Request) {
	var raw string
	err := db.QueryRow("SELECT value FROM ec_settings WHERE key = 'global'").Scan(&raw)
	if err != nil {
		jsonResponse(w, map[string]int{"step": 1})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, raw)
}

func handlePutSettings(w http.ResponseWriter, r *http.Request) {
	if !requireRole(w, r, "owner") {
		return
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}
	data, _ := json.Marshal(body)
	_, err := db.Exec(
		"INSERT INTO ec_settings (key, value) VALUES ('global', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		string(data),
	)
	if err != nil {
		httpError(w, "save settings", err)
		return
	}
	jsonResponse(w, map[string]bool{"ok": true})
}

func handleGetWidgetSettings(w http.ResponseWriter, _ *http.Request) {
	// Per-widget settings inherit from global settings.
	handleGetSettings(w, nil)
}

func handlePutWidgetSettings(w http.ResponseWriter, r *http.Request) {
	handlePutSettings(w, r)
}

// --- RBAC ---

var roleLevel = map[string]int{"guest": 0, "resident": 1, "owner": 2}

// requireRole checks X-Focus-User-Role header injected by the dashboard proxy.
// Returns false and writes 403 if the user lacks sufficient permissions.
func requireRole(w http.ResponseWriter, r *http.Request, required string) bool {
	role := r.Header.Get("X-Focus-User-Role")
	if role == "" {
		role = "guest"
	}
	if roleLevel[role] < roleLevel[required] {
		http.Error(w, fmt.Sprintf(`{"error":"forbidden: requires %s"}`, required), http.StatusForbidden)
		return false
	}
	return true
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
		httpError(w, "update value", err)
		return
	}
	recordHistory(newValue, delta)
	broadcastChange(newValue, delta)
	jsonResponse(w, map[string]int{"value": newValue, "delta": delta})
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

// hostBaseURL is the dashboard's internal API base. Modules communicate back
// to the host via this URL for WebSocket broadcasts and domain events.
var hostBaseURL = getenv("HOST_URL", "http://127.0.0.1:8080")

func broadcastChange(value, delta int) {
	payload := map[string]any{"value": value, "delta": delta}

	// WebSocket broadcast
	go postJSON(hostBaseURL+"/internal/ws/broadcast", map[string]any{
		"event":   "example-counter.value.changed",
		"payload": payload,
	})

	// Domain event
	go postJSON(hostBaseURL+"/internal/events/publish", map[string]any{
		"type":    "example-counter.value.changed",
		"source":  "example-counter",
		"payload": payload,
	})
}

func postJSON(url string, body any) {
	data, err := json.Marshal(body)
	if err != nil {
		log.Printf("marshal: %v", err)
		return
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		log.Printf("POST %s: %v", url, err)
		return
	}
	resp.Body.Close()
}

func jsonResponse(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func httpError(w http.ResponseWriter, context string, err error) {
	log.Printf("%s: %v", context, err)
	msg := map[string]string{"error": fmt.Sprintf("%s: %s", context, err)}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	json.NewEncoder(w).Encode(msg)
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
