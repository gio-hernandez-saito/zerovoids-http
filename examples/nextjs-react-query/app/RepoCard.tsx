"use client";

import { hooks } from "@/client";
import { isNormalizedError } from "@zerovoids/http";

export function RepoCard({ owner, repo }: { owner: string; repo: string }) {
	const { data, error, isLoading } = hooks.github.getRepo.useQuery({
		params: { owner, repo },
	});

	if (isLoading)
		return (
			<p>
				Loading {owner}/{repo}…
			</p>
		);

	if (error) {
		// `error` is typed as `NormalizedError` — consistent shape no matter which
		// transport/validator is underneath.
		return (
			<pre style={{ color: "crimson" }}>
				{isNormalizedError(error)
					? JSON.stringify(error.toJSON(), null, 2)
					: String(error)}
			</pre>
		);
	}

	if (!data) return null;

	return (
		<article
			style={{
				border: "1px solid #ddd",
				borderRadius: 8,
				padding: 16,
				marginTop: 16,
			}}
		>
			<h2 style={{ margin: 0 }}>{data.full_name}</h2>
			<p>{data.description ?? "(no description)"}</p>
			<p>
				⭐ <strong>{data.stargazers_count.toLocaleString()}</strong>
			</p>
		</article>
	);
}
