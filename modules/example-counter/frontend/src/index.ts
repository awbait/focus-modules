import type { FocusModuleApi } from '@focus-dashboard/sdk-types'

export function setup(api: FocusModuleApi) {
  api.registerWidget(() => import('./counter-widget'))
  api.registerWidget(() => import('./chart-widget'))
  api.registerSettings(() => import('./settings'))
}
