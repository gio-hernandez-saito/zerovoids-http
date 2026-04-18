/**
 * Pagination strategy declaration for an adapter. The core does NOT call into
 * these automatically — it exposes the shape so adapters / consumers can build
 * consistent pagination helpers on top. Three well-known strategies cover
 * 95% of real APIs; custom shapes fall through to `type: "custom"`.
 *
 * These types are intentionally *declarative* (no closures, no runtime state)
 * so a client built with `defineAdapter({ pagination })` remains serializable
 * and tree-shakable.
 */
export type CursorPagination<TResponse = unknown> = {
	type: "cursor";
	/** Query-param name for the cursor on outgoing requests (e.g., "after"). */
	cursorParam: string;
	/** Extract the next-page cursor from a decoded response. `null` → last page. */
	getNextCursor: (response: TResponse) => string | null;
};

export type OffsetPagination = {
	type: "offset";
	/** Query-param name for page number (e.g., "page"). */
	pageParam: string;
	/** Query-param name for page size (e.g., "per_page"). */
	limitParam: string;
	/** Default page size. Consumers may still override at call time. */
	defaultLimit: number;
};

export type LinkHeaderPagination = {
	type: "link-header";
	/** `rel` attribute to follow. Default: `"next"`. */
	rel?: "next" | "prev" | "first" | "last";
};

export type CustomPagination<TResponse = unknown, TCursor = unknown> = {
	type: "custom";
	/** Return next-page input, or `null` when exhausted. */
	getNextPageParam: (response: TResponse) => TCursor | null;
};

export type PaginationStrategy<TResponse = unknown> =
	| CursorPagination<TResponse>
	| OffsetPagination
	| LinkHeaderPagination
	| CustomPagination<TResponse>;

/**
 * Parse an `rfc5988` Link header and return the URL for a given `rel`, or
 * `null`. Shared by GitHub / JIRA / W3C pagination flavours.
 */
export function parseLinkHeader(
	value: string | null,
	rel: LinkHeaderPagination["rel"] = "next",
): string | null {
	if (!value) return null;
	for (const part of value.split(",")) {
		const m = /<([^>]+)>\s*;\s*(.+)/.exec(part.trim());
		if (!m) continue;
		const url = m[1];
		const params = m[2];
		if (url == null || params == null) continue;
		if (new RegExp(`\\brel\\s*=\\s*"?${rel}"?`).test(params)) return url;
	}
	return null;
}
