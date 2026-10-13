import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ECONNABORTED') {
              return;
            }
            console.warn('[vite] http proxy error:', err.message);
          });
        },
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED') {
              return;
            }
            console.warn('[vite] ws proxy error:', err.message);
          });
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    globals: true,
  }
})
