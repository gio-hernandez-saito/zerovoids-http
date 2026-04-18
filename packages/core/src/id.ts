export function generateRequestId(): string {
	const cryptoGlobal =
		typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
	if (cryptoGlobal && typeof cryptoGlobal.randomUUID === "function") {
		return cryptoGlobal.randomUUID();
	}
	const rand = Math.random().toString(36).slice(2, 10);
	return `req_${Date.now().toString(36)}_${rand}`;
}
