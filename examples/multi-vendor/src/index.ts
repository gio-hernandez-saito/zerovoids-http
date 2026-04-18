import { createClient, isClientError, isRetryable } from "@zerovoids/http";
import { kyTransport } from "@zerovoids/http-transport-ky";
import { github, hn, placeholder } from "./adapters.js";

type Repo = {
	id: number;
	full_name: string;
	stargazers_count: number;
};
type HnItem = { id: number; title?: string };
type Todo = { id: number; title: string; completed: boolean };

const api = createClient({
	adapters: { github, hn, placeholder },
	retry: { type: "exponential", attempts: 3, baseDelay: 300, maxDelay: 3000 },
	timeout: 10_000,
});

async function demoHappyPath() {
	console.log("\n=== demo: happy path (3 vendors) ===\n");

	const r1 = await api.github.getRepo({
		params: { owner: "sindresorhus", repo: "ky" },
	});
	if (r1.error) throw r1.error;
	const repo = r1.data as Repo;
	console.log(
		`github.getRepo       → ⭐ ${repo.stargazers_count}  ${repo.full_name}`,
	);

	const r2 = await api.hn.getTopStories();
	if (r2.error) throw r2.error;
	const topIds = r2.data as number[];
	const firstId = topIds[0];
	if (firstId !== undefined) {
		const r3 = await api.hn.getItem({ params: { id: firstId } });
		if (r3.error) throw r3.error;
		const story = r3.data as HnItem;
		console.log(`hn.getItem(${firstId})   → ${story.title ?? "(no title)"}`);
	}

	const r4 = await api.placeholder.getTodo({ params: { id: 1 } });
	if (r4.error) throw r4.error;
	const todo = r4.data as Todo;
	console.log(
		`placeholder.getTodo(1) → ${todo.completed ? "✓" : " "} ${todo.title}`,
	);
}

async function demoErrorNormalisation() {
	console.log(
		"\n=== demo: error normalisation (same shape across vendors) ===\n",
	);

	const gh = await api.github.getRepo({
		params: { owner: "nonexistent-user-xyz", repo: "nothing" },
	});
	if (gh.error) {
		console.log("github 404:");
		console.log(
			`  kind=${gh.error.kind}  code="${gh.error.code}"  status=${gh.error.httpStatus}`,
		);
		console.log(
			`  isClientError=${isClientError(gh.error)}  retryable=${isRetryable(gh.error)}`,
		);
	}

	const placeholderMiss = await api.placeholder.getTodo({
		params: { id: 999_999 },
	});
	if (placeholderMiss.error) {
		console.log("jsonplaceholder 404:");
		console.log(
			`  kind=${placeholderMiss.error.kind}  code=${placeholderMiss.error.code}  status=${placeholderMiss.error.httpStatus}`,
		);
		console.log(`  isClientError=${isClientError(placeholderMiss.error)}`);
	}
}

async function demoTransportSwap() {
	console.log("\n=== demo: transport swap (fetch → ky, one line) ===\n");

	const apiKy = createClient({
		adapters: { github },
		transport: kyTransport(),
		timeout: 10_000,
	});

	const r = await apiKy.github.getRepo({
		params: { owner: "sindresorhus", repo: "ky" },
	});
	if (r.error) throw r.error;
	const repo = r.data as Repo;
	console.log(
		`via ky transport: ⭐ ${repo.stargazers_count}  ${repo.full_name}`,
	);
}

async function main() {
	try {
		await demoHappyPath();
		await demoErrorNormalisation();
		await demoTransportSwap();
		console.log("\n✓ multi-vendor demo complete\n");
	} catch (e) {
		console.error("\n✗ demo failed:", e);
		process.exit(1);
	}
}

void main();
