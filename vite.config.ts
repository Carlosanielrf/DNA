import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages project site: https://carlosanielrf.github.io/DNA/
  base: process.env.VITE_BASE ?? '/DNA/',
})
