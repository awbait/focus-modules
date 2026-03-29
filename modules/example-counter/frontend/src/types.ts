import type { Root } from 'react-dom/client'

export type {
  FocusInstance,
  FocusSDKGlobal,
  WidgetProps,
  Styles,
} from '@focus-dashboard/sdk-types'

// ---------------------------------------------------------------------------
// ReactWidgetElement — base class for custom element wrappers
// ---------------------------------------------------------------------------

export class ReactWidgetElement extends HTMLElement {
  _root: Root | null = null

  disconnectedCallback() {
    if (this._root) {
      this._root.unmount()
      this._root = null
    }
  }
}

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
