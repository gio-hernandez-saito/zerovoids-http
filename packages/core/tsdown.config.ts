import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // Fail the build if the published package would be malformed (publint) or its
  // types would resolve incorrectly across ESM/CJS consumers (are-the-types-wrong).
  publint: true,
  attw: true,
})
