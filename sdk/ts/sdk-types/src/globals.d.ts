import type { FocusSDKGlobal } from './index'

declare global {
  interface Window {
    FocusSDK: FocusSDKGlobal
    React: typeof import('react')
    ReactDOM: { createRoot: typeof import('react-dom/client').createRoot }
  }
}
