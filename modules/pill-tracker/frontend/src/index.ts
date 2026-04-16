import type { FocusModuleApi } from '@focus-dashboard/module-sdk'

export function setup(api: FocusModuleApi) {
  api.registerWidget(() => import('./today-widget'), { defaultSize: [2, 2] })
  api.registerSettings(() => import('./settings'))
}
