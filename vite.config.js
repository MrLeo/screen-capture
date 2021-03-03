import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
const { resolve } = require('path')

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV==='production' ? '/screen-capture/': './',
  build: {
    outDir: 'screen-capture',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html')
      }
    }
  },
  plugins: [vue()],
})
