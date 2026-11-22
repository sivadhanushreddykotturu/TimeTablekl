// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

let appBuildId = Date.now().toString(36)
try {
  const versionPath = path.resolve(__dirname, 'public/version.json')
  if (fs.existsSync(versionPath)) {
    const raw = JSON.parse(fs.readFileSync(versionPath, 'utf-8'))
    if (raw.buildId) appBuildId = raw.buildId
  }
} catch (e) {
  // fallback to runtime generated id
}

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true, // 🚀 FORCE PURGE OLD SERVICE WORKERS ON NEW LIVE DEPLOY
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/version.json', '**/announcements.json'],
        runtimeCaching: [
          {
            urlPattern: /.*(?:version|announcements)\.json/i,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          }
        ]
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'KL Timetable',
        short_name: 'KL Timetable',
        description: 'A Progressive Web App for KL University timetable management',
        theme_color: '#0d0d0d',
        background_color: '#0d0d0d',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-v2-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-v2-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          { name: 'Today', short_name: 'Today', description: "What's on now and next", url: '/home', icons: [{ src: 'icon-v2-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Week timetable', short_name: 'Week', description: 'Your full week', url: '/timetable', icons: [{ src: 'icon-v2-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Attendance', short_name: 'Attendance', description: 'Percentages and bunk planner', url: '/attendance', icons: [{ src: 'icon-v2-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Exams', short_name: 'Exams', description: 'Exam dates and seating', url: '/exam', icons: [{ src: 'icon-v2-192.png', sizes: '192x192', type: 'image/png' }] }
        ],
        categories: ['education', 'productivity'],
        lang: 'en',
        dir: 'ltr'
      }
    })
  ],

  server: {
    port: 5173,
    host: true,
    allowedHosts: [
      '.trycloudflare.com'
    ]
  },

  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Only the framework is pinned to its own long-lived chunk; everything
        // else is split per route by the lazy imports in App.jsx.
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor-react'
          }
        },
        assetFileNames(assetInfo) {
          const ext = assetInfo.name.split('.').pop()
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return 'assets/images/[name]-[hash][extname]'
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return 'assets/fonts/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js'
      }
    },
    chunkSizeWarningLimit: 300,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 2,
        // 🔒 Turned off unstable/unsafe properties that scramble module identity hashes
        unsafe: false,
        unsafe_comps: false,
        unsafe_Function: false,
        unsafe_math: false,
        unsafe_proto: false,
        unsafe_regexp: false,
        unsafe_undefined: false
      },
      mangle: {
        safari10: true,
        toplevel: true
      }
    },
    target: 'es2015',
    assetsInlineLimit: 1024,
    cssCodeSplit: true,
    sourcemap: false
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: ['@vercel/analytics']
  },

  esbuild: {
    drop: ['console', 'debugger'],
    pure: ['console.log', 'console.info', 'console.debug', 'console.warn']
  }
})
