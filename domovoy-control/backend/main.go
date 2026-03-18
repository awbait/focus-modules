// domovoy-control backend service.
// Implements focus-module/1 handshake protocol:
// reads PORT from env, binds the listener, then writes handshake JSON to stdout.
package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

type Status struct {
	Running bool   `json:"running"`
	State   string `json:"state"`
	Since   string `json:"since,omitempty"`
}

var (
	mu    sync.RWMutex
	state = Status{Running: true, State: "idle"}
)

func main() {
	portStr := os.Getenv("PORT")
	if portStr == "" {
		portStr = "8090" // dev fallback
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		slog.Error("invalid PORT", "value", portStr)
		os.Exit(1)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /manifest", handleManifest)
	mux.HandleFunc("GET /status", handleStatus)
	mux.HandleFunc("POST /command", handleCommand)

	// Bind the port before writing handshake so the host can connect immediately.
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		slog.Error("listen failed", "port", port, "err", err)
		os.Exit(1)
	}

	// Write handshake — host reads this and registers the proxy.
	handshake := map[string]any{
		"protocol": "focus-module/1",
		"port":     port,
		"name":     "domovoy-control",
	}
	if err := json.NewEncoder(os.Stdout).Encode(handshake); err != nil {
		slog.Error("write handshake", "err", err)
		os.Exit(1)
	}

	slog.Info("domovoy-control ready", "port", port)
	if err := http.Serve(ln, mux); err != nil {
		slog.Error("server error", "err", err)
		os.Exit(1)
	}
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok"}`)) //nolint:errcheck
}

func handleManifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{ //nolint:errcheck
		"id":      "domovoy-control",
		"name":    "Домовой",
		"version": "0.1.0",
	})
}

func handleStatus(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	s := state
	mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s) //nolint:errcheck
}

func handleCommand(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Command string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if body.Command == "" {
		http.Error(w, "command required", http.StatusBadRequest)
		return
	}

	slog.Info("command received", "command", body.Command)

	mu.Lock()
	state = Status{Running: true, State: "listening", Since: time.Now().Format(time.RFC3339)}
	mu.Unlock()

	// Simulate returning to idle after 3s (replace with real domovoy gRPC call).
	go func() {
		time.Sleep(3 * time.Second)
		mu.Lock()
		state = Status{Running: true, State: "idle"}
		mu.Unlock()
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "accepted"}) //nolint:errcheck
}
