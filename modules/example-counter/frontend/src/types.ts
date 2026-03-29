import type { CSSProperties } from 'react'
import type { Root } from 'react-dom/client'

export interface FocusInstance {
  ready(): void
  api<T = unknown>(method: string, path: string, body?: unknown): Promise<T>
  getSettings<T = Record<string, unknown>>(): Promise<T>
  getWidgetId(): string
  on(event: string, callback: (payload: unknown) => void): () => void
}

export interface FocusSDKGlobal {
  create(host: HTMLElement): FocusInstance
}

declare global {
  interface Window {
    FocusSDK: FocusSDKGlobal
    React: typeof import('react')
    ReactDOM: { createRoot: typeof import('react-dom/client').createRoot }
  }
}

export interface WidgetProps {
  focus: FocusInstance
}

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

export type Styles = Record<string, CSSProperties>

/** Base class for widget custom elements with React root. */
export class ReactWidgetElement extends HTMLElement {
  _root: Root | null = null

  disconnectedCallback() {
    if (this._root) {
      this._root.unmount()
      this._root = null
    }
  }
}
