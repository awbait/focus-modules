// Package focusmodule provides helpers for building focus-dashboard dynamic modules.
//
// A typical module main.go:
//
//	var db *sql.DB
//	var app *focusmodule.App
//
//	func main() {
//	    focusmodule.Run(focusmodule.Config{
//	        SettingsTable: "my_settings", // optional
//	    }, func(a *focusmodule.App) {
//	        db = a.DB
//	        app = a
//	        a.Mux.HandleFunc("GET /data", handleData)
//	    })
//	}
//
// Run reads manifest.json, opens the database, registers /health and
// optional settings routes, then starts the HTTP server.
package focusmodule

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	_ "modernc.org/sqlite"
)

// Getenv returns the value of the environment variable or the fallback.
func Getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// OpenDB opens the SQLite database specified by DB_PATH env var (default "focus.db")
// with WAL journal mode, foreign keys enabled, and MaxOpenConns=1.
func OpenDB() *sql.DB {
	dbPath := Getenv("DB_PATH", "focus.db")
	db, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)")
	if err != nil {
		log.Fatalf("focusmodule: open db: %v", err)
	}
	db.SetMaxOpenConns(1)
	return db
}

// ListenAndServe starts the HTTP server with focus-module/1 handshake.
// It reads PORT from the environment (default "0" for random port),
// prints the handshake JSON to stdout, and blocks serving requests.
func ListenAndServe(handler http.Handler, name string) {
	port := Getenv("PORT", "0")

	ln, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		log.Fatalf("focusmodule: listen: %v", err)
	}

	handshake := map[string]any{
		"protocol": "focus-module/1",
		"port":     ln.Addr().(*net.TCPAddr).Port,
		"name":     name,
	}
	if err := json.NewEncoder(os.Stdout).Encode(handshake); err != nil {
		log.Fatalf("focusmodule: handshake: %v", err)
	}

	log.Printf("%s listening on %s", name, ln.Addr())
	if err := http.Serve(ln, handler); err != nil {
		log.Fatalf("focusmodule: serve: %v", err)
	}
}

// HealthHandler responds with 200 OK for the required /health endpoint.
func HealthHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = fmt.Fprint(w, `{"status":"ok"}`)
}
