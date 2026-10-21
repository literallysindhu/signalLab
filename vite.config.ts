/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 800, // recharts alone is ~500 kB minified
    rollupOptions: {
      output: { manualChunks: { react: ['react', 'react-dom'], charts: ['recharts'] } },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
