import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/ACNH_island_design_maker/',
  build: {
    outDir: 'dist'
  }
})