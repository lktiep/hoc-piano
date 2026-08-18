import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' -> chay duoc ca o local, GitHub Pages (/repo/) va khi mo bang file://
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
})
