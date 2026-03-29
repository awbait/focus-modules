/**
 * Build script for example-counter module.
 *
 * Bundles TSX sources into widget.js and settings.js that use window.React
 * and window.ReactDOM at runtime (provided by the host app).
 */

const REACT_SHIM = `
const React = window.React;
const {createElement, Fragment, useState, useEffect, useCallback, useMemo, useRef} = React;
export default React;
export {createElement, Fragment, useState, useEffect, useCallback, useMemo, useRef};
`

const REACT_DOM_SHIM = `
const ReactDOM = window.ReactDOM;
export const createRoot = ReactDOM.createRoot;
export default ReactDOM;
`

const reactGlobalsPlugin = {
  name: 'react-globals',
  setup(build: any) {
    build.onResolve({ filter: /^react$/ }, () => ({
      path: 'react',
      namespace: 'react-shim',
    }))
    build.onLoad({ filter: /.*/, namespace: 'react-shim' }, () => ({
      contents: REACT_SHIM,
      loader: 'js',
    }))

    build.onResolve({ filter: /^react-dom\/client$/ }, () => ({
      path: 'react-dom/client',
      namespace: 'react-dom-shim',
    }))
    build.onLoad({ filter: /.*/, namespace: 'react-dom-shim' }, () => ({
      contents: REACT_DOM_SHIM,
      loader: 'js',
    }))

    build.onResolve({ filter: /^react-dom$/ }, () => ({
      path: 'react-dom',
      namespace: 'react-dom-shim',
    }))
  },
}

// Build widget.js
const widgetResult = await Bun.build({
  entrypoints: ['src/index.ts'],
  outdir: 'dist',
  naming: 'widget.js',
  format: 'esm',
  target: 'browser',
  minify: false,
  plugins: [reactGlobalsPlugin],
})

if (!widgetResult.success) {
  console.error('widget.js build failed:')
  for (const msg of widgetResult.logs) console.error(msg)
  process.exit(1)
}
console.log(`  -> widget.js built (${(widgetResult.outputs[0].size / 1024).toFixed(1)} KB)`)

// Build settings.js
const settingsResult = await Bun.build({
  entrypoints: ['src/settings.tsx'],
  outdir: 'dist',
  naming: 'settings.js',
  format: 'esm',
  target: 'browser',
  minify: false,
  plugins: [reactGlobalsPlugin],
})

if (!settingsResult.success) {
  console.error('settings.js build failed:')
  for (const msg of settingsResult.logs) console.error(msg)
  process.exit(1)
}
console.log(`  -> settings.js built (${(settingsResult.outputs[0].size / 1024).toFixed(1)} KB)`)
