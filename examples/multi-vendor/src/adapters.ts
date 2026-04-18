import {
	createNormalizedError,
	defineAdapter,
	defineEndpoint,
	typedOutput,
} from "@zerovoids/http";

/**
 * GitHub REST API — custom errorMap extracts the `message` field.
 */
export const github = defineAdapter({
	baseURL: "https://api.github.com",
	defaultHeaders: {
		accept: "application/vnd.github+json",
		"user-agent": "zerovoids-http-example",
	},
	errorMap: (raw, ctx) => {
		const msg =
			(raw as { message?: string } | null)?.message ?? `HTTP_${ctx.httpStatus}`;
		return createNormalizedError({
			kind: "http",
			code: msg,
			httpStatus: ctx.httpStatus,
			retryable: ctx.httpStatus >= 500 || ctx.httpStatus === 429,
			cause: raw,
			trace: ctx.trace,
		});
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
		listRepoLanguages: defineEndpoint({
			method: "GET",
			path: "/repos/:owner/:repo/languages",
			output: typedOutput<Record<string, number>>(),
		}),
	},
});

/**
 * HackerNews Firebase API — uses default errorMap (no error body, plain 404).
 */
export const hn = defineAdapter({
	baseURL: "https://hacker-news.firebaseio.com/v0",
	endpoints: {
		getItem: defineEndpoint({
			method: "GET",
			path: "/item/:id.json",
			output: typedOutput<{
				id: number;
				type: "story" | "comment" | "job" | "poll" | "pollopt";
				by?: string;
				title?: string;
				score?: number;
				url?: string;
				time?: number;
			}>(),
		}),
		getTopStories: defineEndpoint({
			method: "GET",
			path: "/topstories.json",
			output: typedOutput<number[]>(),
		}),
	},
});

/**
 * JSONPlaceholder — stable mock API. Uses default errorMap.
 */
export const placeholder = defineAdapter({
	baseURL: "https://jsonplaceholder.typicode.com",
	endpoints: {
		getTodo: defineEndpoint({
			method: "GET",
			path: "/todos/:id",
			output: typedOutput<{
				userId: number;
				id: number;
				title: string;
				completed: boolean;
			}>(),
		}),
	},
});
