import { describe, expect, it } from "vitest";
import {
	type PaginationStrategy,
	defineAdapter,
	defineEndpoint,
	parseLinkHeader,
} from "../index.js";

describe("parseLinkHeader", () => {
	it("returns null for null / empty input", () => {
		expect(parseLinkHeader(null)).toBeNull();
		expect(parseLinkHeader("")).toBeNull();
	});

	it("extracts next URL from github-style Link header", () => {
		const value =
			'<https://api.github.com/user/repos?page=2>; rel="next", <https://api.github.com/user/repos?page=5>; rel="last"';
		expect(parseLinkHeader(value)).toBe(
			"https://api.github.com/user/repos?page=2",
		);
	});

	it("honors custom rel", () => {
		const value =
			'<https://x/a?page=1>; rel="prev", <https://x/a?page=3>; rel="next"';
		expect(parseLinkHeader(value, "prev")).toBe("https://x/a?page=1");
	});

	it("returns null when rel is absent", () => {
		expect(parseLinkHeader('<https://x/a>; rel="last"', "next")).toBeNull();
	});

	it("accepts unquoted rel form", () => {
		expect(parseLinkHeader("<https://x/a?page=2>; rel=next")).toBe(
			"https://x/a?page=2",
		);
	});
});

describe("AdapterDefinition.pagination", () => {
	it("accepts cursor pagination (type-only)", () => {
		const strategy: PaginationStrategy<{ cursor: string | null }> = {
			type: "cursor",
			cursorParam: "after",
			getNextCursor: (r) => r.cursor,
		};
		const a = defineAdapter({
			baseURL: "https://x",
			pagination: strategy,
			endpoints: { list: defineEndpoint({ method: "GET", path: "/l" }) },
		});
		expect(a.pagination?.type).toBe("cursor");
	});

	it("accepts offset pagination", () => {
		const a = defineAdapter({
			baseURL: "https://x",
			pagination: {
				type: "offset",
				pageParam: "page",
				limitParam: "per_page",
				defaultLimit: 30,
			},
			endpoints: { list: defineEndpoint({ method: "GET", path: "/l" }) },
		});
		expect(a.pagination?.type).toBe("offset");
	});

	it("accepts link-header pagination", () => {
		const a = defineAdapter({
			baseURL: "https://x",
			pagination: { type: "link-header" },
			endpoints: { list: defineEndpoint({ method: "GET", path: "/l" }) },
		});
		expect(a.pagination?.type).toBe("link-header");
	});

	it("accepts custom pagination", () => {
		const a = defineAdapter({
			baseURL: "https://x",
			pagination: {
				type: "custom",
				getNextPageParam: (r: { next: string | null }) => r.next,
			},
			endpoints: { list: defineEndpoint({ method: "GET", path: "/l" }) },
		});
		expect(a.pagination?.type).toBe("custom");
	});
});
