import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [".ngrok-free.app", ".ngrok-free.dev"],
    proxy: {
      // "api" resolves via the docker-compose network; override API_PROXY_TARGET
      // when running this dev server directly on the host instead of in Docker.
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://api:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
})
