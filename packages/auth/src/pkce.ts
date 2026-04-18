/**
 * OAuth 2.0 PKCE helpers — RFC 7636 (Proof Key for Code Exchange).
 *
 * Stateless utilities for the Authorization Code + PKCE flow. Each call to
 * `createPkceChallenge()` produces a fresh verifier/challenge pair; callers
 * are responsible for persisting the `verifier` on the client (session
 * storage) between redirect and callback.
 *
 * Runtime requirements: `crypto.getRandomValues` + `crypto.subtle.digest`
 * (both available in browsers, Node ≥ 16, Deno, Bun, Cloudflare Workers).
 */

export type PkceChallenge = {
	/** Random 43–128 char string the client keeps secret until token exchange. */
	verifier: string;
	/** base64url(SHA-256(verifier)) — goes to the authorization server in step 1. */
	challenge: string;
	/** Always `"S256"` — the only method we emit; `"plain"` is intentionally unsupported. */
	method: "S256";
};

const UNRESERVED =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

function base64UrlFromBytes(bytes: Uint8Array): string {
	let bin = "";
	for (let i = 0; i < bytes.byteLength; i++) {
		bin += String.fromCharCode(bytes[i] as number);
	}
	const b64 =
		typeof btoa !== "undefined"
			? btoa(bin)
			: Buffer.from(bytes).toString("base64");
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generate a cryptographically random PKCE verifier. The spec allows 43–128
 * unreserved characters; we default to 64 — long enough to resist guessing,
 * short enough to fit common storage quotas.
 */
export function generateVerifier(length = 64): string {
	if (length < 43 || length > 128) {
		throw new RangeError(
			`@zerovoids/http-auth: PKCE verifier length must be 43–128 (got ${length})`,
		);
	}
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	let out = "";
	for (let i = 0; i < length; i++) {
		out += UNRESERVED[(bytes[i] as number) % UNRESERVED.length];
	}
	return out;
}

/**
 * Derive the `S256` code_challenge from a verifier. Consumers rarely call
 * this directly — `createPkceChallenge()` wraps both steps.
 */
export async function deriveChallenge(verifier: string): Promise<string> {
	const data = new TextEncoder().encode(verifier);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return base64UrlFromBytes(new Uint8Array(hash));
}

/**
 * One-call helper: generate a fresh verifier + S256 challenge pair.
 */
export async function createPkceChallenge(
	verifierLength = 64,
): Promise<PkceChallenge> {
	const verifier = generateVerifier(verifierLength);
	const challenge = await deriveChallenge(verifier);
	return { verifier, challenge, method: "S256" };
}
