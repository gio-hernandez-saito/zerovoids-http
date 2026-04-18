/**
 * StandardSchema v1 subset — structural type only, no runtime import.
 * Accepts zod / valibot / arktype instances that implement the spec.
 */
export type StandardSchemaV1<Input = unknown, Output = Input> = {
	readonly "~standard": {
		readonly version: 1;
		readonly vendor: string;
		readonly validate: (value: unknown) =>
			| { value: Output }
			| {
					issues: ReadonlyArray<{
						message: string;
						path?: ReadonlyArray<PropertyKey>;
					}>;
			  }
			| Promise<
					| { value: Output }
					| {
							issues: ReadonlyArray<{
								message: string;
								path?: ReadonlyArray<PropertyKey>;
							}>;
					  }
			  >;
		readonly types?: { readonly input: Input; readonly output: Output };
	};
};

export type HttpMethod =
	| "GET"
	| "POST"
	| "PUT"
	| "PATCH"
	| "DELETE"
	| "HEAD"
	| "OPTIONS";

export type TransportRequest = {
	url: string;
	method: HttpMethod;
	headers: Headers;
	body?: BodyInit | null;
	signal?: AbortSignal;
	credentials?: RequestCredentials;
	mode?: RequestMode;
	cache?: RequestCache;
	extra?: Record<string, unknown>;
};

export type TransportResponse = {
	status: number;
	headers: Headers;
	body: ArrayBuffer | ReadableStream | string | null;
};

export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

export type RetryStrategy =
	| number
	| {
			type: "linear";
			attempts: number;
			delay: number;
			shouldRetry?: (res: TransportResponse | null) => boolean;
			onRetry?: (res: TransportResponse | null, attempt: number) => void;
	  }
	| {
			type: "exponential";
			attempts: number;
			baseDelay: number;
			maxDelay: number;
			shouldRetry?: (res: TransportResponse | null) => boolean;
			onRetry?: (res: TransportResponse | null, attempt: number) => void;
	  };
