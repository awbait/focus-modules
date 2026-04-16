import type { FocusModuleApi } from '@focus-dashboard/module-sdk'

export function setup(api: FocusModuleApi) {
  api.registerWidget(() => import('./counter-widget'))
  api.registerWidget(() => import('./chart-widget'))
  api.registerSettings(() => import('./settings'))
}
