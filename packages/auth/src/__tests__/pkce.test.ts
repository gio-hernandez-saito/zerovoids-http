import { describe, expect, it } from "vitest";
import {
	createPkceChallenge,
	deriveChallenge,
	generateVerifier,
} from "../pkce.js";

describe("generateVerifier", () => {
	it("defaults to 64 chars", () => {
		const v = generateVerifier();
		expect(v).toHaveLength(64);
	});

	it("honors custom length within 43–128", () => {
		expect(generateVerifier(43)).toHaveLength(43);
		expect(generateVerifier(128)).toHaveLength(128);
	});

	it("rejects out-of-range lengths (RFC 7636 §4.1)", () => {
		expect(() => generateVerifier(42)).toThrow(/43–128/);
		expect(() => generateVerifier(129)).toThrow(/43–128/);
	});

	it("emits only RFC 3986 unreserved characters", () => {
		const v = generateVerifier();
		expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
	});

	it("is effectively unique across calls", () => {
		const a = generateVerifier();
		const b = generateVerifier();
		expect(a).not.toBe(b);
	});
});

describe("deriveChallenge (S256)", () => {
	it("is deterministic for the same verifier", async () => {
		const v = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
		const a = await deriveChallenge(v);
		const b = await deriveChallenge(v);
		expect(a).toBe(b);
	});

	it("matches the RFC 7636 appendix-B reference vector", async () => {
		// verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
		// expected challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
		const v = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
		expect(await deriveChallenge(v)).toBe(
			"E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
		);
	});

	it("emits base64url (no padding, no +/)", async () => {
		const c = await deriveChallenge("a".repeat(64));
		expect(c).not.toContain("=");
		expect(c).not.toContain("+");
		expect(c).not.toContain("/");
	});
});

describe("createPkceChallenge", () => {
	it("returns a consistent verifier/challenge/method triple", async () => {
		const p = await createPkceChallenge();
		expect(p.verifier).toHaveLength(64);
		expect(p.method).toBe("S256");
		expect(p.challenge).toBe(await deriveChallenge(p.verifier));
	});
});
