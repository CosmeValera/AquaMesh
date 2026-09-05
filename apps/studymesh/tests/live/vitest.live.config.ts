import { defineConfig } from 'vitest/config'

// Live harnesses only. They spend real credits, so they are kept out of the
// unit config's include pattern and run by hand with this config.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['./tests/live/**/*.live.ts'],
    testTimeout: 15 * 60 * 1000,
    hookTimeout: 15 * 60 * 1000,
  },
})
