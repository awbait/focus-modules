/**
 * Build script for example-counter module.
 *
 * React/ReactDOM are marked as external — the host app provides them
 * via an import map, so the browser resolves bare specifiers at runtime.
 */

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
  console.log(`  -> ${outName} built (${(result.outputs[0].size / 1024).toFixed(1)} KB)`)
}

await bundle('src/index.ts', 'widget.js')
await bundle('src/settings.tsx', 'settings.js')
