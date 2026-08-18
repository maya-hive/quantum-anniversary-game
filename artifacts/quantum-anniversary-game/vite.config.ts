import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const isBuild = process.argv.includes('build');
const basePath = process.env.BASE_PATH || '/';

let port: number | undefined;
if (!isBuild) {
  const rawPort = process.env.PORT;
  if (!rawPort) {
    throw new Error(
      'PORT environment variable is required but was not provided.',
    );
  }
  port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    ...(port !== undefined ? { port, strictPort: true } : {}),
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            const socket = res as { headersSent?: boolean; writeHead: (status: number, headers: Record<string, string>) => void; end: (body: string) => void };
            if (!socket.headersSent) {
              socket.writeHead(503, { 'Content-Type': 'application/json' });
              socket.end(
                JSON.stringify({
                  message:
                    'API server is not running on port 8080. Start it with PORT=8080 pnpm --filter @workspace/api-server run dev',
                }),
              );
            }
          });
        },
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    ...(port !== undefined ? { port } : {}),
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
