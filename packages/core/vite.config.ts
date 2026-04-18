import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
	plugins: [
		dts({
			include: ["src/**/*"],
			exclude: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"],
			rollupTypes: false,
		}),
	],
	build: {
		outDir: "dist",
		sourcemap: true,
		minify: false,
		rollupOptions: {
			input: { index: resolve(__dirname, "src/index.ts") },
			preserveEntrySignatures: "strict",
			output: [
				{
					format: "es",
					entryFileNames: "[name].js",
					dir: "dist",
					exports: "named",
					preserveModules: false,
				},
				{
					format: "cjs",
					entryFileNames: "[name].cjs",
					dir: "dist",
					exports: "named",
					preserveModules: false,
				},
			],
		},
	},
});
