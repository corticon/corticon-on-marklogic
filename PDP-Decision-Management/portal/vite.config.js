import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom']
    },
    server: {
      port: parseInt(env.VITE_ML_PORT) || 5174,
      proxy: {
        '/api': {
          target: `http://${env.VITE_BACKEND_HOST || 'localhost'}:${env.VITE_BACKEND_PORT || 4005}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          // Required for Server-Sent Events (SSE) streaming — disable response buffering
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              if ((proxyRes.headers['content-type'] || '').includes('text/event-stream')) {
                proxyRes.headers['cache-control'] = 'no-cache'
                proxyRes.headers['x-accel-buffering'] = 'no'
              }
            })
          }
        }
      }
    }
  }
})
