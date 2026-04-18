export type TokenStorage = {
	get(): string | null | Promise<string | null>;
	set(token: string | null): void | Promise<void>;
};

/**
 * In-memory token storage — suitable for server-side request scopes and tests.
 * Not shared across processes; use `localStorageStorage` on the browser for
 * persistence.
 */
export function memoryStorage(initial: string | null = null): TokenStorage {
	let value = initial;
	return {
		get: () => value,
		set: (t) => {
			value = t;
		},
	};
}

type WebStorageLike = {
	getItem(k: string): string | null;
	setItem(k: string, v: string): void;
	removeItem(k: string): void;
};

/**
 * Thin adapter over `window.localStorage` (or any compatible `Storage`
 * implementation). Falls back to in-memory when none is provided — safe on
 * servers, but persistence is lost.
 */
export function localStorageStorage(
	key: string,
	backend?: WebStorageLike,
): TokenStorage {
	const store =
		backend ??
		(typeof globalThis !== "undefined" &&
		(globalThis as { localStorage?: WebStorageLike }).localStorage
			? (globalThis as { localStorage: WebStorageLike }).localStorage
			: null);
	if (!store) return memoryStorage();
	return {
		get: () => store.getItem(key),
		set: (t) => {
			if (t === null) store.removeItem(key);
			else store.setItem(key, t);
		},
	};
}
