export async function decodeBody(
	body: ArrayBuffer | ReadableStream | string | null,
	contentType: string | null,
	status: number,
): Promise<unknown> {
	if (status === 204 || status === 304) return null;
	if (body === null) return null;

	if (typeof body === "string") return parseByContentType(body, contentType);

	if (body instanceof ArrayBuffer) {
		if (isTextLike(contentType)) {
			const text = new TextDecoder().decode(body);
			return parseByContentType(text, contentType);
		}
		return body;
	}

	// ReadableStream — consumer opts-in via .raw() escape hatch (v1)
	return body;
}

export function isTextLike(contentType: string | null): boolean {
	if (!contentType) return false;
	const ct = contentType.toLowerCase();
	return (
		ct.startsWith("application/json") ||
		ct.startsWith("text/") ||
		ct.includes("+json") ||
		ct.includes("+xml")
	);
}

function parseByContentType(text: string, contentType: string | null): unknown {
	if (text === "") return null;
	const ct = contentType?.toLowerCase() ?? "";
	if (ct.startsWith("application/json") || ct.includes("+json")) {
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	}
	return text;
}
