"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

// Per TanStack Query SSR guidance: one QueryClient per request on the server,
// one singleton on the browser. `useState` lazy-init satisfies both because
// Next re-renders the client tree with a fresh closure per request.
function makeClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60_000,
				refetchOnWindowFocus: false,
			},
		},
	});
}

export function Providers({ children }: { children: ReactNode }) {
	const [queryClient] = useState(makeClient);
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
