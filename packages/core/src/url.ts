export function composePath(
	baseURL: string,
	path: string,
	params?: Readonly<Record<string, string | number>>,
	query?: Readonly<Record<string, unknown>>,
): string {
	let p = path;
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			p = p.replace(`:${k}`, encodeURIComponent(String(v)));
		}
	}
	const base = baseURL.replace(/\/+$/, "");
	const joined = p.startsWith("/") ? base + p : `${base}/${p}`;
	if (!query) return joined;
	const qs = serializeQuery(query);
	return qs ? `${joined}?${qs}` : joined;
}

export function serializeQuery(
	query: Readonly<Record<string, unknown>>,
): string {
	const parts: string[] = [];
	for (const [k, v] of Object.entries(query)) {
		if (v === undefined || v === null) continue;
		if (Array.isArray(v)) {
			for (const item of v) {
				if (item === undefined || item === null) continue;
				parts.push(
					`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`,
				);
			}
		} else {
			parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
		}
	}
	return parts.join("&");
}
