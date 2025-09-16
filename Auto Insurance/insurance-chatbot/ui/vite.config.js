 import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
plugins: [react()],
server: {
// Do not proxy /v1 here; the app calls the middle tier on VITE_ML_PORT (4004)
proxy: {
// other dev proxies (if any) can remain
},
},
});