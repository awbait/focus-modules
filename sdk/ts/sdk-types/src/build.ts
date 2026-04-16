#!/usr/bin/env bun
/**
 * focus-build — standard build script for Focus Dashboard modules.
 *
 * Bundles src/index.ts into dist/module.js. The entry must export a
 * `setup(api: FocusModuleApi)` function. Bun automatically code-splits
 * dynamic imports into separate chunks.
 *
 * React is marked as external — the host app provides it via an import map.
 */

const external = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime']

async function bundle(entrypoint: string, outName: string) {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir: 'dist',
    naming: outName,
    format: 'esm',
    target: 'browser',
    splitting: true,
    minify: false,
    external,
  })

  if (!result.success) {
    console.error(`${outName} build failed:`)
    for (const msg of result.logs) console.error(msg)
    process.exit(1)
  }

  const totalKb = result.outputs.reduce((sum, o) => sum + o.size, 0) / 1024
  console.log(`  -> ${outName} (${totalKb.toFixed(1)} KB total, ${result.outputs.length} chunk(s))`)
}

await bundle('src/index.ts', 'module.js')
