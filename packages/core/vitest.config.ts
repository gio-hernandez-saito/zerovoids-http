import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      // Barrel re-exports and pure type declarations carry no runtime logic.
      exclude: [
        'src/**/__tests__/**',
        'src/index.ts',
        'src/**/types.ts',
        'src/normalize/mapper.ts',
      ],
    },
  },
})
