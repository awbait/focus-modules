import type { FocusSDKGlobal } from '@focus-dashboard/sdk-types'

declare global {
  interface Window {
    FocusSDK: FocusSDKGlobal
    React: typeof import('react')
    ReactDOM: { createRoot: typeof import('react-dom/client').createRoot }
  }
}
