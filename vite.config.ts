import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './tests/setupTests.ts'
  }
})
