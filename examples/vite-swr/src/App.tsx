import { isNormalizedError, isRateLimited } from "@zerovoids/http";
import { useState } from "react";
import { hooks } from "./client";

export function App() {
	const [owner, setOwner] = useState("vercel");
	const [repo, setRepo] = useState("next.js");

	return (
		<main
			style={{
				fontFamily: "system-ui, sans-serif",
				padding: 24,
				maxWidth: 640,
			}}
		>
			<h1>@zerovoids/http × Vite × SWR</h1>
			<p>
				SWR 어댑터를 통해 GitHub API 를 호출합니다. 에러는 `NormalizedError` 로
				정규화되어 <code>error.kind</code> 기반 분기가 가능합니다.
			</p>

			<form
				onSubmit={(e) => e.preventDefault()}
				style={{ display: "flex", gap: 8, marginBottom: 16 }}
			>
				<input
					aria-label="owner"
					value={owner}
					onChange={(e) => setOwner(e.target.value)}
					style={{ flex: 1 }}
				/>
				<input
					aria-label="repo"
					value={repo}
					onChange={(e) => setRepo(e.target.value)}
					style={{ flex: 1 }}
				/>
			</form>

			<RepoCard owner={owner} repo={repo} />
		</main>
	);
}

function RepoCard({ owner, repo }: { owner: string; repo: string }) {
	const { data, error, isLoading } = hooks.github.getRepo.useSWR({
		params: { owner, repo },
	});

	if (isLoading)
		return (
			<p>
				Loading {owner}/{repo}…
			</p>
		);

	if (error) {
		if (isRateLimited(error)) {
			return (
				<p>
					rate-limited — retry in{" "}
					{Math.round((error.retryAfterMs ?? 60_000) / 1000)}s
				</p>
			);
		}
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
		<article style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
			<h2 style={{ margin: 0 }}>{data.full_name}</h2>
			<p>{data.description ?? "(no description)"}</p>
			<p>
				⭐ <strong>{data.stargazers_count.toLocaleString()}</strong>
			</p>
		</article>
	);
}
