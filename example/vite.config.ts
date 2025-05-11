import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-ignore
import { fileURLToPath } from 'url'
// @ts-ignore
import * as path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-rerender-guard': path.resolve(__dirname, '../src')
    }
  }
})
