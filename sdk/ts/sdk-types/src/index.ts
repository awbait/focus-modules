import type { CSSProperties } from 'react'
import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

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

  /** Get the list of platform users (public info). Cached after first call. */
  getUsers(): Promise<FocusPublicUser[]>

  /**
   * Check if the current user has the required permission level.
   * Uses role hierarchy: guest < resident < owner.
   * - `'read'`  → guest+
   * - `'write'` → resident+
   * - `'admin'` → owner only
   */
  can(action: FocusAction): Promise<boolean>

  /**
   * Return a container element for portals (Radix, React createPortal, etc.).
   * When the widget runs inside a host Dialog, portals should render
   * into this container so that clicks are not detected as "outside".
   * Returns `null` when no container is available (standalone context).
   */
  getPortalContainer(): HTMLElement | null
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

/** Public user info returned by getUsers(). */
export interface FocusPublicUser {
  id: string
  name: string
  avatar: string
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
 * Handles React root lifecycle (unmount on disconnect).
 * Prefer using {@link registerWidget} instead of subclassing directly.
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

// ---------------------------------------------------------------------------
// PortalContainerContext — portal target for nested dialogs
// ---------------------------------------------------------------------------

/**
 * React Context that holds a container element for portals.
 *
 * When a module widget renders inside a host Dialog (e.g. settings panel),
 * portals must render into a container that lives inside the host Dialog
 * DOM — otherwise clicks are detected as "outside" and close the host.
 *
 * Works with Radix (`container` prop), React `createPortal`, or any
 * library that accepts a portal target element.
 *
 * The SDK sets this automatically via `registerWidget`. Module components
 * read it via `usePortalContainer()`.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null)

/**
 * Return the portal container element from context, or `null` if none.
 * Use in any component that renders a portal (Radix, createPortal, etc.)
 * to redirect content into the correct DOM subtree.
 */
export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext)
}

// ---------------------------------------------------------------------------
// registerWidget — one-line widget registration
// ---------------------------------------------------------------------------

/**
 * Register a React component as a custom element widget.
 *
 * Handles FocusSDK initialization, React root creation, and cleanup.
 * Automatically wraps the component in `PortalContainerContext.Provider`.
 *
 * ```ts
 * registerWidget('my-module-counter', CounterApp)
 * registerWidget('my-module-settings', SettingsApp)
 * ```
 */
export function registerWidget(tagName: string, Component: (props: WidgetProps) => any) {
  const Cls = class extends ReactWidgetElement {
    connectedCallback() {
      const focus = (window as any).FocusSDK.create(this)
      const container = focus.getPortalContainer?.() ?? null
      this._root = createRoot(this)
      this._root.render(
        createElement(
          PortalContainerContext.Provider,
          { value: container },
          createElement(Component, { focus }),
        ),
      )
    }
  }
  customElements.define(tagName, Cls)
}

// ---------------------------------------------------------------------------
// usePermission — reactive permission check hook
// ---------------------------------------------------------------------------

/**
 * Reactive permission check. Returns `true` if the current user has
 * the required permission level. Automatically resets on logout
 * (`auth:unauthorized` event) and re-checks on window focus.
 *
 * ```tsx
 * const canWrite = usePermission(focus, 'write')
 * const canAdmin = usePermission(focus, 'admin')
 * ```
 */
export function usePermission(focus: FocusInstance, action: FocusAction): boolean {
  const [allowed, setAllowed] = useState(false)

  const check = useCallback(() => {
    focus
      .can(action)
      .then(setAllowed)
      .catch(() => setAllowed(false))
  }, [focus, action])

  useEffect(() => {
    check()
  }, [check])

  useEffect(() => {
    const onLogout = () => setAllowed(false)
    const onFocus = () => check()
    window.addEventListener('auth:unauthorized', onLogout)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('auth:unauthorized', onLogout)
      window.removeEventListener('focus', onFocus)
    }
  }, [check])

  return allowed
}

// ---------------------------------------------------------------------------
// baseStyles — shared widget styles
// ---------------------------------------------------------------------------

/** Base styles shared across all widgets. */
export const baseStyles = {
  /** Common widget container: font family and text color. */
  widget: {
    fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
    color: 'var(--foreground)',
  },
  /** Disabled state for interactive elements. */
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    pointerEvents: 'none' as const,
  },
} satisfies Record<string, CSSProperties>
