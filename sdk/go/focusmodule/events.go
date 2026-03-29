package focusmodule

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"
)

// HostURL is the dashboard's internal API base URL.
// Modules use it to broadcast WebSocket events and domain events.
// Defaults to http://127.0.0.1:8080, override via HOST_URL env var.
var HostURL = Getenv("HOST_URL", "http://127.0.0.1:8080")

// BroadcastEvent sends a WebSocket broadcast and a domain event to the dashboard.
// Both requests are sent asynchronously (fire-and-forget).
//
//	focusmodule.BroadcastEvent("example-counter", "value.changed", map[string]any{
//	    "value": 42, "delta": 1,
//	})
func BroadcastEvent(moduleID, eventType string, payload any) {
	fullType := moduleID + "." + eventType

	// WebSocket broadcast
	go postJSON(HostURL+"/internal/ws/broadcast", map[string]any{
		"event":   fullType,
		"payload": payload,
	})

	// Domain event
	go postJSON(HostURL+"/internal/events/publish", map[string]any{
		"type":    fullType,
		"source":  moduleID,
		"payload": payload,
	})
}

func postJSON(url string, body any) {
	data, err := json.Marshal(body)
	if err != nil {
		log.Printf("focusmodule: marshal event: %v", err)
		return
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		log.Printf("focusmodule: POST %s: %v", url, err)
		return
	}
	resp.Body.Close()
}
