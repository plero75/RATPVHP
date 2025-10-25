import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // 🧭 IMPORTANT : base doit pointer vers le sous-dossier GitHub Pages
  // pour que les chemins des assets (CSS/JS) soient corrects
  base: '/RATPVHP/',

  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './components'),
      '@services': path.resolve(__dirname, './services'),
      '@hooks': path.resolve(__dirname, './hooks'),
      '@types': path.resolve(__dirname, './types.ts'),
      '@constants': path.resolve(__dirname, './constants.ts')
    }
  },

  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,   // 🧹 Nettoie le dossier avant chaque build
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          api: ['./services/api']
        }
      }
    }
  },

  server: {
    port: 3000,
    open: true,
    cors: true
  },

  optimizeDeps: {
    include: ['react', 'react-dom']
  }
})
