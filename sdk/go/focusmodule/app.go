package focusmodule

import (
	"database/sql"
	"log"
	"net/http"
)

// App provides module access to the database, router, and manifest metadata.
type App struct {
	DB       *sql.DB
	Mux      *http.ServeMux
	Manifest Manifest

	knownEvents map[string]bool
}

// Config holds optional module configuration for Run.
type Config struct {
	// SettingsTable is the SQLite table name for generic settings CRUD.
	// If empty, settings routes are not registered.
	SettingsTable string
}

// Run is the single entry point for a focus-dashboard module.
// It reads manifest.json, opens the database, creates a mux with /health,
// optionally registers settings routes, calls setup for custom routes,
// and starts the HTTP server.
func Run(cfg Config, setup func(app *App)) {
	manifest := readManifest()

	db := OpenDB()
	defer func() { _ = db.Close() }()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", HealthHandler)

	if cfg.SettingsTable != "" {
		sh := newSettingsHandler(db, cfg.SettingsTable)
		mux.HandleFunc("GET /settings", sh.Get)
		mux.HandleFunc("PUT /settings", sh.Put)
		mux.HandleFunc("GET /widget-settings/{widgetId}", sh.Get)
		mux.HandleFunc("PUT /widget-settings/{widgetId}", sh.Put)
	}

	known := make(map[string]bool, len(manifest.Events))
	for _, e := range manifest.Events {
		known[e.Type] = true
	}

	app := &App{
		DB:          db,
		Mux:         mux,
		Manifest:    manifest,
		knownEvents: known,
	}

	setup(app)

	ListenAndServe(mux, manifest.Name)
}

// Broadcast sends a WebSocket broadcast and a domain event to the dashboard.
// eventType is the short name (e.g. "value.changed"); the module ID prefix
// is added automatically from manifest.json.
// If the full event type is not declared in manifest.json events, a warning is logged.
func (a *App) Broadcast(eventType string, payload any) {
	fullType := a.Manifest.ID + "." + eventType
	if !a.knownEvents[fullType] {
		log.Printf("focusmodule: WARNING: event %q not declared in manifest.json", fullType)
	}
	BroadcastEvent(a.Manifest.ID, eventType, payload)
}
