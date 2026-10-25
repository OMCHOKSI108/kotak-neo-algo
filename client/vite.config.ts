import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err: any) => {
            if (['ECONNREFUSED', 'ECONNRESET', 'EPIPE'].includes(err.code)) {
              return;
            }
            console.warn('[vite api proxy]:', err.message || err);
          });
        },
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err: any) => {
            // Suppress benign client disconnect / reload socket errors
            if (['EPIPE', 'ECONNRESET', 'ECONNREFUSED'].includes(err.code)) {
              return;
            }
            console.warn('[vite ws proxy]:', err.message || err);
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, socket: any) => {
            socket.on('error', (err: any) => {
              // Suppress socket write abort on rapid page reload or component unmount
              if (['EPIPE', 'ECONNRESET', 'ECONNREFUSED'].includes(err.code)) {
                return;
              }
              console.warn('[vite ws socket]:', err.message || err);
            });
          });
        },
      },
    },
  },
});
