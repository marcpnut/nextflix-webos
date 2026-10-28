import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'chrome53',
    cssTarget: 'chrome53',
    modulePreload: false,
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        format: 'iife',
        name: 'NextFlix',
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'assets/[name].js'
      }
    }
  }
});
