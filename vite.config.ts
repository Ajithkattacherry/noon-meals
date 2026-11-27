import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// `base: './'` keeps asset URLs relative so the build works on GitHub Pages
// under any repository name (paired with HashRouter for client-side routes).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
