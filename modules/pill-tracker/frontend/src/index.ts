import type { FocusModuleApi } from '@focus-dashboard/sdk-types'

export function setup(api: FocusModuleApi) {
  api.registerWidget(() => import('./today-widget'), { defaultSize: [2, 2] })
  api.registerSettings(() => import('./settings'))
}
