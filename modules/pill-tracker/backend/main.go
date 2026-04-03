package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	fm "github.com/awbait/focus-modules/sdk/go/focusmodule"
)

var (
	db  *sql.DB
	app *fm.App
)

func main() {
	fm.Run(fm.Config{
		SettingsTable: "pt_settings",
	}, func(a *fm.App) {
		db = a.DB
		app = a

		// Upgrade schema for existing installs (ALTER TABLE is no-op if column exists)
		upgrades := []string{
			"ALTER TABLE pt_prescriptions ADD COLUMN meal_relation TEXT NOT NULL DEFAULT 'none'",
			"ALTER TABLE pt_prescriptions ADD COLUMN meal_minutes INTEGER NOT NULL DEFAULT 30",
			"ALTER TABLE pt_prescriptions ADD COLUMN duration_days INTEGER",
			"ALTER TABLE pt_schedules ADD COLUMN frequency_type TEXT NOT NULL DEFAULT 'daily'",
			"ALTER TABLE pt_schedules ADD COLUMN frequency_value INTEGER NOT NULL DEFAULT 0",
			"ALTER TABLE pt_schedules ADD COLUMN course_off_days INTEGER NOT NULL DEFAULT 0",
		}
		for _, q := range upgrades {
			_, _ = db.Exec(q) // ignore "duplicate column" errors
		}

		// Patients
		a.Mux.HandleFunc("GET /patients", handleListPatients)
		a.Mux.HandleFunc("POST /patients", handleCreatePatient)
		a.Mux.HandleFunc("PUT /patients/{id}", handleUpdatePatient)
		a.Mux.HandleFunc("DELETE /patients/{id}", handleDeletePatient)

		// Medications (global catalog)
		a.Mux.HandleFunc("GET /medications", handleListMedications)
		a.Mux.HandleFunc("POST /medications", handleCreateMedication)
		a.Mux.HandleFunc("PUT /medications/{id}", handleUpdateMedication)
		a.Mux.HandleFunc("DELETE /medications/{id}", handleDeleteMedication)

		// Prescriptions
		a.Mux.HandleFunc("GET /prescriptions", handleListPrescriptions)
		a.Mux.HandleFunc("POST /prescriptions", handleCreatePrescription)
		a.Mux.HandleFunc("PUT /prescriptions/{id}", handleUpdatePrescription)
		a.Mux.HandleFunc("DELETE /prescriptions/{id}", handleDeletePrescription)

		// Schedules
		a.Mux.HandleFunc("GET /schedules", handleListSchedules)
		a.Mux.HandleFunc("POST /schedules", handleCreateSchedule)
		a.Mux.HandleFunc("PUT /schedules/{id}", handleUpdateSchedule)
		a.Mux.HandleFunc("DELETE /schedules/{id}", handleDeleteSchedule)

		// Doses
		a.Mux.HandleFunc("GET /today", handleToday)
		a.Mux.HandleFunc("POST /doses/{id}/give", handleGiveDose)
		a.Mux.HandleFunc("POST /doses/{id}/skip", handleSkipDose)
		a.Mux.HandleFunc("GET /history", handleHistory)

		// Start dose generation ticker (runs in background after server starts)
		go dosesTicker()
	})
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

type patient struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Type         string  `json:"type"`
	Avatar       string  `json:"avatar"`
	LinkedUserID *string `json:"linked_user_id"`
	CreatedAt    string  `json:"created_at"`
}

func handleListPatients(w http.ResponseWriter, _ *http.Request) {
	rows, err := db.Query("SELECT id, name, type, avatar, linked_user_id, created_at FROM pt_patients ORDER BY name")
	if err != nil {
		fm.InternalError(w, "list patients", err)
		return
	}
	defer func() { _ = rows.Close() }()

	patients := []patient{}
	for rows.Next() {
		var p patient
		if err := rows.Scan(&p.ID, &p.Name, &p.Type, &p.Avatar, &p.LinkedUserID, &p.CreatedAt); err != nil {
			fm.InternalError(w, "scan patient", err)
			return
		}
		patients = append(patients, p)
	}
	fm.JSON(w, patients)
}

func handleCreatePatient(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	var req struct {
		Name         string  `json:"name"`
		Type         string  `json:"type"`
		Avatar       string  `json:"avatar"`
		LinkedUserID *string `json:"linked_user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fm.HTTPError(w, 400, "invalid json")
		return
	}
	if req.Name == "" {
		fm.HTTPError(w, 400, "name required")
		return
	}
	if req.Type == "" {
		req.Type = "human"
	}
	if req.Type != "human" && req.Type != "animal" {
		fm.HTTPError(w, 400, "type must be human or animal")
		return
	}

	var p patient
	err := db.QueryRow(
		`INSERT INTO pt_patients (name, type, avatar, linked_user_id) VALUES (?, ?, ?, ?) RETURNING id, name, type, avatar, linked_user_id, created_at`,
		req.Name, req.Type, req.Avatar, req.LinkedUserID,
	).Scan(&p.ID, &p.Name, &p.Type, &p.Avatar, &p.LinkedUserID, &p.CreatedAt)
	if err != nil {
		fm.InternalError(w, "create patient", err)
		return
	}
	fm.JSON(w, p)
}

func handleUpdatePatient(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	id := r.PathValue("id")
	var req struct {
		Name         string  `json:"name"`
		Type         string  `json:"type"`
		Avatar       string  `json:"avatar"`
		LinkedUserID *string `json:"linked_user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fm.HTTPError(w, 400, "invalid json")
		return
	}
	if req.Name == "" {
		fm.HTTPError(w, 400, "name required")
		return
	}
	if req.Type != "human" && req.Type != "animal" {
		fm.HTTPError(w, 400, "type must be human or animal")
		return
	}

	var p patient
	err := db.QueryRow(
		`UPDATE pt_patients SET name = ?, type = ?, avatar = ?, linked_user_id = ? WHERE id = ? RETURNING id, name, type, avatar, linked_user_id, created_at`,
		req.Name, req.Type, req.Avatar, req.LinkedUserID, id,
	).Scan(&p.ID, &p.Name, &p.Type, &p.Avatar, &p.LinkedUserID, &p.CreatedAt)
	if err == sql.ErrNoRows {
		fm.HTTPError(w, 404, "patient not found")
		return
	}
	if err != nil {
		fm.InternalError(w, "update patient", err)
		return
	}
	fm.JSON(w, p)
}

func handleDeletePatient(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	id := r.PathValue("id")
	res, err := db.Exec("DELETE FROM pt_patients WHERE id = ?", id)
	if err != nil {
		fm.InternalError(w, "delete patient", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fm.HTTPError(w, 404, "patient not found")
		return
	}
	fm.JSON(w, map[string]string{"status": "ok"})
}

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------

type medication struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	TargetType    string `json:"target_type"`
	DefaultDosage string `json:"default_dosage"`
	Form          string `json:"form"`
	Notes         string `json:"notes"`
	CreatedAt     string `json:"created_at"`
}

func handleListMedications(w http.ResponseWriter, r *http.Request) {
	q := "SELECT id, name, target_type, default_dosage, form, notes, created_at FROM pt_medications"
	args := []any{}
	if tt := r.URL.Query().Get("target_type"); tt != "" {
		q += " WHERE target_type = ? OR target_type = 'universal'"
		args = append(args, tt)
	}
	q += " ORDER BY name"

	rows, err := db.Query(q, args...)
	if err != nil {
		fm.InternalError(w, "list medications", err)
		return
	}
	defer func() { _ = rows.Close() }()

	meds := []medication{}
	for rows.Next() {
		var m medication
		if err := rows.Scan(&m.ID, &m.Name, &m.TargetType, &m.DefaultDosage, &m.Form, &m.Notes, &m.CreatedAt); err != nil {
			fm.InternalError(w, "scan medication", err)
			return
		}
		meds = append(meds, m)
	}
	fm.JSON(w, meds)
}

func handleCreateMedication(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	var req struct {
		Name          string `json:"name"`
		TargetType    string `json:"target_type"`
		DefaultDosage string `json:"default_dosage"`
		Form          string `json:"form"`
		Notes         string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fm.HTTPError(w, 400, "invalid json")
		return
	}
	if req.Name == "" {
		fm.HTTPError(w, 400, "name required")
		return
	}
	if req.TargetType == "" {
		req.TargetType = "universal"
	}
	if req.Form == "" {
		req.Form = "tablet"
	}

	validTargetTypes := map[string]bool{"human": true, "animal": true, "universal": true}
	if !validTargetTypes[req.TargetType] {
		fm.HTTPError(w, 400, "target_type must be human, animal, or universal")
		return
	}
	validForms := map[string]bool{"tablet": true, "drops": true, "injection": true, "ointment": true}
	if !validForms[req.Form] {
		fm.HTTPError(w, 400, "form must be tablet, drops, injection, or ointment")
		return
	}

	var m medication
	err := db.QueryRow(
		`INSERT INTO pt_medications (name, target_type, default_dosage, form, notes) VALUES (?, ?, ?, ?, ?) RETURNING id, name, target_type, default_dosage, form, notes, created_at`,
		req.Name, req.TargetType, req.DefaultDosage, req.Form, req.Notes,
	).Scan(&m.ID, &m.Name, &m.TargetType, &m.DefaultDosage, &m.Form, &m.Notes, &m.CreatedAt)
	if err != nil {
		fm.InternalError(w, "create medication", err)
		return
	}
	fm.JSON(w, m)
}

func handleUpdateMedication(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	id := r.PathValue("id")
	var req struct {
		Name          string `json:"name"`
		TargetType    string `json:"target_type"`
		DefaultDosage string `json:"default_dosage"`
		Form          string `json:"form"`
		Notes         string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fm.HTTPError(w, 400, "invalid json")
		return
	}
	if req.Name == "" {
		fm.HTTPError(w, 400, "name required")
		return
	}

	var m medication
	err := db.QueryRow(
		`UPDATE pt_medications SET name = ?, target_type = ?, default_dosage = ?, form = ?, notes = ? WHERE id = ? RETURNING id, name, target_type, default_dosage, form, notes, created_at`,
		req.Name, req.TargetType, req.DefaultDosage, req.Form, req.Notes, id,
	).Scan(&m.ID, &m.Name, &m.TargetType, &m.DefaultDosage, &m.Form, &m.Notes, &m.CreatedAt)
	if err == sql.ErrNoRows {
		fm.HTTPError(w, 404, "medication not found")
		return
	}
	if err != nil {
		fm.InternalError(w, "update medication", err)
		return
	}
	fm.JSON(w, m)
}

func handleDeleteMedication(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	id := r.PathValue("id")
	res, err := db.Exec("DELETE FROM pt_medications WHERE id = ?", id)
	if err != nil {
		fm.InternalError(w, "delete medication", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fm.HTTPError(w, 404, "medication not found")
		return
	}
	fm.JSON(w, map[string]string{"status": "ok"})
}

// ---------------------------------------------------------------------------
// Prescriptions
// ---------------------------------------------------------------------------

type prescription struct {
	ID           string  `json:"id"`
	PatientID    string  `json:"patient_id"`
	MedicationID string  `json:"medication_id"`
	Dosage       string  `json:"dosage"`
	Status       string  `json:"status"`
	StartDate    string  `json:"start_date"`
	EndDate      *string `json:"end_date"`
	MealRelation string  `json:"meal_relation"`
	MealMinutes  int     `json:"meal_minutes"`
	DurationDays *int    `json:"duration_days"`
	CreatedAt    string  `json:"created_at"`
}

func handleListPrescriptions(w http.ResponseWriter, r *http.Request) {
	patientID := r.URL.Query().Get("patient_id")
	q := "SELECT id, patient_id, medication_id, dosage, status, start_date, end_date, meal_relation, meal_minutes, duration_days, created_at FROM pt_prescriptions"
	args := []any{}
	if patientID != "" {
		q += " WHERE patient_id = ?"
		args = append(args, patientID)
	}
	q += " ORDER BY created_at DESC"

	rows, err := db.Query(q, args...)
	if err != nil {
		fm.InternalError(w, "list prescriptions", err)
		return
	}
	defer func() { _ = rows.Close() }()

	prescriptions := []prescription{}
	for rows.Next() {
		var p prescription
		if err := rows.Scan(&p.ID, &p.PatientID, &p.MedicationID, &p.Dosage, &p.Status, &p.StartDate, &p.EndDate, &p.MealRelation, &p.MealMinutes, &p.DurationDays, &p.CreatedAt); err != nil {
			fm.InternalError(w, "scan prescription", err)
			return
		}
		prescriptions = append(prescriptions, p)
	}
	fm.JSON(w, prescriptions)
}

func handleCreatePrescription(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	var req struct {
		PatientID    string  `json:"patient_id"`
		MedicationID string  `json:"medication_id"`
		Dosage       string  `json:"dosage"`
		StartDate    string  `json:"start_date"`
		EndDate      *string `json:"end_date"`
		MealRelation string  `json:"meal_relation"`
		MealMinutes  int     `json:"meal_minutes"`
		DurationDays *int    `json:"duration_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fm.HTTPError(w, 400, "invalid json")
		return
	}
	if req.PatientID == "" || req.MedicationID == "" {
		fm.HTTPError(w, 400, "patient_id and medication_id required")
		return
	}

	// Default dosage from medication catalog
	if req.Dosage == "" {
		var dd string
		if err := db.QueryRow("SELECT default_dosage FROM pt_medications WHERE id = ?", req.MedicationID).Scan(&dd); err == nil {
			req.Dosage = dd
		}
	}
	if req.StartDate == "" {
		req.StartDate = time.Now().Format("2006-01-02")
	}
	if req.MealRelation == "" {
		req.MealRelation = "none"
	}
	validMealRelations := map[string]bool{"none": true, "before": true, "during": true, "after": true}
	if !validMealRelations[req.MealRelation] {
		fm.HTTPError(w, 400, "meal_relation must be none, before, during, or after")
		return
	}
	if req.MealMinutes == 0 {
		req.MealMinutes = 30
	}

	// Auto-calculate end_date from duration_days
	if req.DurationDays != nil && req.EndDate == nil {
		start, err := time.Parse("2006-01-02", req.StartDate)
		if err == nil {
			end := start.AddDate(0, 0, *req.DurationDays).Format("2006-01-02")
			req.EndDate = &end
		}
	}

	var p prescription
	err := db.QueryRow(
		`INSERT INTO pt_prescriptions (patient_id, medication_id, dosage, start_date, end_date, meal_relation, meal_minutes, duration_days)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 RETURNING id, patient_id, medication_id, dosage, status, start_date, end_date, meal_relation, meal_minutes, duration_days, created_at`,
		req.PatientID, req.MedicationID, req.Dosage, req.StartDate, req.EndDate,
		req.MealRelation, req.MealMinutes, req.DurationDays,
	).Scan(&p.ID, &p.PatientID, &p.MedicationID, &p.Dosage, &p.Status, &p.StartDate, &p.EndDate, &p.MealRelation, &p.MealMinutes, &p.DurationDays, &p.CreatedAt)
	if err != nil {
		fm.InternalError(w, "create prescription", err)
		return
	}
	fm.JSON(w, p)
}

func handleUpdatePrescription(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	id := r.PathValue("id")
	var req struct {
		Dosage       string  `json:"dosage"`
		Status       string  `json:"status"`
		EndDate      *string `json:"end_date"`
		MealRelation string  `json:"meal_relation"`
		MealMinutes  *int    `json:"meal_minutes"`
		DurationDays *int    `json:"duration_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fm.HTTPError(w, 400, "invalid json")
		return
	}
	validStatuses := map[string]bool{"active": true, "paused": true, "completed": true}
	if req.Status != "" && !validStatuses[req.Status] {
		fm.HTTPError(w, 400, "status must be active, paused, or completed")
		return
	}

	var p prescription
	err := db.QueryRow(
		`UPDATE pt_prescriptions SET
			dosage = CASE WHEN ? = '' THEN dosage ELSE ? END,
			status = CASE WHEN ? = '' THEN status ELSE ? END,
			end_date = ?,
			meal_relation = CASE WHEN ? = '' THEN meal_relation ELSE ? END,
			meal_minutes = CASE WHEN ? IS NULL THEN meal_minutes ELSE ? END,
			duration_days = ?
		 WHERE id = ?
		 RETURNING id, patient_id, medication_id, dosage, status, start_date, end_date, meal_relation, meal_minutes, duration_days, created_at`,
		req.Dosage, req.Dosage, req.Status, req.Status, req.EndDate,
		req.MealRelation, req.MealRelation, req.MealMinutes, req.MealMinutes,
		req.DurationDays, id,
	).Scan(&p.ID, &p.PatientID, &p.MedicationID, &p.Dosage, &p.Status, &p.StartDate, &p.EndDate, &p.MealRelation, &p.MealMinutes, &p.DurationDays, &p.CreatedAt)
	if err == sql.ErrNoRows {
		fm.HTTPError(w, 404, "prescription not found")
		return
	}
	if err != nil {
		fm.InternalError(w, "update prescription", err)
		return
	}
	fm.JSON(w, p)
}

func handleDeletePrescription(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	id := r.PathValue("id")
	res, err := db.Exec("DELETE FROM pt_prescriptions WHERE id = ?", id)
	if err != nil {
		fm.InternalError(w, "delete prescription", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fm.HTTPError(w, 404, "prescription not found")
		return
	}
	fm.JSON(w, map[string]string{"status": "ok"})
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

type schedule struct {
	ID             string   `json:"id"`
	PrescriptionID string   `json:"prescription_id"`
	Time           string   `json:"time"`
	Days           []string `json:"days"`
	Active         bool     `json:"active"`
	FrequencyType  string   `json:"frequency_type"`
	FrequencyValue int      `json:"frequency_value"`
	CourseOffDays  int      `json:"course_off_days"`
	CreatedAt      string   `json:"created_at"`
}

func handleListSchedules(w http.ResponseWriter, r *http.Request) {
	prescriptionID := r.URL.Query().Get("prescription_id")
	if prescriptionID == "" {
		fm.HTTPError(w, 400, "prescription_id required")
		return
	}
	rows, err := db.Query(
		"SELECT id, prescription_id, time, days, active, frequency_type, frequency_value, course_off_days, created_at FROM pt_schedules WHERE prescription_id = ? ORDER BY time",
		prescriptionID,
	)
	if err != nil {
		fm.InternalError(w, "list schedules", err)
		return
	}
	defer func() { _ = rows.Close() }()

	schedules := []schedule{}
	for rows.Next() {
		var s schedule
		var daysJSON string
		var active int
		if err := rows.Scan(&s.ID, &s.PrescriptionID, &s.Time, &daysJSON, &active, &s.FrequencyType, &s.FrequencyValue, &s.CourseOffDays, &s.CreatedAt); err != nil {
			fm.InternalError(w, "scan schedule", err)
			return
		}
		s.Active = active == 1
		_ = json.Unmarshal([]byte(daysJSON), &s.Days)
		if s.Days == nil {
			s.Days = []string{}
		}
		schedules = append(schedules, s)
	}
	fm.JSON(w, schedules)
}

var validFrequencyTypes = map[string]bool{
	"daily": true, "every_other_day": true, "every_n_hours": true,
	"every_n_days": true, "weekly": true, "biweekly": true,
	"monthly": true, "prn": true, "course": true,
}

func handleCreateSchedule(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	var req struct {
		PrescriptionID string   `json:"prescription_id"`
		Time           string   `json:"time"`
		Days           []string `json:"days"`
		FrequencyType  string   `json:"frequency_type"`
		FrequencyValue int      `json:"frequency_value"`
		CourseOffDays  int      `json:"course_off_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fm.HTTPError(w, 400, "invalid json")
		return
	}
	if req.PrescriptionID == "" || req.Time == "" {
		fm.HTTPError(w, 400, "prescription_id and time required")
		return
	}
	if !isValidTime(req.Time) {
		fm.HTTPError(w, 400, "time must be HH:MM format")
		return
	}
	if req.Days == nil {
		req.Days = []string{}
	}
	if !validateDays(req.Days) {
		fm.HTTPError(w, 400, "invalid day values")
		return
	}
	if req.FrequencyType == "" {
		req.FrequencyType = "daily"
	}
	if !validFrequencyTypes[req.FrequencyType] {
		fm.HTTPError(w, 400, "invalid frequency_type")
		return
	}

	daysJSON, _ := json.Marshal(req.Days)
	var s schedule
	var daysOut string
	var active int
	err := db.QueryRow(
		`INSERT INTO pt_schedules (prescription_id, time, days, frequency_type, frequency_value, course_off_days)
		 VALUES (?, ?, ?, ?, ?, ?)
		 RETURNING id, prescription_id, time, days, active, frequency_type, frequency_value, course_off_days, created_at`,
		req.PrescriptionID, req.Time, string(daysJSON), req.FrequencyType, req.FrequencyValue, req.CourseOffDays,
	).Scan(&s.ID, &s.PrescriptionID, &s.Time, &daysOut, &active, &s.FrequencyType, &s.FrequencyValue, &s.CourseOffDays, &s.CreatedAt)
	if err != nil {
		fm.InternalError(w, "create schedule", err)
		return
	}
	s.Active = active == 1
	_ = json.Unmarshal([]byte(daysOut), &s.Days)
	if s.Days == nil {
		s.Days = []string{}
	}

	// Generate doses for this new schedule immediately (skip prn — on-demand only)
	if req.FrequencyType != "prn" {
		generateDosesForSchedule(s.ID, req.Time, req.Days, req.FrequencyType, req.FrequencyValue, req.CourseOffDays)
	}

	fm.JSON(w, s)
}

func handleUpdateSchedule(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	id := r.PathValue("id")
	var req struct {
		Time           string   `json:"time"`
		Days           []string `json:"days"`
		Active         *bool    `json:"active"`
		FrequencyType  string   `json:"frequency_type"`
		FrequencyValue *int     `json:"frequency_value"`
		CourseOffDays  *int     `json:"course_off_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fm.HTTPError(w, 400, "invalid json")
		return
	}
	if req.Time != "" && !isValidTime(req.Time) {
		fm.HTTPError(w, 400, "time must be HH:MM format")
		return
	}
	if req.Days != nil && !validateDays(req.Days) {
		fm.HTTPError(w, 400, "invalid day values")
		return
	}
	if req.FrequencyType != "" && !validFrequencyTypes[req.FrequencyType] {
		fm.HTTPError(w, 400, "invalid frequency_type")
		return
	}

	daysJSON, _ := json.Marshal(req.Days)
	activeInt := 1
	if req.Active != nil && !*req.Active {
		activeInt = 0
	}

	var s schedule
	var daysOut string
	var activeOut int
	err := db.QueryRow(
		`UPDATE pt_schedules SET
			time = CASE WHEN ? = '' THEN time ELSE ? END,
			days = CASE WHEN ? = '[]' THEN days ELSE ? END,
			active = ?,
			frequency_type = CASE WHEN ? = '' THEN frequency_type ELSE ? END,
			frequency_value = CASE WHEN ? IS NULL THEN frequency_value ELSE ? END,
			course_off_days = CASE WHEN ? IS NULL THEN course_off_days ELSE ? END
		 WHERE id = ?
		 RETURNING id, prescription_id, time, days, active, frequency_type, frequency_value, course_off_days, created_at`,
		req.Time, req.Time, string(daysJSON), string(daysJSON), activeInt,
		req.FrequencyType, req.FrequencyType, req.FrequencyValue, req.FrequencyValue,
		req.CourseOffDays, req.CourseOffDays, id,
	).Scan(&s.ID, &s.PrescriptionID, &s.Time, &daysOut, &activeOut, &s.FrequencyType, &s.FrequencyValue, &s.CourseOffDays, &s.CreatedAt)
	if err == sql.ErrNoRows {
		fm.HTTPError(w, 404, "schedule not found")
		return
	}
	if err != nil {
		fm.InternalError(w, "update schedule", err)
		return
	}
	s.Active = activeOut == 1
	_ = json.Unmarshal([]byte(daysOut), &s.Days)
	if s.Days == nil {
		s.Days = []string{}
	}
	fm.JSON(w, s)
}

func handleDeleteSchedule(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	id := r.PathValue("id")
	res, err := db.Exec("DELETE FROM pt_schedules WHERE id = ?", id)
	if err != nil {
		fm.InternalError(w, "delete schedule", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fm.HTTPError(w, 404, "schedule not found")
		return
	}
	fm.JSON(w, map[string]string{"status": "ok"})
}

// ---------------------------------------------------------------------------
// Today's doses
// ---------------------------------------------------------------------------

type doseEntry struct {
	ID             string  `json:"id"`
	ScheduleID     string  `json:"schedule_id"`
	PlannedAt      string  `json:"planned_at"`
	GivenAt        *string `json:"given_at"`
	GivenBy        *string `json:"given_by"`
	GivenByName    *string `json:"given_by_name"`
	Status         string  `json:"status"`
	SkipReason     string  `json:"skip_reason"`
	MedicationName string  `json:"medication_name"`
	MedicationForm string  `json:"medication_form"`
	Dosage         string  `json:"dosage"`
	PatientID      string  `json:"patient_id"`
}

type todayResponse struct {
	Doses []doseEntry `json:"doses"`
	Given int         `json:"given"`
	Total int         `json:"total"`
}

func handleToday(w http.ResponseWriter, r *http.Request) {
	patientID := r.URL.Query().Get("patient")
	if patientID == "" {
		fm.HTTPError(w, 400, "patient query param required")
		return
	}

	targetDate := time.Now().Format("2006-01-02")
	if d := r.URL.Query().Get("date"); d != "" {
		parsed, err := time.Parse("2006-01-02", d)
		if err != nil {
			fm.HTTPError(w, 400, "date must be YYYY-MM-DD format")
			return
		}
		now := time.Now()
		diff := parsed.Sub(now)
		if diff < -7*24*time.Hour || diff > 7*24*time.Hour {
			fm.HTTPError(w, 400, "date must be within 7 days of today")
			return
		}
		targetDate = d
		// Ensure doses exist for the requested date
		generateDosesForDate(parsed)
	}

	rows, err := db.Query(`
		SELECT dl.id, dl.schedule_id, dl.planned_at, dl.given_at, dl.given_by, dl.given_by_name,
		       dl.status, dl.skip_reason,
		       m.name, m.form, p.dosage, p.patient_id
		FROM pt_dose_logs dl
		JOIN pt_schedules s ON s.id = dl.schedule_id
		JOIN pt_prescriptions p ON p.id = s.prescription_id
		JOIN pt_medications m ON m.id = p.medication_id
		WHERE p.patient_id = ? AND date(dl.planned_at) = ?
		ORDER BY dl.planned_at`,
		patientID, targetDate,
	)
	if err != nil {
		fm.InternalError(w, "query today", err)
		return
	}
	defer func() { _ = rows.Close() }()

	resp := todayResponse{Doses: []doseEntry{}}
	for rows.Next() {
		var d doseEntry
		if err := rows.Scan(&d.ID, &d.ScheduleID, &d.PlannedAt, &d.GivenAt, &d.GivenBy, &d.GivenByName,
			&d.Status, &d.SkipReason, &d.MedicationName, &d.MedicationForm, &d.Dosage, &d.PatientID); err != nil {
			fm.InternalError(w, "scan dose", err)
			return
		}
		// Compute live status
		d.Status = computeStatus(d.Status, d.PlannedAt, d.GivenAt)
		resp.Doses = append(resp.Doses, d)
		resp.Total++
		if d.Status == "given" {
			resp.Given++
		}
	}
	fm.JSON(w, resp)
}

func handleGiveDose(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	id := r.PathValue("id")

	userName := r.Header.Get("X-Focus-User-Name")
	userID := r.Header.Get("X-Focus-User-ID")

	now := time.Now().UTC().Format("2006-01-02T15:04:05Z")
	res, err := db.Exec(
		`UPDATE pt_dose_logs SET status = 'given', given_at = ?, given_by = ?, given_by_name = ? WHERE id = ? AND status IN ('pending', 'overdue')`,
		now, userID, userName, id,
	)
	if err != nil {
		fm.InternalError(w, "give dose", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fm.HTTPError(w, 404, "dose not found or already processed")
		return
	}

	// Get medication info for broadcast
	var medName, patientID string
	_ = db.QueryRow(`
		SELECT m.name, p.patient_id FROM pt_dose_logs dl
		JOIN pt_schedules s ON s.id = dl.schedule_id
		JOIN pt_prescriptions p ON p.id = s.prescription_id
		JOIN pt_medications m ON m.id = p.medication_id
		WHERE dl.id = ?`, id,
	).Scan(&medName, &patientID)

	app.Broadcast("dose.given", map[string]any{
		"dose_id":         id,
		"patient_id":      patientID,
		"medication_name": medName,
		"given_by":        userName,
	})
	fm.JSON(w, map[string]string{"status": "ok"})
}

func handleSkipDose(w http.ResponseWriter, r *http.Request) {
	if !fm.RequireRole(w, r, fm.RoleResident) {
		return
	}
	id := r.PathValue("id")
	var req struct {
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	res, err := db.Exec(
		`UPDATE pt_dose_logs SET status = 'skipped', skip_reason = ? WHERE id = ? AND status IN ('pending', 'overdue')`,
		req.Reason, id,
	)
	if err != nil {
		fm.InternalError(w, "skip dose", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		fm.HTTPError(w, 404, "dose not found or already processed")
		return
	}

	app.Broadcast("dose.skipped", map[string]any{
		"dose_id": id,
		"reason":  req.Reason,
	})
	fm.JSON(w, map[string]string{"status": "ok"})
}

func handleHistory(w http.ResponseWriter, r *http.Request) {
	patientID := r.URL.Query().Get("patient")
	if patientID == "" {
		fm.HTTPError(w, 400, "patient query param required")
		return
	}
	days := 7
	if d := r.URL.Query().Get("days"); d != "" {
		if n, err := strconv.Atoi(d); err == nil && n > 0 && n <= 90 {
			days = n
		}
	}

	rows, err := db.Query(`
		SELECT dl.id, dl.schedule_id, dl.planned_at, dl.given_at, dl.given_by, dl.given_by_name,
		       dl.status, dl.skip_reason,
		       m.name, m.form, p.dosage, p.patient_id
		FROM pt_dose_logs dl
		JOIN pt_schedules s ON s.id = dl.schedule_id
		JOIN pt_prescriptions p ON p.id = s.prescription_id
		JOIN pt_medications m ON m.id = p.medication_id
		WHERE p.patient_id = ? AND dl.planned_at >= datetime('now', ?)
		ORDER BY dl.planned_at DESC`,
		patientID, fmt.Sprintf("-%d days", days),
	)
	if err != nil {
		fm.InternalError(w, "query history", err)
		return
	}
	defer func() { _ = rows.Close() }()

	entries := []doseEntry{}
	for rows.Next() {
		var d doseEntry
		if err := rows.Scan(&d.ID, &d.ScheduleID, &d.PlannedAt, &d.GivenAt, &d.GivenBy, &d.GivenByName,
			&d.Status, &d.SkipReason, &d.MedicationName, &d.MedicationForm, &d.Dosage, &d.PatientID); err != nil {
			fm.InternalError(w, "scan history", err)
			return
		}
		entries = append(entries, d)
	}
	fm.JSON(w, entries)
}

// ---------------------------------------------------------------------------
// Dose generation (ticker)
// ---------------------------------------------------------------------------

func dosesTicker() {
	// Initial generation after brief delay (let server start first)
	time.Sleep(2 * time.Second)
	generateDoses()
	markOverdueDoses()

	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		generateDoses()
		markOverdueDoses()
	}
}

func generateDoses() {
	now := time.Now()
	// Generate doses for today + 7 days ahead
	for i := 0; i < 8; i++ {
		generateDosesForDate(now.AddDate(0, 0, i))
	}
}

func generateDosesForDate(date time.Time) {
	dateStr := date.Format("2006-01-02")
	dayOfWeek := strings.ToLower(date.Format("Mon"))[:3] // mon, tue, wed, ...

	// Collect schedules first, then close rows before doing inserts (MaxOpenConns=1)
	type schedEntry struct {
		id             string
		time           string
		days           string
		frequencyType  string
		frequencyValue int
		courseOffDays  int
		startDate      string
	}

	rows, err := db.Query(`
		SELECT s.id, s.time, s.days, s.frequency_type, s.frequency_value, s.course_off_days, p.start_date
		FROM pt_schedules s
		JOIN pt_prescriptions p ON p.id = s.prescription_id
		WHERE p.status = 'active' AND s.active = 1
		  AND (p.end_date IS NULL OR p.end_date >= ?)
		  AND p.start_date <= ?`,
		dateStr, dateStr,
	)
	if err != nil {
		log.Printf("generate doses for %s: query schedules: %v", dateStr, err)
		return
	}

	var entries []schedEntry
	for rows.Next() {
		var e schedEntry
		if err := rows.Scan(&e.id, &e.time, &e.days, &e.frequencyType, &e.frequencyValue, &e.courseOffDays, &e.startDate); err != nil {
			log.Printf("generate doses for %s: scan: %v", dateStr, err)
			continue
		}
		entries = append(entries, e)
	}
	_ = rows.Close()

	for _, e := range entries {
		if !shouldGenerateDose(e.frequencyType, e.frequencyValue, e.courseOffDays, e.days, e.startDate, date, dayOfWeek) {
			continue
		}

		if e.frequencyType == "every_n_hours" && e.frequencyValue > 0 {
			// Generate multiple doses throughout the day
			for h := 0; h < 24; h += e.frequencyValue {
				plannedAt := fmt.Sprintf("%sT%02d:00:00Z", dateStr, h)
				_, err := db.Exec(`INSERT OR IGNORE INTO pt_dose_logs (schedule_id, planned_at) VALUES (?, ?)`, e.id, plannedAt)
				if err != nil {
					log.Printf("generate doses for %s: insert: %v", dateStr, err)
				}
			}
		} else {
			plannedAt := dateStr + "T" + e.time + ":00Z"
			_, err := db.Exec(`INSERT OR IGNORE INTO pt_dose_logs (schedule_id, planned_at) VALUES (?, ?)`, e.id, plannedAt)
			if err != nil {
				log.Printf("generate doses for %s: insert: %v", dateStr, err)
			}
		}
	}
}

// shouldGenerateDose determines if a dose should be generated for the given date
// based on frequency type and schedule configuration.
func shouldGenerateDose(freqType string, freqValue, courseOffDays int, daysJSON, startDateStr string, date time.Time, dayOfWeek string) bool {
	var days []string
	_ = json.Unmarshal([]byte(daysJSON), &days)

	switch freqType {
	case "daily", "every_n_hours":
		// If specific days are set, check day of week
		if len(days) > 0 && !containsDay(days, dayOfWeek) {
			return false
		}
		return true

	case "every_other_day":
		startDate, err := time.Parse("2006-01-02", startDateStr)
		if err != nil {
			return false
		}
		daysSinceStart := int(date.Sub(startDate).Hours() / 24)
		return daysSinceStart%2 == 0

	case "every_n_days":
		if freqValue <= 0 {
			return true
		}
		startDate, err := time.Parse("2006-01-02", startDateStr)
		if err != nil {
			return false
		}
		daysSinceStart := int(date.Sub(startDate).Hours() / 24)
		return daysSinceStart%freqValue == 0

	case "weekly":
		if len(days) > 0 {
			return containsDay(days, dayOfWeek)
		}
		// Default: same weekday as start
		startDate, err := time.Parse("2006-01-02", startDateStr)
		if err != nil {
			return false
		}
		return date.Weekday() == startDate.Weekday()

	case "biweekly":
		startDate, err := time.Parse("2006-01-02", startDateStr)
		if err != nil {
			return false
		}
		daysSinceStart := int(date.Sub(startDate).Hours() / 24)
		weeksSinceStart := daysSinceStart / 7
		if weeksSinceStart%2 != 0 {
			return false
		}
		if len(days) > 0 {
			return containsDay(days, dayOfWeek)
		}
		return date.Weekday() == startDate.Weekday()

	case "monthly":
		if freqValue > 0 {
			return date.Day() == freqValue
		}
		// Default: same day of month as start
		startDate, err := time.Parse("2006-01-02", startDateStr)
		if err != nil {
			return false
		}
		return date.Day() == startDate.Day()

	case "course":
		if freqValue <= 0 {
			return true
		}
		startDate, err := time.Parse("2006-01-02", startDateStr)
		if err != nil {
			return false
		}
		daysSinceStart := int(date.Sub(startDate).Hours() / 24)
		cycleLen := freqValue + courseOffDays
		if cycleLen <= 0 {
			return true
		}
		dayInCycle := daysSinceStart % cycleLen
		return dayInCycle < freqValue // active phase

	case "prn":
		return false // on-demand only, never auto-generate

	default:
		// Unknown type — fallback to daily with day filter
		if len(days) > 0 && !containsDay(days, dayOfWeek) {
			return false
		}
		return true
	}
}

func generateDosesForSchedule(schedID, schedTime string, days []string, freqType string, freqValue, courseOffDays int) {
	// Look up prescription start_date for this schedule
	var startDateStr string
	err := db.QueryRow(`
		SELECT p.start_date FROM pt_schedules s
		JOIN pt_prescriptions p ON p.id = s.prescription_id
		WHERE s.id = ?`, schedID,
	).Scan(&startDateStr)
	if err != nil {
		startDateStr = time.Now().Format("2006-01-02")
	}

	daysJSON, _ := json.Marshal(days)
	now := time.Now()
	for i := 0; i < 8; i++ {
		date := now.AddDate(0, 0, i)
		dateStr := date.Format("2006-01-02")
		dayOfWeek := strings.ToLower(date.Format("Mon"))[:3]

		if !shouldGenerateDose(freqType, freqValue, courseOffDays, string(daysJSON), startDateStr, date, dayOfWeek) {
			continue
		}

		if freqType == "every_n_hours" && freqValue > 0 {
			for h := 0; h < 24; h += freqValue {
				plannedAt := fmt.Sprintf("%sT%02d:00:00Z", dateStr, h)
				_, err := db.Exec(`INSERT OR IGNORE INTO pt_dose_logs (schedule_id, planned_at) VALUES (?, ?)`, schedID, plannedAt)
				if err != nil {
					log.Printf("generate dose for schedule %s on %s: %v", schedID, dateStr, err)
				}
			}
		} else {
			plannedAt := dateStr + "T" + schedTime + ":00Z"
			_, err := db.Exec(`INSERT OR IGNORE INTO pt_dose_logs (schedule_id, planned_at) VALUES (?, ?)`, schedID, plannedAt)
			if err != nil {
				log.Printf("generate dose for schedule %s on %s: %v", schedID, dateStr, err)
			}
		}
	}
}

func markOverdueDoses() {
	threshold := time.Now().Add(-30 * time.Minute).UTC().Format("2006-01-02T15:04:05Z")
	res, err := db.Exec(
		`UPDATE pt_dose_logs SET status = 'overdue' WHERE status = 'pending' AND planned_at < ?`,
		threshold,
	)
	if err != nil {
		log.Printf("mark overdue: %v", err)
		return
	}
	if n, _ := res.RowsAffected(); n > 0 {
		app.Broadcast("dose.overdue", map[string]any{"count": n})
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func computeStatus(dbStatus, plannedAt string, givenAt *string) string {
	if dbStatus == "given" || dbStatus == "skipped" {
		return dbStatus
	}
	if givenAt != nil {
		return "given"
	}
	planned, err := time.Parse("2006-01-02T15:04:05Z", plannedAt)
	if err != nil {
		return dbStatus
	}
	now := time.Now().UTC()
	if now.Sub(planned) > 30*time.Minute {
		return "overdue"
	}
	return "pending"
}

func isValidTime(t string) bool {
	parts := strings.Split(t, ":")
	if len(parts) != 2 {
		return false
	}
	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	return err1 == nil && err2 == nil && h >= 0 && h <= 23 && m >= 0 && m <= 59
}

var validDaysSet = map[string]bool{
	"mon": true, "tue": true, "wed": true, "thu": true,
	"fri": true, "sat": true, "sun": true,
}

func validateDays(days []string) bool {
	for _, d := range days {
		if !validDaysSet[strings.ToLower(d)] {
			return false
		}
	}
	return true
}

func containsDay(days []string, day string) bool {
	for _, d := range days {
		if strings.EqualFold(d, day) {
			return true
		}
	}
	return false
}
