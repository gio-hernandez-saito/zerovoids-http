import { bench, describe } from "vitest";
import { buildFixtures } from "../fixtures.js";

const { rawCall, pipelineCall } = buildFixtures();

describe("cold-call overhead (mock transport, no network)", () => {
	bench("baseline: raw transport call", async () => {
		await rawCall();
	});

	bench("zerovoids: createClient pipeline", async () => {
		await pipelineCall();
	});
});
