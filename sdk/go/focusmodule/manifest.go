package focusmodule

import (
	"encoding/json"
	"log"
	"os"
)

// Manifest represents the module's manifest.json.
type Manifest struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Version     string          `json:"version"`
	Author      string          `json:"author"`
	Events      []ManifestEvent `json:"events"`
}

// ManifestEvent describes an event declared in manifest.json.
type ManifestEvent struct {
	Type        string            `json:"type"`
	Description string            `json:"description"`
	Payload     map[string]string `json:"payload"`
}

// readManifest reads and parses ./manifest.json from the current working directory.
func readManifest() Manifest {
	data, err := os.ReadFile("manifest.json")
	if err != nil {
		log.Fatalf("focusmodule: read manifest.json: %v", err)
	}

	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		log.Fatalf("focusmodule: parse manifest.json: %v", err)
	}

	if m.ID == "" {
		log.Fatal("focusmodule: manifest.json: id is required")
	}
	if m.Name == "" {
		log.Fatal("focusmodule: manifest.json: name is required")
	}

	return m
}
