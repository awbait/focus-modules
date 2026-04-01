#!/usr/bin/env bun
/**
 * focus-build — standard build script for Focus Dashboard modules.
 *
 * Bundles widget.js (from src/index.ts) and optionally settings.js
 * (from src/settings.tsx) into dist/. React is marked as external —
 * the host app provides it via an import map.
 */

import { existsSync } from 'node:fs'

const external = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime']

async function bundle(entrypoint: string, outName: string) {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir: 'dist',
    naming: outName,
    format: 'esm',
    target: 'browser',
    minify: false,
    external,
  })

  if (!result.success) {
    console.error(`${outName} build failed:`)
    for (const msg of result.logs) console.error(msg)
    process.exit(1)
  }
  console.log(`  -> ${outName} (${(result.outputs[0].size / 1024).toFixed(1)} KB)`)
}

await bundle('src/index.ts', 'widget.js')

if (existsSync('src/settings.tsx')) {
  await bundle('src/settings.tsx', 'settings.js')
}
