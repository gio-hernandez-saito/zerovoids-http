import {
	createClient,
	defineAdapter,
	defineEndpoint,
	isNormalizedError,
	isRateLimited,
	isRetryable,
	isServerError,
	typedOutput,
} from "@zerovoids/http";
import { kyTransport } from "@zerovoids/http-transport-ky";

const github = defineAdapter({
	baseURL: "https://api.github.com",
	defaultHeaders: {
		accept: "application/vnd.github+json",
		"user-agent": "zerovoids-http-cli-example",
	},
	endpoints: {
		getRepo: defineEndpoint({
			method: "GET",
			path: "/repos/:owner/:repo",
			output: typedOutput<{
				id: number;
				full_name: string;
				stargazers_count: number;
				description: string | null;
			}>(),
		}),
	},
});

const api = createClient({
	adapters: { github },
	transport: kyTransport(),
	timeout: 10_000,
});

async function main() {
	const [owner = "vercel", repo = "next.js"] = process.argv.slice(2);
	const { data, error } = await api.github.getRepo({
		params: { owner, repo },
	});

	if (error) {
		if (isRateLimited(error)) {
			console.error(
				`rate-limited — retry after ${error.retryAfterMs ?? "?"}ms`,
			);
		} else if (isServerError(error)) {
			console.error(`upstream 5xx: ${error.code}`);
		} else if (isRetryable(error)) {
			console.error(`retryable: ${error.kind} ${error.code}`);
		} else {
			console.error(isNormalizedError(error) ? error.toJSON() : String(error));
		}
		process.exit(1);
	}

	console.log(
		`${data.full_name}: ⭐ ${data.stargazers_count.toLocaleString()}`,
	);
	if (data.description) console.log(data.description);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
