import type { HttpMethod, StandardSchemaV1 } from "./types.js";

type StripExt<S extends string> = S extends `${infer N}.${string}` ? N : S;

/**
 * Extract `:param` names from a path string into a params object type.
 *
 * Handles:
 *   - multiple params: `/repos/:owner/:repo`
 *   - params followed by `.ext`: `/item/:id.json` → `{ id }`
 *
 * @example
 * ExtractPathParams<"/repos/:owner/:repo"> → { owner: string|number; repo: string|number }
 * ExtractPathParams<"/item/:id.json"> → { id: string|number }
 * ExtractPathParams<"/users"> → Record<string, never>
 */
export type ExtractPathParams<P extends string> = string extends P
	? Record<string, string | number>
	: P extends `${string}:${infer Param}/${infer Rest}`
		? {
				[K in StripExt<Param>]: string | number;
			} & ExtractPathParams<`/${Rest}`>
		: P extends `${string}:${infer Param}.${string}`
			? { [K in Param]: string | number }
			: P extends `${string}:${infer Param}`
				? { [K in Param]: string | number }
				: Record<string, never>;

export type EndpointDefinition<
	Path extends string = string,
	Body = unknown,
	Output = unknown,
	Query = unknown,
> = {
	method: HttpMethod;
	path: Path;
	body?: StandardSchemaV1<Body>;
	query?: StandardSchemaV1<Query>;
	headers?: StandardSchemaV1;
	output?: StandardSchemaV1<unknown, Output>;
};

export function defineEndpoint<
	const Path extends string,
	Body = unknown,
	Output = unknown,
	Query = unknown,
>(
	def: EndpointDefinition<Path, Body, Output, Query>,
): EndpointDefinition<Path, Body, Output, Query> {
	return def;
}
