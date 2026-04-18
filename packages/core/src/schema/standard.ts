import type { StandardSchemaV1 } from "../types.js";

export async function validateStandard<Input, Output>(
	schema: StandardSchemaV1<Input, Output>,
	value: unknown,
): Promise<
	| { ok: true; value: Output }
	| {
			ok: false;
			issues: ReadonlyArray<{
				message: string;
				path?: ReadonlyArray<PropertyKey>;
			}>;
	  }
> {
	const result = await schema["~standard"].validate(value);
	if ("value" in result) return { ok: true, value: result.value };
	return { ok: false, issues: result.issues };
}

/**
 * Type-only StandardSchema. Passes values through without runtime validation.
 * Use when you want output/body types but don't need runtime parsing.
 */
export function typedOutput<T>(): StandardSchemaV1<unknown, T> {
	return {
		"~standard": {
			version: 1,
			vendor: "@zerovoids/http/typed",
			validate: (value) => ({ value: value as T }),
		},
	};
}

/**
 * Type-only StandardSchema for request input (body/query/headers).
 */
export function typedInput<T>(): StandardSchemaV1<T> {
	return {
		"~standard": {
			version: 1,
			vendor: "@zerovoids/http/typed",
			validate: (value) => ({ value: value as T }),
		},
	};
}
