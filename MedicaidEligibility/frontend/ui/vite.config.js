import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // <-- Make sure 'path' is imported

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    }
  },
  // ADD THIS NEW SECTION
  server: {
    fs: {
      // This tells Vite it's OK to serve files from the parent
      // 'Medicaid Eligibility' directory, which includes ml-fasttrack
      allow: [
        path.resolve(__dirname, '../../'),
                path.resolve('C:/Users/smeldon/node_modules'),
      ]
    }
  }
})