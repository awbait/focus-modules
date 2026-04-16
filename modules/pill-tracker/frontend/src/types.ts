export type {
  FocusInstance,
  FocusSDKGlobal,
  Styles,
  WidgetProps,
} from '@focus-dashboard/module-sdk'

// Types available at runtime but not yet in published sdk-types
export interface FocusPublicUser {
  id: string
  name: string
  display_name?: string
  username?: string
  avatar: string
}

// ---------------------------------------------------------------------------
// Module-specific types
// ---------------------------------------------------------------------------

export type PatientType = 'human' | 'animal'
export type MedicationForm = 'tablet' | 'drops' | 'injection' | 'ointment'
export type DoseStatus = 'pending' | 'given' | 'skipped' | 'overdue'
export type PrescriptionStatus = 'active' | 'paused' | 'completed'
export type MealRelation = 'none' | 'before' | 'during' | 'after'
export type FrequencyType =
  | 'daily'
  | 'every_other_day'
  | 'every_n_hours'
  | 'every_n_days'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'prn'
  | 'course'

export interface Patient {
  id: string
  name: string
  type: PatientType
  avatar: string
  linked_user_id: string | null
  created_at: string
}

export interface Medication {
  id: string
  name: string
  target_type: string
  default_dosage: string
  form: MedicationForm
  notes: string
  created_at: string
}

export interface Prescription {
  id: string
  patient_id: string
  medication_id: string
  dosage: string
  status: PrescriptionStatus
  start_date: string
  end_date: string | null
  meal_relation: MealRelation
  meal_minutes: number
  duration_days: number | null
  created_at: string
}

export interface Schedule {
  id: string
  prescription_id: string
  time: string
  days: string[]
  active: boolean
  frequency_type: FrequencyType
  frequency_value: number
  course_off_days: number
  created_at: string
}

export interface DoseEntry {
  id: string
  schedule_id: string
  planned_at: string
  given_at: string | null
  given_by: string | null
  given_by_name: string | null
  status: DoseStatus
  skip_reason: string
  medication_name: string
  medication_form: MedicationForm
  dosage: string
  patient_id: string
  meal_relation: MealRelation
  meal_minutes: number
}

export interface TodayResponse {
  doses: DoseEntry[]
  given: number
  total: number
}

export interface WidgetSettings {
  patient_id?: string
}
