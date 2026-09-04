import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/Cyborg/',
  plugins: [react()],
  resolve: {
    alias: {
      'sam-reciter': path.resolve(
        __dirname,
        'node_modules/sam-js/src/reciter/reciter.es6',
      ),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('cmu-pronouncing-dictionary')) {
            return 'cmu-dict'
          }
        },
      },
    },
  },
})
