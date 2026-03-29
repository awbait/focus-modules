package focusmodule

import (
	"fmt"
	"net/http"
)

// Role hierarchy: guest < resident < owner.
var roleLevel = map[string]int{"guest": 0, "resident": 1, "owner": 2}

// RequireRole checks the X-Focus-User-Role header injected by the dashboard proxy.
// Returns false and writes 403 if the caller lacks the required role.
//
//	func handleDelete(w http.ResponseWriter, r *http.Request) {
//	    if !focusmodule.RequireRole(w, r, "owner") {
//	        return
//	    }
//	    // ...
//	}
func RequireRole(w http.ResponseWriter, r *http.Request, required string) bool {
	role := r.Header.Get("X-Focus-User-Role")
	if role == "" {
		role = "guest"
	}
	if roleLevel[role] < roleLevel[required] {
		HTTPError(w, http.StatusForbidden, fmt.Sprintf("forbidden: requires %s", required))
		return false
	}
	return true
}

// UserRole extracts the role from the request header.
// Returns "guest" if the header is missing.
func UserRole(r *http.Request) string {
	role := r.Header.Get("X-Focus-User-Role")
	if role == "" {
		return "guest"
	}
	return role
}
