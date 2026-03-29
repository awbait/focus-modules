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
	moduleID := os.Getenv("MODULE_ID")
	if moduleID == "" {
		moduleID = "example-counter"
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
	if entries == nil {
		entries = []entry{}
	}
	jsonResponse(w, entries)
}

func handleIncrement(w http.ResponseWriter, r *http.Request) {
	step := parseStep(r)
	mutateValue(w, step)
}

func handleDecrement(w http.ResponseWriter, r *http.Request) {
	step := parseStep(r)
	mutateValue(w, -step)
}

func handleReset(w http.ResponseWriter, _ *http.Request) {
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

func handleGetWidgetSettings(w http.ResponseWriter, r *http.Request) {
	_ = r.PathValue("widgetId")
	// Return default settings — module manages its own simple defaults.
	jsonResponse(w, map[string]int{"step": 1})
}

func handlePutWidgetSettings(w http.ResponseWriter, r *http.Request) {
	_ = r.PathValue("widgetId")
	// Accept settings but this example module doesn't persist per-widget settings server-side.
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, `{"ok":true}`)
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

func broadcastChange(value, delta int) {
	payload := map[string]any{"value": value, "delta": delta}

	// WebSocket broadcast
	go postJSON("http://127.0.0.1:8080/internal/ws/broadcast", map[string]any{
		"event":   "example-counter.value.changed",
		"payload": payload,
	})

	// Domain event
	go postJSON("http://127.0.0.1:8080/internal/events/publish", map[string]any{
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
	http.Error(w, fmt.Sprintf(`{"error":"%s: %s"}`, context, err), http.StatusInternalServerError)
}
