export type {
  FocusInstance,
  FocusSDKGlobal,
  Styles,
  WidgetProps,
} from '@focus-dashboard/sdk-types'

// ---------------------------------------------------------------------------
// Module-specific types
// ---------------------------------------------------------------------------

export interface ValueResponse {
  value: number
  delta?: number
}

export interface HistoryEntry {
  id: number
  value: number
  delta: number
  created_at: string
}

export interface WidgetSettings {
  step: number
}
