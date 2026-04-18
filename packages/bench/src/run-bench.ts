import { performance } from "node:perf_hooks";
import { buildFixtures } from "./fixtures.js";

/**
 * Standalone p50/p99 harness (no vitest). Exists so CI can gate on absolute
 * numbers without parsing vitest-bench table output. Run: `pnpm bench:cli`.
 */

const WARMUP = 2_000;
const SAMPLES = 20_000;

async function measure(
	label: string,
	fn: () => Promise<unknown>,
): Promise<void> {
	// Warmup — let JITs stabilize and async microtasks settle.
	for (let i = 0; i < WARMUP; i++) await fn();

	const timings: number[] = new Array(SAMPLES);
	for (let i = 0; i < SAMPLES; i++) {
		const t0 = performance.now();
		await fn();
		timings[i] = performance.now() - t0;
	}
	timings.sort((a, b) => a - b);

	const pct = (p: number) =>
		timings[Math.min(SAMPLES - 1, Math.floor((p / 100) * SAMPLES))] ?? 0;

	console.log(
		`${label.padEnd(36)} p50=${pct(50).toFixed(3)}ms  p95=${pct(95).toFixed(3)}ms  p99=${pct(99).toFixed(3)}ms  max=${pct(100).toFixed(3)}ms`,
	);
}

async function main(): Promise<void> {
	const { rawCall, pipelineCall } = buildFixtures();
	console.log(`samples=${SAMPLES}, warmup=${WARMUP}\n`);
	await measure("baseline (raw mock transport)", rawCall);
	await measure("zerovoids pipeline", pipelineCall);
}

main().catch((e: unknown) => {
	console.error(e);
	process.exit(1);
});
