import { describe, expect, it } from "vitest";
import { decodeBody, isTextLike } from "../decode.js";

describe("decodeBody", () => {
	it("returns null for 204 No Content", async () => {
		expect(await decodeBody("{}", "application/json", 204)).toBeNull();
	});

	it("returns null for 304 Not Modified", async () => {
		expect(await decodeBody("{}", "application/json", 304)).toBeNull();
	});

	it("returns null for null body", async () => {
		expect(await decodeBody(null, null, 200)).toBeNull();
	});

	it("parses JSON string body", async () => {
		const r = await decodeBody('{"a":1}', "application/json", 200);
		expect(r).toEqual({ a: 1 });
	});

	it("returns text for text/* content-type", async () => {
		expect(await decodeBody("hello", "text/plain", 200)).toBe("hello");
	});

	it("returns empty body as null even for 200", async () => {
		expect(await decodeBody("", "application/json", 200)).toBeNull();
	});

	it("falls back to raw text when JSON is malformed", async () => {
		expect(await decodeBody("not json", "application/json", 200)).toBe(
			"not json",
		);
	});

	it("decodes ArrayBuffer as text when content-type is text-like", async () => {
		const buf = new TextEncoder().encode('{"n":2}').buffer as ArrayBuffer;
		const r = await decodeBody(buf, "application/json", 200);
		expect(r).toEqual({ n: 2 });
	});

	it("returns ArrayBuffer unchanged for binary content-type", async () => {
		const buf = new Uint8Array([1, 2, 3]).buffer;
		const r = await decodeBody(buf, "application/octet-stream", 200);
		expect(r).toBe(buf);
	});
});

describe("isTextLike", () => {
	it("recognizes JSON, text/*, +json, +xml", () => {
		expect(isTextLike("application/json")).toBe(true);
		expect(isTextLike("application/json; charset=utf-8")).toBe(true);
		expect(isTextLike("text/html")).toBe(true);
		expect(isTextLike("application/vnd.api+json")).toBe(true);
		expect(isTextLike("application/atom+xml")).toBe(true);
	});

	it("returns false for binary / null", () => {
		expect(isTextLike("application/octet-stream")).toBe(false);
		expect(isTextLike(null)).toBe(false);
	});
});
