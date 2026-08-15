import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Proxy dev: semua request /api diteruskan ke backend Express (PORT 4112,
    // lihat .env root). Dengan proxy, cookie httpOnly terkirim tanpa CORS manual.
    proxy: {
      '/api': {
        target: 'http://localhost:4112',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Vite 8 (rolldown) mengharuskan manualChunks berupa fungsi, bukan object
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('@phosphor-icons')) return 'icons';
            return 'vendor';
          }
        },
      },
    },
  },
});
