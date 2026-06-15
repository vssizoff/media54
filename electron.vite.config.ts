import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from "vite-plugin-vue-devtools"
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      vue(),
      vueDevTools(),
      nodePolyfills({
        include: ['path', 'fs'],
        protocolImports: true,
        globals: {
          Buffer: true,
          process: true,
        },
      })
    ],
    build: {
      rollupOptions: {
        external: ["wcjs-prebuilt", "wrap-chimera"]
      }
    },
    optimizeDeps: {
      exclude: ["wcjs-prebuilt", "wcjs-player"]
    }
  }
});