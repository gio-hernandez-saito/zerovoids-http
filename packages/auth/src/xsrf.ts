import type { HttpMethod, Plugin } from "@zerovoids/http";

export type XsrfOptions = {
	/** Cookie name to read the CSRF value from. Default: `XSRF-TOKEN`. */
	cookieName?: string;
	/** Header name to copy the value into. Default: `X-XSRF-TOKEN`. */
	headerName?: string;
	/**
	 * Methods that should carry the XSRF header. Default: state-changing verbs
	 * (POST / PUT / PATCH / DELETE). `GET`/`HEAD` are skipped to avoid caching
	 * complications and because they should be idempotent.
	 */
	methods?: ReadonlyArray<HttpMethod>;
	/**
	 * Read a cookie value by name. Default: parses `document.cookie` when
	 * available, returns `null` otherwise (SSR-safe).
	 */
	readCookie?: (name: string) => string | null;
};

const WRITE_METHODS: ReadonlyArray<HttpMethod> = [
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
];

export function defaultCookieReader(name: string): string | null {
	const g = globalThis as { document?: { cookie?: string } };
	const raw = g.document?.cookie;
	if (!raw) return null;
	const needle = `${name}=`;
	for (const part of raw.split(";")) {
		const s = part.trim();
		if (s.startsWith(needle)) {
			return decodeURIComponent(s.slice(needle.length));
		}
	}
	return null;
}

/**
 * Cookie→Header XSRF synchronization (double-submit cookie pattern).
 *
 * Reads `XSRF-TOKEN` cookie on each write request and copies the value to the
 * `X-XSRF-TOKEN` header. Servers that follow the standard pattern (Django,
 * Rails, Laravel, axios default) can compare cookie vs header to validate the
 * request origin.
 */
export function xsrf(options: XsrfOptions = {}): Plugin {
	const cookieName = options.cookieName ?? "XSRF-TOKEN";
	const headerName = (options.headerName ?? "X-XSRF-TOKEN").toLowerCase();
	const methods = new Set<HttpMethod>(options.methods ?? WRITE_METHODS);
	const readCookie = options.readCookie ?? defaultCookieReader;
	return {
		id: "auth:xsrf",
		name: "xsrf",
		init: async (url, request) => {
			if (!methods.has(request.method)) return { url, options: request };
			if (request.headers.has(headerName)) return { url, options: request };
			const value = readCookie(cookieName);
			if (value) request.headers.set(headerName, value);
			return { url, options: request };
		},
	};
}
