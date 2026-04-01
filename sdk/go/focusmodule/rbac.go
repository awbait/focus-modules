package focusmodule

import (
	"fmt"
	"net/http"
)

// Role constants for use with RequireRole.
const (
	RoleGuest    = "guest"
	RoleResident = "resident"
	RoleOwner    = "owner"
)

// Role hierarchy: guest < resident < owner.
var roleLevel = map[string]int{RoleGuest: 0, RoleResident: 1, RoleOwner: 2}

// RequireRole checks the X-Focus-User-Role header injected by the dashboard proxy.
// Returns false and writes 403 if the caller lacks the required role.
//
//	func handleDelete(w http.ResponseWriter, r *http.Request) {
//	    if !focusmodule.RequireRole(w, r, focusmodule.RoleOwner) {
//	        return
//	    }
//	    // ...
//	}
func RequireRole(w http.ResponseWriter, r *http.Request, required string) bool {
	role := r.Header.Get("X-Focus-User-Role")
	if role == "" {
		role = RoleGuest
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
		return RoleGuest
	}
	return role
}
