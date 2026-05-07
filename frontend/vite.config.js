import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const buildId = new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace(/[-:TZ.]/g, '').slice(0, 12)

export default defineConfig({
  root: 'frontend',
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, '.')
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Keep api.js in its own chunk to prevent Rollup renaming issues
          if (id.includes('/utils/api.js')) {
            return 'api-utils'
          }
          // vue-vendor chunk
          if (id.includes('node_modules/vue') || id.includes('node_modules/pinia') || id.includes('node_modules/@vueuse')) {
            return 'vue-vendor'
          }
          // Settings sub-pages — always reached together; ship as one chunk
          // so a single prefetch warms all of them.
          if (
            id.includes('/components/Appearance.vue') ||
            id.includes('/components/AccountManager.vue') ||
            id.includes('/components/ChangePassword.vue')
          ) {
            return 'settings-pages'
          }
        },
      },
    }
  },
  define: {
    __VUE_PROD_API_BASE__: JSON.stringify(process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080'),
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD_ID__: JSON.stringify(buildId)
  }
})
