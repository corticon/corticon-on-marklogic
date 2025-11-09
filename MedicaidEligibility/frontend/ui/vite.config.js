import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    }
  },
  server: {
    proxy: {
      // Proxy API requests to your Node.js express server
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
      },
      // Also proxy direct MarkLogic calls if you need them, though /api is better
      '/v1': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false,
      }
    },
    fs: {
      allow: [
        path.resolve(__dirname, '../../'),
        path.resolve('C:/Users/smeldon/node_modules'),
      ]
    }
  }
})