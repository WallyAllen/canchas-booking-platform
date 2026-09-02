import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    server: { deps: { inline: [/@csstools\/css-calc/, /std-env/] } },
    setupFiles: ['./test/setup.ts'],
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
    include: ['**/*.test.{ts,tsx}'],
  },
})
