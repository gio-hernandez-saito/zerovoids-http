export type NormalizedErrorKind =
	| "network"
	| "timeout"
	| "http"
	| "validation"
	| "domain"
	| "canceled";

export type NormalizedErrorTrace = {
	readonly requestId: string;
	readonly url: string;
	readonly method: string;
	readonly attempt: number;
};

export type NormalizedErrorInput = {
	kind: NormalizedErrorKind;
	code: string;
	httpStatus?: number;
	retryable: boolean;
	retryAfterMs?: number;
	cause: unknown;
	trace: NormalizedErrorTrace;
};

export class NormalizedError extends Error {
	readonly kind: NormalizedErrorKind;
	readonly code: string;
	readonly httpStatus?: number;
	readonly retryable: boolean;
	readonly retryAfterMs?: number;
	override readonly cause: unknown;
	readonly trace: NormalizedErrorTrace;

	constructor(input: NormalizedErrorInput) {
		super(
			`[${input.kind}:${input.code}] ${input.trace.method} ${input.trace.url}`,
			{ cause: input.cause },
		);
		this.name = "NormalizedError";
		this.kind = input.kind;
		this.code = input.code;
		if (input.httpStatus !== undefined) this.httpStatus = input.httpStatus;
		this.retryable = input.retryable;
		if (input.retryAfterMs !== undefined)
			this.retryAfterMs = input.retryAfterMs;
		this.cause = input.cause;
		this.trace = input.trace;
	}

	toJSON() {
		return {
			name: this.name,
			message: this.message,
			kind: this.kind,
			code: this.code,
			httpStatus: this.httpStatus,
			retryable: this.retryable,
			retryAfterMs: this.retryAfterMs,
			trace: this.trace,
		};
	}
}

export function createNormalizedError(
	input: NormalizedErrorInput,
): NormalizedError {
	return new NormalizedError(input);
}
