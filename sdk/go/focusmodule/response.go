package focusmodule

import (
	"encoding/json"
	"log"
	"net/http"
)

// JSON writes v as a JSON response with 200 status.
func JSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

// HTTPError writes a JSON error response with the given status code.
func HTTPError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}

// InternalError logs the error and writes a 500 JSON response.
func InternalError(w http.ResponseWriter, context string, err error) {
	log.Printf("%s: %v", context, err)
	HTTPError(w, http.StatusInternalServerError, context+": "+err.Error())
}
