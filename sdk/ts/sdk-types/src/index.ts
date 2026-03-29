import type { CSSProperties } from 'react'

// ---------------------------------------------------------------------------
// Core SDK interfaces
// ---------------------------------------------------------------------------

/**
 * A host-bound SDK instance returned by `window.FocusSDK.create(element)`.
 *
 * Provides API access, WebSocket subscriptions, widget settings, and
 * lifecycle signalling for dynamic module widgets.
 */
export interface FocusInstance {
  /** Signal that the widget has finished its initial render. */
  ready(): void

  /**
   * Make an API request to the widget's own module backend.
   * Path is auto-prefixed with `/api/modules/{moduleId}/api/`.
   */
  api<T = unknown>(method: string, path: string, body?: unknown): Promise<T>

  /** Fetch per-instance widget settings from the module backend. */
  getSettings<T = Record<string, unknown>>(): Promise<T>

  /** Return the widget instance ID (`data-widget-id` attribute). */
  getWidgetId(): string

  /**
   * Subscribe to WebSocket events for this module.
   * Events are filtered by `{moduleId}.{event}`.
   * @returns Unsubscribe function.
   */
  on(event: string, callback: (payload: unknown) => void): () => void

  /**
   * Translate a key using the module's i18n namespace.
   * Keys are resolved within the module's locale bundle.
   * Example: `focus.t('widget.counter.title')` → looks up `{moduleId}:widget.counter.title`
   */
  t(key: string, params?: Record<string, unknown>): string

  /** Get the current authenticated user. Cached after first call. */
  getUser(): Promise<FocusUser>

  /**
   * Check if the current user has the required permission level.
   * Uses role hierarchy: guest < resident < owner.
   * - `'read'`  → guest+
   * - `'write'` → resident+
   * - `'admin'` → owner only
   */
  can(action: FocusAction): Promise<boolean>
}

/** Global SDK object exposed as `window.FocusSDK`. */
export interface FocusSDKGlobal {
  /** Create an SDK instance bound to a host custom element. */
  create(host: HTMLElement): FocusInstance
}

// ---------------------------------------------------------------------------
// Auth / RBAC
// ---------------------------------------------------------------------------

/** Current authenticated user info. */
export interface FocusUser {
  id: string
  name: string
  role: 'owner' | 'resident' | 'guest'
}

/** Predefined permission levels mapped to role hierarchy. */
export type FocusAction = 'read' | 'write' | 'admin'

// ---------------------------------------------------------------------------
// Widget helpers
// ---------------------------------------------------------------------------

/** Common props for a React widget component. */
export interface WidgetProps {
  focus: FocusInstance
}

/** Convenience alias for inline React style objects. */
export type Styles = Record<string, CSSProperties>

// ---------------------------------------------------------------------------
// ReactWidgetElement — base class for custom element wrappers
// ---------------------------------------------------------------------------

/**
 * Base class for React-powered custom elements.
 *
 * Handles React root lifecycle (unmount on disconnect). Subclass and
 * implement `connectedCallback()` to create the root and render:
 *
 * ```ts
 * class MyWidget extends ReactWidgetElement {
 *   connectedCallback() {
 *     const focus = window.FocusSDK.create(this)
 *     this._root = createRoot(this)
 *     this._root.render(<App focus={focus} />)
 *   }
 * }
 * customElements.define('my-module-widget', MyWidget)
 * ```
 */
export class ReactWidgetElement extends HTMLElement {
  _root: import('react-dom/client').Root | null = null

  disconnectedCallback() {
    if (this._root) {
      this._root.unmount()
      this._root = null
    }
  }
}
