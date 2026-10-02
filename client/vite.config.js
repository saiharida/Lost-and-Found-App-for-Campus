import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // <--- Allows your phone to connect over Wi-Fi
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001', // Vite on your computer forwards this to your backend
        changeOrigin: true,
      },
    },
  },
});