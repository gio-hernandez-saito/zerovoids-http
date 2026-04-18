import { describe, expect, it } from "vitest";
import { composePath, serializeQuery } from "../url.js";

describe("composePath", () => {
	it("joins baseURL and absolute path", () => {
		expect(composePath("https://api.example.com", "/users")).toBe(
			"https://api.example.com/users",
		);
	});

	it("joins baseURL with trailing slash and absolute path", () => {
		expect(composePath("https://api.example.com/", "/users")).toBe(
			"https://api.example.com/users",
		);
	});

	it("joins baseURL and relative path", () => {
		expect(composePath("https://api.example.com", "users")).toBe(
			"https://api.example.com/users",
		);
	});

	it("substitutes :param placeholders with encoding", () => {
		expect(
			composePath("https://api.example.com", "/repos/:owner/:repo", {
				owner: "octo cat",
				repo: "hello",
			}),
		).toBe("https://api.example.com/repos/octo%20cat/hello");
	});

	it("appends query string", () => {
		expect(
			composePath("https://api.example.com", "/users", undefined, {
				page: 1,
				limit: 20,
			}),
		).toBe("https://api.example.com/users?page=1&limit=20");
	});

	it("returns no ? when all query values are undefined", () => {
		expect(
			composePath("https://api.example.com", "/users", undefined, {
				a: undefined,
				b: null,
			}),
		).toBe("https://api.example.com/users");
	});
});

describe("serializeQuery", () => {
	it("skips null / undefined", () => {
		expect(serializeQuery({ a: 1, b: undefined, c: null })).toBe("a=1");
	});

	it("repeats key for arrays", () => {
		expect(serializeQuery({ tag: ["a", "b", "c"] })).toBe("tag=a&tag=b&tag=c");
	});

	it("encodes special chars", () => {
		expect(serializeQuery({ q: "hello world & more" })).toBe(
			"q=hello%20world%20%26%20more",
		);
	});
});
