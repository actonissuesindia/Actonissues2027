import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// React SPA build. In dev, /api is proxied to the Express server (port 3001).
// In production, `npm run build` emits to dist/ which the Express server serves.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001'
    }
  },
  build: {
    outDir: 'dist'
  }
});
