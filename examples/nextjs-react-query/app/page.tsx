import { api } from "@/client";
import {
	HydrationBoundary,
	QueryClient,
	dehydrate,
} from "@tanstack/react-query";
import { queryKeyFor } from "@zerovoids/http-react-query";
import { RepoCard } from "./RepoCard";

const OWNER = "vercel";
const REPO = "next.js";

export default async function Home() {
	// Server-side prefetch — shares the same cache key as the client hook
	// via `queryKeyFor`, so hydration is a cache hit.
	const qc = new QueryClient();
	await qc.prefetchQuery({
		queryKey: queryKeyFor("github", "getRepo", {
			params: { owner: OWNER, repo: REPO },
		}),
		queryFn: async () => {
			const { data, error } = await api.github.getRepo({
				params: { owner: OWNER, repo: REPO },
			});
			if (error) throw error;
			return data;
		},
	});

	return (
		<main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
			<h1>@zerovoids/http × Next.js × React Query</h1>
			<p>
				Rendered on the server via `prefetchQuery`, hydrated on the client via{" "}
				`useQuery`. Both paths go through the same vendor adapter + errorMap.
			</p>
			<HydrationBoundary state={dehydrate(qc)}>
				<RepoCard owner={OWNER} repo={REPO} />
			</HydrationBoundary>
		</main>
	);
}
