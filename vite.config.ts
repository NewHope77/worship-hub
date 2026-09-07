import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.GH_PAGES === '1' ? '/worship-hub/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Worship Hub',
        short_name: 'Worship',
        description: 'Пісні прославлення: тексти, акорди, сет-листи',
        theme_color: '#0f1115',
        background_color: '#0f1115',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'uk',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          // Окрема версія для систем, які обрізають іконку під свою форму:
          // фон на всю площу, а нота менша й по центру, щоб її не зрізало
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        /*
         * Без цих двох рядків нова версія чекає, доки закриються всі вкладки
         * застосунку. Встановлений PWA телефон тримає в пам'яті, тож оновлення
         * могло не доходити тижнями — група лишалась би на старій версії.
         */
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
