import {
	createClient,
	createNormalizedError,
	defineAdapter,
	defineEndpoint,
	typedOutput,
} from "@zerovoids/http";
import { createQueryHooks } from "@zerovoids/http-react-query";

export const github = defineAdapter({
	baseURL: "https://api.github.com",
	defaultHeaders: {
		accept: "application/vnd.github+json",
		"user-agent": "zerovoids-http-nextjs-example",
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
	},
});

export const api = createClient({ adapters: { github } });
export const hooks = createQueryHooks(api);
