export function timeoutSignal(ms: number): AbortSignal {
	if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
	const controller = new AbortController();
	const reason = new Error(`timeout after ${ms}ms`);
	reason.name = "TimeoutError";
	setTimeout(() => controller.abort(reason), ms);
	return controller.signal;
}

export function anySignal(
	signals: ReadonlyArray<AbortSignal | undefined>,
): AbortSignal {
	const filtered = signals.filter((s): s is AbortSignal => s !== undefined);
	if (filtered.length === 0) return new AbortController().signal;
	if (filtered.length === 1) {
		const only = filtered[0];
		if (only) return only;
	}
	const anyFn = (
		AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }
	).any;
	if (typeof anyFn === "function") return anyFn(filtered);

	const controller = new AbortController();
	for (const s of filtered) {
		if (s.aborted) {
			controller.abort(s.reason);
			return controller.signal;
		}
		s.addEventListener("abort", () => controller.abort(s.reason), {
			once: true,
		});
	}
	return controller.signal;
}

export function isTimeoutAbort(reason: unknown): boolean {
	return reason instanceof Error && reason.name === "TimeoutError";
}
