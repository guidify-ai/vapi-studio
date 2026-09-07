import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: resolve(__dirname, '../dist/studio-ui'),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/flow': 'http://127.0.0.1:9998',
      '/conversations': 'http://127.0.0.1:9998',
      '/analytics': 'http://127.0.0.1:9998',
      '/studio': 'http://127.0.0.1:9998',
      '/health': 'http://127.0.0.1:9998',
    },
  },
});
