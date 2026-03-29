/**
 * Build script for example-counter widget.
 *
 * Bundles TSX sources into a single widget.js that uses window.React
 * and window.ReactDOM at runtime (provided by the host app).
 */

const REACT_SHIM = `
const React = window.React;
const {createElement, Fragment, useState, useEffect, useCallback, useMemo, useRef} = React;
export default React;
export {createElement, Fragment, useState, useEffect, useCallback, useMemo, useRef};
`

const REACT_JSX_SHIM = `
const React = window.React;
export const jsx = React.createElement;
export const jsxs = React.createElement;
export const jsxDEV = React.createElement;
export const Fragment = React.Fragment;
`

const REACT_DOM_SHIM = `
const ReactDOM = window.ReactDOM;
export const createRoot = ReactDOM.createRoot;
export default ReactDOM;
`

const result = await Bun.build({
  entrypoints: ['src/index.ts'],
  outdir: 'dist',
  naming: 'widget.js',
  format: 'esm',
  target: 'browser',
  minify: false,
  plugins: [
    {
      name: 'react-globals',
      setup(build) {
        // Map react imports to window globals
        build.onResolve({ filter: /^react$/ }, () => ({
          path: 'react',
          namespace: 'react-shim',
        }))
        build.onLoad({ filter: /.*/, namespace: 'react-shim' }, () => ({
          contents: REACT_SHIM,
          loader: 'js',
        }))

        build.onResolve({ filter: /^react\/jsx(-dev)?-runtime$/ }, () => ({
          path: 'react/jsx-runtime',
          namespace: 'react-jsx-shim',
        }))
        build.onLoad({ filter: /.*/, namespace: 'react-jsx-shim' }, () => ({
          contents: REACT_JSX_SHIM,
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
    },
  ],
})

if (!result.success) {
  console.error('Build failed:')
  for (const msg of result.logs) {
    console.error(msg)
  }
  process.exit(1)
}

console.log(`  -> widget.js built (${(result.outputs[0].size / 1024).toFixed(1)} KB)`)
