import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'
// nuxt ui
import nuxtUi from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [nuxtUi(), vue()],
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
