import { NormalizedError, type NormalizedErrorKind } from "./normalize.js";

export function isNormalizedError(value: unknown): value is NormalizedError {
	if (value instanceof NormalizedError) return true;
	// Structural fallback — cross-realm (e.g. SSR hydration) or plain-object factory
	if (typeof value !== "object" || value === null) return false;
	const v = value as Partial<NormalizedError>;
	return (
		typeof v.kind === "string" &&
		typeof v.code === "string" &&
		typeof v.retryable === "boolean" &&
		typeof v.trace === "object" &&
		v.trace !== null
	);
}

export function isKind<K extends NormalizedErrorKind>(
	error: NormalizedError,
	kind: K,
): error is NormalizedError & { kind: K } {
	return error.kind === kind;
}

export function exhaustiveGuard(value: never): never {
	throw new Error(`Unhandled NormalizedError kind: ${JSON.stringify(value)}`);
}
