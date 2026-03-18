import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds a self-contained ES module that defines the <domovoy-control-widget>
// custom element. React is bundled inline — no external dependencies needed.
export default defineConfig({
  plugins: [react()],
  // Replace Node.js globals that React references but browsers don't have
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: 'src/widget.tsx',
      formats: ['es'],
      fileName: () => 'widget.js',
    },
    outDir: '../dist',
    emptyOutDir: true,
    // Bundle everything — widget.js must be self-contained
    rollupOptions: {
      external: [],
    },
  },
})
