import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/__bench__/**/*.bench.ts"],
		benchmark: {
			include: ["src/__bench__/**/*.bench.ts"],
		},
	},
});
