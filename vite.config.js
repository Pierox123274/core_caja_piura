import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Portal Core Caja Piura — puerto 5173
// app_clientes (Flutter) y app_fuerza_ventas (Flutter) comparten Firestore
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
})
