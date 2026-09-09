import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend 4000-portda ishlaydi. Dev rejimida barcha /api, /uploads va
// /socket.io so'rovlari shu yerga uzatiladi — shu bilan CORS muammosi
// umuman paydo bo'lmaydi va ilova "bitta manzil"dek ishlaydi.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:4000', ws: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
