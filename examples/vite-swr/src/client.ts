import {
	createClient,
	defineAdapter,
	defineEndpoint,
	typedOutput,
} from "@zerovoids/http";
import { createSwrHooks } from "@zerovoids/http-swr";

const github = defineAdapter({
	baseURL: "https://api.github.com",
	defaultHeaders: { accept: "application/vnd.github+json" },
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
export const hooks = createSwrHooks(api);
