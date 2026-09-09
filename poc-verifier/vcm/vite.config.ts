import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// The build output is served by the existing Express server (poc-verifier)
// from public/vcm, so the base path must match the mount point.
export default defineConfig({
  base: '/vcm/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    outDir: '../public/vcm',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // Reserved for future backend integration; the dashboard uses mock data only.
      '/api': 'http://localhost:3000',
    },
  },
});
