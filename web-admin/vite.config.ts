import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': process.env.API_PROXY ?? 'http://localhost:8080',
      '/uploads': process.env.API_PROXY ?? 'http://localhost:8080',
    },
  },
})
