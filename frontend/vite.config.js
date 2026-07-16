import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@fullcalendar')) return 'fullcalendar';
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'charts';
          // Keep bootstrap CSS in the main chunk: a separate CSS chunk is linked
          // after app CSS, letting bootstrap override our theme/component styles.
          if (id.includes('bootstrap') && !id.endsWith('.css')) return 'bootstrap';
          if (
            id.includes('/react/')
            || id.includes('/react-dom/')
            || id.includes('react-router')
            || id.includes('/scheduler/')
          ) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
